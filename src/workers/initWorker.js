"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = void 0;
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
// import { redisClient } from "../redisclient";
// import { io } from "../server";
// import { activeRooms } from "../socket/socket";
const waitingQueueWorker = new worker_threads_1.Worker(path_1.default.resolve(__dirname, "../workers/waitingQueueWorker.js"));
const processingQueueWorker = new worker_threads_1.Worker(path_1.default.resolve(__dirname, "../workers/processingQueueWorker.js"));
const startWorkers = () => {
    waitingQueueWorker.postMessage("start");
    processingQueueWorker.postMessage("start");
    waitingQueueWorker.on("message", (msg) => {
        console.log(`Message from Waiting Queue Worker : ${msg}`);
    });
    processingQueueWorker.on("message", (msg) => {
        console.log(`Message from Waiting Queue Worker : ${msg}`);
    });
    waitingQueueWorker.on("error", (error) => {
        console.error("Error in worker:", error);
    });
    processingQueueWorker.on("error", (error) => {
        console.error("Error in worker:", error);
    });
    waitingQueueWorker.on("exit", (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
        else {
            console.log("Worker stopped successfully");
        }
    });
    processingQueueWorker.on("exit", (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
        else {
            console.log("Worker stopped successfully");
        }
    });
};
exports.startWorkers = startWorkers;
// export const updateLiveData = (activeRooms: any) => {
//   const activeRoomsData = Array.from(activeRooms);
//   processingQueueWorker.postMessage({
//     action: "updateLiveData",
//     activeRooms: activeRoomsData,
//   });
//   redisClient.subscribe("UpdateOdds", (err, count) => {
//     if (err) {
//       console.error("Failed to subscribe:", err);
//     } else {
//       console.log(`Successfully subscribed to ${count} channel(s).`);
//     }
//   });
//   redisClient.on("message", (channel, message) => {
//     console.log("CHANNEL", channel);
//     if (channel === "UpdateOdds") {
//       try {
//         const data = JSON.parse(message);
//         // io.to(data.sport).emit("data", { type: "ODDS", data: data.data });
//         console.log("Received data from Redis:", data);
//       } catch (error) {
//         console.error("Error parsing message:", error);
//       }
//     }
//   });
// };
