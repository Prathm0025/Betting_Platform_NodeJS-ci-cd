import mongoose, { Model, Schema } from "mongoose";
import { IAdmin } from "./adminType";
import User, { userSchemaFields } from "../users/userModel";

const adminSchemaFields: Partial<Record<keyof IAdmin, any>> = {
    ...userSchemaFields,
    agents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
    }],
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
    }],
};

const adminSchema: Schema<IAdmin> = new Schema(adminSchemaFields, { discriminatorKey: 'role' });


adminSchema.path('credits').validate(function (value) {
    return value === Infinity;
}, 'Admin credits should be infinite.');

adminSchema.path('createdBy').validate(function (value) {
    return this.role !== 'admin' || value === undefined;
}, 'Admin should not have createdBy.');

const Admin: Model<IAdmin> = User.discriminator<IAdmin>('admin', adminSchema);
export default Admin
