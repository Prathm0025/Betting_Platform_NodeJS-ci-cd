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
  public async processOddsForQueueBets(queueData: any, activeRooms: any) {
    console.log(activeRooms, "active rooms");

    const MAX_WORKER_COUNT = 8; // Limit the number of workers to 8
    const sports = new Set<string>();

    queueData.forEach((bet) => sports.add(bet._doc.sport_key));

    const sportKeysArray = Array.from(sports);
    sportKeysArray.push(...Array.from(activeRooms as string));

    const workerCount = Math.min(MAX_WORKER_COUNT, sportKeysArray.length);

    // Define chunk size
    const chunkSize = Math.ceil(sportKeysArray.length / workerCount);
    const sportKeysChunks = chunkArray(sportKeysArray, chunkSize);

    const workerFilePath = path.resolve(__dirname, "../bets/betWorker.js");

    const workerPromises = sportKeysChunks?.map((chunk) => {
      return new Promise<void>((resolve, reject) => {
        console.log("promise");

        const betsForChunk = queueData.filter(bet => chunk.includes(bet._doc.sport_key));
        console.log(betsForChunk, "bet chunk");

        const worker = new Worker(workerFilePath, {
          workerData: { sportKeys: Array.from(chunk), bets: betsForChunk },
        });

        worker.on("message", (message) => {
          if (message.type === 'updateLiveData') {
            parentPort.postMessage({
              type: 'updateLiveData',
              livedata: message.livedata,
              activeRooms: message.activeRooms,
            });
          } else {
            resolve();
          }
        });

        worker.on("error", (error) => {

          reject(error);
        });

        worker.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
    });

    try {

      await Promise.all(workerPromises);
      console.log("All workers completed processing.");
    } catch (error) {
      console.error("Error during worker processing:", error);
    }
  }
}
// Helper function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export default new BetServices();
