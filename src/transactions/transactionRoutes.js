"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const transactionController_1 = __importDefault(require("./transactionController"));
const middleware_1 = require("../utils/middleware");
const transactionRoutes = express_1.default.Router();
transactionRoutes.post("/", transactionController_1.default.transaction);
transactionRoutes.get("/all", (0, middleware_1.verifyRole)(["admin"]), transactionController_1.default.getAllTransactions);
transactionRoutes.get("/:agentId", (0, middleware_1.verifyRole)(["admin"]), transactionController_1.default.getSpecificAgentTransactions);
transactionRoutes.get("/players/:agentId", (0, middleware_1.verifyRole)(["admin", "agent"]), transactionController_1.default.getAgentPlayerTransaction);
transactionRoutes.get("/player/:playerId", middleware_1.checkUser, transactionController_1.default.getSpecificPlayerTransactions);
exports.default = transactionRoutes;
// import express from "express";
// import { TransactionController } from "./transactionController";
// import { checkUser } from "../utils/middleware";
// const transactionController = new TransactionController();
// const transactionRoutes = express.Router();
// transactionRoutes.get("/all", checkUser, transactionController.getAllTransactions);
// transactionRoutes.get("/", checkUser, transactionController.getTransactions);
// transactionRoutes.get("/:subordinateId", checkUser, transactionController.getTransactionsBySubId);
// export default transactionRoutes;
