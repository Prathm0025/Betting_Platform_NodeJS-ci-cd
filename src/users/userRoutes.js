"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = __importDefault(require("./userController"));
const middleware_1 = require("../utils/middleware");
const userRoutes = express_1.default.Router();
userRoutes.get("/", middleware_1.checkUser, userController_1.default.getCurrentUser);
userRoutes.get("/captcha", userController_1.default.getCaptcha);
userRoutes.post("/login", userController_1.default.login);
userRoutes.get("/summary/:id", middleware_1.checkUser, (0, middleware_1.verifyRole)(["agent", "admin", "distributor", "subdistributor"]), userController_1.default.getSummary);
// userRoutes.get("/notifications", checkUser, userController.getNotifications);
exports.default = userRoutes;
