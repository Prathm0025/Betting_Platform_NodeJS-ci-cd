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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userModel_1 = __importDefault(require("../users/userModel"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const transactionModel_1 = __importDefault(require("./transactionModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const socket_1 = require("../socket/socket");
class TransactionService {
    //RECORDING TRANSACTION AND ABORTING USING SESSIONS
    static performTransaction(senderId, receiverId, sender, receiver, senderModel, receiverModel, type, amount, role) {
        return __awaiter(this, void 0, void 0, function* () {
            //sender and receiver
            //sender-> User who wants to recharge or redeem
            //reciever-> User getting recharged or redeemed 
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                if (amount <= 0) {
                    throw (0, http_errors_1.default)(400, "Transaction amount must be greater than zero.");
                }
                const senderModelInstance = this.getModelInstance(senderModel);
                const receiverModelInstance = this.getModelInstance(receiverModel);
                this.validateCredits(type, sender, receiver, amount);
                yield this.updateCredits(type, senderId, receiverId, senderModel, receiverModel, senderModelInstance, receiverModelInstance, amount, session);
                // to store sender and receiver for DB sendr and reciever field we need to find  who is getting money and who is giving money
                const senderUser = type === "redeem" ? receiverId : senderId; // recieverId is the user who is getting recharged or redeemed
                const receiverUser = type === "redeem" ? senderId : receiverId; //senderId is user who is redeeming or recharging
                //to get the model of sender and reciever
                const senderModelForDB = type === "redeem" ? receiverModel : senderModel;
                const receiverModelForDB = type === "redeem" ? senderModel : receiverModel;
                yield transactionModel_1.default.create([{
                        sender: senderUser,
                        receiver: receiverUser,
                        senderModel: senderModelForDB,
                        receiverModel: receiverModelForDB,
                        type,
                        amount,
                    }], { session });
                yield session.commitTransaction();
                console.log("Transaction committed successfully");
            }
            catch (error) {
                yield session.abortTransaction();
                console.error("Transaction aborted due to error:", error.message);
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    static getModelInstance(modelName) {
        switch (modelName) {
            case "User":
                return userModel_1.default;
            case "Player":
                return playerModel_1.default;
            default:
                throw (0, http_errors_1.default)(500, "Unknown model name");
        }
    }
    static validateCredits(type, sender, receiver, amount) {
        if (type === "recharge" && sender.credits < amount) {
            throw (0, http_errors_1.default)(400, "Insufficient credits in account for recharge.");
        }
        if (type === "redeem" && receiver.credits < amount) {
            throw (0, http_errors_1.default)(400, "Insufficient credits in  account for redemption.");
        }
    }
    static updateCredits(type, senderId, receiverId, senderModel, receiverModel, senderModelInstance, receiverModelInstance, amount, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const senderUpdate = type === "recharge" ? -amount : amount;
            const receiverUpdate = type === "recharge" ? amount : -amount;
            yield senderModelInstance.updateOne({ _id: senderId }, { $inc: { credits: senderUpdate } }, { session });
            yield receiverModelInstance.updateOne({ _id: receiverId }, { $inc: { credits: receiverUpdate } }, { session });
            if (type === "recharge") {
                yield receiverModelInstance.updateOne({ _id: receiverId }, { $inc: { totalRecharge: amount } }, { session });
                yield senderModelInstance.updateOne({ _id: senderId }, { $inc: { totalRedeem: amount } }, { session });
            }
            else if (type === "redeem") {
                yield senderModelInstance.updateOne({ _id: senderId }, { $inc: { totalRecharge: amount } }, { session });
                yield receiverModelInstance.updateOne({ _id: receiverId }, { $inc: { totalRedeem: amount } }, { session });
            }
            yield this.handlePlayerUpdate(senderModel, senderId, session);
            yield this.handlePlayerUpdate(receiverModel, receiverId, session);
        });
    }
}
exports.TransactionService = TransactionService;
_a = TransactionService;
TransactionService.handlePlayerUpdate = (model, id, session) => __awaiter(void 0, void 0, void 0, function* () {
    if (model === "Player") {
        const player = yield playerModel_1.default.findById(id).session(session);
        if (player) {
            const playerName = player.username;
            const playerSocket = socket_1.users.get(playerName);
            if (playerSocket) {
                playerSocket.sendData({ type: "CREDITS", credits: player.credits });
            }
        }
    }
});
// import mongoose from "mongoose";
// import { ITransaction } from "./transactionType";
// import { rolesHierarchy } from "../utils/utils";
// import createHttpError from "http-errors";
// import Transaction from "./transactionModel";
// import { Player, User } from "../usersTest/userModel";
// import { QueryParams } from "../utils/utils";
// export class TransactionService {
//   async createTransaction(
//     type: string,
//     client: any,
//     manager: any,
//     amount: number,
//     session: mongoose.ClientSession
//   ): Promise<ITransaction> {
//     if (!rolesHierarchy[manager.role]?.includes(client.role)) {
//       throw createHttpError(
//         403,
//         `${manager.role} cannot perform transactions with ${client.role}`
//       );
//     }
//     if (type === "recharge") {
//       if (manager.credits < amount) {
//         throw createHttpError(400, "Insufficient credits to recharge");
//       }
//       client.credits += amount;
//       client.totalRecharged += amount;
//       manager.credits -= amount;
//     } else if (type === "redeem") {
//       if (client.credits < amount) {
//         throw createHttpError(400, "Client has insufficient credits to redeem");
//       }
//       client.credits -= amount;
//       client.totalRedeemed += amount;
//       manager.credits += amount;
//     }
//     const transaction = new Transaction({
//       debtor: type === "recharge" ? client.username : manager.username,
//       creditor: type === "recharge" ? manager.username : client.username,
//       type: type,
//       amount: amount,
//       createdAt: new Date(),
//     });
//     await transaction.save({ session });
//     return transaction;
//   }
//   async getTransactions(
//     username: string,
//     page: number,
//     limit: number,
//     query: QueryParams
//   ) {
//     const skip = (page - 1) * limit;
//     const user =
//       (await User.findOne({ username })) ||
//       (await Player.findOne({ username }));
//     if (!user) {
//       throw new Error("User not found");
//     }
//     const totalTransactions = await Transaction.countDocuments({
//       $or: [{ debtor: user.username }, { creditor: user.username }],
//       ...query,
//     });
//     const totalPages = Math.ceil(totalTransactions / limit);
//     if (totalTransactions === 0) {
//       return {
//         transactions: [],
//         totalTransactions: 0,
//         totalPages: 0,
//         currentPage: 0,
//         outOfRange: false,
//       };
//     }
//     if (page > totalPages) {
//       return {
//         transactions: [],
//         totalTransactions,
//         totalPages,
//         currentPage: page,
//         outOfRange: true,
//       };
//     }
//     const transactions = await Transaction.find({
//       $or: [{ debtor: user.username }, { creditor: user.username }],
//       ...query,
//     })
//       .skip(skip)
//       .limit(limit);
//     return {
//       transactions,
//       totalTransactions,
//       totalPages,
//       currentPage: page,
//       outOfRange: false,
//     };
//   }
//   deleteTransaction(id: string, session: mongoose.ClientSession) {
//     return Transaction.findByIdAndDelete(id).session(session);
//   }
// }
// export default TransactionService;
