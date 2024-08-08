import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import globalErrorHandler from "./utils/globalHandler";
import userRoutes from "./users/userRoutes";
import adminRoutes from "./admin/adminRoutes";
import agentRoutes from "./agents/agentRoutes";
import { checkUser } from "./utils/middleware";
import { Server } from "socket.io";
import socketController from "./socket/socket";


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

app.use("/api/user", checkUser,userRoutes);
app.use("/api/admin",checkUser, adminRoutes);
app.use("/api/agent",checkUser, agentRoutes);


// app.use("/api/superadmin", superadminRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/transactions", transactionRoutes);
// app.use("/api/superadmin", superadminRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/bets", betTransactionRoutes);


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
