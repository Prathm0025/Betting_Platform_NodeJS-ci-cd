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
const playerModel_1 = __importDefault(require("./playerModel"));
const betController_1 = __importDefault(require("../bets/betController"));
const storeController_1 = __importDefault(require("../store/storeController"));
class Player {
    constructor(socket, userId, username, credits) {
        this.socket = socket;
        this.userId = userId;
        this.username = username;
        this.credits = credits;
        this.messageHandler();
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
    messageHandler() {
        this.socket.on("data", (message) => __awaiter(this, void 0, void 0, function* () {
            try {
                const res = message;
                switch (res.action) {
                    case "INIT":
                        const initData = yield storeController_1.default.getSports();
                        this.sendMessage(initData);
                        break;
                    case "EVENT":
                        const event = res.payload;
                        console.log("Event : ", event);
                        const eventData = yield storeController_1.default.getSportEvents(event);
                        console.log("Event Data : ", eventData);
                        this.sendMessage(eventData);
                        break;
                }
            }
            catch (error) {
                console.log(error);
            }
        }));
    }
    betHandler() {
        this.socket.on("bet", (message) => {
            try {
                const res = message;
                switch (res.action) {
                    case "ADD":
                        const payload = res.payload;
                        betController_1.default.addBet(payload);
                        console.log("BET RECEIVED : ", res.payload);
                        break;
                    case "START":
                        break;
                    default:
                        console.log("UNKOWN ACTION : ", res.payload);
                }
            }
            catch (error) {
                console.error("Error processing bet event:", error);
            }
        });
    }
}
exports.default = Player;
