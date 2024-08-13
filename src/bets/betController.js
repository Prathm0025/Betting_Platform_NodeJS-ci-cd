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
class BetController {
    // constructor() {
    //     this.agenda = new Agenda({ db: { address: config.databaseUrl } });
    // }
    // Method to place a bet
    placeBet(betData) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const commenceTime = new Date(betData.commence_time);
            // Check if the event has already started
            if (commenceTime <= now) {
                console.log('Cannot place a bet after the match has started.');
                return;
            }
            const bet = new betModel_1.default(betData);
            yield bet.save();
            const delay = commenceTime.getTime() - now.getTime();
            if (delay > 0) {
                // Schedule job to lock bet at commence time
                this.agenda.schedule(new Date(Date.now() + delay), 'lock bet', { betId: bet._id.toString() });
            }
            else {
                // This case should not happen because of the above check, but added for safety
                yield this.lockBetImmediately(bet._id.toString());
            }
        });
    }
    initializeAgenda() {
        this.agenda.define('lock bet', (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.lockBet(job.attrs.data.betId);
        }));
        this.agenda.define('process outcome', (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.processOutcomeQueue(job.attrs.data.betId, job.attrs.data.result);
        }));
        this.agenda.define('retry bet', (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.processRetryQueue(job.attrs.data.betId);
        }));
        this.agenda.start();
    }
    lockBetImmediately(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.lockBet(betId);
        });
    }
    lockBet(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = yield betModel_1.default.findById(betId);
            if (bet) {
                try {
                    // Lock the bet (e.g., prevent further modifications)
                    bet.status = 'locked';
                    yield bet.save();
                }
                catch (error) {
                    this.agenda.schedule('in 5 minutes', 'retry bet', { betId });
                }
            }
        });
    }
    processOutcomeQueue(betId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = yield betModel_1.default.findById(betId);
            if (bet) {
                try {
                    // Process bet outcome based on external result
                    bet.status = result;
                    yield bet.save();
                }
                catch (error) {
                    this.agenda.schedule('in 5 minutes', 'retry bet', { betId });
                }
            }
        });
    }
    processRetryQueue(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = yield betModel_1.default.findById(betId);
            if (bet) {
                try {
                    bet.status = 'retry';
                    yield bet.save();
                }
                catch (error) {
                    bet.retryCount += 1;
                    if (bet.retryCount > 1) {
                        bet.status = 'fail';
                    }
                    yield bet.save();
                }
            }
        });
    }
    // Method to trigger outcome processing (e.g., from an external event)
    settleBet(betId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            this.agenda.now('process outcome', { betId, result });
        });
    }
}
exports.default = new BetController();
