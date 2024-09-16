import express from "express";
import notificationController from "./notificationController";
import { Redis } from "ioredis";
import { config } from "../config/config";

const notificationRoutes = express.Router();

notificationRoutes.get("/", notificationController.getNotifications);

const redisForSub = new Redis(config.redisUrl);
//NOTE: 
// SSE route to stream notifications to agents
notificationRoutes.get('/agent', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Set the headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const sendNotification = (message: string) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  };
  // Subscribe to the 'agent-notif' channel
  redisForSub.subscribe('agent-notif');
  // Listen for messages on the Redis channel
  // Send notification as SSE
  redisForSub.on('message', (channel, message) => {
    if (channel === 'agent-notif') {
      sendNotification(JSON.parse(message));
    }
  });

  // Clean up when the connection is closed
  req.on('close', () => {
    res.end();
  });
});

export default notificationRoutes;
