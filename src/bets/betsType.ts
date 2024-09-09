import mongoose from "mongoose";

export interface IBetDetail extends Document {
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
  status: "won" | "lost" | "pending" | "locked" | "retry" | "redeem" | "failed";
  isResolved:boolean
}

export interface IBet extends Document {
  player: mongoose.Schema.Types.ObjectId;
  data: mongoose.Schema.Types.ObjectId[];
  amount: number;
  possibleWinningAmount: number;
  status: "won" | "lost" | "pending" | "locked" | "retry" | "redeem" | "failed";
  retryCount: number;
  betType: "single" | "combo";
}

export interface Bet {
  id: string;
  category: string;
}

export interface WorkerPoolOptions {
  workerCount: number;
}
