import express, { Router } from "express";
import userController from "./userController";
import { loginRateLimiter, verifyRole } from "../utils/middleware";

const userRoutes = express.Router()

userRoutes.get("/", userController.sayHello)
userRoutes.post("/login", loginRateLimiter,  userController.login)


export default userRoutes;