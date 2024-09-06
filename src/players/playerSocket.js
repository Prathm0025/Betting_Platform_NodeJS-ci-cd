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
class Player {
    constructor(socket, userId, username, credits, io // Initialize io instance in constructor
    ) {
        this.socket = socket;
        this.userId = userId;
        this.username = username;
        this.credits = credits;
        this.io = io; // Assign io instance
        this.initializeHandlers();
        this.betHandler();
    }
    updateSocket(socket) {
        this.socket = socket;
        this.initializeHandlers();
        this.betHandler();
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
                            player.credits = 0; // Ensure credits do not go below zero
                        }
                    }
                    yield player.save();
                    this.credits = player.credits; // Update the local credits value
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
                    case "GET event odds":
                        const eventOddsData = yield storeController_1.default.getEventOdds(res.payload.sport, res.payload.eventId, res.payload.markets, res.payload.regions, res.payload.oddsFormat, res.payload.dateFormat);
                        const { bookmakers } = eventOddsData, data = __rest(eventOddsData, ["bookmakers"]);
                        this.sendData({ type: "GET event odds", data: data });
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
                    case "START":
                        // Handle "START" action if needed
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
        console.log(socket_1.activeRooms, "active");
        this.socket.join(room);
        this.currentRoom = room;
    }
}
exports.default = Player;
