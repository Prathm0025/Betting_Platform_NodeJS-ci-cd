"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const worker_threads_1 = require("worker_threads");
const mongoose_1 = __importDefault(require("mongoose"));
const storeController_1 = __importDefault(require("../store/storeController"));
const betModel_1 = __importStar(require("./betModel"));
function processBets(sportKeys, bets) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting bet processing...");
        console.log("Bets:", bets.length);
        // sportKeys.push(...Array.from(activeRooms));
        console.log(sportKeys, "worker sport key");
        try {
            for (const sport of sportKeys) {
                console.log("Processing sport:", sport);
                const oddsData = yield storeController_1.default.getOdds(sport);
                if (!oddsData || !oddsData.completed_games) {
                    // console.error(`No data or completed games found for sport: ${sport}`);
                    continue;
                }
                const { completed_games, live_games, upcoming_games } = oddsData;
                worker_threads_1.parentPort.postMessage({
                    type: 'updateLiveData',
                    livedata: oddsData,
                    activeRooms: sportKeys
                });
                // console.log("Live games:", live_games);
                console.log("Upcoming games:", upcoming_games);
                for (const game of completed_games) {
                    const bet = bets.find((b) => b.event_id === game.id);
                    if (bet) {
                        yield processCompletedBet(bet._id.toString(), game);
                        // console.log("Processed bet:", bet._id);
                    }
                    else {
                        console.log("No bet found for game:", game.id);
                    }
                }
            }
        }
        catch (error) {
            console.error("Error during bet processing:", error);
        }
    });
}
function processCompletedBet(betDetailId, gameData) {
    return __awaiter(this, void 0, void 0, function* () {
        const session = yield mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const betDetail = yield betModel_1.BetDetail.findById(betDetailId).session(session);
            if (!betDetail) {
                console.error("BetDetail not found:", betDetailId);
                yield session.abortTransaction();
                return;
            }
            const bet = yield betModel_1.default.findById(betDetail.key).session(session);
            if (!bet) {
                console.error("Parent Bet not found:", betDetail.key);
                yield session.abortTransaction();
                return;
            }
            const winner = determineWinner(betDetail.home_team.name, betDetail.away_team.name, gameData.scores);
            betDetail.status = winner === betDetail.bet_on ? "won" : "lost";
            yield betDetail.save({ session });
            const allBetDetails = yield betModel_1.BetDetail.find({ key: bet._id }).session(session);
            const allProcessed = allBetDetails.every((detail) => detail.status !== "pending");
            if (allProcessed) {
                bet.status = allBetDetails.every((detail) => detail.status === "won")
                    ? "won"
                    : "lost";
                yield bet.save({ session });
            }
            yield session.commitTransaction();
        }
        catch (error) {
            console.error("Error processing completed bet:", error);
            yield session.abortTransaction();
        }
        finally {
            session.endSession();
        }
    });
}
function determineWinner(homeTeam, awayTeam, scores) {
    var _a, _b;
    const homeScore = parseInt(((_a = scores.find((s) => s.name === homeTeam)) === null || _a === void 0 ? void 0 : _a.score) || "0");
    const awayScore = parseInt(((_b = scores.find((s) => s.name === awayTeam)) === null || _b === void 0 ? void 0 : _b.score) || "0");
    return homeScore > awayScore ? "home_team" : awayScore > homeScore ? "away_team" : null;
}
// The worker receives data from the main thread
processBets(worker_threads_1.workerData.sportKeys, worker_threads_1.workerData.bets)
    .then(() => {
    worker_threads_1.parentPort.postMessage("Bet processing completed.");
})
    .catch((error) => {
    console.error("Error during worker processing:", error);
    worker_threads_1.parentPort.postMessage({ error: error.message });
});
