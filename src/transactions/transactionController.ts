import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { AuthRequest, sanitizeInput } from "../utils/utils";
import User from "../users/userModel";
import Player from "../players/playerModel";
import { TransactionService } from "./transactionService";
import mongoose from "mongoose";
import Transaction from "./transactionModel";

class TransactionController {

  // TO RECORD TRANSACTIONS, RECHARGE AND REDEEM

  async transaction(req: Request, res: Response, next: NextFunction) {
    const { reciever: receiverId, amount, type } = req.body;

    try {
      const sanitizedAmount = sanitizeInput(amount);
      const sanitizedType = sanitizeInput(type);
      if (!receiverId || !sanitizedAmount || sanitizedAmount <= 0)
        throw createHttpError(400, "Reciever or Amount is missing");
      const _req = req as AuthRequest;
      const { userId, role } = _req.user;
      const newObjectId: mongoose.Types.ObjectId = new mongoose.Types.ObjectId(
        userId
      );


      if (receiverId == userId) {
        throw createHttpError(500, "Can't Recharge or redeem Yourself");
      }
      const sender =
        (await User.findById({ _id: userId })) ||
        (await Player.findById({ _id: userId }));
      if (!sender) throw createHttpError(404, "User Not Found");
      const reciever =
        (await User.findById({ _id: receiverId })) ||
        (await Player.findById({ _id: receiverId }));
      if (!reciever) throw createHttpError(404, "Reciever does not exist");
      if (role === "agent") {
        if (reciever?.createdBy.toString() !== userId)
          throw createHttpError(404, "You Are Not Authorised")
      }
      const senderModelName =
        sender instanceof User
          ? "User"
          : sender instanceof Player
            ? "Player"
            : (() => {
              throw createHttpError(500, "Unknown sender model");
            })();
      const recieverModelName =
        reciever instanceof User
          ? "User"
          : reciever instanceof Player
            ? "Player"
            : (() => {
              throw createHttpError(500, "Unknown reciever model");
            })();


      await TransactionService.performTransaction(
        newObjectId,
        receiverId,
        sender,
        reciever,
        senderModelName,
        recieverModelName,
        sanitizedType,
        sanitizedAmount,
        role
      );
      res.status(200).json({ message: "Transaction successful" });
    } catch (err) {
      console.log(err);

      next(err);
    }
  }

  //GET ALL TRANSCATIONS FOR ADMIN

  async getAllTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const allTransactions = await Transaction.find().select('+senderModel +receiverModel')
        .populate({
          path: 'sender',
          select: '-password',
        })
        .populate({
          path: 'receiver',
          select: '-password',
        });
      res.status(200).json(allTransactions)
    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  //SPECIFIC USER TRANSACTIONS

  async getSpecificUserTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      if (!userId) throw createHttpError(400, "User Id not Found");
      const transactionsOfAgent = await Transaction.find({
        $or: [
          { sender: userId },
          { receiver: userId }
        ]
      }).select('+senderModel +receiverModel')
        .populate({
          path: 'sender',
          select: '-password',
        })
        .populate({
          path: 'receiver',
          select: '-password',
        });
     
      res.status(200).json(transactionsOfAgent );

    } catch (error) {
      next(error);
    }

  }

  //SUPERIOR AND HIS SUBORDINATE TRANSACTIONS

  async getSuperiorSubordinateTransaction(req: Request, res: Response, next: NextFunction) {

    try {
      const { superior } = req.params;
      const { type } = req.query;

      let superiorUser: any;

      if (type === "id") {
        superiorUser = await User.findById(superior);
        superiorUser && superiorUser.subordinates?
        superiorUser = await User.findById(superior).populate('_id subordinates role'):
        superiorUser = await User.findById(superior).populate('_id players role');
        if (!superiorUser) throw createHttpError(404, "User Not Found");
      } else if (type === "username") {
        superiorUser = await User.findOne({ username: superior });
        superiorUser && superiorUser.subordinates?
        superiorUser= await User.findOne({ username: superior }) .populate('_id subordinates role'):
          superiorUser = await User.findOne({ username: superior }).populate('_id players role')
        if (!superiorUser) throw createHttpError(404, "User Not Found with the provided username");
      } else {
        throw createHttpError(400, "User Id or Username not provided");
      }
      const subordinateIds = superiorUser.role === "admin"
      ? [
          ...superiorUser.players.map(player => player._id),
          ...superiorUser.subordinates.map(sub => sub._id)
        ]
      : superiorUser.role === "agent"
      ? superiorUser.players.map(player => player._id)
      : superiorUser.subordinates.map(sub => sub._id);
    
        let  transactions:any;
        if(subordinateIds){
            transactions = await Transaction.find({
        $or: [
          { sender: { $in: subordinateIds } },
          { receiver: { $in: subordinateIds } }
        ]
      }).select('+senderModel +receiverModel')
        .populate({
          path: 'sender',
          select: 'username',
        })
        .populate({
          path: 'receiver',
          select: 'username',
        });
      }
      const superiorTransactions = await Transaction.find({
        $or: [
          { sender: superiorUser._id },
          { receiver: superiorUser._id }
        ]
      }).select('+senderModel +receiverModel')
        .populate({
          path: 'sender',
          select: 'username',
        })
        .populate({
          path: 'receiver',
          select: 'username',
        });

      const combinedTransactions = [...transactions, ...superiorTransactions];

    
      res.status(200).json( combinedTransactions );

    } catch (error) {
      console.log(error);
      next(error);
    }
  }

  //SPECIFIC PLAYER TRANSACTION

  async getSpecificPlayerTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { player } = req.params;
      const { type } = req.query;

      let players:any;
      if (type==="id") {
        players = await Player.findById(player);
        if (!player) throw createHttpError(404, "Player Not Found");
      } else if (type==="username") {
        players = await Player.findOne({ username:player });
        if (!player) throw createHttpError(404, "Player Not Found with the provided username");
      } else {
        throw createHttpError(400, "Player Id or Username not provided");
      }

      const playerTransactions = await Transaction.find({ receiver: players._id })
        .select('+senderModel +receiverModel')
        .populate({
          path: 'sender',
          select: '-password',
        })
        .populate({
          path: 'receiver',
          select: '-password',
        });


      res.status(200).json( playerTransactions );

    } catch (error) {
      console.log(error);
      next(error);
    }
  }

}

export default new TransactionController();

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
