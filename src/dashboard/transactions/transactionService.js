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
exports.TransactionService = void 0;
const utils_1 = require("../../utils/utils");
const http_errors_1 = __importDefault(require("http-errors"));
const transactionModel_1 = __importDefault(require("./transactionModel"));
const userModel_1 = require("../users/userModel");
class TransactionService {
    createTransaction(type, client, manager, amount, session) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!((_a = utils_1.rolesHierarchy[manager.role]) === null || _a === void 0 ? void 0 : _a.includes(client.role))) {
                throw (0, http_errors_1.default)(403, `${manager.role} cannot perform transactions with ${client.role}`);
            }
            if (type === "recharge") {
                if (manager.credits < amount) {
                    throw (0, http_errors_1.default)(400, "Insufficient credits to recharge");
                }
                client.credits += amount;
                client.totalRecharged += amount;
                manager.credits -= amount;
            }
            else if (type === "redeem") {
                if (client.credits < amount) {
                    throw (0, http_errors_1.default)(400, "Client has insufficient credits to redeem");
                }
                client.credits -= amount;
                client.totalRedeemed += amount;
                manager.credits += amount;
            }
            const transaction = new transactionModel_1.default({
                debtor: type === "recharge" ? client.username : manager.username,
                creditor: type === "recharge" ? manager.username : client.username,
                type: type,
                amount: amount,
                createdAt: new Date(),
            });
            yield transaction.save({ session });
            return transaction;
        });
    }
    getTransactions(username, page, limit, query) {
        return __awaiter(this, void 0, void 0, function* () {
            const skip = (page - 1) * limit;
            const user = (yield userModel_1.User.findOne({ username })) ||
                (yield userModel_1.Player.findOne({ username }));
            if (!user) {
                throw new Error("User not found");
            }
            const totalTransactions = yield transactionModel_1.default.countDocuments(Object.assign({ $or: [{ debtor: user.username }, { creditor: user.username }] }, query));
            const totalPages = Math.ceil(totalTransactions / limit);
            if (totalTransactions === 0) {
                return {
                    transactions: [],
                    totalTransactions: 0,
                    totalPages: 0,
                    currentPage: 0,
                    outOfRange: false,
                };
            }
            if (page > totalPages) {
                return {
                    transactions: [],
                    totalTransactions,
                    totalPages,
                    currentPage: page,
                    outOfRange: true,
                };
            }
            const transactions = yield transactionModel_1.default.find(Object.assign({ $or: [{ debtor: user.username }, { creditor: user.username }] }, query))
                .skip(skip)
                .limit(limit);
            return {
                transactions,
                totalTransactions,
                totalPages,
                currentPage: page,
                outOfRange: false,
            };
        });
    }
    deleteTransaction(id, session) {
        return transactionModel_1.default.findByIdAndDelete(id).session(session);
    }
}
exports.TransactionService = TransactionService;
exports.default = TransactionService;
