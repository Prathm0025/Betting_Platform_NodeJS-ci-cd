import mongoose, { Model, Schema } from "mongoose";
import { IBet, IBetDetail } from "./betsType";

const BetDetailSchema: Schema = new Schema({
  key: { type: Schema.Types.ObjectId, ref: "Bet", required: true }, // Reference to the parent Bet
  event_id: { type: String, required: true },
  sport_title: { type: String, required: true },
  sport_key: { type: String, required: true },
  commence_time: { type: Date, required: true },
  home_team: {
    name: { type: String, required: true },
    odds: { type: Number, required: true },
  },
  away_team: {
    name: { type: String, required: true },
    odds: { type: Number, required: true },
  },
  market: { type: String, required: true },
  bet_on: { type: String, enum: ["home_team", "away_team"], required: true },
  selected: { type: String, required: true },
  oddsFormat: { type: String, required: true },
  status: {
    type: String,
    enum: ["won", "lost", "pending", "locked", "retry", "redeem"],
    required: true,
  },
});

const BetSchema: Schema = new Schema({
  player: { type: Schema.Types.ObjectId, ref: "Player", required: true },
  data: [{ type: Schema.Types.ObjectId, ref: "BetDetail", required: true }],
  amount: { type: Number, required: true },
  possibleWinningAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["won", "lost", "pending", "locked", "retry", "redeem"],
    required: true,
  },
  retryCount: { type: Number, default: 0 },
  betType: { type: String, enum: ["single", "combo"], required: true },
});

export const BetDetail = mongoose.model<IBetDetail>(
  "BetDetail",
  BetDetailSchema
);
const Bet = mongoose.model<IBet>("Bet", BetSchema);

export default Bet;
