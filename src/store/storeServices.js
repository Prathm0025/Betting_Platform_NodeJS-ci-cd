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
const socket_1 = require("../socket/socket");
const server_1 = require("../server");
const storeController_1 = __importDefault(require("./storeController"));
class StoreService {
    selectBookmaker(bookmakers) {
        let bestBookmaker = null;
        let highestMargin = -Infinity;
        bookmakers.forEach((bookmaker) => {
            bookmaker.markets.forEach((market) => {
                let totalImpliedProbability = 0;
                market.outcomes.forEach((outcome) => {
                    const impliedProbability = 1 / outcome.price;
                    totalImpliedProbability += impliedProbability;
                });
                // Calculate the bookmaker's margin for the current market
                const bookmakerMargin = (totalImpliedProbability - 1) * 100;
                // Update the highest margin and best bookmaker if needed
                if (bookmakerMargin > highestMargin) {
                    highestMargin = bookmakerMargin;
                    bestBookmaker = bookmaker;
                }
            });
        });
        return bestBookmaker;
    }
    updateLiveData() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("i will update the live data");
            const currentActive = this.removeInactiveRooms();
            if (currentActive.size <= 0) {
                console.log("no active rooms to update");
                return;
            }
            for (const sport of currentActive) {
                console.log("sending req again");
                const { live_games, upcoming_games } = yield storeController_1.default.getOdds(sport);
                server_1.io.to(sport).emit("data", {
                    type: "ODDS",
                    data: {
                        live_games,
                        upcoming_games,
                    },
                });
                console.log(`Data broadcasted to room: ${sport}`);
            }
        });
    }
    removeInactiveRooms() {
        const rooms = server_1.io.sockets.adapter.rooms;
        const currentRooms = new Set(rooms.keys());
        socket_1.activeRooms.forEach((room) => {
            if (!currentRooms.has(room)) {
                socket_1.activeRooms.delete(room);
                console.log(`Removed inactive room: ${room}`);
            }
        });
        return socket_1.activeRooms;
    }
}
exports.default = StoreService;
