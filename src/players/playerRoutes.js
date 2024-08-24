"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const playerController_1 = __importDefault(require("./playerController"));
const middleware_1 = require("../utils/middleware");
const playerRoutes = express_1.default.Router();
playerRoutes.post("/", (0, middleware_1.verifyRole)(['agent', 'admin']), playerController_1.default.createPlayer);
playerRoutes.get("/", (0, middleware_1.verifyRole)(['agent', 'admin']), playerController_1.default.getAllPlayers);
playerRoutes.get("/:id?", (0, middleware_1.verifyRole)(["admin", "agent"]), playerController_1.default.getPlayer);
playerRoutes.put("/:id", (0, middleware_1.verifyRole)(['agent', 'admin']), playerController_1.default.updatePlayer);
playerRoutes.delete("/:id", (0, middleware_1.verifyRole)(['agent', 'admin']), playerController_1.default.deletePlayer);
exports.default = playerRoutes;
