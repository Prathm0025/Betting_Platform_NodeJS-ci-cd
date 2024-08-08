import express, { Router } from "express";
import userController from "./userController";
import { checkUser, loginRateLimiter, verifyRole } from "../utils/middleware";

const userRoutes = express.Router()

userRoutes.get("/", checkUser, userController.getCurrentUser)
userRoutes.post("/login", loginRateLimiter,  userController.login)



export default userRoutes;