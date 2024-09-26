"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("./config/config");
// Create and configure your Redis client
const redisClient = new ioredis_1.default(config_1.config.redisUrl);
exports.redisClient = redisClient;
// Log errors from Redis
redisClient.on('error', (err) => {
    console.error('Redis error:', err);
    process.exit(1);
});
// Ensure that Redis is connected before proceeding
redisClient.on('connect', () => {
    console.log('Redis client connected');
});
