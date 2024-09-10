import mongoose from "mongoose";

export interface IBetDetail extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  key: mongoose.Schema.Types.ObjectId;
  event_id: string;
  sport_title: string;
  sport_key: string;
  commence_time: Date;
  home_team: {
    name: string;
    odds: number;
    points?: number;
  };
  away_team: {
    name: string;
    odds: number;
    points?: number;
  };
  market: string;
  bet_on: "home_team" | "away_team" | "Over" | "Under";
  selected: string;
  oddsFormat: string;
  status: "won" | "lost" | "draw" | "pending" | "redeem" | "failed";
  isResolved: boolean;
}

export interface IBet extends mongoose.Document {
  player: mongoose.Schema.Types.ObjectId;
  data: IBetDetail[]; // Expect populated `BetDetail` documents
  amount: number;
  possibleWinningAmount: number;
  status: "won" | "lost" | "draw" | "pending" | "redeem" | "failed";
  retryCount: number;
  betType: "single" | "combo";
  isResolved: boolean;
}