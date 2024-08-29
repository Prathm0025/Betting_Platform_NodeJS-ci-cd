"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// betServices.ts
const PriorityQueue_1 = require("../utils/PriorityQueue");
const betModel_1 = require("./betModel");
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
class BetServices {
    constructor() {
        this.priorityQueue = new PriorityQueue_1.PriorityQueue();
    }
    // Add a bet to the priority queue
    addBetToQueue(bet, priority) {
        console.log("ADDING TO QUEUE");
        this.priorityQueue.enqueue(bet, priority);
    }
    getPriorityQueueData() {
        console.log(this.priorityQueue.size(), "size");
        return this.priorityQueue.getItems().map((item) => item.item);
    }
    // Retrieve and remove the highest priority bet from the queue
    processNextBet() {
        if (this.priorityQueue.isEmpty()) {
            console.log("No bets in the priority queue.");
            return;
        }
        const nextBet = this.priorityQueue.dequeue();
        console.log(`Processing bet with ID ${nextBet}`);
    }
    // Handle adding a bet to the queue (this will be called by the scheduled job)
    addBetToQueueAtCommenceTime(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bet = yield betModel_1.BetDetail.findById(betId);
                if (!bet) {
                    console.log("Bet not found.");
                    return;
                }
                const priority = this.calculatePriority(bet);
                this.addBetToQueue(bet, priority);
                console.log("Bet added to processing queue : ", bet);
            }
            catch (error) {
                console.error("Error adding bet to queue:", error.message);
            }
        });
    }
    // Calculate the priority of a bet detail
    calculatePriority(betDetail) {
        const timeUntilCommence = new Date(betDetail.commence_time).getTime() - new Date().getTime();
        return timeUntilCommence;
    }
    // Fetch odds for all bets in the queue
    processOddsForQueueBets(queueData, activeRooms) {
        return __awaiter(this, void 0, void 0, function* () {
            // if (this.priorityQueue.isEmpty()) {
            //   console.log("No bets in the priority queue.");
            //   return;
            // }
            // console.log("Bets in the queue:", this.priorityQueue.getItems());
            // Process the bets
            // console.log(queueData, "queue");
            console.log("mai yaha hu yaha hu yaha");
            const sports = new Set();
            console.log(activeRooms, "cgdfgdf");
            console.log(queueData.length, "jdj");
            // const bets = this.priorityQueue.getItems().map((item) => item.item);
            queueData.forEach((bet) => sports.add(bet._doc.sport_key));
            // console.log(sports, "SPORTS");
            const sportKeysArray = Array.from(sports);
            sportKeysArray.push(...Array.from(activeRooms));
            // Define chunk size
            const chunkSize = Math.ceil(queueData.length / sportKeysArray.length);
            const betChunks = chunkArray(queueData, chunkSize);
            // Chunk the bets
            const workerFilePath = path_1.default.resolve(__dirname, "../bets/betWorker.js");
            // Create a promise to track the workers
            const workerPromises = sportKeysArray.map((chunk) => {
                return new Promise((resolve, reject) => {
                    console.log("promise");
                    const worker = new worker_threads_1.Worker(workerFilePath, {
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
                yield Promise.all(workerPromises);
                console.log("All workers completed processing.");
            }
            catch (error) {
                console.error("Error during worker processing:", error);
            }
        });
    }
}
// Helper function to chunk arrays
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}
exports.default = new BetServices();
