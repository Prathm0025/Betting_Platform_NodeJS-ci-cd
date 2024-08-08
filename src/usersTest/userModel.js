// import mongoose, { Model, Schema, Types } from "mongoose";
// import { IPlayer, IUser } from "./userType";
// const UserSchema: Schema = new Schema<IUser>(
//   {
//     name: { type: String, required: true },
//     username: { type: String, required: true, unique: true },
//     status: { type: String, default: "active" },
//     password: { type: String, required: true },
//     role: { type: String, required: true },
//     subordinates: [
//       { type: mongoose.Types.ObjectId, refPath: "subordinateModel" },
//     ],
//     transactions: [{ type: mongoose.Types.ObjectId, ref: "Transaction" }],
//     lastLogin: { type: Date, default: null },
//     loginTimes: { type: Number, default: 0 },
//     totalRecharged: { type: Number, default: 0 },
//     totalRedeemed: { type: Number, default: 0 },
//     credits: { type: Number, required: true },
//     createdBy: { type: Types.ObjectId as any, ref: "User", default: null },
//   },
//   { timestamps: true }
// );
// UserSchema.virtual("subordinateModel").get(function (this: IUser) {
//   const rolesHierarchy: Record<string, string> = {
//     superadmin: "User",
//     admin: "Player",
//   };
//   return rolesHierarchy[this.role];
// });
// const PlayerSchema = new Schema<IPlayer>(
//   {
//     username: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     role: { type: String, default: "player", immutable: true },
//     status: { type: String, default: "active" },
//     lastLogin: { type: Date, default: null },
//     loginTimes: { type: Number, default: 0 },
//     totalRecharged: { type: Number, default: 0 },
//     totalRedeemed: { type: Number, default: 0 },
//     credits: { type: Number, default: 0 },
//     favouriteGames: { type: [String], default: [] },
//     transactions: [{ type: mongoose.Types.ObjectId, ref: "Transaction" }],
//     betTransaction: [{ type: mongoose.Types.ObjectId, ref: "BetTransaction" }],
//     createdBy: { type: Types.ObjectId as any, ref: "User", default: null },
//   },
//   { timestamps: true }
// );
// const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
// const Player = mongoose.model<IPlayer>("Player", PlayerSchema);
// export { User, Player };
