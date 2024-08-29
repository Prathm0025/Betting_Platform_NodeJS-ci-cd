// betServices.ts
import { PriorityQueue } from "../utils/PriorityQueue";
import Bet, { BetDetail } from "./betModel";
import { IBet, IBetDetail } from "./betsType";
import { Worker } from "worker_threads";
import path from "path";
import { activeRooms } from "../socket/socket";
import { agenda } from "../config/db";

class BetServices {
  private priorityQueue: PriorityQueue<IBetDetail>;

  constructor() {
    this.priorityQueue = new PriorityQueue<IBetDetail>();
  }

  // Add a bet to the priority queue
  public addBetToQueue(bet: IBetDetail, priority: number) {
    console.log("ADDING TO QUEUE");
    this.priorityQueue.enqueue(bet, priority);
  }

  public getPriorityQueueData(): IBetDetail[] {
    console.log(this.priorityQueue.size(), "size");
    
    return this.priorityQueue.getItems().map((item) => item.item);
  }

  // Retrieve and remove the highest priority bet from the queue
  public processNextBet() {
    if (this.priorityQueue.isEmpty()) {
      console.log("No bets in the priority queue.");
      return;
    }

    const nextBet = this.priorityQueue.dequeue();
    console.log(`Processing bet with ID ${nextBet}`);
  }

  // Handle adding a bet to the queue (this will be called by the scheduled job)
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

  // Fetch odds for all bets in the queue
  public async processOddsForQueueBets(queueData: any, activeRooms:any) {
    // if (this.priorityQueue.isEmpty()) {
    //   console.log("No bets in the priority queue.");
    //   return;
    // }
    // console.log("Bets in the queue:", this.priorityQueue.getItems());
    // Process the bets
    // console.log(queueData, "queue");
    console.log("mai yaha hu yaha hu yaha");
    
    const sports = new Set<string>();
    console.log(activeRooms, "cgdfgdf");
console.log(queueData.length, "jdj");
       
   
  
    // const bets = this.priorityQueue.getItems().map((item) => item.item);
    queueData.forEach((bet) => sports.add(bet._doc.sport_key));
    
    // console.log(sports, "SPORTS");
    
    const sportKeysArray = Array.from(sports);
   sportKeysArray.push(...Array.from(activeRooms as string));

    // Define chunk size
    const chunkSize = Math.ceil(queueData.length / sportKeysArray.length);
    const betChunks = chunkArray(queueData, chunkSize);
   
    // Chunk the bets
    const workerFilePath = path.resolve(
      __dirname,
      "../bets/betWorker.js"
    );
    
    // Create a promise to track the workers
    const workerPromises = sportKeysArray.map((chunk) => {
      return new Promise<void>((resolve, reject) => {
        console.log("promise");
        
        const worker = new Worker(workerFilePath, {
          workerData: { sportKeys: sportKeysArray, bets: chunk },
        });

        worker.on("message", () => {
          resolve(); // Resolve when the worker completes its task
        });

        worker.on("error", (error) => {
          reject(error); // Reject if the worker encounters an error
        });

        worker.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
    });

    // Wait for all workers to complete
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