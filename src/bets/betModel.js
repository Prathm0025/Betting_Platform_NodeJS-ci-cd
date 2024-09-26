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
exports.BetDetail = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BetDetailSchema = new mongoose_1.Schema({
    key: { type: mongoose_1.Schema.Types.ObjectId, ref: "Bet", required: true },
    teams: [
        {
            name: { type: String, required: true },
            odds: { type: Number, required: true }
        }
    ],
    bet_on: {
        name: {
            type: String,
            required: true,
        },
        odds: {
            type: Number,
            required: true
        },
        points: {
            type: Number,
            required: false
        }
    },
    event_id: { type: String, required: true },
    sport_title: { type: String, required: true },
    sport_key: { type: String, required: true },
    commence_time: { type: Date, required: true },
    category: { type: String, required: true },
    bookmaker: { type: String, required: true },
    oddsFormat: { type: String, required: true },
    status: {
        type: String,
        enum: ["won", "lost", "draw", "pending", "redeem", "failed"],
        required: true,
    },
    isResolved: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });
const BetDetailTotalsSchema = new mongoose_1.Schema({
    key: { type: mongoose_1.Schema.Types.ObjectId, ref: "Bet", required: true },
    teams: [
        {
            name: { type: String, required: true }
        }
    ],
    bet_on: {
        name: {
            type: String,
            required: true,
        },
        odds: {
            type: Number,
            required: true
        },
        points: {
            type: Number,
            required: true
        }
    },
    event_id: { type: String, required: true },
    sport_title: { type: String, required: true },
    sport_key: { type: String, required: true },
    commence_time: { type: Date, required: true },
    category: { type: String, required: true },
    bookmaker: { type: String, required: true },
    oddsFormat: { type: String, required: true },
    status: {
        type: String,
        enum: ["won", "lost", "draw", "pending", "redeem", "failed"],
        required: true,
    },
    isResolved: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });
const BetSchema = new mongoose_1.Schema({
    player: { type: mongoose_1.Schema.Types.ObjectId, ref: "Player", required: true },
    data: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "BetDetail", required: true }],
    amount: { type: Number, required: true },
    possibleWinningAmount: { type: Number, required: true },
    status: {
        type: String,
        // enum: ["won", "lost", "draw", "pending", "redeem", "failed"],
        required: true,
    },
    retryCount: { type: Number, default: 0 },
    betType: { type: String, enum: ["single", "combo"], required: true },
}, { timestamps: true });
exports.BetDetail = mongoose_1.default.model("BetDetail", BetDetailSchema);
const Bet = mongoose_1.default.model("Bet", BetSchema);
exports.default = Bet;
