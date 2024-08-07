import express, { Router } from "express";
import userController from "./userController";
import { verifyRole } from "../utils/middleware";

const userRoutes = express.Router()

userRoutes.get("/", userController.sayHello)
userRoutes.post("/login", userController.login)
userRoutes.post("/create-user", verifyRole(['agent']), userController.createUser)


export default userRoutes;