import mongoose, { Document, Schema } from "mongoose";
import { INotification } from "./notifcationType";

const notificationSchema: Schema = new Schema(
  {
    initiatorId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "initiatorModel", 
    },
    targetId: {
      type: Schema.Types.ObjectId,
    //   required: true,
      refPath: "targetModel", 
    },
    initiatorModel: {
      type: String,
      required: true,
      enum: ["User", "Player"], 
    },
    targetModel: {
      type: String,
      required: true,
      enum: ["User", "Player"], 
    },
    type: {
      type: String,
      enum: ["error", "success"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    reference: {
      type: String,
      enum: ["bet", "transaction"],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent"],
      default: "pending",
    },
    action: {
      type: String,
      enum: ["refund"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

export default Notification;