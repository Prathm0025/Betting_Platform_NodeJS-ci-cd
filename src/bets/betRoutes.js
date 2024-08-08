"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const betController_1 = __importDefault(require("./betController"));
const agentRoutes = express_1.default.Router();
agentRoutes.get("/", betController_1.default.sayHello);
exports.default = agentRoutes;
