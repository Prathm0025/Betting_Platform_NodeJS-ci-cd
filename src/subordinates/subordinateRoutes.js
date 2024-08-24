"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const subordinateController_1 = __importDefault(require("./subordinateController"));
const middleware_1 = require("../utils/middleware");
const subordinatesRoutes = express_1.default.Router();
subordinatesRoutes.post("/", subordinateController_1.default.createSubordinate);
subordinatesRoutes.get("/", (0, middleware_1.verifyRole)(["admin"]), subordinateController_1.default.getAllSubordinates);
subordinatesRoutes.get("/:username", subordinateController_1.default.getSubordinate);
subordinatesRoutes.get("/:superior/subordinates", (0, middleware_1.verifyRole)(["admin", "distributor", "subdistributor", "agent"]), subordinateController_1.default.getSubordinatessUnderSuperior);
subordinatesRoutes.put("/:id", subordinateController_1.default.updateSubordinate);
subordinatesRoutes.delete("/:id", subordinateController_1.default.deleteSubordinate);
exports.default = subordinatesRoutes;
