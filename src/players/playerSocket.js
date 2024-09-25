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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playerModel_1 = __importDefault(require("./playerModel"));
const betController_1 = __importDefault(require("../bets/betController"));
const storeController_1 = __importDefault(require("../store/storeController"));
const socket_1 = require("../socket/socket");
const redisclient_1 = require("../redisclient");
class Player {
    constructor(socket, userId, username, credits, io) {
        this.socket = socket;
        this.userId = userId;
        this.username = username;
        this.credits = credits;
        this.io = io;
        this.betSlip = new Map();
        this.initializeHandlers();
        this.initializeRedis();
        this.betHandler();
    }
    initializeRedis() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.redisGetAsync = redisclient_1.redisClient.get.bind(redisclient_1.redisClient);
                this.redisSetAsync = redisclient_1.redisClient.set.bind(redisclient_1.redisClient);
            }
            catch (error) {
                console.error("Redis client connection error:", error);
                this.redisGetAsync = () => __awaiter(this, void 0, void 0, function* () { return null; });
                this.redisSetAsync = () => __awaiter(this, void 0, void 0, function* () { return null; });
            }
        });
    }
    updateSocket(socket) {
        this.socket = socket;
        this.initializeHandlers();
        this.betHandler();
    }
    addBetToSlip(bet) {
        var _a;
        const betId = bet.id;
        if (this.betSlip.has(betId)) {
            // console.log(`Bet with ID ${betId} already exists in the bet slip.`);
            return;
        }
        this.betSlip.set(betId, bet);
        socket_1.eventRooms.set(bet.sport_key, new Set());
        this.joinEventRoom(bet.sport_key, bet.event_id);
        if (!socket_1.playerBets.has(this.username)) {
            socket_1.playerBets.set(this.username, new Set());
        }
        (_a = socket_1.playerBets.get(this.username)) === null || _a === void 0 ? void 0 : _a.add(bet.event_id);
    }
    updateBetAmount(bet, amount) {
        const betId = this.generateBetId(bet);
        const existingBet = this.betSlip.get(betId);
        if (!existingBet) {
            // console.log(`Bet with ID ${betId} not found in the bet slip.`);
            return;
        }
        existingBet.amount = amount;
        // console.log("BET SLIP UPDATED : ", this.betSlip.get(betId));
        this.sendBetSlip();
    }
    removeBetFromSlip(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const bet = (_a = this.betSlip) === null || _a === void 0 ? void 0 : _a.get(betId);
            if (this.betSlip.has(betId)) {
                this.betSlip.delete(betId);
                const roomKey = `${bet.sport_key}:${bet.event_id}`;
                this.socket.leave(roomKey);
                const playerEvents = socket_1.playerBets.get(this.username);
                if (playerEvents) {
                    playerEvents.delete(bet.event_id);
                    if (playerEvents.size === 0) {
                        socket_1.playerBets.delete(this.username);
                    }
                }
                const hasRemainingBets = Array.from(this.betSlip.values()).some(b => b.sport_key === bet.sport_key && b.event_id === bet.event_id);
                if (!hasRemainingBets) {
                    const redisKey = "globalEventRooms";
                    const eventRoomsData = yield this.redisGetAsync(redisKey);
                    let eventRoomsMap = eventRoomsData
                        ? new Map(JSON.parse(eventRoomsData, (key, value) => {
                            if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
                                return new Set(value);
                            }
                            return value;
                        }))
                        : new Map();
                    const eventRedisSet = eventRoomsMap.get(bet.sport_key);
                    if (eventRedisSet) {
                        eventRedisSet.delete(bet.event_id);
                        if (eventRedisSet.size === 0) {
                            eventRoomsMap.delete(bet.sport_key);
                        }
                    }
                    // Update Redis with the modified eventRooms
                    yield this.redisSetAsync(redisKey, JSON.stringify(Array.from(eventRoomsMap.entries(), ([key, set]) => [
                        key,
                        Array.from(set),
                    ])), "EX", 300);
                    // In-memory update (optional, in case you're maintaining another state)
                    const eventSet = socket_1.eventRooms.get(bet.sport_key);
                    if (eventSet) {
                        eventSet.delete(bet.event_id);
                        if (eventSet.size === 0) {
                            socket_1.eventRooms.delete(bet.sport_key);
                        }
                    }
                }
                // console.log("BET SLIP REMOVED: ", bet);
                this.sendBetSlip();
            }
            else {
                this.sendError(`Bet with ID ${betId} not found in the slip.`);
            }
        });
    }
    removeAllBetsFromSlip() {
        for (const [betId, bet] of this.betSlip.entries()) {
            const roomKey = `${bet.sport_key}:${bet.event_id}`;
            this.socket.leave(roomKey);
            const playerEvents = socket_1.playerBets.get(this.userId.toString());
            if (playerEvents) {
                playerEvents.delete(bet.event_id);
                if (playerEvents.size === 0) {
                    socket_1.playerBets.delete(this.userId.toString());
                }
            }
            const hasRemainingBets = Array.from(this.betSlip.values()).some(b => b.sport_key === bet.sport_key && b.event_id === bet.event_id);
            if (!hasRemainingBets) {
                const eventSet = socket_1.eventRooms.get(bet.sport_key);
                if (eventSet) {
                    eventSet.delete(bet.event_id);
                    if (eventSet.size === 0) {
                        socket_1.eventRooms.delete(bet.sport_key);
                    }
                }
            }
            this.betSlip.clear();
            console.log("All bets removed from bet slip");
            this.sendBetSlip();
        }
    }
    sendBetSlip() {
        const betSlipData = Array.from(this.betSlip.values());
        this.sendAlert({ type: "BET_SLIP", payload: betSlipData }); // Send the bet slip to the client
    }
    generateBetId(betDetails) {
        return `${betDetails.event_id}_${betDetails.bet_on.name}_${betDetails.category}_${betDetails.bet_on.odds}`;
    }
    updateBalance(type, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const player = yield playerModel_1.default.findById(this.userId).exec();
                if (player) {
                    if (type === "credit") {
                        player.credits += amount;
                    }
                    else if (type === "debit") {
                        player.credits -= amount;
                        if (player.credits < 0) {
                            player.credits = 0;
                        }
                    }
                    yield player.save();
                    this.credits = player.credits;
                    this.sendAlert({ credits: this.credits });
                }
                else {
                    console.error(`Player with ID ${this.userId} not found.`);
                }
            }
            catch (error) {
                console.error(`Error updating balance for player ${this.userId}:`, error);
            }
        });
    }
    sendMessage(message) {
        try {
            this.socket.emit("message", message);
        }
        catch (error) {
            console.error(`Error sending message for player ${this.userId}:`, error);
        }
    }
    sendError(message) {
        try {
            this.socket.emit("error", { message });
        }
        catch (error) {
            console.error(`Error sending error for player ${this.userId}:`, error);
        }
    }
    sendAlert(message) {
        try {
            this.socket.emit("alert", { message });
        }
        catch (error) {
            console.error(`Error sending alert for player ${this.userId}:`, error);
        }
    }
    sendData(data) {
        try {
            this.socket.emit("data", data);
        }
        catch (error) {
            console.error(`Error sending data for player ${this.userId}:`, error);
        }
    }
    initializeHandlers() {
        this.socket.on("data", (message) => __awaiter(this, void 0, void 0, function* () {
            try {
                const res = message;
                switch (res.action) {
                    case "INIT":
                        // Fetch initial data from Store
                        const sports = yield storeController_1.default.getCategories();
                        this.sendData({ type: "CATEGORIES", data: sports });
                        break;
                    case "CATEGORIES":
                        const categoriesData = yield storeController_1.default.getCategories();
                        this.sendData({
                            type: "CATEGORIES",
                            data: categoriesData,
                        });
                        break;
                    case "CATEGORY_SPORTS":
                        const categorySportsData = yield storeController_1.default.getCategorySports(res.payload);
                        this.sendData({
                            type: "CATEGORY_SPORTS",
                            data: categorySportsData,
                        });
                        break;
                    case "EVENTS":
                        const eventsData = yield storeController_1.default.getEvents(res.payload.sport, res.payload.dateFormat);
                        this.sendData({ type: "EVENTS", data: eventsData });
                        break;
                    case "SCORES":
                        const scoresData = yield storeController_1.default.getScores(res.payload.sport, res.payload.daysFrom, res.payload.dateFormat);
                        this.sendData({ scores: scoresData });
                        break;
                    case "ODDS":
                        const oddsData = yield storeController_1.default.getOdds(res.payload.sport, res.payload.markets, res.payload.regions, this);
                        this.sendData({ type: "ODDS", data: oddsData });
                        this.joinRoom(res.payload.sport);
                        break;
                    case "SEARCH EVENT":
                        const searchEventData = yield storeController_1.default.searchEvent(res.payload.sport, res.payload.query);
                        this.sendData({ type: "SEARCH EVENT", data: searchEventData });
                        break;
                    case "GET event odds":
                        const eventOddsData = yield storeController_1.default.getEventOdds(res.payload.sport, res.payload.eventId, res.payload.markets, res.payload.regions, res.payload.oddsFormat, res.payload.dateFormat);
                        const { bookmakers } = eventOddsData, data = __rest(eventOddsData, ["bookmakers"]);
                        this.sendData({ type: "GET event odds", data: data });
                        this.joinEventRoom(res.payload.sport, res.payload.eventId);
                        break;
                    case "SPORTS":
                        const sportsData = yield storeController_1.default.getSports();
                        this.sendData({ sports: sportsData });
                        break;
                    default:
                        console.warn(`Unknown action: ${res.action}`);
                        this.sendError(`Unknown action: ${res.action}`);
                }
            }
            catch (error) {
                console.log(error);
                this.sendError("An error occurred while processing your request.");
            }
        }));
    }
    betHandler() {
        this.socket.on("bet", (message, callback) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { action, payload } = message;
                switch (action) {
                    case "PLACE":
                        try {
                            // Check if the payload is an array of bets
                            if (Array.isArray(payload.data) &&
                                payload.betType === "single") {
                                for (const bet of payload.data) {
                                    try {
                                        const betRes = yield betController_1.default.placeBet(this, [bet], bet.amount, payload.betType);
                                    }
                                    catch (error) {
                                        console.error("Error adding bet: ", error);
                                        // Send failure acknowledgment to the client for this particular bet
                                        callback({
                                            status: "error",
                                            message: `Failed to place bet: ${bet}.`,
                                        });
                                        return; // Optionally, stop processing further bets on error
                                    }
                                }
                            }
                            else {
                                // Handle single bet case (fallback if payload is not an array)
                                const betRes = yield betController_1.default.placeBet(this, payload.data, payload.amount, payload.betType);
                                console.log("BET RECEIVED AND PROCESSED: ", payload);
                            }
                        }
                        catch (error) {
                            console.error("Error processing bet array: ", error);
                            // Send failure acknowledgment to the client
                            callback({ status: "error", message: "Failed to place bet." });
                        }
                        break;
                    case "ADD_TO_BETSLIP":
                        try {
                            const { data } = payload;
                            this.addBetToSlip(data);
                            callback({ status: "success", message: `Bet added successfully.` });
                        }
                        catch (error) {
                            console.error("Error adding bet to bet slip:", error);
                            callback({ status: "error", message: "Failed to add bet to bet slip." });
                        }
                        break;
                    case "REMOVE_FROM_BETSLIP":
                        let betId;
                        try {
                            betId = payload.betId;
                            this.removeBetFromSlip(betId);
                            callback({ status: "success", message: `Bet with ID ${betId} removed successfully.` });
                        }
                        catch (error) {
                            console.error("Error removing bet from bet slip:", error);
                            callback({ status: "error", message: `Failed to remove bet with ID ${betId}.` });
                        }
                        break;
                    case "REMOVE_ALL_FROM_BETSLIP":
                        try {
                            this.removeAllBetsFromSlip();
                            callback({ status: "success", message: "All bets removed from the bet slip." });
                        }
                        catch (error) {
                            console.error("Error removing all bets from bet slip:", error);
                            callback({ status: "error", message: "Failed to remove all bets from the bet slip." });
                        }
                        break;
                    case "UPDATE_BET_AMOUNT":
                        this.updateBetAmount(payload.bet, payload.amount);
                        break;
                    default:
                        console.log("UNKNOWN ACTION: ", payload);
                        // Send error acknowledgment for unknown actions
                        callback({ status: "error", message: "Unknown action." });
                }
            }
            catch (error) {
                console.error("Error processing bet event:", error);
                // Send failure acknowledgment to the client if an exception occurs
                callback({
                    status: "error",
                    message: "Server error processing the bet.",
                });
            }
        }));
    }
    joinRoom(room) {
        if (this.currentRoom) {
            this.socket.leave(this.currentRoom);
            const clients = this.io.sockets.adapter.rooms.get(this.currentRoom);
            console.log(clients, "clients");
            if (!clients || clients.size === 0) {
                socket_1.activeRooms.delete(this.currentRoom);
                console.log(`Room ${this.currentRoom} removed from activeRooms.`);
            }
        }
        socket_1.activeRooms.add(room);
        // updateLiveData(activeRooms);
        console.log(socket_1.activeRooms.values());
        this.socket.join(room);
        this.currentRoom = room;
    }
    joinEventRoom(sportKey, eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            const redisKey = "globalEventRooms";
            const eventRoomsData = yield this.redisGetAsync(redisKey);
            let eventRoomsMap;
            if (eventRoomsData) {
                eventRoomsMap = new Map(JSON.parse(eventRoomsData, (key, value) => {
                    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
                        return new Set(value);
                    }
                    return value;
                }));
            }
            else {
                eventRoomsMap = new Map();
            }
            if (!eventRoomsMap.has(sportKey)) {
                eventRoomsMap.set(sportKey, new Set());
            }
            const eventRedisSet = eventRoomsMap.get(sportKey);
            eventRedisSet === null || eventRedisSet === void 0 ? void 0 : eventRedisSet.add(eventId);
            const serializedMap = JSON.stringify(Array.from(eventRoomsMap.entries(), ([key, set]) => [
                key,
                Array.from(set),
            ]));
            yield this.redisSetAsync(redisKey, serializedMap, "EX", 300);
            if (!socket_1.eventRooms.has(sportKey)) {
                socket_1.eventRooms.set(sportKey, new Set());
            }
            // Retrieve the Set of event IDs for the sportKey
            const eventSet = socket_1.eventRooms.get(sportKey);
            eventSet === null || eventSet === void 0 ? void 0 : eventSet.add(eventId);
            this.socket.join(`${sportKey}:${eventId}`);
            this.currentRoom = `${sportKey}:${eventId}`;
            // console.log(`Joined room: ${this.currentRoom}`);
        });
    }
}
exports.default = Player;
