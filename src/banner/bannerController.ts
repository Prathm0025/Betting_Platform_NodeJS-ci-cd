import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { Buffer } from "buffer";
import { config } from "../config/config";
import cloudinary from "cloudinary";
import Banner from "./bannerModel";
import mongoose from "mongoose";

cloudinary.v2.config({
  cloud_name: config.cloud_name,
  api_key: config.api_key,
  api_secret: config.api_secret,
});

interface BannerRequest extends Request {
  files?: {
    [fieldname: string]: Express.Multer.File[];
  };
}

class BannerController {
  public async getBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const banners = await Banner.find();
      res.status(200).json({ banners: banners });
    } catch (err) {
      next(err);
    }
  }

  public async addBanner(
    req: BannerRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      let bannerUploadResult: cloudinary.UploadApiResponse | undefined;
      const bannerBuffer = req.files.banner[0].buffer;
      const { category } = req.body;

      bannerUploadResult = await new Promise<cloudinary.UploadApiResponse>(
        (resolve, reject) => {
          cloudinary.v2.uploader
            .upload_stream(
              { resource_type: "image", folder: "Banner" },
              (error, result) => {
                if (error) {
                  return reject(error);
                }
                resolve(result as cloudinary.UploadApiResponse);
              }
            )
            .end(bannerBuffer);
        }
      );

      if (!bannerUploadResult || !bannerUploadResult.secure_url) {
        throw new Error("Image upload failed");
      }

      const newBanner = new Banner({
        url: bannerUploadResult.secure_url,
        category: category,
        status: true,
      });
      await newBanner.save();

      res.status(200).json({
        message: "Banner uploaded and saved successfully",
      });
    } catch (err) {
      next(err);
    }
  }
  public async updateBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, status } = req.body;
      const bannerId = new mongoose.Types.ObjectId(id);
      const updateBanner = await Banner.findByIdAndUpdate(bannerId, {
        status: status,
      });
      if (!updateBanner) {
        throw createHttpError(400, "Can't find the banner to update");
      }
      res.status(200).json({ message: "Banner updated succesfully" });
    } catch (err) {
      next(err);
    }
  }
  public async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { url } = req.body;
      let publicId = "Banner/";
      const imageId = url.split("/").pop()?.split(".")[0];
      publicId += imageId;
      const deletedBanner = await Banner.findOneAndDelete({ url: url });
      if (!deletedBanner) {
        throw createHttpError(400, "Banner not found");
      }
      if (!publicId) {
        throw createHttpError(400, "Invalid URL format");
      }

      await cloudinary.v2.uploader.destroy(publicId, (destroyError, result) => {
        if (destroyError) {
          throw createHttpError(400, "Error deleting image");
        } else {
          res.status(200).json({ message: "Banner deleted successfully" });
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

export default BannerController;
