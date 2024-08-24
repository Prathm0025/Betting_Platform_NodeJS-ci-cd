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
exports.hasPermission = exports.rolesHierarchy = void 0;
exports.sanitizeInput = sanitizeInput;
const validator_1 = __importDefault(require("validator"));
const userModel_1 = __importDefault(require("../users/userModel"));
function sanitizeInput(input) {
    return validator_1.default.escape(validator_1.default.trim(input));
}
//USERS HEIRARCHy OBJECT
exports.rolesHierarchy = {
    admin: ["distributor", "subdistributor", "agent", "player"],
    distributor: ["subdistributor"],
    subdistributor: ["agent"],
    agent: ["player"],
};
//CHECKS PERMISSION TO PERFORM ACTIONS
const hasPermission = (requestingUserId, targetUserId, requestingUserRole) => __awaiter(void 0, void 0, void 0, function* () {
    if (!requestingUserId || !requestingUserRole || !targetUserId) {
        return false;
    }
    const requestingUser = yield userModel_1.default.findById(requestingUserId);
    if (!requestingUser)
        return false;
    const targetUser = yield userModel_1.default.findOne({
        _id: targetUserId,
        createdBy: requestingUserId
    });
    if (!targetUser)
        return false;
    const allowedRoles = exports.rolesHierarchy[requestingUserRole] || [];
    return allowedRoles.includes(targetUser.role);
});
exports.hasPermission = hasPermission;
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
