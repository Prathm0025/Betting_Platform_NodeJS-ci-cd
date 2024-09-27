"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const betController_1 = __importDefault(require("./betController"));
const middleware_1 = require("../utils/middleware");
const betRoutes = express_1.default.Router();
betRoutes.get("/", (0, middleware_1.verifyRole)(["admin"]), betController_1.default.getAdminBets);
betRoutes.get("/redeem/:betId", middleware_1.checkUser, middleware_1.checkBetCommision, betController_1.default.redeemBetInfo);
betRoutes.get("/:agentId", betController_1.default.getAgentBets);
betRoutes.get("/:player/bets", betController_1.default.getBetForPlayer);
betRoutes.put("/:betId", middleware_1.checkUser, middleware_1.checkBetCommision, betController_1.default.redeemPlayerBet);
betRoutes.put("/resolve/:betDetailId", (0, middleware_1.verifyRole)(["admin", "agent"]), betController_1.default.resolveBet);
betRoutes.put("/", (0, middleware_1.verifyRole)(["admin", "agent"]), betController_1.default.updateBet);
exports.default = betRoutes;
