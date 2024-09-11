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