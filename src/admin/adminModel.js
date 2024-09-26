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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const userModel_1 = __importDefault(require("../users/userModel"));
const adminSchemaFields = {
    agents: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Agent',
        }],
    players: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Player',
        }],
};
const adminSchema = new mongoose_1.Schema(adminSchemaFields);
// Pre-save hook to validate fields
adminSchema.pre('save', function (next) {
    if (this.role === 'admin') {
        if (this.credits !== Infinity) {
            return next(new Error('Admin credits should be infinite.'));
        }
        if (this.createdBy !== undefined) {
            return next(new Error('Admin should not have createdBy.'));
        }
    }
    next();
});
const Admin = userModel_1.default.discriminator('admin', adminSchema);
exports.default = Admin;
