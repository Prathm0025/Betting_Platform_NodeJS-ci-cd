import mongoose, { Model, Schema } from "mongoose";
import { IBet } from "./betsType";

const betSchema: Schema<IBet> = new Schema({
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true,
    },
    sport_title: {
        type: String,
        required: true
    },
    sport_key: {
        type: String,
        required: true
    },
    event_id: {
        type: String,
        required: true
    },
    commence_time: {
        type: Date,
        required: true,
    },
    home_team: {
        name: {
            type: String,
            required: true,
        },
        odds: {
            type: Number,
            required: true,
        },
    },
    away_team: {
        name: {
            type: String,
            required: true,
        },
        odds: {
            type: Number,
            required: true,
        },
    },
    market: {
        type: String,
        required: true,
    },
    bet_on: {
        type: String,
        enum: ['home_team', 'away_team'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['won', 'lost', 'pending', 'locked', 'retry']
    },
    possibleWinningAmount: { // New field
        type: Number,
        required: true,
    },
    retryCount: {
        type: Number,
        default: 0,
    },
}, { timestamps: true })

const Bet: Model<IBet> = mongoose.model<IBet>('Bet', betSchema);
export default Bet;