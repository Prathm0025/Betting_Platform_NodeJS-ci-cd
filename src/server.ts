import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import globalErrorHandler from "./utils/globalHandler";
import userRoutes from "./users/userRoutes";
import adminRoutes from "./admin/adminRoutes";
import agentRoutes from "./agents/agentRoutes";
import { checkUser } from "./utils/middleware";
import playerRoutes from "./players/playerRoutes";


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
app.use("/api/payer", checkUser, playerRoutes);
app.use("/api/admin", checkUser, adminRoutes);
app.use("/api/agent", checkUser, agentRoutes);


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

app.use(globalErrorHandler);

export default server;
