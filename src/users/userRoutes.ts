import express, { Router } from "express";
import userController from "./userController";
import { loginRateLimiter } from "../utils/middleware";

const userRoutes = express.Router()

userRoutes.post("/login", loginRateLimiter,  userController.login)


export default userRoutes;