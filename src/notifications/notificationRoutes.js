"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationController_1 = __importDefault(require("./notificationController"));
const config_1 = require("../config/config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const utils_1 = require("../utils/utils");
const middleware_1 = require("../utils/middleware");
const notificationRoutes = express_1.default.Router();
notificationRoutes.get("/", middleware_1.checkUser, notificationController_1.default.getNotifications);
notificationRoutes.put("/", middleware_1.checkUser, notificationController_1.default.markNotificationViewed);
//NOTE:
// SSE route to stream notifications to agents
notificationRoutes.get("/sse", middleware_1.checkUser, (req, res) => {
    const origin = req.headers.origin;
    const token = req.headers.authorization.split(" ")[1];
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    // Set the headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
    utils_1.agents.set(decoded.userId, res);
    // Clean up when the connection is closed
    req.on("close", () => {
        utils_1.agents.delete(decoded.userId);
        res.end();
    });
});
exports.default = notificationRoutes;
