"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PriorityQueue_1 = require("../utils/PriorityQueue");
class BetController {
    constructor() {
        this.betQueue = new PriorityQueue_1.PriorityQueue();
    }
    calculatePriority(bet) {
        return new Date(bet.commence_time).getTime();
    }
    addBet(bet) {
        const priority = this.calculatePriority(bet);
        this.betQueue.enqueue(bet, priority);
    }
    processNextBet() {
        if (!this.betQueue.isEmpty()) {
            const nextBet = this.betQueue.dequeue();
            if (nextBet) {
                console.log("Processing next bet : ", nextBet);
            }
            else {
                console.log("No bets to process");
            }
        }
        else {
            console.log("Bet queue is empty.");
        }
    }
}
exports.default = new BetController();
