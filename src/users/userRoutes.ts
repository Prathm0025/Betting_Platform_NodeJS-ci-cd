import express, { Router } from "express";
import userController from "./userController";
import { checkUser, loginRateLimiter } from "../utils/middleware";

const userRoutes = express.Router();

userRoutes.post("/login", loginRateLimiter, userController.login);
userRoutes.get("/", checkUser, userController.currentUser);

export default userRoutes;
