import { PriorityQueue } from "../utils/PriorityQueue";
import Bet, { BetDetail } from "./betModel";
import { IBet, IBetDetail } from "./betsType";
import { parentPort, Worker } from "worker_threads";
import path from "path";
import os from 'os';
import { enqueue, size } from "../utils/ProcessingQueue";

class BetServices {
  private priorityQueue: PriorityQueue<IBetDetail>;

  constructor() {
    this.priorityQueue = new PriorityQueue<IBetDetail>();
  }

  // Add a bet to the priority queue
  public addBetToQueue(bet: IBetDetail, priority: number) {
    console.log("ADDING TO QUEUE");
    this.priorityQueue.enqueue(bet, priority);
    enqueue(JSON.stringify(bet));
  }

  //NOTE: only used in interval worker 
  public getPriorityQueueData(): IBetDetail[] {

    //FIX:
    // console.log(this.priorityQueue.size(), "size");
    console.log(size());

    //FIX:
    return this.priorityQueue.getItems().map((item) => item.item);
  }

  //NOTE: Not being used
  // Retrieve and remove the highest priority bet from the queue
  public processNextBet() {

    if (this.priorityQueue.isEmpty()) {
      console.log("No bets in the priority queue.");
      return;
    }

    if (size().then((size) => size === 0)) {
      console.log("No bets in the priority queue.");
      return;
    }
    const nextBet = this.priorityQueue.dequeue();
    console.log(`Processing bet with ID ${nextBet}`);
  }

  // Handle adding a bet to the queue (this will be called by the scheduled job)
  public async addBetToQueueAtCommenceTime(betId: string) {
    try {
      console.log("add bet to queue");

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

  // Fetch odds for all bets in the queue
}

export default new BetServices();
