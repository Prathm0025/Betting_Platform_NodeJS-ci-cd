"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const storeRoutes = express_1.default.Router();
// const store = new Store()
// storeRoutes.get("/", store.getRequestCount);
// storeRoutes.get("/sports", store.getSports);
// storeRoutes.get("/sports/:sport/events", store.getSportEvents);
exports.default = storeRoutes;
