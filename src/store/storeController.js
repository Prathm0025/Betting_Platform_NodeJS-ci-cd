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
const socket_1 = require("../socket/socket");
const server_1 = require("../server");
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
                // Log the quota-related headers
                const requestsRemaining = response.headers["x-requests-remaining"];
                const requestsUsed = response.headers["x-requests-used"];
                const requestsLast = response.headers["x-requests-last"];
                console.log(`Requests Remaining: ${requestsRemaining}`);
                console.log(`Requests Used: ${requestsUsed}`);
                console.log(`Requests Last: ${requestsLast}`);
                cache.set(cacheKey, response.data);
                return response.data;
            }
            catch (error) {
                throw new Error(error.message || "Error Fetching Data");
            }
        });
    }
    getSports() {
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports`, {}, this.sportsCache, "sportsList");
    }
    getScores(sport, daysFrom, dateFormat) {
        const cacheKey = `scores_${sport}_${daysFrom}_${dateFormat || "iso"}`;
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/scores`, { daysFrom, dateFormat }, this.scoresCache, cacheKey);
    }
    // HANDLE ODDS
    getOdds(sport, markets, regions, player) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = `odds_${sport}_h2h_us`;
                console.log("CACHE KEY : ", cacheKey);
                // Fetch data from the API
                const oddsResponse = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/odds`, {
                    markets: "h2h", // Default to 'h2h' if not provided
                    regions: "us", // Default to 'us' if not provided
                    oddsFormat: "decimal",
                }, this.oddsCache, cacheKey);
                const scoresResponse = yield this.getScores(sport, "1", "iso");
                // Get the current time for filtering live games
                const now = new Date();
                const startOfToday = new Date(now);
                startOfToday.setHours(0, 0, 0, 0);
                const endOfToday = new Date(now);
                endOfToday.setHours(23, 59, 59, 999);
                // Process the data
                const processedData = oddsResponse.map((game) => {
                    // Select one bookmaker (e.g., the first one)
                    const bookmaker = this.storeService.selectBookmaker(game.bookmakers);
                    const matchedScore = scoresResponse.find((score) => score.id === game.id);
                    return {
                        id: game.id,
                        sport_key: game.sport_key,
                        sport_title: game.sport_title,
                        commence_time: game.commence_time,
                        home_team: game.home_team,
                        away_team: game.away_team,
                        markets: (bookmaker === null || bookmaker === void 0 ? void 0 : bookmaker.markets) || [],
                        scores: (matchedScore === null || matchedScore === void 0 ? void 0 : matchedScore.scores) || [],
                        completed: matchedScore === null || matchedScore === void 0 ? void 0 : matchedScore.completed,
                        last_update: matchedScore === null || matchedScore === void 0 ? void 0 : matchedScore.last_update,
                        selected: bookmaker.key,
                    };
                });
                // console.log(processedData, "pd");
                // Get the current time for filtering live games
                // Filter live games
                const liveGames = processedData.filter((game) => {
                    const commenceTime = new Date(game.commence_time);
                    return commenceTime <= now && !game.completed;
                });
                // console.log(liveGames, "liveGames");
                // Filter today's upcoming games
                const todaysUpcomingGames = processedData.filter((game) => {
                    const commenceTime = new Date(game.commence_time);
                    return (commenceTime > now &&
                        commenceTime >= startOfToday &&
                        commenceTime <= endOfToday &&
                        !game.completed);
                });
                // console.log(todaysUpcomingGames, "todaysUpcomingGames");
                // Filter future upcoming games
                const futureUpcomingGames = processedData.filter((game) => {
                    const commenceTime = new Date(game.commence_time);
                    return commenceTime > endOfToday && !game.completed;
                });
                // console.log(futureUpcomingGames, "futureUpcomingGames");
                const completedGames = processedData.filter((game) => game.completed);
                // console.log(liveGames, todaysUpcomingGames, futureUpcomingGames, completedGames);
                return {
                    live_games: liveGames,
                    todays_upcoming_games: todaysUpcomingGames,
                    future_upcoming_games: futureUpcomingGames,
                    completed_games: completedGames || [],
                };
            }
            catch (error) {
                console.log(error.message);
                if (player) {
                    player.sendError(error.message);
                }
            }
        });
    }
    getEvents(sport, dateFormat) {
        const cacheKey = `events_${sport}_${dateFormat || "iso"}`;
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/events`, { dateFormat }, this.eventsCache, cacheKey);
    }
    getEventOdds(sport, eventId, markets, regions, oddsFormat, dateFormat) {
        console.log("in event odds", sport, eventId, markets, regions, oddsFormat, dateFormat);
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
    updateLiveData(livedata) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("i will update the live data");
            const currentActive = this.removeInactiveRooms();
            console.log(currentActive, "cdcdc");
            for (const sport of currentActive) {
                const { live_games, future_upcoming_games } = livedata;
                server_1.io.to(sport).emit("data", {
                    type: "ODDS",
                    data: {
                        live_games,
                        future_upcoming_games,
                    },
                });
                console.log(`Data broadcasted to room: ${sport}`);
            }
        });
    }
    removeInactiveRooms() {
        const rooms = server_1.io.sockets.adapter.rooms;
        const currentRooms = new Set(rooms.keys());
        socket_1.activeRooms.forEach((room) => {
            if (!currentRooms.has(room)) {
                socket_1.activeRooms.delete(room);
                console.log(`Removed inactive room: ${room}`);
            }
        });
        console.log(socket_1.activeRooms, 'rooms active');
        return socket_1.activeRooms;
    }
}
exports.default = new Store();
