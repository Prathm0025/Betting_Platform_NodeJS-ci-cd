import { NextFunction, Request, Response } from "express";
import rateLimit from 'express-rate-limit';

import jwt from "jsonwebtoken";
import { AuthRequest, DecodedToken } from "./utils";
import createHttpError from "http-errors";
import { config } from "../config/config";

export function checkUser(req: Request, res: Response, next: NextFunction) {
  const cookie = req.headers.cookie
    ?.split("; ")
    .find((row) => row.startsWith("userToken="))
    ?.split("=")[1];
  const authHeaders = req.headers.authorization;
  const token =
    cookie ||
    (authHeaders &&
      authHeaders.startsWith("Bearer") &&
      authHeaders.split(" ")[1]);
  //
  if (token) {
    jwt.verify(
      token,
      process.env.JWT_SECRET!,
      (err, decoded: DecodedToken | undefined) => {
        if (err) {
          if (err.name === "TokenExpiredError") {
            console.error("Token expired:", err.message);
            return next(createHttpError(401, "Token has expired"));
          } else {
            console.error("Token verification failed:", err.message);
            return next(createHttpError(401, "You are not authenticated"));
          }
        } else {
            console.log(decoded!.userId, 's');
            
          const _req = req as AuthRequest;
          _req.user = {
            userId:decoded!.userId,
            username: decoded!.username,
            role: decoded!.role,
          };
          next();
        }
      }
    );
  } else {
    next(createHttpError(401, "Unauthorized: No role found in cookies"));
  }
}

const API_KEY = config.adminApiKey;

export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ message: "API key is missing" });
    }

    if (apiKey !== API_KEY) {
        return res.status(403).json({ message: "Invalid API key" });
    }

    next();
};


export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: "Too many login attempts, please try again later."
});


export function verifyRole(requiredRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const _req = req as AuthRequest;
      const userRole = _req?.user?.role;
      console.log(userRole);
      
  
      if (!userRole || !requiredRoles.includes(userRole)) {
        return next(createHttpError(403, "Forbidden: Insufficient role"));
      }
  
      next();
    };
  }