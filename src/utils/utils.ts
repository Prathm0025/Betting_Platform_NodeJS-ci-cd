import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

import bcrypt from "bcrypt";
import mongoose from "mongoose";
import validator from 'validator';
import User from "../users/userModel";
import { redisClient } from "../redisclient";

export function sanitizeInput(input: string) {
  return validator.escape(validator.trim(input));
}
export const agents = new Map<string, any>();

//USERS HEIRARCHy OBJECT
export const rolesHierarchy = {
  admin: ["distributor", "subdistributor", "agent", "player"],
  distributor: ["subdistributor"],
  subdistributor: ["agent"],
  agent: ["player"],
};


/*
 * Function to remove a bet from the waiting queue
 * @param bet - stringified object eg: {betID: "1234", commence_time: "2022-01-01T00:00:00.000Z"}
 * */
export async function removeFromWaitingQueue(bet: any) {
  //here bet is a stringified object eg:{betID: "1234", commence_time: "2022-01-01T00:00:00.000Z"}

  await redisClient.zrem('waitingQueue', bet);
}

//CHECKS PERMISSION TO PERFORM ACTIONS
export const hasPermission = async (
  requestingUserId: string,
  targetUserId: string,
  requestingUserRole: string,
): Promise<boolean> => {
  if (!requestingUserId || !requestingUserRole || !targetUserId) {
    return false;
  }

  const requestingUser = await User.findById(requestingUserId);
  if (!requestingUser) return false;
  console.log(requestingUser, "requesting user");

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

