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
const betModel_1 = __importStar(require("../bets/betModel"));
const ProcessingQueue_1 = require("../utils/ProcessingQueue");
const config_1 = require("../config/config");
const playerModel_1 = __importDefault(require("../players/playerModel"));
function connectDB() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            mongoose_1.default.connection.on("connected", () => __awaiter(this, void 0, void 0, function* () {
                console.log("Connected to database successfully");
            }));
            mongoose_1.default.connection.on("error", (err) => {
                console.log("Error in connecting to database.", err);
            });
            yield mongoose_1.default.connect(config_1.config.databaseUrl);
        }
        catch (err) {
            console.error("Failed to connect to database.", err);
            process.exit(1);
        }
    });
}
connectDB();
function processBets(sportKeys, bets) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting bet processing...");
        try {
            for (const sport of sportKeys) {
                const scoresData = yield storeController_1.default.getScoresForProcessing(sport, "3", "iso");
                console.log(scoresData, "score data");
                if (!scoresData) {
                    continue;
                }
                const { completedGames } = scoresData;
                //  const oddsData = await Store.getOddsForProcessing(sport)
                for (const game of completedGames) { // CHANGE THIS TO COMPLETD BETS (if not)
                    const betsToBeProcess = bets.filter((b) => b.event_id === game.id);
                    if (betsToBeProcess.length > 0) {
                        for (const bet of betsToBeProcess) {
                            if (bet) {
                                try {
                                    const removalResult = yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(bet));
                                    if (removalResult === 0) {
                                        console.log(`Bet ${bet._id} could not be removed from the queue.`);
                                    }
                                    else {
                                        console.log(`Bet ${bet._id} removed successfully from the queue.`);
                                    }
                                    yield processCompletedBet(bet._id.toString(), game);
                                }
                                catch (error) {
                                    console.log(error);
                                }
                            }
                            else {
                                console.log("No bet found for game:", game.id);
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error("Error during bet processing:", error);
        }
    });
}
// THIS WILL BE CALLED ONLY WHEN MATCH IS COMPLETED
function processCompletedBet(betDetailId, gameData) {
    return __awaiter(this, void 0, void 0, function* () {
        const session = yield mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const betDetail = yield betModel_1.BetDetail.findById(betDetailId).session(session);
            if (!betDetail) {
                console.error("Bet Detail not found:", betDetailId);
                yield session.abortTransaction();
                return;
            }
            const parentBetId = betDetail.key;
            const bet = yield betModel_1.default.findById(parentBetId)
                .populate('data')
                .session(session);
            if (!bet) {
                console.error("Parent Bet not found:", parentBetId);
                yield session.abortTransaction();
                return;
            }
            // for combo bets 
            if (bet.betType === "combo") {
                const allBetDetailsValid = bet.data.every((detail) => detail.status === 'won' || detail.status === 'pending');
                // if any one bet detail is failed under an parent  bet we mark all bet as failed
                if (!allBetDetailsValid) {
                    betDetail.isResolved = true;
                    yield betDetail.save({ session });
                    //NOTIFY AGENT HERE
                    // bet.status = 'failed';
                    // await bet.save({ session }); // Mark parent bet as failed
                    yield session.commitTransaction();
                    return;
                }
            }
            // Await result of processing bet
            yield processBetResult(betDetail, gameData, bet);
            if (processBetResult) {
                betDetail.status = "won";
                yield betDetail.save({ session });
            }
            else {
                betDetail.status = "lost";
                yield betDetail.save({ session });
            }
            const allBetDetails = yield betModel_1.BetDetail.find({ key: bet._id }).session(session);
            const allProcessed = allBetDetails.every(detail => detail.status !== "pending");
            if (allProcessed) {
                bet.status = allBetDetails.every(detail => detail.status === "won") ? "won" : "lost";
                yield bet.save({ session });
            }
            yield session.commitTransaction();
        }
        catch (error) {
            console.error("Error processing completed bet:", error);
            yield session.abortTransaction();
            try {
                const betDetail = yield betModel_1.BetDetail.findById(betDetailId);
                if (betDetail) {
                    betDetail.isResolved = true;
                    yield betDetail.save();
                }
            }
            catch (rollbackError) {
                console.error("Error during rollback:", rollbackError);
            }
        }
        finally {
            session.endSession();
        }
    });
}
function determineWinner(betDetail, gameData, bet) {
    var _a, _b;
    try {
        const betType = betDetail.market;
        console.log(betType, "betType");
        // console.log(gameData, "");
        if (gameData.scores === null) {
            throw new Error("No Scores from the API");
        }
        const homeTeamScore = (_a = gameData === null || gameData === void 0 ? void 0 : gameData.scores) === null || _a === void 0 ? void 0 : _a.find(score => score.name === gameData.home_team).score;
        const awayTeamScore = (_b = gameData === null || gameData === void 0 ? void 0 : gameData.scores) === null || _b === void 0 ? void 0 : _b.find(score => score.name === gameData.away_team).score;
        switch (betType) {
            // case 'spreads':
            //   const { handicap, bet_on: betOn } = betDetail;
            //   let adjustedHomeTeamScore = homeTeamScore + (betOn === 'home_team' ? handicap : 0);
            //   let adjustedAwayTeamScore = awayTeamScore + (betOn === 'away_team' ? handicap : 0);
            //   if (betOn === 'home_team') {
            //     return adjustedHomeTeamScore > awayTeamScore;
            //   } else if (betOn === 'away_team') {
            //     return adjustedAwayTeamScore > homeTeamScore;
            //   } else {
            //     throw new Error("Invalid betOn value for Handicap. It should be home_team or away_team.");
            //   }
            case 'h2h':
                const { bet_on: h2hBetOn } = betDetail;
                if (h2hBetOn === 'home_team') {
                    return homeTeamScore > awayTeamScore;
                }
                else if (h2hBetOn === 'away_team') {
                    return awayTeamScore > homeTeamScore;
                }
                else {
                    throw new Error("Invalid betOn value for H2H. It should be 'home_team' or 'away_team'.");
                }
            // case 'totals':
            //     const { totalLine, overUnder } = options;
            //     let totalScore = teamAScore + teamBScore;
            //     if (overUnder === 'Over') {
            //         return totalScore > totalLine;
            //     } else if (overUnder === 'Under') {
            //         return totalScore < totalLine;
            //     } else {
            //         throw new Error("Invalid overUnder value for Totals. It should be 'Over' or 'Under'.");
            //     }
            default:
                throw new Error("Invalid betType. It should be 'spreads' or 'h2h'.");
        }
    }
    catch (error) {
        console.error("Error determining winner:", error.message);
        throw new Error("An Error occured, maybe no scores");
    }
}
function calculateWinningAmount(stake, odds, oddsType) {
    let winningAmount;
    if (oddsType === 'american') {
        if (odds > 0) {
            winningAmount = stake * (odds / 100);
        }
        else if (odds < 0) {
            winningAmount = stake / (Math.abs(odds) / 100);
        }
        else {
            return stake;
        }
    }
    else if (oddsType === 'decimal') {
        if (odds <= 1) {
            return stake;
        }
        winningAmount = stake * odds - stake;
    }
    else {
        throw new Error('Invalid odds type provided. Use "american" or "decimal".');
    }
    return winningAmount + stake;
}
function processBetResult(betDetail, gameData, bet) {
    return __awaiter(this, void 0, void 0, function* () {
        const isWinner = determineWinner(betDetail, gameData, bet);
        if (!isWinner) {
            return false;
        }
        if (isWinner) {
            console.log(gameData.markets, "market");
            const teamname = betDetail.bet_on === "home_team" ? betDetail.home_team.name : betDetail.away_team.name;
            console.log(teamname, "teamname");
            const type = bet.type;
            const allBetDetailsValid = bet.data.every((betDetail) => betDetail.status === 'won' || betDetail.status === 'pending');
            if (type === "combo" && !allBetDetailsValid) {
                return false;
            }
            const odds = betDetail.bet_on === "home_team" ? betDetail.home_team.odds : betDetail.away_team.odds;
            const winnings = calculateWinningAmount(bet.amount, odds, betDetail.oddsFormat);
            console.log(`Bet won! Winning amount: ${winnings}`);
            const playerId = bet.player;
            const player = yield playerModel_1.default.findById(playerId);
            if (!player) {
                console.log('Player not found.');
                return;
            }
            player.credits = (player.credits || 0) + winnings;
            yield player.save();
            console.log(`Player's credit updated. New credit: ${player.credits}`);
        }
    });
}
// Example usage:
// const stake = 100; // Amount you want to bet
// const americanOdds = -150; // American odds
// const decimalOdds = 2.50; // Decimal odds
// // Calculate for American odds
// const payoutAmerican = calculateWinningAmount(stake, americanOdds, 'american');
// console.log(`Total Payout for American Odds: $${payoutAmerican.toFixed(2)}`);
// // Calculate for Decimal odds
// const payoutDecimal = calculateWinningAmount(stake, decimalOdds, 'decimal');
// console.log(`Total Payout for Decimal Odds: $${payoutDecimal.toFixed(2)}`);
// Example usage for Handicap
// console.log(isBetWinner('Handicap', 2, 1, { handicap: -1.5, betOn: 'A' })); // Output: false
// // Example usage for H2H
// console.log(isBetWinner('H2H', 3, 2, { betOn: 'A' })); // Output: true
// // Example usage for Totals
// console.log(isBetWinner('Totals', 2, 2, { totalLine: 3.5, overUnder: 'Over' })); // Output: true
const processBetsFromQueue = () => __awaiter(void 0, void 0, void 0, function* () {
    let betsData = [];
    const sports = new Set();
    try {
        const betQueue = yield (0, ProcessingQueue_1.getAll)();
        console.log(betQueue, "betqueue");
        const parsedBetQueue = betQueue.map((bet) => JSON.parse(bet));
        if (Array.isArray(parsedBetQueue)) {
            parsedBetQueue.forEach((bet) => {
                if (bet && bet.sport_key) {
                    betsData.push(bet);
                    sports.add(bet.sport_key);
                }
            });
            const sportKeysArray = Array.from(sports);
            console.log(sportKeysArray, "sports key array");
            console.log("Bets data after dequeuing:", betsData);
            if (betsData.length > 0) {
                processBets(sportKeysArray, betsData);
            }
            else {
                console.log("Nothing to process in processing queue");
            }
        }
        else {
            console.log("No bets found in the queue");
        }
    }
    catch (error) {
        console.error('Error fetching or processing queue data:', error);
    }
});
function startWorker() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Processing Queue Worker Started");
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Processing Bet.........");
                yield processBetsFromQueue();
            }
            catch (error) {
                console.error("Error in setInterval Waiting Queue Worker:", error);
            }
        }), 30000);
    });
}
worker_threads_1.parentPort.on('message', (message) => {
    if (message === "start") {
        startWorker();
    }
});
