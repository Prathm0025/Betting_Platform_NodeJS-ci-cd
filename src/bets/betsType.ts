import mongoose from "mongoose";

export interface IBetDetail extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  key: mongoose.Schema.Types.ObjectId;
  event_id: string;
  sport_title: string;
  sport_key: string;
  commence_time: Date;
  teams: Array<{
    name: string;
  }>;
  bet_on: {
    name: string;
    odds: number;
    points: number;
  };
  category: string;
  bookmaker: string;
  oddsFormat: string;
  status: "won" | "lost" | "draw" | "pending" | "redeem" | "failed";
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
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