import mongoose, { ClientSession, Model } from "mongoose";
import { IUser } from "../users/userType";
import { IPlayer } from "../players/playerType";
import User from "../users/userModel";
import Player from "../players/playerModel";
import Transaction from "./transactionModel";
import createHttpError from "http-errors";

export class TransactionService {

  //RECORDING TRANSACTION AND ABORTING USING SESSIONS
  static async performTransaction(
    senderId: mongoose.Types.ObjectId,
    receiverId: mongoose.Types.ObjectId,
    sender: IUser | IPlayer,
    receiver: IUser | IPlayer,
    senderModel: "User" | "Player",
    receiverModel: "User" | "Player",
    type: "recharge" | "redeem",
    amount: number,
    role: string
  ): Promise<void> {
    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
      if (amount <= 0) {
        throw createHttpError(400, "Transaction amount must be greater than zero.");
      }

      const senderModelInstance = this.getModelInstance(senderModel);
      const receiverModelInstance = this.getModelInstance(receiverModel);

      this.validateCredits(type, sender, receiver, amount);

      await this.updateCredits(type, senderId, receiverId, senderModelInstance, receiverModelInstance, amount, session);

      await Transaction.create([{
        sender: senderId,
        receiver: receiverId,
        senderModel,
        receiverModel,
        type,
        amount,
      }], { session });

      await session.commitTransaction();
      console.log("Transaction committed successfully");

    } catch (error) {
      await session.abortTransaction();
      console.error("Transaction aborted due to error:", error.message);
      throw error;
    } finally {
      session.endSession();
    }
  }

  
  private static getModelInstance(modelName: "User" | "Player"): Model<IUser | IPlayer> {
    switch (modelName) {
      case "User":
        return User;
      case "Player":
        return Player;
      default:
        throw createHttpError(500, "Unknown model name");
    }
  }

  
  private static validateCredits(
    type: "recharge" | "redeem",
    sender: IUser | IPlayer,
    receiver: IUser | IPlayer,
    amount: number
  ): void {
    if (type === "recharge" && sender.credits < amount) {
      throw createHttpError(400, "Insufficient credits in sender's account for recharge.");
    }
    if (type === "redeem" && receiver.credits < amount) {
      throw createHttpError(400, "Insufficient credits in receiver's account for redemption.");
    }
  }


  private static async updateCredits(
    type: "recharge" | "redeem",
    senderId: mongoose.Types.ObjectId,
    receiverId: mongoose.Types.ObjectId,
    senderModelInstance: Model<IUser | IPlayer>,
    receiverModelInstance: Model<IUser | IPlayer>,
    amount: number,
    session: ClientSession
  ): Promise<void> {
    const senderUpdate = type === "recharge" ? -amount : amount;
    const receiverUpdate = type === "recharge" ? amount : -amount;

    await senderModelInstance.updateOne({ _id: senderId }, { $inc: { credits: senderUpdate } }, { session });
    await receiverModelInstance.updateOne({ _id: receiverId }, { $inc: { credits: receiverUpdate } }, { session });
  }
}

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
