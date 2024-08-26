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
exports.userSchemaFields = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.userSchemaFields = {
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'distributor', 'subdistributor', 'agent'],
        required: true,
    },
    credits: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    createdBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
    },
    lastLogin: {
        type: Date,
    },
    transactions: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Transaction',
        }],
    subordinates: [
        {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    players: [
        {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Player'
        }
    ],
    totalRecharge: {
        type: Number,
        default: 0
    },
    totalRedeem: {
        type: Number,
        default: 0
    }
};
const userSchema = new mongoose_1.Schema(exports.userSchemaFields, {
    collection: 'users',
    timestamps: true,
});
userSchema.pre('save', function (next) {
    if (this.role && (this.role !== 'admin' && this.role !== 'agent')) {
        this.players = undefined;
    }
    else if (this.role === 'agent') {
        this.subordinates = undefined;
    }
    next();
});
userSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();
    if (update.role && (update.role !== 'admin' && update.role !== 'agent')) {
        this.set({ players: undefined });
    }
    else if (update.role === 'agent') {
        this.set({ subordintes: undefined });
    }
    next();
});
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;
