import Agenda, { Job } from "agenda";
import Bet from "./betModel";
import { agenda } from "../config/db";
import { IBet } from "./betsType";
import createHttpError from "http-errors";
import { NextFunction, Request, Response } from "express";
import Agent from '../subordinates/agentModel';
import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";
import PlayerModel from "../players/playerModel";
import Player from "../players/playerSocket";
import Store from "../store/storeController";
import { users } from "../socket/socket";

class BetController {
  constructor() {
    if (!agenda) {
      console.error(
        "Agenda is not initialized. Make sure the database is connected and agenda is initialized before using BetController."
      );
      return;
    }

    this.initializeAgenda();
  }

  private initializeAgenda() {
    agenda.define("lock bet", async (job: Job) => {
      await this.lockBet(job.attrs.data.betId);
    });

    agenda.define("process outcome", async (job: Job) => {
      await this.processOutcomeQueue(
        job.attrs.data.betId,
        job.attrs.data.result
      );
    });

    agenda.define("retry bet", async (job: Job) => {
      await this.processRetryQueue(job.attrs.data.betId);
    });

    agenda.start();
  }

  public async placeBet(playerRef: Player, betData: IBet) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const oddsData = await Store.getOdds(betData.sport_key);

      // Find the game data matching the event_id
      const game =
        oddsData.live_games.find((g: any) => g.id === betData.event_id) ||
        oddsData.upcoming_games.find((g: any) => g.id === betData.event_id) ||
        oddsData.completed_games.find((g: any) => g.id === betData.event_id);

      if (game && game.completed) {
        console.log("Cannot place a bet on a completed game");
        throw new Error("Cannot place a bet on a completed game");
      }

      // Get the Player
      const player = await PlayerModel.findById(playerRef.userId).session(
        session
      );
      if (!player) {
        console.log("Player not found");
        throw new Error("Player not found");
      }

      // check if the player has enought credits
      const betAmount = parseFloat(betData.amount.toString());
      if (player.credits < betAmount) {
        throw new Error("Insufficient credits");
      }

      // Deduct the bet amount from player's credits
      player.credits -= betAmount;

      await player.save({ session });
      const playerSocket = users.get(player.username);
      if (playerSocket) {
        console.log("FOUND PLAYER CONNECTED", playerSocket);
        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
      }

      // Calculate the possible winning amount
      const possibleWinningAmount = this.calculatePossibleWinning(betData);
      console.log("POSSIBLE WINNING AMOUNT: ", possibleWinningAmount);

      // Add the possibleWinningAmount to the betData
      const betDataWithWinning = {
        ...betData,
        possibleWinningAmount: possibleWinningAmount,
      };

      // Save the bet with the session
      const bet = new Bet(betDataWithWinning);
      await bet.save({ session });

      const now = new Date();
      const commenceTime = new Date(betData.commence_time);
      const delay = commenceTime.getTime() - now.getTime();

      const job = agenda.schedule(
        new Date(Date.now() + delay),
        "add bet to queue",
        { betId: bet._id.toString() }
      );

      if (job) {
        console.log(
          `Bet ${bet._id.toString()} scheduled successfully with a delay of ${delay}ms`
        );
      } else {
        console.error(`Failed to schedule bet ${bet._id.toString()}`);
        throw new Error("Failed to schedule bet");
      }

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
      agenda.schedule("in 5 minutes", "retry bet", { betId });
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
        agenda.schedule("in 5 minutes", "retry bet", { betId });
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
        agenda.schedule("in 5 minutes", "retry bet", { betId });
      }
    }
  }

  public async settleBet(betId: string, result: "success" | "fail") {
    agenda.now("process outcome", { betId, result });
  }

  //GET BETS OF PLAYERS UNDER AN AGENT

  async getAgentBets(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      if (!agentId) throw createHttpError(400, "Agent Id not Found");
      const agent = await Agent.findById(agentId);
      console.log(agent);

      if (!agent) throw createHttpError(404, "Agent Not Found");
      const playerUnderAgent = agent.players;
      if (playerUnderAgent.length === 0)
        res.status(200).json({ message: "No Players Under Agent" });
      const bets = await Bet.find({
        player: { $in: playerUnderAgent },
      }).populate("player", "username _id");
      console.log(bets, "bets");
      if (bets.length === 0)
        return res.status(200).json({ message: "No Bets Found" });
      res.status(200).json( bets );
    } catch (error) {
      next(error);
    }
  }
  //GET ALL BETS FOR ADMIN

  async getAdminBets(req: Request, res: Response, next: NextFunction) {
    try {
      const bets = await Bet.find().populate("player", "username _id");
      console.log(bets, "bets");
      if (bets.length === 0) res.status(200).json({ message: "No Bets" });
      res.status(200).json(bets );
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  //GET BETS FOR A PLAYER

  async getBetForPlayer(req: Request, res: Response, next: NextFunction) {
    try {
      const { player } = req.params;
      const { type } = req.query;
      let playerDoc: any;

      console.log(player, type);

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

      const playerBets = await Bet.find({ player: playerDoc._id }).populate(
        "player",
        "username _id"
      );

      if (playerBets.length === 0) {
        return res.status(200).json({ message: "No bets found" });
      }

      res.status(200).json(playerBets );
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
}

export default new BetController();
