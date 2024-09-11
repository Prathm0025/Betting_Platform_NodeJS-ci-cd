import express from "express";
import { verifyRole } from "../utils/middleware";
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