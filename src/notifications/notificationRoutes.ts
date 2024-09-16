import express from "express";
import notificationController from "./notificationController";
import { config } from "../config/config";
import jwt from "jsonwebtoken";
import { agents } from "../utils/utils";
import { checkUser } from "../utils/middleware";

const notificationRoutes = express.Router();

notificationRoutes.get("/", notificationController.getNotifications);

//NOTE: 
// SSE route to stream notifications to agents
notificationRoutes.get('/agent', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Set the headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const token = req.headers.cookie?.split("=")[1];
  const decoded = jwt.verify(token, config.jwtSecret!);

  agents.set(decoded.userId, res)

  // Clean up when the connection is closed
  req.on('close', () => {
    agents.delete(decoded.userId)
    res.end();
  });
});

//another route to get notifications
notificationRoutes.get("/get", checkUser, notificationController.getNotifications);

export default notificationRoutes;
