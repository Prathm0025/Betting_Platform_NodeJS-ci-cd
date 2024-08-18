"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const betController_1 = __importDefault(require("./betController"));
const middleware_1 = require("../utils/middleware");
const betRoutes = express_1.default.Router();
betRoutes.get("/:agentId", betController_1.default.getAgentBets);
betRoutes.get("/", (0, middleware_1.verifyRole)(["admin"]), betController_1.default.getAdminBets);
// betRoutes.get("/all/:adminId",verifyRole(["admin"]), betController.getAdminAgentBets)
betRoutes.get("/player/:userId?", betController_1.default.getBetForPlayer);
betRoutes.get("/player/by-username/:username", betController_1.default.getBetForPlayer);
exports.default = betRoutes;
