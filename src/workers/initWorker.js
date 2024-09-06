"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = void 0;
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
const startWorkers = () => {
    const waitingQueueWorker = new worker_threads_1.Worker(path_1.default.resolve(__dirname, "../workers/waitingQueueWorker.js"));
    const processingQueueWorker = new worker_threads_1.Worker(path_1.default.resolve(__dirname, "../workers/processingQueueWorker.js"));
    waitingQueueWorker.postMessage('start');
    processingQueueWorker.postMessage('start');
    waitingQueueWorker.on('message', (msg) => {
        console.log(`Message from Waiting Queue Worker : ${msg}`);
    });
    processingQueueWorker.on('message', (msg) => {
        console.log(`Message from Waiting Queue Worker : ${msg}`);
    });
    waitingQueueWorker.on('error', (error) => {
        console.error("Error in worker:", error);
    });
    processingQueueWorker.on('error', (error) => {
        console.error("Error in worker:", error);
    });
    waitingQueueWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
        else {
            console.log("Worker stopped successfully");
        }
    });
    processingQueueWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
        else {
            console.log("Worker stopped successfully");
        }
    });
};
exports.startWorkers = startWorkers;
