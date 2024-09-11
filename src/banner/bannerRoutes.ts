import express from "express";
import { verifyRole } from "../utils/middleware";
import BannerController from "./bannerController";
import multer from "multer";

const bannerRoutes = express.Router();
const bannerController = new BannerController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

bannerRoutes.get("/", verifyRole(["admin"]), bannerController.getBanners);
bannerRoutes.post(
  "/",
  verifyRole(["admin"]),
  upload.fields([{ name: "banner" }]),
  bannerController.addBanner
);
bannerRoutes.put("/", verifyRole(["admin"]), bannerController.updateBanner);
bannerRoutes.delete("/", verifyRole(["admin"]), bannerController.deleteBanner);

export default bannerRoutes;
