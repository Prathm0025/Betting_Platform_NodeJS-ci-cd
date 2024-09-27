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
exports.verifySocketToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const config_1 = require("../config/config");
const verifySocketToken = (socket) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            throw new Error("No authentication token provided");
        }
        const decoded = yield jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret, (err, decoded) => {
            if (err) {
                console.error("Token verification failed:", err.message);
                throw new Error(err);
            }
            else {
                if ((decoded === null || decoded === void 0 ? void 0 : decoded.role) === "player") {
                    return decoded;
                }
                else {
                    throw new Error("Only users with role players are allowed here");
                }
            }
        });
        if (!decoded || !decoded.username) {
            throw new Error("Token does not contain required fields");
        }
        const player = yield playerModel_1.default.findOne({ username: decoded.username });
        if (!player) {
            throw new Error("Player not found");
        }
        return Object.assign(Object.assign({}, decoded), { userId: player._id, credits: player.credits });
    }
    catch (error) {
        console.error("Error in token verification:", error.message);
        throw new Error("You are not authenticated");
    }
});
exports.verifySocketToken = verifySocketToken;
