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
const redisclient_1 = require("../redisclient");
const migration_1 = require("../utils/migration");
class ProcessingQueueWorker {
    constructor() {
        this.tick = 0;
        this.redisClient = redisclient_1.redisClient;
        this.connectDB();
    }
    connectDB() {
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
    startWorker() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Processing Queue Worker Started");
            setInterval(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    console.log("Processing Bet.........");
                    this.redisClient.publish('live-update', 'true');
                    yield this.processBetsFromQueue();
                }
                catch (error) {
                    console.error("Error in setInterval Waiting Queue Worker:", error);
                }
            }), 30000);
        });
    }
    processBetsFromQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            let bets = [];
            const sports = new Set();
            try {
                const betQueue = yield (0, ProcessingQueue_1.getAll)();
                const parsedBetQueue = betQueue.map((bet) => JSON.parse(bet));
                if (Array.isArray(parsedBetQueue)) {
                    for (const bet of parsedBetQueue) {
                        if (bet && bet.sport_key) {
                            if (bet.status === "pending") {
                                bets.push(bet);
                                sports.add(bet.sport_key);
                            }
                            else {
                                yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(bet));
                            }
                        }
                    }
                    const sportKeys = Array.from(sports);
                    if (bets.length > 0) {
                        yield this.processBets(sportKeys, bets);
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
    }
    processBets(sportKeys, bets) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                for (const sport of sportKeys) {
                    const scoresData = yield storeController_1.default.getScoresForProcessing(sport, "3", "iso");
                    if (!scoresData) {
                        continue;
                    }
                    const { completedGames } = scoresData;
                    console.log("COMPLETED GAMES : ", completedGames);
                    for (const game of completedGames) {
                        const betsToBeProcess = bets.filter((b) => b.event_id === game.id);
                        if (betsToBeProcess.length > 0) {
                            for (const bet of betsToBeProcess) {
                                try {
                                    yield this.processCompletedBet(bet._id, game);
                                    yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(bet));
                                }
                                catch (error) {
                                    const parentBet = yield betModel_1.default.findById(bet.key);
                                    if (parentBet) {
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
    processCompletedBet(betDetailId, gameData) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxRetries = 3;
            let retryCount = 0;
            let currentBetDetail = null;
            while (retryCount < maxRetries) {
                try {
                    const betToMigrate = yield betModel_1.BetDetail.findById(betDetailId).lean();
                    console.log("MIGRATING IN PROCESSING QUEUE");
                    yield (0, migration_1.migrateLegacyBet)(betToMigrate);
                    currentBetDetail = yield betModel_1.BetDetail.findById(betDetailId);
                    if (!currentBetDetail) {
                        console.error("BetDetail not found after migration:", betDetailId);
                        return;
                    }
                    const parentBet = yield betModel_1.default.findById(currentBetDetail.key);
                    if (!parentBet) {
                        return;
                    }
                    const playerId = parentBet.player.toString();
                    const player = yield playerModel_1.default.findById(playerId);
                    if (!player) {
                        return;
                    }
                    const agentId = player.createdBy.toString();
                    let result;
                    switch (currentBetDetail.category) {
                        case "h2h":
                            result = this.checkH2HBetResult(currentBetDetail, gameData);
                            break;
                        case "spread":
                            result = this.checkSpreadBetResult(currentBetDetail, gameData);
                            break;
                        case "totals":
                            result = this.checkTotalsBetResult(currentBetDetail, gameData);
                            break;
                        default:
                            console.error(`Unknown bet category: ${currentBetDetail.category}`);
                            return;
                    }
                    if (result === "pending" || result === "failed") {
                        console.log(`Bet is ${result} for BetDetail ID ${currentBetDetail._id}`);
                        return;
                    }
                    currentBetDetail.status = result;
                    currentBetDetail.isResolved = true;
                    yield currentBetDetail.save();
                    console.log(`BetDetail with ID ${currentBetDetail._id} updated to '${result}'`);
                    yield this.checkAndUpdateParentBet(parentBet, player, agentId);
                    break;
                }
                catch (error) {
                    console.error("Error during processing, retrying...", error);
                    if (currentBetDetail) {
                        yield betModel_1.BetDetail.findByIdAndUpdate(betDetailId, {
                            status: 'failed',
                            isResolved: false,
                        });
                    }
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(currentBetDetail));
                        if (currentBetDetail) {
                            const parentBet = yield betModel_1.default.findByIdAndUpdate(currentBetDetail.key, { status: 'failed', isResolved: false });
                            const player = yield playerModel_1.default.findById(parentBet.player);
                            yield this.publishRedisNotification("BET_FAILED", player._id.toString(), player.username, player.createdBy.toString(), parentBet._id.toString(), `Bet failed! We have raised a ticket to your agent. You can contact your agent for further assistance.`, `Player ${player.username}'s bet has failed. Please resolve the bet as soon as possible.`);
                            console.log(`Parent Bet with ID ${currentBetDetail.key} marked as 'failed' due to processing issue.`);
                        }
                        throw error;
                    }
                }
            }
        });
    }
    checkAndUpdateParentBet(parentBet, player, agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedBetDetails = yield betModel_1.BetDetail.find({ _id: { $in: parentBet.data } });
            const anyBetLost = updatedBetDetails.some(detail => detail.status === 'lost');
            const anyBetFailed = updatedBetDetails.some(detail => detail.status === 'failed');
            if (anyBetLost) {
                yield betModel_1.default.findByIdAndUpdate(parentBet._id, { status: 'lost', isResolved: true });
                yield this.publishRedisNotification("BET_LOST", player._id.toString(), player.username, agentId, parentBet._id.toString(), `Unfortunately, you lost your bet (ID: ${parentBet._id}). Better luck next time!`, `A player's bet (ID: ${parentBet._id}) has lost. Please review the details.`);
                return;
            }
            if (anyBetFailed) {
                yield betModel_1.default.findByIdAndUpdate(parentBet._id, { status: 'failed', isResolved: false });
                yield this.publishRedisNotification("BET_FAILED", player._id.toString(), player.username, agentId, parentBet._id.toString(), `Bet failed! We have raised a ticket to your agent. You can contact your agent for further assistance.`, `Player ${player.username}'s bet has failed. Please resolve the bet as soon as possible.`);
                return;
            }
            const allBetsWon = updatedBetDetails.every(detail => detail.status === 'won');
            if (allBetsWon) {
                yield betModel_1.default.findByIdAndUpdate(parentBet._id, { status: 'won', isResolved: true });
                yield this.awardWinningsToPlayer(parentBet.player, parentBet.possibleWinningAmount);
                yield this.publishRedisNotification("BET_WON", player._id.toString(), player.username, agentId, parentBet._id.toString(), `Congratulations! Bet with ID ${parentBet._id} has won. You have been awarded $${parentBet.possibleWinningAmount}.`, `Player ${player.username} has won the bet with ID ${parentBet._id}, and the winnings of $${parentBet.possibleWinningAmount} have been awarded.`);
            }
            else {
                yield betModel_1.default.findByIdAndUpdate(parentBet._id, { isResolved: true });
                console.log(`Parent Bet with ID ${parentBet._id} has been resolved.`);
            }
        });
    }
    awardWinningsToPlayer(playerId, possibleWinningAmount) {
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
    checkH2HBetResult(betDetail, gameData) {
        var _a, _b;
        const betOnTeam = betDetail.bet_on.name;
        if (!gameData.completed) {
            return "pending";
        }
        const homeTeamName = gameData.home_team;
        const awayTeamName = gameData.away_team;
        const homeTeamScore = (_a = gameData.scores.find((team) => team.name === homeTeamName)) === null || _a === void 0 ? void 0 : _a.score;
        const awayTeamScore = (_b = gameData.scores.find((team) => team.name === awayTeamName)) === null || _b === void 0 ? void 0 : _b.score;
        if (homeTeamScore === undefined || awayTeamScore === undefined) {
            return "failed";
        }
        if (homeTeamScore === awayTeamScore) {
            return "draw";
        }
        const gameWinner = homeTeamScore > awayTeamScore ? homeTeamName : awayTeamName;
        return betOnTeam === gameWinner ? "won" : "lost";
    }
    checkSpreadBetResult(betDetail, gameData) {
        var _a, _b;
        const spreadLine = betDetail.bet_on.points;
        const betOnTeam = betDetail.bet_on.name;
        const isFavorite = spreadLine < 0;
        if (!gameData.completed) {
            return "pending";
        }
        const homeTeamName = gameData.home_team;
        const awayTeamName = gameData.away_team;
        const homeTeamScore = (_a = gameData.scores.find((team) => team.name === homeTeamName)) === null || _a === void 0 ? void 0 : _a.score;
        const awayTeamScore = (_b = gameData.scores.find((team) => team.name === awayTeamName)) === null || _b === void 0 ? void 0 : _b.score;
        if (homeTeamScore == null || awayTeamScore == null) {
            return "failed";
        }
        const scoreDifference = homeTeamScore - awayTeamScore;
        if (Math.abs(scoreDifference) === Math.abs(spreadLine)) {
            return "draw";
        }
        // Handle bets on the favorite (negative spread)
        if (isFavorite) {
            if (betOnTeam === homeTeamName && scoreDifference > Math.abs(spreadLine)) {
                return "won"; // Favorite covered the spread
            }
            else if (betOnTeam === awayTeamName && scoreDifference < -Math.abs(spreadLine)) {
                return "won"; // Away team (underdog) won against the spread
            }
            return "lost"; // Favorite didn't cover, or underdog lost by more than the spread
        }
        // Handle bets on the underdog (positive spread)
        if (!isFavorite) {
            if (betOnTeam === homeTeamName && scoreDifference >= spreadLine) {
                return "won"; // Home underdog covered or won outright
            }
            else if (betOnTeam === awayTeamName && scoreDifference <= spreadLine) {
                return "won"; // Away underdog covered or won outright
            }
            return "lost"; // Underdog didn't cover
        }
        return "pending"; // Fallback case, should not reach here
    }
    checkTotalsBetResult(betDetail, gameData) {
        var _a, _b;
        const totalLine = betDetail.bet_on.points;
        const betOn = betDetail.bet_on.name; // 'Over' or 'Under'
        if (!gameData.completed) {
            return "pending";
        }
        const homeTeamScore = (_a = gameData.scores.find((team) => team.name === gameData.home_team)) === null || _a === void 0 ? void 0 : _a.score;
        const awayTeamScore = (_b = gameData.scores.find((team) => team.name === gameData.away_team)) === null || _b === void 0 ? void 0 : _b.score;
        if (homeTeamScore == null || awayTeamScore == null) {
            return "failed";
        }
        // Handle invalid scores (e.g., negative scores)
        if (homeTeamScore < 0 || awayTeamScore < 0) {
            console.error("Error: Invalid scores found (negative values).");
            return "failed";
        }
        const totalScore = homeTeamScore + awayTeamScore;
        if (totalScore === totalLine) {
            console.log("The total score equals the total line. It's a push (draw).");
            return "draw";
        }
        if (betOn === "Over") {
            return totalScore > totalLine ? "won" : "lost";
        }
        else if (betOn === "Under") {
            return totalScore < totalLine ? "won" : "lost";
        }
        return "pending";
    }
    publishRedisNotification(type, playerId, username, agentId, betId, playerMessage, agentMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield redisclient_1.redisClient.publish("bet-notifications", JSON.stringify({
                    type,
                    player: {
                        _id: playerId,
                        username
                    },
                    agent: agentId,
                    betId,
                    playerMessage,
                    agentMessage
                }));
                console.log(`Published ${type} notification for bet ${betId}`);
            }
            catch (error) {
                console.error(`Failed to publish ${type} notification for bet ${betId}:`, error);
            }
        });
    }
}
worker_threads_1.parentPort.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (message === "start") {
        const worker = new ProcessingQueueWorker();
        yield worker.startWorker();
    }
}));
