import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import globalErrorHandler from "./utils/globalHandler";
import userRoutes from "./users/userRoutes";
import adminRoutes from "./admin/adminRoutes";
import agentRoutes from "./agents/agentRoutes";
import { checkUser, verifyApiKey } from "./utils/middleware";
import { Server } from "socket.io";
import socketController from "./socket/socket";
import playerRoutes from "./players/playerRoutes";
import transactionRoutes from "./transactions/transactionRoutes";
import storeRoutes from "./store/storeRoutes";


const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

const server = createServer(app);

app.use("/api/auth", userRoutes);
app.use("/api/player", checkUser, playerRoutes);
app.use("/api/admin", verifyApiKey, adminRoutes);
app.use("/api/agent", checkUser, agentRoutes);
app.use("/api/store", checkUser, storeRoutes);
app.use("/api/transaction", checkUser, transactionRoutes);



app.get("/", (req, res, next) => {
  const health = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: new Date().toLocaleDateString(),
  };
  res.status(200).json(health);
});

app.use(express.static("src"));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
socketController(io);

app.use(globalErrorHandler);

export default server;
