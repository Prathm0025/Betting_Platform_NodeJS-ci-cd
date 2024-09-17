import express from "express";
import notificationController from "./notificationController";
import { config } from "../config/config";
import jwt from "jsonwebtoken";
import { agents } from "../utils/utils";
import { checkUser } from "../utils/middleware";

const notificationRoutes = express.Router();
const allowedOrigins = [
  "http://localhost:3000",
  "https://crm.bettingparadize.com",
  "https://betting-crm-nextjs-dev.vercel.app",
];
notificationRoutes.get("/", checkUser, notificationController.getNotifications);
notificationRoutes.put(
  "/",
  checkUser,
  notificationController.markNotificationViewed
);

//NOTE:
// SSE route to stream notifications to agents
notificationRoutes.get("/sse", (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Set the headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const token = req.headers.cookie?.split("=")[1];
  const decoded = jwt.verify(token, config.jwtSecret!);

  agents.set(decoded.userId, res);

  // Clean up when the connection is closed
  req.on("close", () => {
    agents.delete(decoded.userId);
    res.end();
  });
});

export default notificationRoutes;
