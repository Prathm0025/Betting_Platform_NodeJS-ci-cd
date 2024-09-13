import express from "express";
import notificationController from "./notificationController";

const notificationRoutes = express.Router();

notificationRoutes.get("/:recipientId", notificationController.getNotifications);

export default notificationRoutes;