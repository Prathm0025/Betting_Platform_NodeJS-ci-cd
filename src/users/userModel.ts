import mongoose, { Model, Schema } from "mongoose";
import { IUser } from "./userType";

export const userSchemaFields: Partial<Record<keyof IUser, any>> = {
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'agent'],
        required: true,
    },
    credits: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    lastLogin: {
        type: Date,
    },
    transactions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
    }],
};

const User: Model<IUser> = mongoose.model<IUser>('User', new Schema(userSchemaFields, { discriminatorKey: 'role', collection: 'users' }));
export default User;