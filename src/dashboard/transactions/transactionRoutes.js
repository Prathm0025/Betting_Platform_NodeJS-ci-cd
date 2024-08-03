"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const transactionController_1 = require("./transactionController");
const middleware_1 = require("../../utils/middleware");
const transactionController = new transactionController_1.TransactionController();
const transactionRoutes = express_1.default.Router();
transactionRoutes.get("/all", middleware_1.checkUser, transactionController.getAllTransactions);
transactionRoutes.get("/", middleware_1.checkUser, transactionController.getTransactions);
transactionRoutes.get("/:subordinateId", middleware_1.checkUser, transactionController.getTransactionsBySubId);
exports.default = transactionRoutes;
