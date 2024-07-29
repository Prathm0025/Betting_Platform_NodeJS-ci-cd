import mongoose, { Schema, Model, Document } from "mongoose";
import { ITransaction } from "./transactionType";

const TransactionSchema = new Schema<ITransaction>(
  {
    debtor: { type: String, required: true },
    creditor: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  TransactionSchema
);

export default Transaction;
