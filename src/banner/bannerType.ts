<<<<<<< HEAD
export interface UploadResult {
    public_id: string;
    version: number;
    signature: string;
    width: number;
    height: number;
    format: string;
    resource_type: string;
    url: string;
    secure_url: string;
=======
import mongoose from "mongoose";

export interface IBanner extends Document {
  url: string;
  category: string[];
  status: boolean;
  title: string;
>>>>>>> d52d6d7e14a998a754a4a88a499b268155ce9727
}
