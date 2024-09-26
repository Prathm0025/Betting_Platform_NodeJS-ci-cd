"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middleware_1 = require("../utils/middleware");
const userActivityController_1 = __importDefault(require("./userActivityController"));
const userActivityRoutes = express_1.default.Router();
userActivityRoutes.get("/", (0, middleware_1.verifyRole)(["admin"]), userActivityController_1.default.getActivitiesByDate);
userActivityRoutes.get("/:player", (0, middleware_1.verifyRole)(["admin"]), userActivityController_1.default.getAllDailyActivitiesOfAPlayer);
userActivityRoutes.post("/", (0, middleware_1.verifyRole)(["admin"]), userActivityController_1.default.getBetsAndTransactionsInActivitySession);
exports.default = userActivityRoutes;
