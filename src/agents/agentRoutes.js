"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const agentController_1 = __importDefault(require("./agentController"));
const middleware_1 = require("../utils/middleware");
const agentRoutes = express_1.default.Router();
agentRoutes.get("/", agentController_1.default.sayHello);
agentRoutes.post("/create-agent", (0, middleware_1.verifyRole)(['admin']), agentController_1.default.createAgent);
agentRoutes.get("/get-agent/:id", (0, middleware_1.verifyRole)(['admin']), agentController_1.default.getAgent);
agentRoutes.get("/get-all-agents", (0, middleware_1.verifyRole)(['admin']), agentController_1.default.getAllAgents);
agentRoutes.put("/update-agent/:id", (0, middleware_1.verifyRole)(['admin']), agentController_1.default.updateAgent);
agentRoutes.delete("/delete-agent/:id", (0, middleware_1.verifyRole)(['admin']), agentController_1.default.deleteAgent);
exports.default = agentRoutes;
