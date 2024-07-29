import express from "express";
import { TransactionController } from "./transactionController";
import { checkUser } from "../../utils/middleware";

const transactionController = new TransactionController();
const transactionRoutes = express.Router();

transactionRoutes.get("/all",checkUser,transactionController.getAllTransactions);
transactionRoutes.get("/", checkUser, transactionController.getTransactions);
transactionRoutes.get("/:subordinateId",checkUser,transactionController.getTransactionsBySubId);

export default transactionRoutes;
