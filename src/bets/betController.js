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
const betModel_1 = __importDefault(require("./betModel"));
const db_1 = require("../config/db");
class BetController {
    constructor() {
        if (!db_1.agenda) {
            console.error("Agenda is not initialized. Make sure the database is connected and agenda is initialized before using BetController.");
            return;
        }
        this.initializeAgenda();
    }
    initializeAgenda() {
        db_1.agenda.define('lock bet', (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.lockBet(job.attrs.data.betId);
        }));
        db_1.agenda.define('process outcome', (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.processOutcomeQueue(job.attrs.data.betId, job.attrs.data.result);
        }));
        db_1.agenda.define('retry bet', (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.processRetryQueue(job.attrs.data.betId);
        }));
        db_1.agenda.start();
    }
    placeBet(betData) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const commenceTime = new Date(betData.commence_time);
            if (commenceTime <= now) {
                console.log('Cannot place a bet after the match has started');
                return;
            }
            // Calculate the possible winning amount
            const possibleWinningAmount = this.calculatePossibleWinning(betData);
            console.log("POSSIBLE WINNING AMOUNT: ", possibleWinningAmount);
            // Add the possibleWinningAmount to the betData
            const betDataWithWinning = Object.assign(Object.assign({}, betData), { possibleWinningAmount: possibleWinningAmount });
            // Now you can proceed with saving the bet and scheduling the job
            const bet = new betModel_1.default(betDataWithWinning);
            yield bet.save();
            const delay = commenceTime.getTime() - now.getTime();
            db_1.agenda.schedule(new Date(Date.now() + delay), 'lock bet', { betId: bet._id.toString() });
        });
    }
    calculatePossibleWinning(data) {
        const selectedTeam = data.bet_on === 'home_team' ? data.home_team : data.away_team;
        const oddsFormat = data.oddsFormat;
        const betAmount = parseFloat(data.amount.toString());
        let possibleWinningAmount = 0;
        switch (oddsFormat) {
            case "decimal":
                possibleWinningAmount = selectedTeam.odds * betAmount;
                break;
            case "american":
                if (selectedTeam.odds > 0) {
                    possibleWinningAmount = (selectedTeam.odds / 100) * betAmount + betAmount;
                }
                else {
                    possibleWinningAmount = (100 / Math.abs(selectedTeam.odds)) * betAmount + betAmount;
                }
                break;
            default:
                console.log("INVALID ODDS FORMAT");
        }
        return possibleWinningAmount;
    }
    lockBet(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield betModel_1.default.startSession();
            session.startTransaction();
            try {
                const bet = yield betModel_1.default.findById(betId).session(session);
                if (bet && bet.status !== 'locked') {
                    bet.status = 'locked';
                    yield bet.save();
                    yield session.commitTransaction();
                }
            }
            catch (error) {
                yield session.abortTransaction();
                db_1.agenda.schedule('in 5 minutes', 'retry bet', { betId });
            }
            finally {
                session.endSession();
            }
        });
    }
    processOutcomeQueue(betId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = yield betModel_1.default.findById(betId);
            if (bet) {
                try {
                    bet.status = result;
                    yield bet.save();
                }
                catch (error) {
                    db_1.agenda.schedule('in 5 minutes', 'retry bet', { betId });
                }
            }
        });
    }
    processRetryQueue(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = yield betModel_1.default.findById(betId);
            if (bet) {
                try {
                    bet.retryCount += 1;
                    if (bet.retryCount > 1) {
                        bet.status = 'fail';
                    }
                    else {
                        bet.status = 'retry';
                    }
                    yield bet.save();
                }
                catch (error) {
                    db_1.agenda.schedule('in 5 minutes', 'retry bet', { betId });
                }
            }
        });
    }
    settleBet(betId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            db_1.agenda.now('process outcome', { betId, result });
        });
    }
}
exports.default = new BetController();
