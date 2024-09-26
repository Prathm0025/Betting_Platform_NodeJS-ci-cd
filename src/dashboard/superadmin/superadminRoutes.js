"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const superadminController_1 = require("./superadminController");
const superadminController = new superadminController_1.SuperadminController();
const superadminRoutes = express_1.default.Router();
superadminRoutes.post("/", superadminController.createSuperadmin);
exports.default = superadminRoutes;
