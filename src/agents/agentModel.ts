import mongoose, { Model, Schema } from "mongoose";
import { IAgent } from "./agentType";
import User, { userSchemaFields } from "../users/userModel";


const agentSchemaFields: Partial<Record<keyof IAgent, any>> = {
    ...userSchemaFields,
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
    }],
};

const agentSchema: Schema<IAgent> = new Schema(agentSchemaFields, { discriminatorKey: 'role' });
const Agent: Model<IAgent> = User.discriminator<IAgent>('agent', agentSchema);

export default Agent