import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, DecodedToken } from "./utils";
import createHttpError from "http-errors";

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
          const _req = req as AuthRequest;
          _req.user = {
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
