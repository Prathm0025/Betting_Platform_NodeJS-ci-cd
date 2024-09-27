"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const config_1 = require("../config/config");
const cloudinary_1 = __importDefault(require("cloudinary"));
const bannerModel_1 = __importDefault(require("./bannerModel"));
const mongoose_1 = __importDefault(require("mongoose"));
const storeController_1 = __importDefault(require("../store/storeController"));
cloudinary_1.default.v2.config({
    cloud_name: config_1.config.cloud_name,
    api_key: config_1.config.api_key,
    api_secret: config_1.config.api_secret,
});
class BannerController {
    getCategory(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield storeController_1.default.getCategories();
                const categoryData = data.map((item) => item.category);
                res.status(200).json(categoryData);
            }
            catch (err) {
                next(err);
            }
        });
    }
    getBanners(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { category, status } = req.query;
                console.log(req.query);
                const banners = yield bannerModel_1.default.find({
                    category: category,
                    status: status === "active" ? true : false,
                });
                res.status(200).json({ banners: banners });
            }
            catch (err) {
                next(err);
            }
        });
    }
    addBanner(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let bannerUploadResult;
                const bannerBuffer = req.files.banner[0].buffer;
                const { category, title } = req.body;
                const categories = JSON.parse(category);
                console.log("data", req.body);
                bannerUploadResult = yield new Promise((resolve, reject) => {
                    cloudinary_1.default.v2.uploader
                        .upload_stream({ resource_type: "image", folder: config_1.config.cloud_folder }, (error, result) => {
                        if (error) {
                            return reject(error);
                        }
                        resolve(result);
                    })
                        .end(bannerBuffer);
                });
                if (!bannerUploadResult || !bannerUploadResult.secure_url) {
                    throw new Error("Image upload failed");
                }
                const newBanner = new bannerModel_1.default({
                    url: bannerUploadResult.secure_url,
                    category: categories,
                    status: true,
                    title: title,
                });
                yield newBanner.save();
                res.status(200).json({
                    message: "Banner uploaded and saved successfully",
                });
            }
            catch (err) {
                next(err);
            }
        });
    }
    updateBanner(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { banners, status } = req.body;
                for (const banner of banners) {
                    const bannerId = new mongoose_1.default.Types.ObjectId(banner);
                    const updateBanner = yield bannerModel_1.default.findByIdAndUpdate(bannerId, {
                        status: status === "active" ? true : false,
                    });
                    if (!updateBanner) {
                        throw (0, http_errors_1.default)(400, "Can't find the banner to update");
                    }
                }
                res.status(200).json({ message: "Banner updated succesfully" });
            }
            catch (err) {
                next(err);
            }
        });
    }
    deleteBanner(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { banners } = req.body;
                for (const banner of banners) {
                    const bannerId = new mongoose_1.default.Types.ObjectId(banner);
                    const bannerData = yield bannerModel_1.default.findById(bannerId);
                    if (!bannerData) {
                        throw (0, http_errors_1.default)(404, "Banner not found in database");
                    }
                    const imageId = (_a = bannerData.url.split("/").pop()) === null || _a === void 0 ? void 0 : _a.split(".")[0];
                    const publicId = `${config_1.config.cloud_folder}/${imageId}`;
                    const cloudinaryResult = yield new Promise((resolve, reject) => {
                        cloudinary_1.default.v2.uploader.destroy(publicId, (destroyError, result) => {
                            if (destroyError) {
                                return reject((0, http_errors_1.default)(400, "Error deleting image from Cloudinary"));
                            }
                            resolve(result);
                        });
                    });
                    const deletedBanner = yield bannerModel_1.default.findByIdAndDelete(bannerId);
                    if (!deletedBanner) {
                        throw (0, http_errors_1.default)(400, "Banner not found in database");
                    }
                }
                res.status(200).json({ message: "Banners deleted successfully" });
            }
            catch (err) {
                next(err);
            }
        });
    }
}
exports.default = BannerController;
