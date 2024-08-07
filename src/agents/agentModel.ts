import mongoose, { Model, Schema } from "mongoose";
import { IAgent } from "./agentType";
import User from "../users/userModel";

const agentSchemaFields: Partial<Record<keyof IAgent, any>> = {
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
    }],
};

const agentSchema: Schema<IAgent> = new Schema(agentSchemaFields);

const Agent: Model<IAgent> = User.discriminator<IAgent>('agent', agentSchema);

export default Agent;