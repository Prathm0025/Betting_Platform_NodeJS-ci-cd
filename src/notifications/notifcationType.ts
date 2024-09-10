import mongoose from "mongoose";

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  initiatorId: mongoose.Schema.Types.ObjectId;
  targetId: mongoose.Schema.Types.ObjectId;
  initiatorModel: "User" | "Player";
  targetModel: "User" | "Player";
  type: "error" | "success";
  message: string;
  reference: "bet" | "transaction";
  referenceId: mongoose.Schema.Types.ObjectId;
  status: "pending" | "sent";
  action: "refund";
  createdAt: Date;
  updatedAt: Date;
}
