import express, { Router } from "express";
import userController from "./userController";

const userRoutes = express.Router()

userRoutes.get("/", userController.sayHello)
userRoutes.post("/login", userController.login)

export default userRoutes;