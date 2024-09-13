import mongoose from "mongoose";

interface INotification extends Document {
  type: "alert" | "info" | "message",
  payload: any;
  recipient: mongoose.Schema.Types.ObjectId;
  viewed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default INotification