"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const agentController_1 = __importDefault(require("./agentController"));
const middleware_1 = require("../utils/middleware");
const agentRoutes = express_1.default.Router();
agentRoutes.post("/", (0, middleware_1.verifyRole)(["admin"]), agentController_1.default.createAgent);
agentRoutes.get("/all", (0, middleware_1.verifyRole)(["admin"]), agentController_1.default.getAllAgents);
agentRoutes.get("/:id", (0, middleware_1.verifyRole)(["admin"]), agentController_1.default.getAgent);
agentRoutes.get("/players/:agentId", (0, middleware_1.verifyRole)(["admin", "agent"]), agentController_1.default.getPlayersUnderAgent);
agentRoutes.put("/:id", (0, middleware_1.verifyRole)(["admin"]), agentController_1.default.updateAgent);
agentRoutes.delete("/:id", (0, middleware_1.verifyRole)(["admin"]), agentController_1.default.deleteAgent);
exports.default = agentRoutes;
