<<<<<<< HEAD
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
    {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        image: {
            type: String,
            required: true,
            trim: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
    });

const Gallery = mongoose.model('Gallery', imageSchema);
export default Gallery;
=======
import mongoose, { Document, Schema } from "mongoose";
import { IBanner } from "./bannerType";

const bannerSchema: Schema = new Schema({
  url: {
    type: String,
    required: true,
  },
  category: {
    type: [String],
    required: true,
  },
  status: {
    type: Boolean,
    require: true,
  },
  title: {
    type: String,
    required: true,
  },
});

const Banner = mongoose.model<IBanner>("Banners", bannerSchema);

export default Banner;
>>>>>>> d52d6d7e14a998a754a4a88a499b268155ce9727
