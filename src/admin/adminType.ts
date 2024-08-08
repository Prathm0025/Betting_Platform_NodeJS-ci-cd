import mongoose from "mongoose";
import { IUser } from "../users/userType";

export interface IAdmin extends IUser {
    agents: mongoose.Schema.Types.ObjectId[];
    players: mongoose.Schema.Types.ObjectId[];
}
