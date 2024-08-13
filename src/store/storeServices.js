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
const axios_1 = __importDefault(require("axios"));
const http_errors_1 = __importDefault(require("http-errors"));
class StoreService {
    constructor(url, key) {
        this.requestCount = 0;
        this.apiUrl = url;
        this.apiKey = key;
    }
    incrementRequestCount() {
        this.requestCount += 1;
    }
    getRequestCount() {
        return this.requestCount;
    }
    fetchSportsData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(`${this.apiUrl}/sports`, {
                    params: { apiKey: this.apiKey },
                });
                this.incrementRequestCount();
                return response.data;
            }
            catch (error) {
                console.error('Error fetching sports data:', error);
                throw (0, http_errors_1.default)(500, 'Error fetching sports data');
            }
        });
    }
    fetchSportEvents(sport) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(`${this.apiUrl}/sports/${sport}/events`, {
                    params: { apiKey: this.apiKey },
                });
                this.incrementRequestCount();
                return response.data;
            }
            catch (error) {
                console.error(`Error fetching events for sport ${sport}:`, error);
                throw (0, http_errors_1.default)(500, `Error fetching events for sport ${sport}`);
            }
        });
    }
    fetchOddsData(sport_1, eventId_1) {
        return __awaiter(this, arguments, void 0, function* (sport, eventId, markets = 'h2h,spreads,totals') {
            try {
                const response = yield axios_1.default.get(`${this.apiUrl}/v4/sports/${sport}/events/${eventId}/odds`, {
                    params: {
                        apiKey: this.apiKey,
                        regions: 'us', // or other regions you are interested in
                        markets: markets, // specify the markets you want
                        dateFormat: 'iso', // use 'iso' or 'unix' based on your preference
                        oddsFormat: 'american' // use 'american', 'decimal', or 'fractional'
                    }
                });
                this.incrementRequestCount();
                return response.data;
            }
            catch (error) {
                if (error.response && error.response.status === 404) {
                    console.error(`Odds data not found for event ${eventId}:`, error.message);
                }
                else {
                    console.error('Error fetching odds data:', error.message);
                }
                throw (0, http_errors_1.default)(500, `Error fetching odds data for event ${eventId}`);
            }
        });
    }
}
exports.default = StoreService;
