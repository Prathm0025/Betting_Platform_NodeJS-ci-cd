"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const betSchema = new mongoose_1.Schema({
    player: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
        enum: ['success', 'fail', 'pending', 'retry', 'locked']
    },
    retryCount: {
        type: Number,
        default: 0,
    },
});
const Bet = mongoose_1.default.model('Bet', betSchema);
exports.default = Bet;
