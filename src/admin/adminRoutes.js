"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController_1 = __importDefault(require("./adminController"));
const adminRoutes = express_1.default.Router();
adminRoutes.post("/request-otp", adminController_1.default.requestOtp);
adminRoutes.post("/verify-otp", adminController_1.default.verifyOtpAndCreateAdmin);
exports.default = adminRoutes;
