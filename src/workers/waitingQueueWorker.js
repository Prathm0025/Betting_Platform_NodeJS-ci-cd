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
const migration_1 = require("../utils/migration");
const storeController_1 = __importDefault(require("../store/storeController"));
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
                        yield redisclient_1.redisClient.zrem('waitingQueue', bet);
                        continue;
                    }
                    const multi = redisclient_1.redisClient.multi();
                    multi.lpush('processingQueue', JSON.stringify(betDetail));
                    multi.zrem('waitingQueue', bet);
                    yield multi.exec();
                }
                catch (error) {
                    console.log(`Error processing bet with ID ${betId}:`, error);
                    yield redisclient_1.redisClient.zrem('waitingQueue', bet);
                }
            }
        }
    });
}
function getLatestOddsForAllEvents() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Fetch globalEventRooms data from Redis
            const redisKey = 'globalEventRooms';
            const eventRoomsData = yield redisclient_1.redisClient.get(redisKey);
            if (!eventRoomsData) {
                console.log("No event rooms data found in Redis.");
                return;
            }
            // Parse the data from Redis into a Map<string, Set<string>>
            const eventRoomsMap = new Map(JSON.parse(eventRoomsData, (key, value) => {
                if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
                    return new Set(value);
                }
                return value;
            }));
            for (const [sportKey, eventIdsSet] of eventRoomsMap.entries()) {
                for (const eventId of eventIdsSet) {
                    console.log(eventId, "EVENT ID IN WAITING QUEUE");
                    const latestOdds = yield storeController_1.default.getEventOdds(sportKey, eventId);
                    const oddsUpdate = {
                        eventId,
                        latestOdds,
                    };
                    yield redisclient_1.redisClient.publish("live-update-odds", JSON.stringify(oddsUpdate));
                    console.log(`Published latest odds for event: ${eventId} on channel: live-update-odds`);
                }
            }
        }
        catch (error) {
            console.error("Error fetching latest odds:", error);
        }
    });
}
function migrateAllBetsFromWaitingQueue() {
    return __awaiter(this, void 0, void 0, function* () {
        const bets = yield redisclient_1.redisClient.zrange('waitingQueue', 0, -1);
        for (const bet of bets) {
            const data = JSON.parse(bet);
            const betId = data.betId;
            try {
                let betDetail = yield betModel_1.BetDetail.findById(betId).lean();
                if (!betDetail) {
                    console.log(`BetDetail not found for betId: ${betId}, skipping this bet.`);
                    continue;
                }
                if (!betDetail.key) {
                    console.log(`BetDetail with ID ${betId} is missing the 'key' field, skipping.`);
                    continue;
                }
                const betParent = yield betModel_1.default.findById(betDetail.key).lean();
                if (!betParent) {
                    console.log(`Parent Bet not found for betId: ${betId}, skipping.`);
                    continue;
                }
                yield (0, migration_1.migrateLegacyBet)(betDetail);
            }
            catch (error) {
                console.log(`Error migrating bet with ID ${betId}:`, error);
            }
        }
    });
}
function migrateLegacyResolvedBets() {
    return __awaiter(this, void 0, void 0, function* () {
        const bets = yield betModel_1.BetDetail.find({ status: { $ne: 'pending' } }).lean();
        for (const bet of bets) {
            try {
                yield (0, migration_1.migrateLegacyBet)(bet);
            }
            catch (error) {
                console.log(`Error updating bet with ID ${bet._id}:`, error);
            }
        }
    });
}
function migrateLegacyPendingBets() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get all the bets in the waiting queue in one go
            const queueBets = yield redisclient_1.redisClient.zrange('waitingQueue', 0, -1);
            // Extract bet IDs and store them in a Set for quick lookup
            const waitingQueueBetIds = new Set(queueBets.map(bet => JSON.parse(bet).betId));
            // Find bets with status 'pending' and isResolved as false
            const pendingBets = yield betModel_1.BetDetail.find({ status: 'pending', isResolved: false }).lean();
            for (const bet of pendingBets) {
                try {
                    // Check if the bet is in the waiting queue
                    if (waitingQueueBetIds.has(bet._id.toString())) {
                        console.log(`Bet with ID ${bet._id} is in the waiting queue, skipping migration.`);
                        continue; // Skip this bet if it's in the waiting queue
                    }
                    // If not in the queue, migrate the bet
                    yield (0, migration_1.migrateLegacyBet)(bet);
                }
                catch (error) {
                    console.log(`Error migrating pending bet with ID ${bet._id}:`, error);
                }
            }
        }
        catch (error) {
            console.error("Error during migration of legacy pending bets:", error);
        }
    });
}
function startWorker() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Waiting Queue Worker Started");
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield migrateAllBetsFromWaitingQueue();
                yield migrateLegacyResolvedBets();
                yield migrateLegacyPendingBets();
                yield checkBetsCommenceTime();
                yield getLatestOddsForAllEvents();
            }
            catch (error) {
                console.error("Error in setInterval Waiting Queue Worker:", error);
            }
        }), 30000); // Runs every 30 seconds
    });
}
worker_threads_1.parentPort.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (message === "start") {
        startWorker();
    }
}));
