import express from "express";
import { verifyRole } from "../utils/middleware";
<<<<<<< HEAD
import multer from "multer";
import bannerController from "./bannerController";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 50MB limit
let bannerRoutes = express.Router();

bannerRoutes.post('/', verifyRole(['admin']), upload.fields([{ name: 'banner' }]), bannerController.uploadImage)
bannerRoutes.post('/createbanner', bannerController.saveBannerData)
bannerRoutes.put('/editbanner/:id', bannerController.editBannerData)
bannerRoutes.delete('/deletebanner/:id', bannerController.deleteBannerData)
bannerRoutes.get('/',bannerController.getBannerData)

export default bannerRoutes;
=======
import BannerController from "./bannerController";
import multer from "multer";

const bannerRoutes = express.Router();
const bannerController = new BannerController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 * 1024 },
});
bannerRoutes.post(
  "/",
  verifyRole(["admin"]),
  upload.fields([{ name: "banner" }]),
  bannerController.addBanner
);
bannerRoutes.get("/", verifyRole(["admin"]), bannerController.getBanners);
bannerRoutes.put("/", verifyRole(["admin"]), bannerController.updateBanner);
bannerRoutes.delete("/", verifyRole(["admin"]), bannerController.deleteBanner);
bannerRoutes.get(
  "/category",
  verifyRole(["admin"]),
  bannerController.getCategory
);

export default bannerRoutes;
>>>>>>> d52d6d7e14a998a754a4a88a499b268155ce9727
