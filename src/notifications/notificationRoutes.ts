import express from "express";
import notificationController from "./notificationController";

const notificationRoutes = express.Router();

notificationRoutes.get("/", notificationController.getUserNotification)

export default notificationRoutes;