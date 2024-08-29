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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agenda = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const agenda_1 = __importDefault(require("agenda"));
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
const betServices_1 = __importDefault(require("../bets/betServices"));
const socket_1 = require("../socket/socket");
let agenda;
const workerFilePath = path_1.default.resolve(__dirname, "../bets/betWorkerScheduler.js");
const startWorker = (queueData, activeRooms) => {
    console.log(activeRooms, 'fesaz');
    const worker = new worker_threads_1.Worker(workerFilePath, {
        workerData: { queueData, activeRooms },
    });
    worker.on("message", (message) => {
        console.log("Worker message:", message);
    });
    worker.on("error", (error) => {
        console.error("Worker error:", error);
    });
    worker.on("exit", (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
    });
};
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        mongoose_1.default.connection.on("connected", () => __awaiter(void 0, void 0, void 0, function* () {
            console.log("Connected to database successfully");
        }));
        mongoose_1.default.connection.on("error", (err) => {
            console.log("Error in connecting to database.", err);
        });
        yield mongoose_1.default.connect(config_1.config.databaseUrl);
        exports.agenda = agenda = new agenda_1.default({
            db: { address: config_1.config.databaseUrl, collection: "jobs" },
        });
        agenda.define("add bet to queue", (job) => __awaiter(void 0, void 0, void 0, function* () {
            const { betDetailId } = job.attrs.data;
            yield betServices_1.default.addBetToQueueAtCommenceTime(betDetailId);
            console.log(`Bet ${betDetailId} is added to processing queue`);
        }));
        yield agenda.start();
        setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            const queueData = betServices_1.default.getPriorityQueueData();
            const active = socket_1.activeRooms;
            console.log(active, socket_1.activeRooms, "hagga");
            startWorker(queueData, active);
        }), 30000);
    }
    catch (err) {
        console.error("Failed to connect to database.", err);
        process.exit(1);
    }
});
exports.default = connectDB;
