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
        console.log("Bets:", bets.length);
        try {
            for (const sport of sportKeys) {
                const oddsData = yield storeController_1.default.getOdds(sport);
                if (!oddsData || !oddsData.completed_games) {
                    continue;
                }
                const { completed_games, live_games, future_upcoming_games, todays_upcoming_games } = oddsData;
                const allGames = [
                    ...completed_games,
                    ...live_games,
                    ...future_upcoming_games,
                    ...todays_upcoming_games
                ];
                for (const game of completed_games) {
                    const bet = bets.find((b) => b.event_id === game.id);
                    if (bet) {
                        try {
                            yield processCompletedBet(bet._id.toString(), game);
                        }
                        catch (error) {
                            console.error(`Error processing bet ${bet._id}:`, error);
                        }
                        finally {
                            for (const processedBets of bets) {
                                const removalResult = yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(processedBets));
                                if (removalResult === 0) {
                                    console.log(`Bet ${bet._id} could not be removed from the queue.`);
                                }
                                else {
                                    console.log(`Bet ${bet._id} removed successfully from the queue.`);
                                }
                            }
                        }
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
            var parentBetId = betDetail.key;
            console.log(betDetail, "bet detail");
            const bet = yield betModel_1.default.findById(betDetail.key)
                .populate('data')
                .session(session);
            if (!bet) {
                console.error("Parent Bet not found:", betDetail.key);
                yield session.abortTransaction();
                return;
            }
            const allBetDetailsValid = bet.data.every((betDetail) => betDetail.status === 'won' || betDetail.status === 'pending');
            if (!allBetDetailsValid) {
                // Update all bet details to 'failed'
                yield Promise.all(bet.data.map((betDetail) => __awaiter(this, void 0, void 0, function* () {
                    if (betDetail.status !== 'won' && betDetail.status !== 'pending') {
                        betDetail.status = 'failed'; // Update status to 'failed'
                        yield betDetail.save({ session }); // Save the updated BetDetail within the transaction session
                    }
                })));
                // Update the parent bet status to 'failed'
                bet.status = 'failed';
                yield bet.save({ session });
                console.log("All invalid bet details and parent bet have been updated to 'failed'.");
                return;
            }
            else {
                bet.status = "won";
                yield bet.save({ session });
            }
            const winner = yield processBetResult(betDetail, gameData, bet);
            betDetail.status = "won";
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
            // Set bet status to 'failed' and refund bet amount in case of failure
            const betDetail = yield betModel_1.BetDetail.findById(betDetailId);
            console.log(betDetail, "betDeab");
            if (betDetail) {
                betDetail.status = "failed";
                yield betDetail.save();
            }
            const bet = yield betModel_1.default.findById(betDetail.key)
                .session(session);
            const betAmount = bet.amount;
            const player = yield playerModel_1.default.findById(bet.player);
            if (player) {
                console.log(player.credits, "credits before");
                player.credits += betAmount;
                console.log(player.credits, "credits after");
                yield player.save();
                console.log(`Refunded ${bet.amount} to player ${player._id} due to failure.`);
            }
            yield session.abortTransaction();
        }
        finally {
            session.endSession();
        }
    });
}
// function determineWinner(homeTeam, awayTeam, scores) {
//   const homeScore = parseInt(scores.find((s) => s.name === homeTeam)?.score || "0");
//   const awayScore = parseInt(scores.find((s) => s.name === awayTeam)?.score || "0");
//   return homeScore > awayScore ? "home_team" : awayScore > homeScore ? "away_team" : null;
// }
function determineWinner(betDetail, gameData, bet) {
    try {
        console.log(bet, "bet");
        const betType = betDetail.market;
        console.log(betType, "betType");
        const homeTeamScore = gameData.scores.find(score => score.name === gameData.home_team).score;
        const awayTeamScore = gameData.scores.find(score => score.name === gameData.away_team).score;
        switch (betType) {
            case 'spreads':
                const { handicap, bet_on: betOn } = betDetail;
                let adjustedHomeTeamScore = homeTeamScore + (betOn === 'home_team' ? handicap : 0);
                let adjustedAwayTeamScore = awayTeamScore + (betOn === 'away_team' ? handicap : 0);
                if (betOn === 'home_team') {
                    return adjustedHomeTeamScore > awayTeamScore;
                }
                else if (betOn === 'away_team') {
                    return adjustedAwayTeamScore > homeTeamScore;
                }
                else {
                    throw new Error("Invalid betOn value for Handicap. It should be home_team or away_team.");
                }
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
            // Positive American odds
            winningAmount = stake * (odds / 100);
        }
        else if (odds < 0) {
            // Negative American odds
            winningAmount = stake / (Math.abs(odds) / 100);
        }
        else {
            // Invalid American odds
            return stake;
        }
    }
    else if (oddsType === 'decimal') {
        if (odds <= 1) {
            // Decimal odds of 1 or less indicate no profit
            return stake; // You only get your stake back
        }
        // Total payout for decimal odds
        winningAmount = stake * odds - stake;
    }
    else {
        throw new Error('Invalid odds type provided. Use "american" or "decimal".');
    }
    // Return the total payout which is the winning amount plus the original stake
    return winningAmount + stake;
}
function processBetResult(betDetail, gameData, bet) {
    return __awaiter(this, void 0, void 0, function* () {
        const isWinner = determineWinner(betDetail, gameData, bet);
        if (isWinner) {
            console.log(gameData.markets, "market");
            const market = gameData.markets.find((m) => m.key === bet.market);
            // Find the outcome for the specified team
            const teamname = betDetail.bet_on === "home_team" ? betDetail.home_team.name : betDetail.away_team.name;
            console.log(teamname, "teamname");
            const type = bet.type;
            const allBetDetailsValid = bet.data.every((betDetail) => betDetail.status === 'won' || betDetail.status === 'pending');
            if (type === "combo" && !allBetDetailsValid) {
                return;
            }
            // const outcome = market?.outcomes?.find((o) => o.name === teamname )||[];
            // console.log(outcome, "outcome");
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
        else {
            console.log('Bet lost. No winnings.');
            return 0; // No winnings if the bet is lost
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
        // Parse the stringified betQueue data
        const parsedBetQueue = betQueue.map((bet) => JSON.parse(bet));
        // Ensure parsedBetQueue is an array
        if (Array.isArray(parsedBetQueue)) {
            // Process each bet item in the parsed queue
            parsedBetQueue.forEach((bet) => {
                // Ensure bet is an object and has sport_key
                if (bet && bet.sport_key) {
                    betsData.push(bet); // Add to betsData
                    sports.add(bet.sport_key); // Add sport_key to the Set
                }
            });
            const sportKeysArray = Array.from(sports);
            console.log(sportKeysArray, "sports key array");
            console.log("Bets data after dequeuing:", betsData);
            if (betsData.length > 0) {
                processBets(sportKeysArray, betsData); // Process bets if data exists
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
        }), 30000); // Runs every 30 seconds
    });
}
worker_threads_1.parentPort.on('message', (message) => {
    if (message === "start") {
        startWorker();
    }
});
