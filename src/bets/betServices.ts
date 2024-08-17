import Store from "../store/storeController";
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
            this.addBetToQueue(bet, priority);
            console.log("Bet added to processing queue : ", bet);

        } catch (error) {
            console.error('Error adding bet to queue:', error.message);
        }
    }

    // calculate the priority of a bet
    private calculatePriority(bet: IBet): number {
        const timeUntilCommence = new Date(bet.commence_time).getTime() - new Date().getTime();
        return timeUntilCommence;
    }

    // fetch odds for all bets in the queue 
    public async fetchOddsForQueueBets() {
        if (this.priorityQueue.isEmpty()) {
            console.log('No bets in the priority queue.');
            return;
        }

        const sports = new Set<string>();
        const queueSize = this.priorityQueue.size();
        const itemsToReenqueue: { item: IBet; priority: number }[] = [];


        // collect all the sports from bets in the Queue;
        for (let i = 0; i < queueSize; i++) {
            const bet = this.priorityQueue.dequeue();
            if (bet) {
                sports.add(bet.sport_key);
                itemsToReenqueue.push({ item: bet, priority: this.calculatePriority(bet) });
            }
        }

        // Re-enqueue all the bets
        for (const { item, priority } of itemsToReenqueue) {
            this.priorityQueue.enqueue(item, priority);
        }


        // Fetch odds for each sport
        for (const sport of sports) {
            const oddsData = await Store.getOdds(sport);
            


            // check bets in queue
            for (let i = 0; i < this.priorityQueue.size(); i++) {
                const bet = this.priorityQueue.dequeue();

                if (bet) {
                    const matchingEvent = oddsData.upcoming_games.find((game: any) => game.id === bet.event_id) ||
                        oddsData.live_games.find((game: any) => game.id === bet.event_id);

                    if (matchingEvent) {
                        console.log(`Bet with ID ${bet} matches event ID ${matchingEvent.id}`);

                    }

                    // Re-enqueue the bet
                    this.priorityQueue.enqueue(bet, this.calculatePriority(bet));
                }
            }
        }
    }


}

// {
//     "id": "0af01ddcf423c17cfb2d18496a3ed644",
//     "sport_key": "americanfootball_cfl",
//     "sport_title": "CFL",
//     "commence_time": "2024-08-17T23:00:00Z",
//     "home_team": "Hamilton Tiger-Cats",
//     "away_team": "Edmonton Elks",
//     "markets": [
//       {
//         "key": "h2h",
//         "last_update": "2024-08-17T10:28:26Z",
//         "outcomes": [
//           {
//             "name": "Edmonton Elks",
//             "price": 1.83
//           },
//           {
//             "name": "Hamilton Tiger-Cats",
//             "price": 1.99
//           }
//         ]
//       }
//     ],
//     "scores": []
//   }

export default new BetServices()