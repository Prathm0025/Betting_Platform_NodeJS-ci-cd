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
const betModel_1 = __importDefault(require("./betModel"));
class BetServices {
    constructor() {
        this.priorityQueue = new PriorityQueue_1.PriorityQueue();
    }
    // add a bet to the priority queue
    addBetToQueue(bet, priority) {
        this.priorityQueue.enqueue(bet, priority);
    }
    // retrieve and remove the highest priority bet from the queue
    processNextBet() {
        if (this.priorityQueue.isEmpty()) {
            console.log('No bets in the priority queue.');
            return;
        }
        const nextBet = this.priorityQueue.dequeue();
        console.log(`Processing bet with ID ${nextBet}`);
    }
    // handle adding a bet to the queue (this will be called by the scheduled job)
    addBetToQueueAtCommenceTime(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bet = yield betModel_1.default.findById(betId);
                if (!bet) {
                    console.log('Bet not found.');
                    return;
                }
                const priority = this.calculatePriority(bet);
                this.addBetToQueue(bet, priority);
            }
            catch (error) {
                console.error('Error adding bet to queue:', error.message);
            }
        });
    }
    // Method to calculate the priority of a bet based on commence time
    calculatePriority(bet) {
        const now = new Date();
        const timeUntilCommence = bet.commence_time.getTime() - now.getTime();
        // Higher priority for bets that commence sooner (lower timeUntilCommence)
        const priority = Math.max(1, Math.floor(timeUntilCommence / 1000)); // Convert to seconds
        return priority;
    }
}
exports.default = new BetServices();
