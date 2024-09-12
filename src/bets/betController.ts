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
import Notification from "../notifications/notificationModel";

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

      //combo from same event and market
      // if (betType === "combo") {
      //   const combinedKeys = betDetails.map((bet) => `${bet.event_id}-${bet.market}`);
      //   const uniqueCombinedKeys = new Set(combinedKeys);
      //   if (combinedKeys.length !== uniqueCombinedKeys.size) {
      //     throw new Error("Invalid combo!");
      //   }
      // }

      // Check if the player already has a pending bet on the same team
      for (const betDetailData of betDetails) {
        const existingBetDetails = await BetDetail.find({
          event_id: betDetailData.event_id,
          status: "pending",
          market: betDetailData.market,
        }).session(session);

        // Check if there are any existing bet details
        if (existingBetDetails.length > 0) {
          for (const data of existingBetDetails) {
            const bet = await Bet.findById(data.key).session(session);
            if (!bet) {
              throw new Error("Something went wrong");
            }
            const betPlayer = await PlayerModel.findById(bet.player).session(
              session
            );
            if (betPlayer._id.equals(player._id)) {
              // Use `.equals` for MongoDB ObjectId comparison
              if (data.bet_on === betDetailData.bet_on) {
                throw new Error(
                  `You already have a pending bet on ${betDetailData.bet_on}.`
                );
              } else {
                throw new Error(
                  `This is not a valid bet since the other bet is not yet resolved!`
                );
              }
            }
          }
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
        let selectedOdds;
        switch (betDetailData.bet_on) {
          case "home_team":
            selectedOdds = betDetailData.home_team.odds;
            break;
          case "away_team":
            selectedOdds = betDetailData.home_team.odds;
            break;
          case "Over":
            selectedOdds = betDetailData.home_team.odds;
            break;
          case "Under":
            selectedOdds = betDetailData.away_team.odds;
            break;
          default:
            break;
        }

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
        _id: betId,
        player: player._id,
        data: betDetailIds,
        amount,
        possibleWinningAmount,
        status: "pending",
        retryCount: 0,
        betType,
      });
      await bet.save({ session });

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
      const timestamp = commence_time.getTime() / 1000;
      const data = {
        betId: betDetail._id.toString(),
        commence_time: new Date(betDetail.commence_time),
      };

      await redisClient.zadd(
        "waitingQueue",
        timestamp.toString(),
        JSON.stringify(data)
      );

      console.log(
        `BetDetail ${betDetail._id.toString()} scheduled successfully with a delay of ${delay}ms`
      );
    } catch (error) {
      console.error(
        `Failed to schedule bet detail ${betDetail._id.toString()}:`,
        error
      );
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

  async redeemBetInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const _req = req as AuthRequest;
      const { userId } = _req.user;
      const { betId } = req.params;
      let failed = false;

      const player = await PlayerModel.findById({ _id: userId });
      console.log("PLAYERRRR", player);

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
      const betAmount = bet.amount;
      const allBets = bet?.data;

      const betDetailsArray = await Promise.all(
        allBets.map((id) => BetDetail.findById(id))
      );
      let totalOldOdds = 1;
      let totalNewOdds = 1;

      for (const betDetails of betDetailsArray) {
        let selectedTeam;
        switch (betDetails.bet_on) {
          case "home_team":
            selectedTeam = betDetails.home_team;
            break;
          case "away_team":
            selectedTeam = betDetails.home_team;
            break;
          case "Over":
            selectedTeam = betDetails.home_team;
            break;
          case "Under":
            selectedTeam = betDetails.away_team;
            break;
          default:
            break;
        }

        const oldOdds = selectedTeam.odds;

        totalOldOdds *= oldOdds;

        const currentData = await Store.getEventOdds(
          betDetails.sport_key,
          betDetails.event_id,
          betDetails.market,
          "us",
          betDetails.oddsFormat,
          "iso"
        );

        const currentBookmakerData = currentData?.bookmakers?.find(
          (item) => item?.key === betDetails.selected
        );

        //the earlier selected bookmaker is not available anymore
        if (!currentBookmakerData) {
          failed = true;
          break;
        } else {
          const marketDetails = currentBookmakerData?.markets?.find(
            (item) => item.key === betDetails.market
          );

          const newOdds = marketDetails.outcomes.find((item) => {
            if (betDetails.market !== "totals") {
              return item.name === selectedTeam.name;
            } else {
              return item.name === betDetails.bet_on;
            }
          }).price;
          totalNewOdds *= newOdds;
        }
      }
      if (failed) {
        res.status(200).json({
          message:
            "There was some error in processing this bet so, you will be refunded with the complete amount",
          amount: betAmount,
        });
      } else {
        const amount = (totalNewOdds / totalOldOdds) * betAmount;
        const finalPayout =
          amount - (parseInt(config.betCommission) / 100) * amount;
        res
          .status(200)
          .json({ message: "Your final payout will be", amount: finalPayout });
      }
    } catch (error) {
      next(error);
    }
  }

  //REDEEM PLAYER BET
  async redeemPlayerBet(req: Request, res: Response, next: NextFunction) {
    try {
      const _req = req as AuthRequest;
      const { userId } = _req.user;
      const { betId } = req.params;
      let failed = false;

      const player = await PlayerModel.findById({ _id: userId });

      if (!player) {
        throw createHttpError(404, "Player not found");
      }
      const playerSocket = users.get(player.username);
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
      const betAmount = bet.amount;
      const allBets = bet?.data;

      const betDetailsArray = await Promise.all(
        allBets.map((id) => BetDetail.findById(id))
      );
      let totalOldOdds = 1;
      let totalNewOdds = 1;

      for (const betDetails of betDetailsArray) {
        let selectedTeam;
        switch (betDetails.bet_on) {
          case "home_team":
            selectedTeam = betDetails.home_team;
            break;
          case "away_team":
            selectedTeam = betDetails.home_team;
            break;
          case "Over":
            selectedTeam = betDetails.home_team;
            break;
          case "Under":
            selectedTeam = betDetails.away_team;
            break;
          default:
            break;
        }

        const oldOdds = selectedTeam.odds;

        totalOldOdds *= oldOdds;

        const currentData = await Store.getEventOdds(
          betDetails.sport_key,
          betDetails.event_id,
          betDetails.market,
          "us",
          betDetails.oddsFormat,
          "iso"
        );

        const currentBookmakerData = currentData?.bookmakers?.find(
          (item) => item?.key === betDetails.selected
        );

        //the earlier selected bookmaker is not available anymore
        if (!currentBookmakerData) {
          failed = true;
          break;
        } else {
          const marketDetails = currentBookmakerData?.markets?.find(
            (item) => item.key === betDetails.market
          );

          const newOdds = marketDetails.outcomes.find((item) => {
            if (betDetails.market !== "totals") {
              return item.name === selectedTeam.name;
            } else {
              return item.name === betDetails.bet_on;
            }
          }).price;
          totalNewOdds *= newOdds;

          betDetails.status = "redeem";
          betDetails.isResolved = true;
          await betDetails.save();
          bet.status = "redeem";
          await bet.save();
        }
      }
      if (failed) {
        for (const betDetails of betDetailsArray) {
          betDetails.status = "failed";
          await betDetails.save();
        }
        player.credits += betAmount;
        await player.save();
        bet.status = "failed";
        await bet.save();
        if (playerSocket) {
          playerSocket.sendData({ type: "CREDITS", credits: player.credits });
        }
        throw createHttpError(400, "Bet failed!");
      } else {
        const amount = (totalNewOdds / totalOldOdds) * betAmount;
        const finalPayout =
          amount - (parseInt(config.betCommission) / 100) * amount;
        player.credits += finalPayout;

        await player.save();
        bet.status = "redeem";
        await bet.save();
        res.status(200).json({ message: "Bet Redeemed Successfully" });
        if (playerSocket) {
          playerSocket.sendData({ type: "CREDITS", credits: player.credits });
        }
      }
    } catch (error) {
      next(error);
    }
  }


  // UPADTE OR RESOLVE BET
  async resolveBet(req: Request, res: Response, next: NextFunction) {
    try {
      const { betDetailId } = req.params;
      const { status } = req.body; // won - lost
  
      const updatedBetDetails = await BetDetail.findByIdAndUpdate(betDetailId, {
        status: status,
      }, { new: true });
  
      if(!updatedBetDetails){
        throw createHttpError(404,"Bet detail not found");
      }
  
      const parentBetId = updatedBetDetails.key;
      const parentBet = await Bet.findById(parentBetId);
  
      if(!parentBet){
        throw createHttpError(404, "Parent bet not found")
      }
  
      const parentBetStatus = parentBet.status;
  
      if (parentBetStatus === "lost") {
        return res.status(200).json({ message: "Bet detail updated, Combo bet lost" });
      }
  
      if (status !== "won") {
        parentBet.status = "lost";
        await parentBet.save();
        return res.status(200).json({ message: "Bet detail updated, Combo bet lost" });
      }
  
      const allBetDetails = await BetDetail.find({ _id: { $in: parentBet.data } });
      const hasNotWon = allBetDetails.some((detail) => detail.status !== 'won');
  
      if (!hasNotWon && parentBet.status !== "won") {
        const playerId = parentBet.player;
        const possibleWinningAmount = parentBet.possibleWinningAmount;
        const player = await PlayerModel.findById(playerId);
  
        if (player) {
          player.credits += possibleWinningAmount;
          await player.save();
        }
  
        parentBet.status = "won";
        await parentBet.save();

        const playerSocket = users.get(player.username);
        if (playerSocket) {
          playerSocket.sendData({ type: "CREDITS", credits: player.credits });
        }
      }
  
      return res.status(200).json({ message: "Bet detail status updated" });
    } catch (error) {
      next(error);
    }
  }
  

}

export default new BetController();
