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
            const MAX_WORKER_COUNT = 8; // Limit the number of workers to 8
            const sports = new Set();
            queueData.forEach((bet) => sports.add(bet._doc.sport_key));
            const sportKeysArray = Array.from(sports);
            sportKeysArray.push(...Array.from(activeRooms));
            const workerCount = Math.min(MAX_WORKER_COUNT, sportKeysArray.length);
            // Define chunk size
            const chunkSize = Math.ceil(sportKeysArray.length / workerCount);
            const sportKeysChunks = chunkArray(sportKeysArray, chunkSize);
            const workerFilePath = path_1.default.resolve(__dirname, "../bets/betWorker.js");
            const workerPromises = sportKeysChunks.map((chunk) => {
                return new Promise((resolve, reject) => {
                    const betsForChunk = queueData.filter(bet => chunk.includes(bet._doc.sport_key));
                    const worker = new worker_threads_1.Worker(workerFilePath, {
                        workerData: { sportKeys: chunk, bets: betsForChunk },
                    });
                    worker.on("message", (message) => {
                        if (message.type === 'updateLiveData') {
                            worker_threads_1.parentPort.postMessage({
                                type: 'updateLiveData',
                                livedata: message.livedata,
                                activeRooms: message.activeRooms,
                            });
                        }
                        else {
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
