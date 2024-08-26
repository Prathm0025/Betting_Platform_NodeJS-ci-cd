import express, { Router } from "express";
import userController from "./userController";

import { checkUser, loginRateLimiter, verifyRole } from "../utils/middleware";

const userRoutes = express.Router();

userRoutes.get("/", checkUser, userController.getCurrentUser)
userRoutes.get("/captcha", userController.getCaptcha);
userRoutes.post("/login",  userController.login)
userRoutes.get("/summary/:id",checkUser, verifyRole(["agent", "admin", "distributor", "subdistributor"]), userController.getSummary)




export default userRoutes;


