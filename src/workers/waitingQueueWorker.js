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
exports.checkBetsCommenceTime = checkBetsCommenceTime;
const redisclient_1 = require("../redisclient");
const mongoose_1 = __importDefault(require("mongoose"));
const betModel_1 = __importStar(require("../bets/betModel"));
const config_1 = require("../config/config");
const worker_threads_1 = require("worker_threads");
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
function checkBetsCommenceTime() {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date().getTime();
        const bets = yield redisclient_1.redisClient.zrangebyscore('waitingQueue', 0, now);
        for (const bet of bets) {
            const data = JSON.parse(bet);
            const commenceTime = data.commence_time;
            const betId = data.betId;
            if (now >= new Date(commenceTime).getTime()) {
                try {
                    const betDetail = yield betModel_1.BetDetail.findById(betId).lean();
                    const betParent = yield betModel_1.default.findById(betDetail.key).lean();
                    if (!betDetail || !betParent) {
                        console.log(`BetDetail or BetParent not found for betId: ${betId}, removing from queue`);
                        // Remove the problematic bet from the waiting queue
                        yield redisclient_1.redisClient.zrem('waitingQueue', bet);
                        continue; // Skip further processing for this bet
                    }
                    const multi = redisclient_1.redisClient.multi();
                    // Add the entire betDetail data to the processing queue
                    multi.lpush('processingQueue', JSON.stringify(betDetail));
                    // Remove the bet from the waiting queue
                    multi.zrem('waitingQueue', bet);
                    yield multi.exec();
                }
                catch (error) {
                    console.log(`Error processing bet with ID ${betId}:`, error);
                    // Remove the problematic bet from the waiting queue if an error occurs
                    yield redisclient_1.redisClient.zrem('waitingQueue', bet);
                }
            }
        }
    });
}
function startWorker() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Waiting Queue Worker Started");
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Checking bets commence time...");
                yield checkBetsCommenceTime();
            }
            catch (error) {
                console.error("Error in setInterval Waiting Queue Worker:", error);
            }
        }), 30000); // Runs every 30 seconds
    });
}
const bets = [];
function getAllBetsForPlayerAndUpdateStatus(playerId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Ensure the provided playerId is a valid MongoDB ObjectId
            if (!mongoose_1.default.Types.ObjectId.isValid(playerId)) {
                throw new Error('Invalid player ID');
            }
            // Find all bets for the given playerId and populate the BetDetail data
            const bets = yield betModel_1.default.find({ player: playerId })
                .populate({
                path: 'data', // Populate the 'data' field referencing BetDetail
                model: 'BetDetail',
            })
                .lean(); // Use lean() for performance boost
            if (!bets || bets.length === 0) {
                console.log(`No bets found for player with ID: ${playerId}`);
                return [];
            }
            // Update each BetDetail and the parent Bet
            for (const bet of bets) {
                const betDetailsIds = bet.data.map(detail => detail._id);
                // Update all bet details to status 'pending' and isResolved 'false'
                yield betModel_1.BetDetail.updateMany({ _id: { $in: betDetailsIds } }, { $set: { status: 'pending', isResolved: false } });
                // Update the parent bet to status 'pending'
                yield betModel_1.default.findByIdAndUpdate(bet._id, { status: 'pending', isResolved: false });
            }
            return bets; // Return the bets with updated status for further use
        }
        catch (error) {
            console.error(`Error retrieving or updating bets for player with ID ${playerId}:`, error);
            throw error; // Rethrow the error to handle it in the calling function
        }
    });
}
function addMultipleBetsToProcessingQueue(bets) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Start a Redis multi transaction to push multiple bets at once
            const multi = redisclient_1.redisClient.multi();
            // Loop through each bet and add to Redis multi command
            for (const bet of bets) {
                // Serialize each bet object to a JSON string
                const serializedBet = JSON.stringify(bet);
                // Add the serialized bet to the processingQueue
                multi.lpush('processingQueue', serializedBet);
            }
            // Execute all commands in the multi queue
            yield multi.exec();
            console.log(`${bets.length} bets added to processingQueue`);
        }
        catch (error) {
            console.error("Error adding bets to processing queue:", error);
        }
    });
}
function extractDataField(betsArray) {
    let extractedData = [];
    for (let bet of betsArray) {
        if (bet.data && Array.isArray(bet.data)) {
            extractedData = [...extractedData, ...bet.data];
        }
    }
    return extractedData;
}
worker_threads_1.parentPort.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (message === "start") {
        startWorker();
        // const bets = await getAllBetsForPlayerAndUpdateStatus('66dee5b9cae56250cc64b370')
        // const data = extractDataField(bets)
        // console.log(data);
        // await addMultipleBetsToProcessingQueue(data)
    }
}));
