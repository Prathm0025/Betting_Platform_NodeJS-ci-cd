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
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const socket_1 = require("../socket/socket");
const initWorker_1 = require("../workers/initWorker");
const ioredis_1 = require("ioredis");
const storeController_1 = __importDefault(require("../store/storeController"));
const notificationController_1 = __importDefault(require("../notifications/notificationController"));
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        (() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const redisForSub = new ioredis_1.Redis(config_1.config.redisUrl);
                yield redisForSub.subscribe("live-update");
                yield redisForSub.subscribe("bet-notifications");
                redisForSub.on("message", (channel, message) => __awaiter(void 0, void 0, void 0, function* () {
                    if (channel === "bet-notifications") {
                        try {
                            const notificationData = JSON.parse(message);
                            const { type, player, agent, betId, playerMessage, agentMessage } = notificationData;
                            const playerNotification = yield notificationController_1.default.createNotification('alert', { message: playerMessage, betId: betId }, player._id);
                            const agentNotification = yield notificationController_1.default.createNotification('alert', { message: agentMessage, betId: betId }, agent);
                            const playerSocket = socket_1.users.get(player.username);
                            if (playerSocket && playerSocket.socket.connected) {
                                playerSocket.sendAlert({
                                    type: "NOTIFICATION",
                                    payload: playerNotification
                                });
                            }
                            console.log(`Notification of type ${type} for bet ID ${betId} processed.`);
                        }
                        catch (error) {
                            console.error('Error processing notification:', error);
                        }
                    }
                    else {
                        yield storeController_1.default.updateLiveData();
                    }
                }));
            }
            catch (err) {
                console.log(err);
            }
        }))();
        mongoose_1.default.connection.on("connected", () => __awaiter(void 0, void 0, void 0, function* () {
            console.log("Connected to database successfully");
        }));
        mongoose_1.default.connection.on("error", (err) => {
            console.log("Error in connecting to database.", err);
        });
        yield mongoose_1.default.connect(config_1.config.databaseUrl);
        const activeRoomsData = Array.from(socket_1.activeRooms);
        console.log(activeRoomsData, socket_1.activeRooms);
        (0, initWorker_1.startWorkers)();
    }
    catch (err) {
        console.error("Failed to connect to database.", err);
        process.exit(1);
    }
});
exports.default = connectDB;
