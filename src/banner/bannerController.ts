import { Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';
import { v2 as cloudinary } from 'cloudinary';
import { Buffer } from 'buffer';
import { UploadResult } from './bannerType';
import Gallery from './bannerModel';

class BannerController {
  private static instance: BannerController;

  private constructor() {}

  public static getInstance(): BannerController {
    if (!BannerController.instance) {
      BannerController.instance = new BannerController();
      cloudinary.config({
        cloud_name: 'dhl5hifpz',
        api_key: '788474111765231',
        api_secret: '6kSJ1ia8ndE3aprfCvpn_1ubNUs'
      });
    }
    return BannerController.instance;
  }

  private uploadThumbnail = async (thumbnailBuffer: Buffer): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "image", folder: 'folder' },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result as UploadResult);
        }
      ).end(thumbnailBuffer);
    });
  };

  public uploadImage = async (req: Request & { files: { banner: { buffer: Buffer }[] } }, res: Response, next: NextFunction) => {
    let thumbnailUploadResult: UploadResult;
    const thumbnailBuffer = req.files.banner[0].buffer;

    try {
      thumbnailUploadResult = await this.uploadThumbnail(thumbnailBuffer);
      console.log(thumbnailUploadResult, "Upload result is Here");
      res.status(200).json(thumbnailUploadResult);
    } catch (uploadError) {
      next(createHttpError(500, "Failed to upload thumbnail"));
    }
  };

  public saveBannerData = async (req: Request, res: Response) => {
    try {
      const { image, title } = req.body;
      console.log(image, title, "image and title");
      if (!title || !image) {
        throw new Error('Title,Image URL are required');
      }
      const gallery = new Gallery({
        image,
        title
      });

      await gallery.save();

      res.status(200).json({ success: true, message: 'Banner data saved successfully' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  public editBannerData = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { image, title } = req.body;

      if (!id || !image || !title) {
        throw new Error('ID, Image URL, and Title are required');
      }

      const updatedGallery = await Gallery.findByIdAndUpdate(id, {
        $set: {
          image,
          title
        }
      }, { new: true });

      if (!updatedGallery) {
        throw new Error('Banner not found');
      }

      res.status(200).json({ success: true, message: 'Banner data updated successfully', updatedBanner: updatedGallery });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  public deleteBannerData = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new Error('ID is required');
      }

      const deletedBanner = await Gallery.findByIdAndDelete(id);

      if (!deletedBanner) {
        throw new Error('Banner not found');
      }

      res.status(200).json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  public getBannerData = async (req: Request, res: Response) => {
    try {
      const bannerData = await Gallery.find();

      console.log(bannerData, "bannerData");

      if (!bannerData || bannerData.length === 0) {
        return res.status(200).json({ success: true, banners: [] });
      }

      res.status(200).json({
        success: true,
        banners: bannerData,
        totalBanners: bannerData.length
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch banner data' });
    }
  }
}

export default BannerController.getInstance();