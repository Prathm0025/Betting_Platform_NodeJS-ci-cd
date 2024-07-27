import express from "express";
import { checkUser } from "../../utils/middleware";
import { UserController } from "./userController";
const userRoutes = express.Router();

const userController = new UserController();

userRoutes.post("/login", userController.loginUser);
userRoutes.post("/", checkUser, userController.createUser);
userRoutes.get("/", checkUser, userController.getCurrentUser);
userRoutes.get("/all", checkUser, userController.getAllSubordinates);
userRoutes.get("/subordinates",checkUser,userController.getCurrentUserSubordinates);

export default userRoutes;
