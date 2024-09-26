"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middleware_1 = require("../../utils/middleware");
const betTransactionController_1 = require("./betTransactionController");
const betTransactionRoutes = express_1.default.Router();
const bettransactionController = new betTransactionController_1.BetTransactionController();
betTransactionRoutes.post("/", middleware_1.checkUser, bettransactionController.createBet);
betTransactionRoutes.get("/all", middleware_1.checkUser, bettransactionController.getAllbets);
betTransactionRoutes.get("/:playerId", middleware_1.checkUser, bettransactionController.getPlayerBets);
exports.default = betTransactionRoutes;
