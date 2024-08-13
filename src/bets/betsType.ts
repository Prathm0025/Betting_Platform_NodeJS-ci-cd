import mongoose from "mongoose";

export interface IBet extends Document {
    player: mongoose.Schema.Types.ObjectId;
    sport_title: string,
    commence_time: Date,
    home_team: {
        name: string,
        odds: number
    },
    away_team: {
        name: string,
        odd: number
    },
    market: string,
    bet_on: 'home' | 'away';
    amount: number;
    status: 'success' | 'fail' | 'pending' | 'locked' | 'retry',
    retryCount: number
}