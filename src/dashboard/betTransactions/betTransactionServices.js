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
exports.BetTransactionService = void 0;
const betTransactionModel_1 = __importDefault(require("./betTransactionModel"));
const userModel_1 = require("../users/userModel");
class BetTransactionService {
    createBetTransaction(matchId, betAmount, betOdds, teamId, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = new betTransactionModel_1.default({
                matchId: matchId,
                betAmount: betAmount,
                betOdds: betOdds,
                teamId: teamId,
                createdAt: new Date(),
            });
            yield bet.save({ session });
            return bet;
        });
    }
    findPlayerById(id, session) {
        return __awaiter(this, void 0, void 0, function* () {
            return userModel_1.Player.findById(id).session(session || null);
        });
    }
}
exports.BetTransactionService = BetTransactionService;
exports.default = BetTransactionService;
