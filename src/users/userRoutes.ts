import express, { Router } from "express";
import userController from "./userController";

import { checkUser, loginRateLimiter } from "../utils/middleware";

const userRoutes = express.Router();

userRoutes.get("/", checkUser, userController.getCurrentUser)
userRoutes.get("/captcha", userController.getCaptcha);
userRoutes.post("/login", loginRateLimiter, userController.login)




export default userRoutes;


