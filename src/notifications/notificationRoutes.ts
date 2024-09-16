import express from "express";
import notificationController from "./notificationController";

const notificationRoutes = express.Router();

notificationRoutes.get("/", notificationController.getNotifications);
notificationRoutes.put("/", notificationController.markNotificationViewed);

export default notificationRoutes;
