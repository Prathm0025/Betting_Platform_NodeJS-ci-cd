import { PriorityQueue } from "../utils/PriorityQueue"
import Bet from "./betModel";
import { IBet } from "./betsType"

class BetServices {
    private priorityQueue: PriorityQueue<IBet>;

    constructor() {
        this.priorityQueue = new PriorityQueue<IBet>();
    }

    // add a bet to the priority queue
    public addBetToQueue(bet: IBet, priority: number) {
        this.priorityQueue.enqueue(bet, priority);
    }

    // retrieve and remove the highest priority bet from the queue
    public processNextBet() {
        if (this.priorityQueue.isEmpty()) {
            console.log('No bets in the priority queue.');
            return;
        }

        const nextBet = this.priorityQueue.dequeue();
        console.log(`Processing bet with ID ${nextBet}`);
    }

    // handle adding a bet to the queue (this will be called by the scheduled job)
    public async addBetToQueueAtCommenceTime(betId: string) {
        try {
            const bet = await Bet.findById(betId);
            if (!bet) {
                console.log('Bet not found.');
                return;
            }

            const priority = this.calculatePriority(bet);
            this.addBetToQueue(bet, priority)
        } catch (error) {
            console.error('Error adding bet to queue:', error.message);
        }
    }

    // Method to calculate the priority of a bet based on commence time
    private calculatePriority(bet: IBet): number {
        const now = new Date();
        const timeUntilCommence = bet.commence_time.getTime() - now.getTime();

        // Higher priority for bets that commence sooner (lower timeUntilCommence)
        const priority = Math.max(1, Math.floor(timeUntilCommence / 1000)); // Convert to seconds
        return priority;
    }


}

export default new BetServices()