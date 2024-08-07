import mongoose, { Model, Schema } from "mongoose";
import { IAdmin } from "./adminType";
import User from "../users/userModel";

const adminSchemaFields: Partial<Record<keyof IAdmin, any>> = {
    agents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
    }],
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
    }],
};

const adminSchema: Schema<IAdmin> = new Schema(adminSchemaFields);

// Pre-save hook to validate fields
adminSchema.pre('save', function (next) {
    if (this.role === 'admin') {
        if (this.credits !== Infinity) {
            return next(new Error('Admin credits should be infinite.'));
        }
        if (this.createdBy !== undefined) {
            return next(new Error('Admin should not have createdBy.'));
        }
    }
    next();
});

const Admin: Model<IAdmin> = User.discriminator<IAdmin>('admin', adminSchema);
export default Admin;