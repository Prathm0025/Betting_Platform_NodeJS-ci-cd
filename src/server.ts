import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import superadminRoutes from "./dashboard/superadmin/superadminRoutes";
import globalErrorHandler from "./utils/globalHandler";
import userRoutes from "./dashboard/users/userRoutes";
import transactionRoutes from "./dashboard/transactions/transactionRoutes";
import betTransactionRoutes from "./dashboard/betTransactions/betTransactionRoutes";

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

app.use("/api/superadmin", superadminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bets", betTransactionRoutes);

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
