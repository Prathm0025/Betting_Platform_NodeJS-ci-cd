import Bet, { BetDetail } from "./betModel";
import { IBetDetail } from "./betsType";
import createHttpError from "http-errors";
import { NextFunction, Request, Response } from "express";

import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";
import PlayerModel from "../players/playerModel";
import Player from "../players/playerSocket";
import Store from "../store/storeController";
import { users } from "../socket/socket";
import User from "../users/userModel";
import { config } from "../config/config";
import { redisClient } from "../redisclient";

class BetController {

  public async placeBet(
    playerRef: Player,
    betDetails: IBetDetail[],
    amount: number,
    betType: "single" | "combo"
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if the player is connected to the socket
      const playerSocket = users.get(playerRef.username);
      if (!playerSocket) {
        throw new Error(
          "Player must be connected to the socket to place a bet"
        );
      }

      // Find the player by ID and ensure they exist
      const player = await PlayerModel.findById(playerRef.userId).session(
        session
      );
      if (!player) {
        console.log("Player not found");
        throw new Error("Player not found");
      }

      // Ensure the player has enough credits to place the bet
      if (player.credits < amount) {
        throw new Error("Insufficient credits");
      }
      if (amount === 0) {
        throw new Error("Betting amount can't be zero");
      }

      if (betType === "combo") {
        const eventIds = betDetails.map((bet) => bet.event_id);
        const uniqueEventIds = new Set(eventIds);
        if (eventIds.length !== uniqueEventIds.size) {
          throw new Error("Invalid combo!");
        }
      }
      // Check if the player already has a pending bet on the same team
      for (const betDetailData of betDetails) {
        const existingBetDetail = await BetDetail.findOne({
          event_id: betDetailData.event_id,
          bet_on: betDetailData.bet_on,
          status: "pending",
        }).session(session);

        if (existingBetDetail) {
          const bet = await Bet.findById(existingBetDetail.key).session(
            session
          );
          if (!bet) {
            throw new Error("Something went wrong");
          }

          const betPlayer = await PlayerModel.findById(bet.player).session(
            session
          );

          if (betPlayer._id === player._id)
            throw new Error(
              `You already have a pending bet on ${betDetailData.bet_on}.`
            );
        }
      }
      // Deduct the bet amount from the player's credits
      player.credits -= amount;
      await player.save({ session });

      playerSocket.sendData({ type: "CREDITS", credits: player.credits });

      // Manually generate the Bet's _id
      const betId = new mongoose.Types.ObjectId();
      const betDetailIds: mongoose.Types.ObjectId[] = [];
      let cumulativeOdds = 1; // Initialize cumulative odds

      // Loop through each BetDetail and create it
      for (const betDetailData of betDetails) {
        // Calculate the selected team's odds
        const selectedOdds =
          betDetailData.bet_on === "home_team"
            ? betDetailData.home_team.odds
            : betDetailData.away_team.odds;

        cumulativeOdds *= selectedOdds;

        // Create the BetDetail document
        const betDetail = new BetDetail({
          ...betDetailData,
          key: betId,
          status: "pending", // Set the betId as the key in BetDetail
        });

        await betDetail.save({ session });
        betDetailIds.push(betDetail._id); // No need to cast, using mongoose.Types.ObjectId

        // Schedule the job for this BetDetail based on its commence_time
        await this.scheduleBetDetailJob(betDetail);
      }

      // Calculate the possible winning amount
      const possibleWinningAmount = cumulativeOdds * amount;

      // Create the Bet document with the manually generated _id
      const bet = new Bet({
        _id: betId, // Use the manually generated _id
        player: player._id,
        data: betDetailIds, // Store all the BetDetail references
        amount,
        possibleWinningAmount,
        status: "pending",
        retryCount: 0,
        betType,
      });
      await bet.save({ session });

      //send myBets to user for disabling
      const playerBets = await Bet.find({
        player: player._id,
      })
        .session(session)
        .populate("player", "username _id")
        .populate({
          path: "data",
          populate: {
            path: "key",
            select: "event_id sport_title commence_time status",
          },
        });

      playerSocket.sendData({ type: "MYBETS", bets: playerBets });

      let responseMessage;
      if (betType === "single") {
        responseMessage = `Single bet on ${betDetails[0].bet_on === "home_team"
          ? betDetails[0].home_team.name
          : betDetails[0].away_team.name
          } placed successfully!`;
      } else {
        responseMessage = "Combo bet placed sccessfully!";
      }
      playerSocket.sendMessage({
        type: "BET",
        data: responseMessage,
      });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return bet;
    } catch (error) {
      // Rollback the transaction in case of error
      await session.abortTransaction();
      session.endSession();
      console.error("Error placing bet:", error.message);
      playerRef.sendError(error.message);
    }
  }

  private async scheduleBetDetailJob(betDetail: IBetDetail) {
    const commence_time = new Date(betDetail.commence_time);
    const delay = commence_time.getTime() - Date.now();

    try {
      const timestamp = commence_time.getTime() / 1000
      const data = { betId: betDetail._id.toString(), commence_time: new Date(betDetail.commence_time) };

      await redisClient.zadd("waitingQueue", timestamp.toString(), JSON.stringify(data));

      console.log(
        `BetDetail ${betDetail._id.toString()} scheduled successfully with a delay of ${delay}ms`
      );
    } catch (error) {
      console.error(`Failed to schedule bet detail ${betDetail._id.toString()}:`, error);
    }
  }


  private calculatePossibleWinning(data: any) {
    const selectedTeam =
      data.bet_on === "home_team" ? data.home_team : data.away_team;
    const oddsFormat = data.oddsFormat;
    const betAmount = parseFloat(data.amount.toString());

    let possibleWinningAmount = 0;

    switch (oddsFormat) {
      case "decimal":
        possibleWinningAmount = selectedTeam.odds * betAmount;
        break;

      case "american":
        if (selectedTeam.odds > 0) {
          possibleWinningAmount =
            (selectedTeam.odds / 100) * betAmount + betAmount;
        } else {
          possibleWinningAmount =
            (100 / Math.abs(selectedTeam.odds)) * betAmount + betAmount;
        }
        break;

      default:
        console.log("INVALID ODDS FORMAT");
    }

    return possibleWinningAmount;
  }

  private async lockBet(betId: string) {
    const session = await Bet.startSession();
    session.startTransaction();

    try {
      const bet = await Bet.findById(betId).session(session);
      if (bet && bet.status !== "locked") {
        bet.status = "locked";
        await bet.save();
        await session.commitTransaction();
      }
    } catch (error) {
      await session.abortTransaction();
    } finally {
      session.endSession();
    }
  }

  private async processOutcomeQueue(betId: string, result: "won" | "lost") {
    const bet = await Bet.findById(betId);

    if (bet) {
      try {
        bet.status = result;
        await bet.save();
      } catch (error) {
      }
    }
  }

  private async processRetryQueue(betId: string) {
    const bet = await Bet.findById(betId);

    if (bet) {
      try {
        bet.retryCount += 1;
        if (bet.retryCount > 1) {
          bet.status = "lost";
        } else {
          bet.status = "retry";
        }
        await bet.save();
      } catch (error) {
      }
    }
  }

  public async settleBet(betId: string, result: "success" | "fail") {
  }

  //GET BETS OF PLAYERS UNDER AN AGENT

  async getAgentBets(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      if (!agentId) throw createHttpError(400, "Agent Id not Found");

      const agent = await User.findById(agentId);
      if (!agent) throw createHttpError(404, "Agent Not Found");

      const playerUnderAgent = agent.players;
      if (playerUnderAgent.length === 0)
        return res.status(200).json({ message: "No Players Under Agent" });

      const bets = await Bet.find({
        player: { $in: playerUnderAgent },
      })
        .populate("player", "username _id")
        .populate({
          path: "data",
          populate: {
            path: "key",
            select: "event_id sport_title commence_time status",
          },
        });

      res.status(200).json(bets);
    } catch (error) {
      next(error);
    }
  }

  //GET ALL BETS FOR ADMIN

  async getAdminBets(req: Request, res: Response, next: NextFunction) {
    try {
      const bets = await Bet.find()
        .populate("player", "username _id")
        .populate({
          path: "data",
          populate: {
            path: "key",
            select: "event_id sport_title commence_time status",
          },
        });

      res.status(200).json(bets);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  //GET BETS FOR A PLAYER

  async getBetForPlayer(req: Request, res: Response, next: NextFunction) {
    try {
      const { player } = req.params;
      const { type, status } = req.query;
      let playerDoc: any;
      if (type === "id") {
        playerDoc = await PlayerModel.findById(player);
        if (!playerDoc) throw createHttpError(404, "Player Not Found");
      } else if (type === "username") {
        playerDoc = await PlayerModel.findOne({ username: player });
        if (!playerDoc)
          throw createHttpError(
            404,
            "Player Not Found with the provided username"
          );
      } else {
        throw createHttpError(400, "User Id or Username not provided");
      }

      const playerBets = await Bet.find({
        player: playerDoc._id,
        ...(status === "combo" || status === "all" ? {} : { status }),
        ...(status === "combo" && { betType: "combo" }),
      })
        .populate("player", "username _id")
        .populate({
          path: "data",
          populate: {
            path: "key",
            select: "event_id sport_title commence_time status",
          },
        });

      res.status(200).json(playerBets);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  //REDEEM PLAYER BET
  async redeemPlayerBet(req: Request, res: Response, next: NextFunction) {
    try {
      const _req = req as AuthRequest;
      const { userId } = _req.user;
      const { betId } = req.params;
      console.log(betId, "ye bheja");

      const player = await PlayerModel.findById({ _id: userId });

      if (!player) {
        throw createHttpError(404, "Player not found");
      }

      const betObjectId = new mongoose.Types.ObjectId(betId);
      const bet = await Bet.findById(betObjectId);
      if (!bet) {
        throw createHttpError(404, "Bet not found");
      }
      if (bet.status !== "pending") {
        throw createHttpError(
          400,
          "Only bets with pending status can be redeemed!"
        );
      }

      const allBets = bet.data;

      const betDetailsArray = await Promise.all(
        allBets.map((id) => BetDetail.findById(id))
      );
      let totalOldOdds = 1;
      let totalNewOdds = 1;

      const betAmount = bet.amount;

      for (const betDetails of betDetailsArray) {
        if (!betDetails) continue;
        if (betDetails.status !== "pending") {
          throw createHttpError(
            400,
            "Only bets with pending status can be redeemed!"
          );
        }

        const selectedTeam =
          betDetails.bet_on === "home_team"
            ? betDetails.home_team.name
            : betDetails.away_team.name;

        const oldOdds =
          betDetails.bet_on === "home_team"
            ? betDetails.home_team.odds
            : betDetails.away_team.odds;

        const currentData = await Store.getEventOdds(
          betDetails.sport_key,
          betDetails.event_id,
          betDetails.market,
          "us",
          betDetails.oddsFormat,
          "iso"
        );

        const currentOddsData = currentData.bookmakers.find(
          (item) => item.key === betDetails.selected
        );
        totalOldOdds *= oldOdds;

        const newOdds = currentOddsData.markets[0].outcomes.find(
          (item) => item.name === selectedTeam
        ).price;
        totalNewOdds *= newOdds;

        betDetails.status = "redeem";
        await betDetails.save();
      }
      console.log("OLD", totalOldOdds, "NEW", totalNewOdds);

      const amount = (totalNewOdds / totalOldOdds) * betAmount;
      const finalPayout =
        amount - (parseInt(config.betCommission) / 100) * amount;

      player.credits += finalPayout;

      await player.save();

      bet.status = "redeem";
      await bet.save();

      const playerSocket = users.get(player.username);
      if (playerSocket) {
        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
      }

      res.status(200).json({ message: "Bet Redeemed Successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export default new BetController();