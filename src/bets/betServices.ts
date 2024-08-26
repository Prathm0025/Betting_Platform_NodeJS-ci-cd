import mongoose from "mongoose";
import Store from "../store/storeController";
import { PriorityQueue } from "../utils/PriorityQueue";
import Bet, { BetDetail } from "./betModel";
import { IBet, IBetDetail } from "./betsType";

class BetServices {
  private priorityQueue: PriorityQueue<IBetDetail>;

  constructor() {
    this.priorityQueue = new PriorityQueue<IBetDetail>();
  }

  // add a bet to the priority queue
  public addBetToQueue(bet: IBetDetail, priority: number) {
    this.priorityQueue.enqueue(bet, priority);
  }

  // retrieve and remove the highest priority bet from the queue
  public processNextBet() {
    if (this.priorityQueue.isEmpty()) {
      console.log("No bets in the priority queue.");
      return;
    }

    const nextBet = this.priorityQueue.dequeue();
    console.log(`Processing bet with ID ${nextBet}`);
  }

  // handle adding a bet to the queue (this will be called by the scheduled job)
  public async addBetToQueueAtCommenceTime(betId: string) {
    try {
      const bet = await BetDetail.findById(betId);
      if (!bet) {
        console.log("Bet not found.");
        return;
      }

      const priority = this.calculatePriority(bet);
      this.addBetToQueue(bet, priority);
      console.log("Bet added to processing queue : ", bet);
    } catch (error) {
      console.error("Error adding bet to queue:", error.message);
    }
  }

  // Calculate the priority of a bet detail
  private calculatePriority(betDetail: IBetDetail): number {
    const timeUntilCommence =
      new Date(betDetail.commence_time).getTime() - new Date().getTime();
    return timeUntilCommence;
  }

  // fetch odds for all bets in the queue
  public async fetchOddsForQueueBets() {
    if (this.priorityQueue.isEmpty()) {
      console.log("No bets in the priority queue.");
      return;
    }

    const sports = new Set<string>();
    const queueSize = this.priorityQueue.size();
    const itemsToReenqueue: { item: IBetDetail; priority: number }[] = [];

    // collect all the sports from bets in the Queue;
    for (let i = 0; i < queueSize; i++) {
      const bet = this.priorityQueue.dequeue();
      if (bet) {
        sports.add(bet.sport_key);
        itemsToReenqueue.push({
          item: bet,
          priority: this.calculatePriority(bet),
        });
      }
    }

    // Re-enqueue all the bets
    for (const { item, priority } of itemsToReenqueue) {
      this.priorityQueue.enqueue(item, priority);
    }

    // Fetch odds for each sport
    for (const sport of sports) {
      const { live_games, upcoming_games, completed_games } =
        await Store.getOdds(sport);

      completed_games.forEach(async (game: any) => {
        const bet = this.priorityQueue
          .getItems()
          .find((b) => b.item.event_id === game.id);
        if (bet) {
          await this.processCompletedBet(bet.item._id.toString(), game);
        }
      });
    }
  }

  private async processCompletedBet(betDetailId: string, gameData: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const betDetail = await BetDetail.findById(betDetailId).session(session);
      if (!betDetail) {
        console.log("Bet not found.");
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const bet = await Bet.findById(betDetail.key).session(session);
      if (!bet) {
        console.log("Parent bet not found.");
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const winner = this.determineWinner(
        betDetail.home_team.name,
        betDetail.away_team.name,
        gameData.scores
      );
      let won = false;

      if (winner === betDetail.bet_on) {
        betDetail.status = "won";
        won = true;
        console.log(`BetDetail ${betDetailId} won!`);
      } else {
        betDetail.status = "lost";
        console.log(`BetDetail ${betDetailId} lost.`);
      }

      await betDetail.save({ session });

      // check if all BetDetails are processed
      const allBetDetails = await BetDetail.find({ key: bet._id }).session(
        session
      );
      const allProcessed = allBetDetails.every(
        (detail) => detail.status !== "pending"
      );

      if (allProcessed) {
        // Determine the overall outcome of the Bet based on the BetDetails
        const betWon = allBetDetails.every((detail) => detail.status === "won");
        bet.status = betWon ? "won" : "lost";
        await bet.save({ session });

        if (betWon) {
          // The whole bet has won, award the possible winning amount
          console.log(
            `Bet ${bet._id} won! Awarding amount: ${bet.possibleWinningAmount}`
          );
        } else {
          console.log(`Bet ${bet._id} lost.`);
        }
      }
      await session.commitTransaction();
    } catch (error) {
      console.error("Error processing completed bet:", error.message);
      await session.abortTransaction();
    } finally {
      session.endSession();
    }
  }

  private determineWinner(
    homeTeam: string,
    awayTeam: string,
    scores: { name: string; score: string }[]
  ): string | null {
    const homeScore = parseInt(
      scores.find((s) => s.name === homeTeam)?.score || "0"
    );
    const awayScore = parseInt(
      scores.find((s) => s.name === awayTeam)?.score || "0"
    );

    if (homeScore > awayScore) {
      return "home_team";
    } else if (awayScore > homeScore) {
      return "away_team";
    } else {
      return null; // Tie or error
    }
  }
}

export default new BetServices();
