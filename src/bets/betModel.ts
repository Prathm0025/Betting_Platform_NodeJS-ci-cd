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
        enum: ['home', 'away'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['success', 'fail', 'pending']
    }
})

const Bet: Model<IBet> = mongoose.model<IBet>('Bet', betSchema);
export default Bet;