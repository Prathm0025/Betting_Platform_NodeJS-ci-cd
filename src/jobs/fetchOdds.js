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
exports.fetchScores = exports.fetchOdds = exports.fetchSports = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
const fetchSports = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get('https://api.the-odds-api.com/v4/sports', {
            params: {
                apiKey: config_1.config.oddsApiKey
            },
        });
        const sportsData = response.data;
        console.log(sportsData);
        // Save the data to your database or perform other actions
    }
    catch (error) {
        console.error('Error fetching sports data:', error);
    }
});
exports.fetchSports = fetchSports;
const fetchOdds = (sport) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(`https://api.the-odds-api.com/v4/sports/${sport}/odds`, {
            params: {
                apiKey: config_1.config.oddsApiKey
            },
        });
        const oddsData = response.data;
        console.log(oddsData);
        // Save the data to your database or perform other actions
    }
    catch (error) {
        console.error(`Error fetching odds data for sport ${sport}:`, error);
    }
});
exports.fetchOdds = fetchOdds;
const fetchScores = (sport) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get(`https://api.the-odds-api.com/v4/sports/${sport}/scores`, {
            params: {
                apiKey: config_1.config.oddsApiKey
            },
        });
        const scoresData = response.data;
        console.log(scoresData);
        // Save the data to your database or perform other actions
    }
    catch (error) {
        console.error(`Error fetching scores data for sport ${sport}:`, error);
    }
});
exports.fetchScores = fetchScores;
