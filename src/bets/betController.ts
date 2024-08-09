import { NextFunction, Request, Response } from "express";
import { PriorityQueue } from "../utils/PriorityQueue";
import { IBet } from "./betsType";

class BetController {
    private betQueue: PriorityQueue<IBet>;

    constructor() {
        this.betQueue = new PriorityQueue<IBet>();
    }

    private calculatePriority(bet: IBet) {
        return new Date(bet.commence_time).getTime();
    }

    public addBet(bet: IBet) {
        const priority = this.calculatePriority(bet);
        this.betQueue.enqueue(bet, priority)
    }

    public processNextBet() {
        if (!this.betQueue.isEmpty()) {
            const nextBet = this.betQueue.dequeue();
            if (nextBet) {
                console.log("Processing next bet : ", nextBet);
            } else {
                console.log("No bets to process");
            }
        } else {
            console.log("Bet queue is empty.");
        }
    }
}

export default new BetController()