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
const config_1 = require("../config/config");
const lru_cache_1 = require("lru-cache");
const axios_1 = __importDefault(require("axios"));
const storeServices_1 = __importDefault(require("./storeServices"));
class Store {
    constructor() {
        this.sportsCache = new lru_cache_1.LRUCache({
            max: 100,
            ttl: 12 * 60 * 60 * 1000, // 12 hours
        });
        this.scoresCache = new lru_cache_1.LRUCache({
            max: 100,
            ttl: 30 * 1000, // 30 seconds
        });
        this.oddsCache = new lru_cache_1.LRUCache({
            max: 100,
            ttl: 30 * 1000, // 30 seconds
        });
        this.eventsCache = new lru_cache_1.LRUCache({
            max: 100,
            ttl: 30 * 1000, // 30 seconds
        });
        this.eventOddsCache = new lru_cache_1.LRUCache({
            max: 100,
            ttl: 30 * 1000, // 30 seconds
        });
        this.storeService = new storeServices_1.default();
    }
    fetchFromApi(url, params, cache, cacheKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const cachedData = cache.get(cacheKey);
            if (cachedData) {
                return cachedData;
            }
            try {
                const response = yield axios_1.default.get(url, {
                    params: Object.assign(Object.assign({}, params), { apiKey: config_1.config.oddsApi.key }),
                });
                cache.set(cacheKey, response.data);
                return response.data;
            }
            catch (error) {
                throw new Error(error.message || "Error Fetching Data");
            }
        });
    }
    getPollingInterval(marketType, eventStartTime) {
        const now = new Date();
        const startTime = new Date(eventStartTime);
        const timeUntilEvent = startTime.getTime() - now.getTime();
        // Determine if the event is pre-match or in-play
        const isInPlay = timeUntilEvent <= 0;
        const minutesUntilEvent = timeUntilEvent / (60 * 1000);
        if (isInPlay) {
            // In-Play Update Intervals
            switch (marketType) {
                case "head_to_head":
                case "moneyline":
                case "1x2":
                case "spreads":
                case "handicaps":
                case "totals":
                case "over_under":
                    return 40 * 1000; // 40 seconds
                case "player_props":
                case "alternates":
                case "period_markets":
                    return 60 * 1000; // 60 seconds
                case "outrights":
                case "futures":
                    return 60 * 1000; // 60 seconds
                default:
                    return 60 * 1000; // Default to 60 seconds
            }
        }
        else {
            // Pre-Match Update Intervals
            if (minutesUntilEvent > 360) {
                // More than 6 hours before the event
                switch (marketType) {
                    case "head_to_head":
                    case "moneyline":
                    case "1x2":
                    case "spreads":
                    case "handicaps":
                    case "totals":
                    case "over_under":
                    case "player_props":
                    case "alternates":
                    case "period_markets":
                        return 60 * 1000; // 60 seconds
                    case "outrights":
                    case "futures":
                        return 5 * 60 * 1000; // 5 minutes
                    default:
                        return 60 * 1000; // Default to 60 seconds
                }
            }
            else {
                // Between 0 and 6 hours before the event
                return Math.max(60 * 1000, (minutesUntilEvent / 360) * 60 * 1000); // Linearly interpolate between 60 seconds and 5 minutes
            }
        }
    }
    pollForUpdates(marketType, eventStartTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const pollingInterval = this.getPollingInterval(marketType, eventStartTime);
            try {
                // Refresh event odds data
                yield this.getEventOdds("example_sport", "example_event_id", "us", "head_to_head", "iso", "decimal");
            }
            catch (error) {
                console.error("Error during polling:", error.message);
            }
            setTimeout(() => this.pollForUpdates(marketType, eventStartTime), pollingInterval);
        });
    }
    startPollingForEvent(sport, eventId, marketType) {
        // Example of how to start polling for a specific event
        this.getEvents(sport)
            .then((events) => {
            const event = events.find((e) => e.id === eventId);
            if (event) {
                this.pollForUpdates(marketType, event.commence_time);
            }
        })
            .catch((error) => {
            console.error("Error starting polling:", error.message);
        });
    }
    getSports() {
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports`, {}, this.sportsCache, "sportsList");
    }
    getScores(sport, daysFrom, dateFormat) {
        const cacheKey = `scores_${sport}_${daysFrom}_${dateFormat || "iso"}`;
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/scores`, { daysFrom, dateFormat }, this.scoresCache, cacheKey);
    }
    // HANDLE 
    getOdds(sport, markets, regions, player) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = `odds_${sport}_${markets}_${regions}`;
                // Fetch data from the API
                const oddsResponse = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/odds?markets=h2h&oddsFormat=decimal`, { regions, }, this.oddsCache, cacheKey);
                const scoresResponse = yield this.getScores(sport, '1', 'iso');
                // Get the current time for filtering live games
                const now = new Date().toISOString();
                // Process the data
                const processedData = oddsResponse.map((game) => {
                    // Select one bookmaker (e.g., the first one)
                    const bookmaker = this.storeService.selectBookmaker(game.bookmakers);
                    const matchedScore = scoresResponse.find((score) => score.id === game.id);
                    console.log("GAME ID : ", game.id);
                    console.log("matchedScore: ", matchedScore);
                    return {
                        id: game.id,
                        sport_key: game.sport_key,
                        sport_title: game.sport_title,
                        commence_time: game.commence_time,
                        home_team: game.home_team,
                        away_team: game.away_team,
                        markets: (bookmaker === null || bookmaker === void 0 ? void 0 : bookmaker.markets) || [],
                        scores: (matchedScore === null || matchedScore === void 0 ? void 0 : matchedScore.scores) || []
                    };
                });
                // Separate live games and upcoming games
                const liveGames = processedData.filter((game) => game.commence_time <= now);
                const upcomingGames = processedData.filter((game) => game.commence_time > now);
                // Return the formatted data
                return {
                    live_games: liveGames,
                    upcoming_games: upcomingGames,
                };
            }
            catch (error) {
                console.log(error.message);
                player.sendError(error.message);
            }
        });
    }
    getEvents(sport, dateFormat) {
        const cacheKey = `events_${sport}_${dateFormat || "iso"}`;
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/events`, { dateFormat }, this.eventsCache, cacheKey);
    }
    getEventOdds(sport, eventId, regions, markets, dateFormat, oddsFormat) {
        const cacheKey = `eventOdds_${sport}_${eventId}_${regions}_${markets}_${dateFormat || "iso"}_${oddsFormat || "decimal"}`;
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/events/${eventId}/odds`, { regions, markets, dateFormat, oddsFormat }, this.eventOddsCache, cacheKey);
    }
    getCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sportsData = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports`, {}, this.sportsCache, "sportsList");
                // Ensure sportsData is treated as an array of objects with known structure
                const categories = sportsData.reduce((acc, sport) => {
                    if (sport.active && !acc.includes(sport.group)) {
                        acc.push(sport.group);
                    }
                    return acc;
                }, []);
                return categories;
            }
            catch (error) {
                console.error("Error fetching categories:", error);
                throw new Error("Failed to fetch categories");
            }
        });
    }
    getCategorySports(category) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sportsData = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports`, {}, this.sportsCache, "sportsList");
                if (category.toLowerCase() === "all") {
                    // If the category is "all", return all sports
                    return sportsData.filter((sport) => sport.active);
                }
                // Otherwise, filter by the specified category
                const categorySports = sportsData.filter((sport) => sport.group === category && sport.active);
                return categorySports;
            }
            catch (error) {
                console.error("Error fetching category sports:", error);
                throw new Error("Failed to fetch category sports");
            }
        });
    }
}
exports.default = new Store();
