import { Document } from "mongoose";

export interface ITransaction extends Document {
  debtor: string;
  creditor: string;
  type: string;
  amount: number;
  createdAt: Date;
}
