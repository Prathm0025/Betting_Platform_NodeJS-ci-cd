import express from "express";
import notificationController from "./notificationController";
import { checkUser } from "../utils/middleware";

const notificationRoutes = express.Router();

notificationRoutes.get("/", notificationController.getNotifications);

export default notificationRoutes;