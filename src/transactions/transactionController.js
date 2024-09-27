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
const http_errors_1 = __importDefault(require("http-errors"));
const utils_1 = require("../utils/utils");
const userModel_1 = __importDefault(require("../users/userModel"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const transactionService_1 = require("./transactionService");
const mongoose_1 = __importDefault(require("mongoose"));
const transactionModel_1 = __importDefault(require("./transactionModel"));
class TransactionController {
    // TO RECORD TRANSACTIONS, RECHARGE AND REDEEM
    transaction(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { reciever: receiverId, amount, type } = req.body;
            try {
                const sanitizedAmount = (0, utils_1.sanitizeInput)(amount);
                const sanitizedType = (0, utils_1.sanitizeInput)(type);
                if (!receiverId || !sanitizedAmount || sanitizedAmount <= 0)
                    throw (0, http_errors_1.default)(400, "Reciever or Amount is missing");
                const _req = req;
                const { userId, role } = _req.user;
                const newObjectId = new mongoose_1.default.Types.ObjectId(userId);
                if (receiverId == userId) {
                    throw (0, http_errors_1.default)(500, "Can't Recharge or redeem Yourself");
                }
                const sender = (yield userModel_1.default.findById({ _id: userId })) ||
                    (yield playerModel_1.default.findById({ _id: userId }));
                if (!sender)
                    throw (0, http_errors_1.default)(404, "User Not Found");
                const reciever = (yield userModel_1.default.findById({ _id: receiverId })) ||
                    (yield playerModel_1.default.findById({ _id: receiverId }));
                if (!reciever)
                    throw (0, http_errors_1.default)(404, "Reciever does not exist");
                if (role !== "admin") {
                    if ((reciever === null || reciever === void 0 ? void 0 : reciever.createdBy.toString()) !== userId)
                        throw (0, http_errors_1.default)(404, "You Are Not Authorised");
                }
                const senderModelName = sender instanceof userModel_1.default
                    ? "User"
                    : sender instanceof playerModel_1.default
                        ? "Player"
                        : (() => {
                            throw (0, http_errors_1.default)(500, "Unknown sender model");
                        })();
                const recieverModelName = reciever instanceof userModel_1.default
                    ? "User"
                    : reciever instanceof playerModel_1.default
                        ? "Player"
                        : (() => {
                            throw (0, http_errors_1.default)(500, "Unknown reciever model");
                        })();
                yield transactionService_1.TransactionService.performTransaction(newObjectId, receiverId, sender, reciever, senderModelName, recieverModelName, sanitizedType, sanitizedAmount, role);
                res.status(200).json({ message: "Transaction successful" });
            }
            catch (err) {
                console.log(err);
                next(err);
            }
        });
    }
    //GET ALL TRANSCATIONS FOR ADMIN
    getAllTransactions(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { search, date } = req.query;
                // Initial match conditions
                const matchConditions = [];
                // Add search filters
                if (search) {
                    if (!isNaN(Number(search))) {
                        matchConditions.push({ amount: Number(search) });
                    }
                    else {
                        const regex = new RegExp(search, "i");
                        matchConditions.push({
                            $or: [
                                { "senderUser.username": { $regex: regex } },
                                { "receiverUser.username": { $regex: regex } },
                                { "senderPlayer.username": { $regex: regex } },
                                { "receiverPlayer.username": { $regex: regex } },
                                { type: { $regex: regex } },
                            ],
                        });
                    }
                }
                if (date) {
                    const dateRange = new Date(date);
                    matchConditions.push({
                        date: {
                            $gte: new Date(dateRange.setHours(0, 0, 0, 0)),
                            $lt: new Date(dateRange.setHours(23, 59, 59, 999)),
                        },
                    });
                }
                const pipeline = [
                    {
                        $lookup: {
                            from: "users",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderPlayer",
                        },
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverPlayer",
                        },
                    },
                    {
                        $unwind: {
                            path: "$senderUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$senderPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    ...(matchConditions.length > 0
                        ? [{ $match: { $and: matchConditions } }]
                        : []),
                    {
                        $project: {
                            sender: {
                                $cond: {
                                    if: { $ifNull: ["$senderUser.username", false] },
                                    then: "$senderUser.username",
                                    else: "$senderPlayer.username",
                                },
                            },
                            receiver: {
                                $cond: {
                                    if: { $ifNull: ["$receiverUser.username", false] },
                                    then: "$receiverUser.username",
                                    else: "$receiverPlayer.username",
                                },
                            },
                            amount: 1,
                            type: 1,
                            date: 1,
                        },
                    },
                ];
                const allTransactions = yield transactionModel_1.default.aggregate(pipeline).sort({
                    date: -1,
                });
                res.status(200).json(allTransactions);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    //SPECIFIC USER TRANSACTIONS
    getSpecificUserTransactions(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = req.params;
                if (!userId)
                    throw (0, http_errors_1.default)(400, "User Id not Found");
                const transactionsOfAgent = yield transactionModel_1.default.find({
                    $or: [{ sender: userId }, { receiver: userId }],
                })
                    .select("+senderModel +receiverModel")
                    .populate({
                    path: "sender",
                    select: "-password",
                })
                    .populate({
                    path: "receiver",
                    select: "-password",
                });
                res.status(200).json(transactionsOfAgent);
            }
            catch (error) {
                next(error);
            }
        });
    }
    // //SUPERIOR AND HIS SUBORDINATE TRANSACTIONS
    getSuperiorSubordinateTransaction(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { superior } = req.params;
                const { type, search, date } = req.query;
                let superiorUser;
                // Fetching superior user based on type (id or username)
                if (type === "id") {
                    superiorUser = yield userModel_1.default.findById(superior).select("_id subordinates players role");
                }
                else if (type === "username") {
                    superiorUser = yield userModel_1.default.findOne({ username: superior }).select("_id subordinates players role");
                }
                else {
                    throw (0, http_errors_1.default)(400, "User Id or Username not provided");
                }
                if (!superiorUser)
                    throw (0, http_errors_1.default)(404, "User Not Found");
                const subordinateIds = superiorUser.role === "admin"
                    ? [
                        ...superiorUser.players.map((player) => player._id),
                        ...superiorUser.subordinates.map((sub) => sub._id),
                    ]
                    : superiorUser.role === "agent"
                        ? superiorUser.players.map((player) => player._id)
                        : superiorUser.subordinates.map((sub) => sub._id);
                const matchConditions = [
                    {
                        $or: [
                            { sender: { $in: subordinateIds } },
                            { receiver: { $in: subordinateIds } },
                            { sender: superiorUser._id },
                            { receiver: superiorUser._id },
                        ],
                    },
                ];
                if (search) {
                    if (!isNaN(Number(search))) {
                        matchConditions.push({ amount: Number(search) });
                    }
                    else {
                        const regex = new RegExp(search, "i");
                        matchConditions.push({
                            $or: [
                                { "senderUser.username": { $regex: regex } },
                                { "receiverUser.username": { $regex: regex } },
                                { "senderPlayer.username": { $regex: regex } },
                                { "receiverPlayer.username": { $regex: regex } },
                                { type: { $regex: regex } },
                            ],
                        });
                    }
                }
                if (date) {
                    const dateRange = new Date(date);
                    matchConditions.push({
                        date: {
                            $gte: new Date(dateRange.setHours(0, 0, 0, 0)),
                            $lt: new Date(dateRange.setHours(23, 59, 59, 999)),
                        },
                    });
                }
                const pipeline = [
                    {
                        $lookup: {
                            from: "users",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderPlayer",
                        },
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverPlayer",
                        },
                    },
                    {
                        $unwind: {
                            path: "$senderUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$senderPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    ...(matchConditions.length > 0
                        ? [{ $match: { $and: matchConditions } }]
                        : []),
                    {
                        $project: {
                            sender: {
                                $cond: {
                                    if: { $ifNull: ["$senderUser.username", false] },
                                    then: "$senderUser.username",
                                    else: "$senderPlayer.username",
                                },
                            },
                            receiver: {
                                $cond: {
                                    if: { $ifNull: ["$receiverUser.username", false] },
                                    then: "$receiverUser.username",
                                    else: "$receiverPlayer.username",
                                },
                            },
                            amount: 1,
                            type: 1,
                            date: 1,
                        },
                    },
                ];
                const transactions = yield transactionModel_1.default.aggregate(pipeline).sort({
                    date: -1,
                });
                res.status(200).json(transactions);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    // async getSuperiorSubordinateTransaction(req: Request, res: Response, next: NextFunction) {
    //   try {
    //     const { superior } = req.params;
    //     const { type } = req.query;
    //     let superiorUser: any;
    //     if (type === "id") {
    //       superiorUser = await User.findById(superior);
    //       superiorUser && superiorUser.subordinates?
    //       superiorUser = await User.findById(superior).populate('_id subordinates role'):
    //       superiorUser = await User.findById(superior).populate('_id players role');
    //       if (!superiorUser) throw createHttpError(404, "User Not Found");
    //     } else if (type === "username") {
    //       superiorUser = await User.findOne({ username: superior });
    //       superiorUser && superiorUser.subordinates?
    //       superiorUser= await User.findOne({ username: superior }) .populate('_id subordinates role'):
    //         superiorUser = await User.findOne({ username: superior }).populate('_id players role')
    //       if (!superiorUser) throw createHttpError(404, "User Not Found with the provided username");
    //     } else {
    //       throw createHttpError(400, "User Id or Username not provided");
    //     }
    //     const subordinateIds = superiorUser.role === "admin"
    //     ? [
    //         ...superiorUser.players.map(player => player._id),
    //         ...superiorUser.subordinates.map(sub => sub._id)
    //       ]
    //     : superiorUser.role === "agent"
    //     ? superiorUser.players.map(player => player._id)
    //     : superiorUser.subordinates.map(sub => sub._id);
    //       let  transactions:any;
    //       if(subordinateIds){
    //           transactions = await Transaction.find({
    //       $or: [
    //         { sender: { $in: subordinateIds } },
    //         { receiver: { $in: subordinateIds } }
    //       ]
    //     }).select('+senderModel +receiverModel')
    //       .populate({
    //         path: 'sender',
    //         select: 'username',
    //       })
    //       .populate({
    //         path: 'receiver',
    //         select: 'username',
    //       });
    //     }
    //     const superiorTransactions = await Transaction.find({
    //       $or: [
    //         { sender: superiorUser._id },
    //         { receiver: superiorUser._id }
    //       ]
    //     }).select('+senderModel +receiverModel')
    //       .populate({
    //         path: 'sender',
    //         select: 'username',
    //       })
    //       .populate({
    //         path: 'receiver',
    //         select: 'username',
    //       });
    //     const combinedTransactions = [...transactions, ...superiorTransactions];
    //     res.status(200).json( combinedTransactions );
    //   } catch (error) {
    //     console.log(error);
    //     next(error);
    //   }
    // }
    //SPECIFIC PLAYER TRANSACTION
    getSpecificPlayerTransactions(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { player } = req.params;
                const { type, search, date } = req.query;
                let playerData;
                if (type === "id") {
                    playerData = yield playerModel_1.default.findById(player);
                    if (!playerData)
                        throw (0, http_errors_1.default)(404, "Player Not Found");
                }
                else if (type === "username") {
                    playerData = yield playerModel_1.default.findOne({ username: player });
                    if (!playerData)
                        throw (0, http_errors_1.default)(404, "Player Not Found with the provided username");
                }
                else {
                    throw (0, http_errors_1.default)(400, 'Invalid type provided. Use "id" or "username".');
                }
                const matchConditions = [
                    { $or: [{ receiver: playerData._id }, { sender: playerData._id }] },
                ];
                if (search) {
                    if (!isNaN(Number(search))) {
                        matchConditions.push({ amount: Number(search) });
                    }
                    else {
                        const regex = new RegExp(search, "i");
                        matchConditions.push({
                            $or: [
                                { "senderUser.username": { $regex: regex } },
                                { "receiverUser.username": { $regex: regex } },
                                { "senderPlayer.username": { $regex: regex } },
                                { "receiverPlayer.username": { $regex: regex } },
                                { type: { $regex: regex } },
                            ],
                        });
                    }
                }
                if (date) {
                    const dateRange = new Date(date);
                    matchConditions.push({
                        date: {
                            $gte: new Date(dateRange.setHours(0, 0, 0, 0)),
                            $lt: new Date(dateRange.setHours(23, 59, 59, 999)),
                        },
                    });
                }
                const pipeline = [
                    {
                        $lookup: {
                            from: "users",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderPlayer",
                        },
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverPlayer",
                        },
                    },
                    ...(matchConditions.length > 0
                        ? [{ $match: { $and: matchConditions } }]
                        : []),
                    {
                        $unwind: {
                            path: "$senderUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$senderPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            type: 1,
                            amount: 1,
                            date: 1,
                            sender: {
                                $cond: {
                                    if: { $ifNull: ["$senderUser.username", false] },
                                    then: "$senderUser.username",
                                    else: "$senderPlayer.username",
                                },
                            },
                            receiver: {
                                $cond: {
                                    if: { $ifNull: ["$receiverUser.username", false] },
                                    then: "$receiverUser.username",
                                    else: "$receiverPlayer.username",
                                },
                            },
                        },
                    },
                ];
                const playerTransactions = yield transactionModel_1.default.aggregate(pipeline).sort({
                    date: -1,
                });
                // Map transactions to the desired format
                const formattedTransactions = playerTransactions.map((transaction) => ({
                    _id: transaction._id,
                    type: transaction.type,
                    amount: transaction.amount,
                    date: transaction.date,
                    sender: transaction.sender,
                    receiver: transaction.receiver,
                }));
                res.status(200).json(formattedTransactions);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
}
exports.default = new TransactionController();
// import { Request, Response, NextFunction } from "express";
// import { Player, User } from "../usersTest/userModel";
// import Transaction from "./transactionModel";
// import createHttpError from "http-errors";
// import mongoose from "mongoose";
// import { AuthRequest } from "../utils/utils";
// import { IPlayer, IUser } from "../usersTest/usersanitizedType";
// import { ITransaction } from "./transactionsanitizedType";
// import TransactionService from "./transactionService";
// import { QueryParams } from "../utils/utils";
// export class TransactionController {
//   private transactionService: TransactionService;
//   constructor() {
//     this.transactionService = new TransactionService();
//     this.getTransactions = this.getTransactions.bind(this);
//     this.getTransactionsBySubId = this.getTransactionsBySubId.bind(this);
//     this.deleteTransaction = this.deleteTransaction.bind(this);
//     this.getAllTransactions = this.getAllTransactions.bind(this);
//   }
//   async createTransaction(
//     sanitizedType: string,
//     debtor: IUser | IPlayer,
//     creditor: IUser,
//     amount: number,
//     session: mongoose.ClientSession
//   ): Promise<ITransaction> {
//     try {
//       const transaction = await this.transactionService.createTransaction(
//         sanitizedType,
//         debtor,
//         creditor,
//         amount,
//         session
//       );
//       return transaction;
//     } catch (error) {
//       console.error(`Error creating transaction: ${error.message}`);
//       throw error;
//     }
//   }
//   async getTransactions(req: Request, res: Response, next: NextFunction) {
//     try {
//       const _req = req as AuthRequest;
//       const { username, role } = _req.user;
//       const page = parseInt(req.query.page as string) || 1;
//       const limit = parseInt(req.query.limit as string) || 10;
//       const search = req.query.search as string;
//       let parsedData: QueryParams = {
//         role: "",
//         status: "",
//         totalRecharged: { From: 0, To: 0 },
//         totalRedeemed: { From: 0, To: 0 },
//         credits: { From: 0, To: 0 },
//         updatedAt: { From: new Date(), To: new Date() },
//         sanitizedType: "",
//         amount: { From: 0, To: Infinity },
//       };
//       let sanitizedType, updatedAt, amount;
//       if (search) {
//         parsedData = JSON.parse(search);
//         if (parsedData) {
//           sanitizedType = parsedData.sanitizedType;
//           updatedAt = parsedData.updatedAt;
//           amount = parsedData.amount;
//         }
//       }
//       let query: any = {};
//       if (sanitizedType) {
//         query.sanitizedType = sanitizedType;
//       }
//       if (updatedAt) {
//         query.updatedAt = {
//           $gte: parsedData.updatedAt.From,
//           $lte: parsedData.updatedAt.To,
//         };
//       }
//       if (amount) {
//         query.amount = {
//           $gte: parsedData.amount.From,
//           $lte: parsedData.amount.To,
//         };
//       }
//       const {
//         transactions,
//         totalTransactions,
//         totalPages,
//         currentPage,
//         outOfRange,
//       } = await this.transactionService.getTransactions(
//         username,
//         page,
//         limit,
//         query
//       );
//       if (outOfRange) {
//         return res.status(400).json({
//           message: `Page number ${page} is out of range. There are only ${totalPages} pages available.`,
//           totalTransactions,
//           totalPages,
//           currentPage: page,
//           transactions: [],
//         });
//       }
//       res.status(200).json({
//         totalTransactions,
//         totalPages,
//         currentPage,
//         transactions,
//       });
//     } catch (error) {
//       console.error(`Error fetching transactions: ${error.message}`);
//       next(error);
//     }
//   }
//   async getTransactionsBySubId(
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ) {
//     try {
//       const _req = req as AuthRequest;
//       const { username, role } = _req.user;
//       const { subordinateId } = req.params;
//       const page = parseInt(req.query.page as string) || 1;
//       const limit = parseInt(req.query.limit as string) || 10;
//       const user = await User.findOne({ username });
//       const subordinate =
//         (await User.findOne({ _id: subordinateId })) ||
//         (await Player.findOne({ _id: subordinateId }));
//       if (!user) {
//         throw createHttpError(404, "Unable to find logged in user");
//       }
//       if (!subordinate) {
//         throw createHttpError(404, "User not found");
//       }
//       let query: any = {};
//       if (
//         user.role === "superadmin" ||
//         user.subordinates.includes(new mongoose.sanitizedTypes.ObjectId(subordinateId))
//       ) {
//         const {
//           transactions,
//           totalTransactions,
//           totalPages,
//           currentPage,
//           outOfRange,
//         } = await this.transactionService.getTransactions(
//           subordinate.username,
//           page,
//           limit,
//           query
//         );
//         if (outOfRange) {
//           return res.status(400).json({
//             message: `Page number ${page} is out of range. There are only ${totalPages} pages available.`,
//             totalTransactions,
//             totalPages,
//             currentPage: page,
//             transactions: [],
//           });
//         }
//         res.status(200).json({
//           totalTransactions,
//           totalPages,
//           currentPage,
//           transactions,
//         });
//       } else {
//         throw createHttpError(
//           403,
//           "Forbidden: You do not have the necessary permissions to access this resource."
//         );
//       }
//     } catch (error) {
//       console.error(
//         `Error fetching transactions by client ID: ${error.message}`
//       );
//       next(error);
//     }
//   }
//   async getAllTransactions(req: Request, res: Response, next: NextFunction) {
//     try {
//       const _req = req as AuthRequest;
//       const { username, role } = _req.user;
//       if (role != "superadmin") {
//         throw createHttpError(
//           403,
//           "Access denied. Only users with the role 'superadmin' can access this resource."
//         );
//       }
//       const page = parseInt(req.query.page as string) || 1;
//       const limit = parseInt(req.query.limit as string) || 10;
//       const search = req.query.search as string;
//       let parsedData: QueryParams = {
//         role: "",
//         status: "",
//         totalRecharged: { From: 0, To: 0 },
//         totalRedeemed: { From: 0, To: 0 },
//         credits: { From: 0, To: 0 },
//         updatedAt: { From: new Date(), To: new Date() },
//         sanitizedType: "",
//         amount: { From: 0, To: Infinity },
//       };
//       let sanitizedType, updatedAt, amount;
//       if (search) {
//         parsedData = JSON.parse(search);
//         if (parsedData) {
//           sanitizedType = parsedData.sanitizedType;
//           updatedAt = parsedData.updatedAt;
//           amount = parsedData.amount;
//         }
//       }
//       let query: any = {};
//       if (sanitizedType) {
//         query.sanitizedType = sanitizedType;
//       }
//       if (updatedAt) {
//         query.updatedAt = {
//           $gte: parsedData.updatedAt.From,
//           $lte: parsedData.updatedAt.To,
//         };
//       }
//       if (amount) {
//         query.amount = {
//           $gte: parsedData.amount.From,
//           $lte: parsedData.amount.To,
//         };
//       }
//       const skip = (page - 1) * limit;
//       const totalTransactions = await Transaction.countDocuments(query);
//       const totalPages = Math.ceil(totalTransactions / limit);
//       // Check if the requested page is out of range
//       if (page > totalPages) {
//         return res.status(400).json({
//           message: `Page number ${page} is out of range. There are only ${totalPages} pages available.`,
//           totalTransactions,
//           totalPages,
//           currentPage: page,
//           transactions: [],
//         });
//       }
//       const transactions = await Transaction.find(query)
//         .skip(skip)
//         .limit(limit);
//       res.status(200).json({
//         totalTransactions,
//         totalPages,
//         currentPage: page,
//         transactions,
//       });
//     } catch (error) {
//       console.error(
//         `Error fetching transactions by client ID: ${error.message}`
//       );
//       next(error);
//     }
//   }
//   async deleteTransaction(req: Request, res: Response, next: NextFunction) {
//     const { id } = req.params;
//     const session = await mongoose.startSession();
//     session.startTransaction();
//     try {
//       if (!mongoose.sanitizedTypes.ObjectId.isValid(id)) {
//         throw createHttpError(400, "Invalid transaction ID");
//       }
//       const deletedTransaction =
//         await this.transactionService.deleteTransaction(id, session);
//       if (deletedTransaction instanceof mongoose.Query) {
//         const result = await deletedTransaction.lean().exec();
//         if (!result) {
//           throw createHttpError(404, "Transaction not found");
//         }
//         res.status(200).json({ message: "Transaction deleted successfully" });
//       } else {
//         if (!deletedTransaction) {
//           throw createHttpError(404, "Transaction not found");
//         }
//         res.status(200).json({ message: "Transaction deleted successfully" });
//       }
//     } catch (error) {
//       await session.abortTransaction();
//       session.endSession();
//       console.error(`Error deleting transaction: ${error.message}`);
//       next(error);
//     }
//   }
// }
