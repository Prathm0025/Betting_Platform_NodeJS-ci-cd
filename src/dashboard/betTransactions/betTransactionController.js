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
exports.BetTransactionController = void 0;
const userModel_1 = require("../users/userModel");
const betTransactionModel_1 = __importDefault(require("./betTransactionModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const betTransactionServices_1 = __importDefault(require("./betTransactionServices"));
class BetTransactionController {
    constructor() {
        this.betTransactionService = new betTransactionServices_1.default();
        this.createBet = this.createBet.bind(this);
        this.getAllbets = this.getAllbets.bind(this);
        this.getPlayerBets = this.getPlayerBets.bind(this);
    }
    createBet(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            try {
                session.startTransaction();
                const _req = req;
                const { username, role } = _req.user;
                const { matchId, betOdds, betAmount, teamId } = req.body;
                console.log("body", req.body);
                if (role !== "player") {
                    throw (0, http_errors_1.default)(403, "Forbidden: You do not have the necessary permissions to access this resource.");
                }
                const player = yield userModel_1.Player.findOne({ username });
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player not found!");
                }
                if (!matchId || !betOdds || !betAmount || !teamId) {
                    throw (0, http_errors_1.default)(400, "All fields are required");
                }
                if (player.credits < betAmount) {
                    throw (0, http_errors_1.default)(400, "You have insufficient balance to place this bet");
                }
                const bet = yield this.betTransactionService.createBetTransaction(matchId, betAmount, betOdds, teamId, session);
                player.betTransaction.push(bet._id);
                player.credits = player.credits - betAmount;
                yield player.save();
                yield session.commitTransaction();
                session.endSession();
                res.status(200).json({ message: "Bet Placed Successfully!", bet });
            }
            catch (error) {
                yield session.abortTransaction();
                session.endSession();
                console.error(`Error deleting transaction: ${error.message}`);
                next(error);
            }
        });
    }
    getAllbets(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const _req = req;
                const { username, role } = _req.user;
                if (role !== "superadmin") {
                    throw (0, http_errors_1.default)(400, "You don't have access to this");
                }
                const bets = yield betTransactionModel_1.default.find();
                res.status(200).json({ bets });
            }
            catch (error) {
                next(error);
            }
        });
    }
    getPlayerBets(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const _req = req;
                const { role } = _req.user;
                if (role !== "superadmin") {
                    throw (0, http_errors_1.default)(400, "You don't have access to this");
                }
                const { playerId } = req.params;
                const playerObjectId = new mongoose_1.default.Types.ObjectId(playerId);
                const player = yield this.betTransactionService.findPlayerById(playerObjectId);
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                const betTransactionIds = player.betTransaction;
                const bets = yield betTransactionModel_1.default.find({
                    _id: { $in: betTransactionIds },
                });
                res.status(200).json({ bets });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.BetTransactionController = BetTransactionController;
