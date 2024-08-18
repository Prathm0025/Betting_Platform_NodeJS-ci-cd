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
const betServices_1 = __importDefault(require("../bets/betServices"));
let agenda;
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        mongoose_1.default.connection.on("connected", () => __awaiter(void 0, void 0, void 0, function* () {
            console.log("Connected to database successfully");
        }));
        mongoose_1.default.connection.on("error", (err) => {
            console.log("Error in connecting to database.", err);
        });
        yield mongoose_1.default.connect(config_1.config.databaseUrl);
        // Initialize Agenda
        exports.agenda = agenda = new agenda_1.default({
            db: { address: config_1.config.databaseUrl, collection: "jobs" }
        });
        // Define a sample job
        agenda.define('add bet to queue', (job) => __awaiter(void 0, void 0, void 0, function* () {
            const { betId } = job.attrs.data;
            yield betServices_1.default.addBetToQueueAtCommenceTime(betId);
            console.log(`Bet ${betId} is added to processing queue`);
        }));
        agenda.define('fetch odds for queue bets', () => __awaiter(void 0, void 0, void 0, function* () {
            yield betServices_1.default.fetchOddsForQueueBets();
        }));
        // // Start Agenda
        yield agenda.start();
        // Schedule the recurring job
        yield agenda.every('30 seconds', 'fetch odds for queue bets');
        console.log('Agenda started');
    }
    catch (err) {
        console.error("Failed to connect to database.", err);
        process.exit(1);
    }
});
exports.default = connectDB;
