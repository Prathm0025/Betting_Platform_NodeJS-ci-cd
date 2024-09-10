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
const notificationController_1 = __importDefault(require("../notifications/notificationController"));
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
        try {
            for (const sport of sportKeys) {
                const scoresData = yield storeController_1.default.getScoresForProcessing(sport, "3", "iso");
                if (!scoresData) {
                    continue;
                }
                const { completedGames } = scoresData;
                console.log("COMPLETED GAMES : ", scoresData);
                for (const game of completedGames) {
                    const betsToBeProcess = bets.filter((b) => b.event_id === game.id);
                    if (betsToBeProcess.length > 0) {
                        for (const bet of betsToBeProcess) {
                            try {
                                yield processCompletedBet(bet._id.toString(), game);
                                yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(bet));
                            }
                            catch (error) {
                                // In case of error, mark the parent bet as unresolved
                                console.error(`Error during processing of bet detail with ID ${bet._id}:`, error);
                                // Retrieve the parent bet of the current bet detail
                                const parentBet = yield betModel_1.default.findById(bet.key); // Assuming `key` references the parent bet
                                if (parentBet) {
                                    // Mark the parent bet as unresolved
                                    yield betModel_1.default.findByIdAndUpdate(parentBet._id, { isResolved: false });
                                    console.log(`Parent Bet with ID ${parentBet._id} marked as unresolved due to an error in processing bet detail.`);
                                }
                                else {
                                    console.error(`Parent bet not found for bet detail ID ${bet._id}.`);
                                }
                                yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(bet));
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
// If any bet is lost then mark it as unresolved
// and remove all the bets associated with it from waiting queue and processing queue 
function processCompletedBet(betDetailId, gameData) {
    return __awaiter(this, void 0, void 0, function* () {
        const maxRetries = 3;
        let retryCount = 0;
        let currentBetDetail;
        while (retryCount < maxRetries) {
            try {
                console.log("Associated game data:", JSON.stringify(gameData, null, 2));
                // Find the current BetDetail
                currentBetDetail = yield betModel_1.BetDetail.findById(betDetailId).lean();
                if (!currentBetDetail) {
                    console.error("BetDetail not found:", betDetailId);
                    return;
                }
                console.log("CURRENT BET : ", currentBetDetail);
                // Find the parent Bet associated with the BetDetail
                const parentBet = yield betModel_1.default.findById(currentBetDetail.key);
                if (!parentBet) {
                    console.error("Parent Bet not found for betDetail:", currentBetDetail._id);
                    return;
                }
                console.log("PARENT : ", parentBet);
                // Process the current bet result
                const result = checkIfPlayerWonBet(currentBetDetail, gameData);
                if (["won", "lost", "draw"].includes(result)) {
                    // Update the BetDetail status
                    currentBetDetail.status = result;
                    yield currentBetDetail.save();
                    console.log(`BetDetail with ID ${currentBetDetail._id} updated to '${result}'`);
                }
                // Fetch the updated BetDetail to ensure status change
                currentBetDetail = yield betModel_1.BetDetail.findById(currentBetDetail._id).lean();
                console.log("UPDATED BET DETAIL: ", currentBetDetail);
                // After updating the current BetDetail, check the status of all BetDetails
                const updatedBetDetails = yield betModel_1.BetDetail.find({ _id: { $in: parentBet.data } });
                // Log the updated details
                console.log("UPDATED BET : ", updatedBetDetails);
                // Check if any BetDetail is lost or failed
                const anyBetLost = updatedBetDetails.some(detail => detail.status === 'lost');
                const anyBetFailed = updatedBetDetails.some(detail => detail.status === 'failed');
                // If any bet is lost, mark the parent bet as lost and stop further processing
                if (anyBetLost) {
                    yield betModel_1.default.findByIdAndUpdate(parentBet._id, { status: 'lost', isResolved: true });
                    console.log(`Parent Bet with ID ${parentBet._id} updated to 'lost'`);
                    return; // Stop processing other bet details under this parent
                }
                // If any bet fails, mark the parent bet as failed and stop further processing
                if (anyBetFailed) {
                    yield betModel_1.default.findByIdAndUpdate(parentBet._id, { status: 'failed', isResolved: false });
                    console.log(`Parent Bet with ID ${parentBet._id} updated to 'failed' due to one or more failed bets.`);
                    return; // Stop processing other bet details under this parent
                }
                // Check if all BetDetails are won
                const allBetsWon = updatedBetDetails.every(detail => detail.status === 'won');
                console.log("ALL WON : ", allBetsWon);
                // If all BetDetails are won, mark the parent bet as won and award the winnings
                if (allBetsWon) {
                    yield betModel_1.default.findByIdAndUpdate(parentBet._id, { status: 'won', isResolved: true });
                    yield awardWinningsToPlayer(parentBet.player, parentBet.possibleWinningAmount);
                    console.log(`Parent Bet with ID ${parentBet._id} won and winnings awarded.`);
                }
                else {
                    // If all bets are resolved (either won or lost), mark the parent Bet as resolved
                    yield betModel_1.default.findByIdAndUpdate(parentBet._id, { isResolved: true });
                    console.log(`Parent Bet with ID ${parentBet._id} has been resolved.`);
                }
                break;
            }
            catch (error) {
                console.error("Error during processing, retrying...", error);
                // If an error occurs, mark the BetDetail as 'failed' and set isResolved to false
                if (currentBetDetail) {
                    yield betModel_1.BetDetail.findByIdAndUpdate(betDetailId, {
                        status: 'failed',
                        isResolved: false,
                    });
                    console.log(`BetDetail with ID ${betDetailId} marked as 'failed' due to error.`);
                }
                retryCount++;
                if (retryCount >= maxRetries) {
                    console.error("Max retries reached. Aborting processing.");
                    // Remove the failed bet from the processing queue
                    yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(currentBetDetail));
                    console.log(`Removed BetDetail with ID ${currentBetDetail._id} from processing queue.`);
                    // Mark the parent bet as failed due to a processing issue
                    if (currentBetDetail) {
                        const parentBet = yield betModel_1.default.findByIdAndUpdate(currentBetDetail.key, { status: 'failed', isResolved: false });
                        const player = yield playerModel_1.default.findById(parentBet.player);
                        const targetId = player.createdBy;
                        const parentBetId = parentBet._id;
                        notificationController_1.default.createNotification(player._id, targetId, 'error', `Parent Bet with ID ${currentBetDetail.key} marked as 'failed' due to processing issue.`, "bet", parentBetId, "refund");
                        console.log(`Parent Bet with ID ${currentBetDetail.key} marked as 'failed' due to processing issue.`);
                    }
                    throw error;
                }
            }
        }
    });
}
function checkIfPlayerWonBet(betDetail, gameData) {
    var _a, _b;
    // check if the game is completed
    if (!gameData.completed) {
        console.log("Game is not yet completed.");
        return "pending";
    }
    // extract the scores from the game data
    const homeTeamScore = (_a = gameData.scores.find(team => team.name === gameData.home_team)) === null || _a === void 0 ? void 0 : _a.score;
    const awayTeamScore = (_b = gameData.scores.find(team => team.name === gameData.away_team)) === null || _b === void 0 ? void 0 : _b.score;
    if (homeTeamScore === undefined || awayTeamScore === undefined) {
        console.error("Error: Could not find scores for the teams.");
        return "failed";
    }
    // Check if it's a draw
    if (homeTeamScore === awayTeamScore) {
        console.log("The game ended in a draw.");
        return "draw";
    }
    // Check if the user bet on the home team or away team
    const userBetOn = betDetail.bet_on;
    let userWon = false;
    if (userBetOn === "home_team") {
        // check id the home team won
        userWon = homeTeamScore > awayTeamScore;
    }
    else if (userBetOn === "away_team") {
        // Check if the away team won
        userWon = awayTeamScore > homeTeamScore;
    }
    return userWon ? "won" : "lost";
}
function awardWinningsToPlayer(playerId, possibleWinningAmount) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Find the player and update their balance
            const player = yield playerModel_1.default.findById(playerId);
            if (!player) {
                console.log(`Player with ID ${playerId} not found.`);
                return;
            }
            // Add the possible winning amount to the player's balance
            player.credits += possibleWinningAmount;
            // Save the updated player data
            yield player.save();
            console.log(`Awarded ${possibleWinningAmount} to player with ID ${player._id}`);
        }
        catch (error) {
            console.error("Error updating player's balance:", error);
        }
    });
}
const processBetsFromQueue = () => __awaiter(void 0, void 0, void 0, function* () {
    let bets = [];
    const sports = new Set();
    try {
        const betQueue = yield (0, ProcessingQueue_1.getAll)();
        const parsedBetQueue = betQueue.map((bet) => JSON.parse(bet));
        // Ensure parsedBetQueue is an array
        if (Array.isArray(parsedBetQueue)) {
            // Process each bet item in the parsed queue
            for (const bet of parsedBetQueue) {
                if (bet && bet.sport_key) {
                    if (bet.status === "pending") {
                        bets.push(bet); // Add to betsData
                        sports.add(bet.sport_key); // Add sport_key to the Set
                    }
                    else {
                        // If bet is not pending, remove it from the queue
                        console.log(`Removing bet with ID ${bet._id} from the queue as it is not pending (status: ${bet.status})`);
                        yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(bet));
                    }
                }
            }
            const sportKeys = Array.from(sports);
            console.log(sportKeys, "sports key array");
            console.log("Bets data after dequeuing:", bets);
            if (bets.length > 0) {
                yield processBets(sportKeys, bets); // Process bets if data exists
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
