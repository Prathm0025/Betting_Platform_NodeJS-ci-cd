import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";
// import { IPlayer, IUser } from "../dashboard/users/userType";
// import createHttpError from "http-errors";
// import mongoose from "mongoose";
// import { TransactionController } from "../dashboard/transactions/transactionController";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import validator from 'validator';
import User from "../users/userModel";

export function sanitizeInput(input: string) {
  return validator.escape(validator.trim(input));
}

//USERS HEIRARCHy OBJECT

export const rolesHierarchy = {
  admin: ["distributor", "subdistributor", "agent", "player"],
  distributor: ["subdistributor"],
  subdistributor: ["agent"],
  agent: ["player"],
};

//CHECKS PERMISSION TO PERFORM ACTIONS

export const hasPermission = async (
  requestingUserId: string,
  targetUserId: string, 
  requestingUserRole: string,
): Promise<boolean> => {
  if (!requestingUserId || !requestingUserRole || !targetUserId ) {
    return false;
  }

  const requestingUser = await User.findById(requestingUserId);
  if (!requestingUser) return false;
 console.log( requestingUser, "requesting user");
 
 const targetUserQuery = requestingUserRole === 'admin' 
 ? { _id: targetUserId } 
 : { _id: targetUserId, createdBy: requestingUserId };

const targetUser = await User.findOne(targetUserQuery);
if (!targetUser) return false;
  console.log(targetUser, "targetUser");
  
  if (!targetUser) return false;
  const allowedRoles = rolesHierarchy[requestingUserRole] || [];
  console.log(allowedRoles, "allowedroles");
  
  return allowedRoles.includes(targetUser.role);
};

export interface DecodedToken {
  userId: string;
  username: string;
  role: string;
}

export interface SocketToken {
  username: string;
  role: string;
  credits: Number;
  userId: mongoose.Types.ObjectId;
}

export interface AuthRequest extends Request {
  user: {
    userId: string;
    username: string;
    role: string;
  };
}

export interface CustomJwtPayload extends JwtPayload {
  role: string;
}
export interface SearchQuery {
  type?: string;
  searchQuery?: Object;
  username?: string;
  amount?: number;
}
// interface amount {
//   From: number;
//   To: number;
// }
// interface date {
//   From: Date;
//   To: Date;
// }

// export interface QueryParams {
//   role: string;
//   status: string;
//   totalRecharged: amount;
//   totalRedeemed: amount;
//   credits: amount;
//   updatedAt: date;
//   type: string;
//   amount: amount;
// }

// export const updateStatus = (client: IUser | IPlayer, status: string) => {
//   const validStatuses = ["active", "inactive"];
//   if (!validStatuses.includes(status)) {
//     throw createHttpError(400, "Invalid status value");
//   }
//   client.status = status;
// };

// export const updatePassword = async (
//   client: IUser | IPlayer,
//   password: string,
//   existingPassword: string
// ) => {
//   try {
//     if (!existingPassword) {
//       throw createHttpError(
//         400,
//         "Existing password is required to update the password"
//       );
//     }

//     // Check if existingPassword matches client's current password
//     const isPasswordValid = await bcrypt.compare(
//       existingPassword,
//       client.password
//     );
//     if (!isPasswordValid) {
//       throw createHttpError(400, "Existing password is incorrect");
//     }

//     // Update password
//     client.password = await bcrypt.hash(password, 10);
//   } catch (error) {
//     throw error;
//   }
// };

// export const updateCredits = async (
//   client: IUser | IPlayer,
//   creator: IUser,
//   credits: { type: string; amount: number }
// ) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { type, amount } = credits;

//     // Validate credits
//     if (
//       !type ||
//       typeof amount !== "number" ||
//       !["recharge", "redeem"].includes(type)
//     ) {
//       throw createHttpError(
//         400,
//         "Credits must include a valid type ('recharge' or 'redeem') and a numeric amount"
//       );
//     }
//     console.log("debtor:", client, "creditor", creator);

//     const transaction = await transactionController.createTransaction(
//       type,
//       client,
//       creator,
//       amount,
//       session
//     );

//     // // Add the transaction to both users' transactions arrays
//     client.transactions.push(transaction._id as mongoose.Types.ObjectId);
//     creator.transactions.push(transaction._id as mongoose.Types.ObjectId);

//     await client.save({ session });
//     await creator.save({ session });

//     await session.commitTransaction();
//     session.endSession();
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     throw error;
//   }
// };

// export const getSubordinateModel = (role: string) => {
//   const rolesHierarchy: Record<string, string> = {
//     superadmin: "User",
//     admin: "Player",
//   };
//   return rolesHierarchy[role];
// };
