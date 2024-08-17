import mongoose from "mongoose";

export interface IBet extends Document {
    player: mongoose.Schema.Types.ObjectId;
    sport_title: string,
    sport_key: string,
    event_id: string,
    commence_time: Date,
    home_team: {
        name: string,
        odds: number
    },
    away_team: {
        name: string,
        odds: number
    },
    market: string,
    bet_on: 'home_team' | 'away_team';
    amount: number;
    status: 'success' | 'fail' | 'pending' | 'locked' | 'retry',
    possibleWinningAmount: number,
    retryCount: number
}