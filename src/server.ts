import express from "express";
import cors from "cors";
import { createServer } from "http";
import globalErrorHandler from "./utils/globalHandler";
import userRoutes from "./users/userRoutes";
import adminRoutes from "./admin/adminRoutes";
import subordinateRoutes from "./subordinates/subordinateRoutes";
import { checkUser, verifyApiKey } from "./utils/middleware";
import { Server } from "socket.io";
import socketController from "./socket/socket";
import playerRoutes from "./players/playerRoutes";
import transactionRoutes from "./transactions/transactionRoutes";
import storeRoutes from "./store/storeRoutes";
import betRoutes from "./bets/betRoutes";
import { config } from "./config/config";
import notificationRoutes from "./notifications/notificationRoutes";
import bannerRoutes from "./banner/bannerRoutes";

const app = express();

app.use(
  cors({
    origin: [`*.${config.hosted_url_cors}`],
  })
);

app.use(express.json());

const server = createServer(app);

app.use("/api/auth", userRoutes);
app.use("/api/players", checkUser, playerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subordinates", checkUser, subordinateRoutes);
app.use("/api/store", checkUser, storeRoutes);
app.use("/api/transactions", checkUser, transactionRoutes);
app.use("/api/bets", checkUser, betRoutes);
app.use("/api/notifications", checkUser, notificationRoutes);
app.use("/api/banner", checkUser, bannerRoutes);

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

export { io };
export default server;
