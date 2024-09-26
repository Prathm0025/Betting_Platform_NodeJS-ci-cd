"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueue = enqueue;
exports.dequeue = dequeue;
exports.peek = peek;
exports.getAll = getAll;
exports.size = size;
exports.removeItem = removeItem;
const redisclient_1 = require("../redisclient");
const QUEUE_NAME = 'processingQueue';
// Enqueue an item to the queue
function enqueue(item) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redisclient_1.redisClient.lpush(QUEUE_NAME, item);
    });
}
// Dequeue an item from the queue
function dequeue() {
    return __awaiter(this, void 0, void 0, function* () {
        return redisclient_1.redisClient.rpop(QUEUE_NAME);
    });
}
// Peek at the next item to be dequeued
function peek() {
    return __awaiter(this, void 0, void 0, function* () {
        const items = yield redisclient_1.redisClient.lrange(QUEUE_NAME, -1, -1);
        return items[0] || null;
    });
}
// get all items in the queue
function getAll() {
    return __awaiter(this, void 0, void 0, function* () {
        return redisclient_1.redisClient.lrange(QUEUE_NAME, 0, -1);
    });
}
//size of the queue
function size() {
    return __awaiter(this, void 0, void 0, function* () {
        return redisclient_1.redisClient.llen(QUEUE_NAME);
    });
}
// Remove a specific item from the queue
function removeItem(item) {
    return __awaiter(this, void 0, void 0, function* () {
        return redisclient_1.redisClient.lrem(QUEUE_NAME, 0, item);
    });
}
