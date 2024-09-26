"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middleware_1 = require("../utils/middleware");
const bannerController_1 = __importDefault(require("./bannerController"));
const multer_1 = __importDefault(require("multer"));
const bannerRoutes = express_1.default.Router();
const bannerController = new bannerController_1.default();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 * 1024 },
});
bannerRoutes.post("/", (0, middleware_1.verifyRole)(["admin"]), upload.fields([{ name: "banner" }]), bannerController.addBanner);
bannerRoutes.get("/", middleware_1.checkUser, bannerController.getBanners);
bannerRoutes.put("/", (0, middleware_1.verifyRole)(["admin"]), bannerController.updateBanner);
bannerRoutes.delete("/", (0, middleware_1.verifyRole)(["admin"]), bannerController.deleteBanner);
bannerRoutes.get("/category", (0, middleware_1.verifyRole)(["admin"]), bannerController.getCategory);
exports.default = bannerRoutes;
