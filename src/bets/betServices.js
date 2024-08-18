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
const mongoose_1 = __importDefault(require("mongoose"));
const storeController_1 = __importDefault(require("../store/storeController"));
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
                console.log("Bet added to processing queue : ", bet);
            }
            catch (error) {
                console.error('Error adding bet to queue:', error.message);
            }
        });
    }
    // calculate the priority of a bet
    calculatePriority(bet) {
        const timeUntilCommence = new Date(bet.commence_time).getTime() - new Date().getTime();
        return timeUntilCommence;
    }
    // fetch odds for all bets in the queue 
    fetchOddsForQueueBets() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.priorityQueue.isEmpty()) {
                console.log('No bets in the priority queue.');
                return;
            }
            const sports = new Set();
            const queueSize = this.priorityQueue.size();
            const itemsToReenqueue = [];
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
                const { live_games, upcoming_games, completed_games } = yield storeController_1.default.getOdds(sport);
                completed_games.forEach((game) => __awaiter(this, void 0, void 0, function* () {
                    const bet = this.priorityQueue.getItems().find((b) => b.item.event_id === game.id);
                    if (bet) {
                        yield this.processCompletedBet(bet.item._id.toString(), game);
                    }
                }));
            }
        });
    }
    processCompletedBet(betId, gameData) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                const bet = yield betModel_1.default.findById(betId).session(session);
                if (!bet) {
                    console.log('Bet not found.');
                    yield session.abortTransaction();
                    session.endSession();
                    return;
                }
                const winner = this.determineWinner(bet.home_team.name, bet.away_team.name, gameData.scores);
                let winningAmount = null;
                if (winner === bet.bet_on) {
                    bet.status = 'won';
                    winningAmount = bet.possibleWinningAmount; // Set the winning amount if the bet is successful
                    console.log(`Bet ${betId} won!`);
                }
                else {
                    bet.status = 'lost';
                    console.log(`Bet ${betId} lost.`);
                }
                yield bet.save({ session });
                yield session.commitTransaction();
            }
            catch (error) {
                console.error('Error processing completed bet:', error.message);
                yield session.abortTransaction();
            }
            finally {
                session.endSession();
            }
        });
    }
    determineWinner(homeTeam, awayTeam, scores) {
        var _a, _b;
        const homeScore = parseInt(((_a = scores.find(s => s.name === homeTeam)) === null || _a === void 0 ? void 0 : _a.score) || '0');
        const awayScore = parseInt(((_b = scores.find(s => s.name === awayTeam)) === null || _b === void 0 ? void 0 : _b.score) || '0');
        if (homeScore > awayScore) {
            return 'home_team';
        }
        else if (awayScore > homeScore) {
            return 'away_team';
        }
        else {
            return null; // Tie or error
        }
    }
}
exports.default = new BetServices();
