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
const axios_1 = __importDefault(require("axios"));
const storeServices_1 = __importDefault(require("./storeServices"));
const socket_1 = require("../socket/socket");
const server_1 = require("../server");
const redisclient_1 = require("../../src/redisclient");
class Store {
    constructor() {
        this.storeService = new storeServices_1.default();
        this.initializeRedis();
    }
    initializeRedis() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.redisGetAsync = redisclient_1.redisClient.get.bind(redisclient_1.redisClient);
                this.redisSetAsync = redisclient_1.redisClient.set.bind(redisclient_1.redisClient);
            }
            catch (error) {
                console.error("Redis client connection error:", error);
                this.redisGetAsync = () => __awaiter(this, void 0, void 0, function* () { return null; });
                this.redisSetAsync = () => __awaiter(this, void 0, void 0, function* () { return null; });
            }
        });
    }
    fetchFromApi(url, params, cacheKey) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if the data is already in the Redis cache
            const cachedData = yield this.redisGetAsync(cacheKey);
            if (cachedData) {
                // console.log(JSON.parse(cachedData), "cached");
                return JSON.parse(cachedData);
            }
            try {
                const response = yield axios_1.default.get(url, {
                    params: Object.assign(Object.assign({}, params), { apiKey: config_1.config.oddsApi.key }),
                });
                let cacheDuration = 30; // Default to 1 minute (60 seconds)
                if (cacheKey === 'sportsList') {
                    cacheDuration = 43200; // 12 hours (12 * 60 * 60 = 43200 seconds)
                }
                // Cache the data in Redis
                yield this.redisSetAsync(cacheKey, JSON.stringify(response.data), "EX", cacheDuration); // Cache for 12 hours
                return response.data;
            }
            catch (error) {
                console.log("EVENT ODDS ERROR", error);
                throw new Error(error.message || "Error Fetching Data");
            }
        });
    }
    getSports() {
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports`, {}, "sportsList");
    }
    getScores(sport, daysFrom, dateFormat) {
        const cacheKey = `scores_${sport}_${daysFrom}_${dateFormat || "iso"}`;
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/scores`, { daysFrom, dateFormat }, cacheKey);
    }
    getScoresForProcessing(sport, daysFrom, dateFormat) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `scores_${sport}_${daysFrom}_${dateFormat || "iso"}`;
            const scoresResponse = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/scores`, { daysFrom, dateFormat }, cacheKey);
            const now = new Date();
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            const endOfToday = new Date(now);
            endOfToday.setHours(23, 59, 59, 999);
            const completedGames = scoresResponse.filter((game) => game.completed);
            const futureUpcomingGames = scoresResponse.filter((game) => {
                const commenceTime = new Date(game.commence_time);
                return commenceTime > endOfToday && !game.completed;
            });
            return {
                futureUpcomingGames,
                completedGames
            };
        });
    }
    // HANDLE ODDS
    getOdds(sport, markets, regions, player) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = `odds_${sport}_h2h_us`;
                // Fetch data from the API
                const oddsResponse = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/odds`, {
                    // markets: "h2h", // Default to 'h2h' if not provided
                    regions: "us", // Default to 'us' if not provided
                    oddsFormat: "decimal",
                }, cacheKey);
                //  console.log(oddsResponse, "odds response");
                const scoresResponse = yield this.getScores(sport, "1", "iso");
                const filteredScores = scoresResponse.filter((score) => score.completed === false && score.scores !== null);
                console.log(filteredScores, "filtered scores");
                const now = new Date();
                const startOfToday = new Date(now);
                startOfToday.setHours(0, 0, 0, 0);
                const endOfToday = new Date(now);
                endOfToday.setHours(23, 59, 59, 999);
                const processedData = oddsResponse.map((game) => {
                    const bookmaker = this.storeService.selectBookmaker(game.bookmakers);
                    const matchedScore = scoresResponse.find((score) => score.id === game.id);
                    if (bookmaker === undefined) {
                        return {};
                    }
                    return {
                        id: game === null || game === void 0 ? void 0 : game.id,
                        sport_key: game === null || game === void 0 ? void 0 : game.sport_key,
                        sport_title: game === null || game === void 0 ? void 0 : game.sport_title,
                        commence_time: game === null || game === void 0 ? void 0 : game.commence_time,
                        home_team: game === null || game === void 0 ? void 0 : game.home_team,
                        away_team: game === null || game === void 0 ? void 0 : game.away_team,
                        markets: (bookmaker === null || bookmaker === void 0 ? void 0 : bookmaker.markets) || [],
                        scores: (matchedScore === null || matchedScore === void 0 ? void 0 : matchedScore.scores) || [],
                        completed: matchedScore === null || matchedScore === void 0 ? void 0 : matchedScore.completed,
                        last_update: matchedScore === null || matchedScore === void 0 ? void 0 : matchedScore.last_update,
                        selected: bookmaker === null || bookmaker === void 0 ? void 0 : bookmaker.key,
                    };
                });
                const liveGames = processedData.filter((game) => {
                    const commenceTime = new Date(game.commence_time);
                    return commenceTime <= now && !game.completed;
                });
                //  console.log(liveGames, "live");
                const todaysUpcomingGames = processedData.filter((game) => {
                    const commenceTime = new Date(game.commence_time);
                    return (commenceTime > now &&
                        commenceTime >= startOfToday &&
                        commenceTime <= endOfToday &&
                        !game.completed);
                });
                const futureUpcomingGames = processedData.filter((game) => {
                    const commenceTime = new Date(game.commence_time);
                    return commenceTime > endOfToday && !game.completed;
                });
                const completedGames = processedData.filter((game) => game.completed);
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
    getOddsForProcessing(sport) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `odds_${sport}_h2h_us`;
            const oddsResponse = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/odds`, {
                markets: "h2h,spreads,totals", // Default to 'h2h' if not provided
                regions: "us", // Default to 'us' if not provided
                oddsFormat: "decimal",
            }, cacheKey);
            return oddsResponse;
        });
    }
    getEvents(sport, dateFormat) {
        const cacheKey = `events_${sport}_${dateFormat || "iso"}`;
        return this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/events`, { dateFormat }, cacheKey);
    }
    getEventOdds(sport, eventId, markets, regions, oddsFormat, dateFormat) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const categoriesData = yield this.getCategories();
            const has_outrights = (_b = (_a = categoriesData === null || categoriesData === void 0 ? void 0 : categoriesData.flatMap((item) => item === null || item === void 0 ? void 0 : item.events)) === null || _a === void 0 ? void 0 : _a.find((event) => (event === null || event === void 0 ? void 0 : event.key) === sport)) === null || _b === void 0 ? void 0 : _b.has_outrights;
            markets = has_outrights ? "outrights" : "h2h,spreads,totals";
            regions = "us";
            const cacheKey = `eventOdds_${sport}_${eventId}_${regions}_${markets}_${dateFormat || "iso"}_${oddsFormat || "decimal"}`;
            const data = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports/${sport}/events/${eventId}/odds`, { regions, markets, dateFormat: "iso", oddsFormat: "decimal" }, cacheKey);
            const { bookmakers } = data;
            const selectBookmakers = this.storeService.selectBookmaker(bookmakers);
            return Object.assign(Object.assign({}, data), { markets: selectBookmakers.markets, selected: selectBookmakers === null || selectBookmakers === void 0 ? void 0 : selectBookmakers.key });
        });
    }
    //search event from getOdds
    searchEvent(sport, query) {
        return __awaiter(this, void 0, void 0, function* () {
            //using getEvents with sportname 
            const events = yield this.getOdds(sport);
            if (query === "")
                return events;
            let filteredEvents = {
                live_games: [],
                todays_upcoming_games: [],
                future_upcoming_games: [],
            };
            events.live_games.forEach((event) => {
                var _a, _b, _c, _d;
                if (((_b = (_a = event === null || event === void 0 ? void 0 : event.home_team) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes(query === null || query === void 0 ? void 0 : query.toLowerCase())) ||
                    ((_d = (_c = event === null || event === void 0 ? void 0 : event.away_team) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === null || _d === void 0 ? void 0 : _d.includes(query === null || query === void 0 ? void 0 : query.toLowerCase()))) {
                    filteredEvents.live_games.push(event);
                }
            });
            events.todays_upcoming_games.forEach((event) => {
                var _a, _b, _c, _d;
                if (((_b = (_a = event === null || event === void 0 ? void 0 : event.home_team) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes(query === null || query === void 0 ? void 0 : query.toLowerCase())) ||
                    ((_d = (_c = event === null || event === void 0 ? void 0 : event.away_team) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === null || _d === void 0 ? void 0 : _d.includes(query === null || query === void 0 ? void 0 : query.toLowerCase()))) {
                    filteredEvents.todays_upcoming_games.push(event);
                }
            });
            events.future_upcoming_games.forEach((event) => {
                var _a, _b, _c, _d;
                if (((_b = (_a = event === null || event === void 0 ? void 0 : event.home_team) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes(query === null || query === void 0 ? void 0 : query.toLowerCase())) ||
                    ((_d = (_c = event === null || event === void 0 ? void 0 : event.away_team) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === null || _d === void 0 ? void 0 : _d.includes(query === null || query === void 0 ? void 0 : query.toLowerCase()))) {
                    filteredEvents.future_upcoming_games.push(event);
                }
            });
            return filteredEvents;
        });
    }
    getCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sportsData = yield this.fetchFromApi(`${config_1.config.oddsApi.url}/sports`, {}, "sportsList");
                const groupedData = {};
                groupedData["All"] = [];
                sportsData.forEach((item) => {
                    const { group, title, key, has_outrights, active } = item;
                    if (!groupedData[group]) {
                        groupedData[group] = [];
                    }
                    groupedData[group].push({ title, key, has_outrights, active });
                    groupedData["All"].push({ title, key, has_outrights, active });
                });
                const categories = Object.keys(groupedData).map((group) => ({
                    category: group,
                    events: groupedData[group],
                }));
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
                const sportsData = yield this.getSports();
                if (category.toLowerCase() === "all") {
                    return sportsData.filter((sport) => sport.active);
                }
                const categorySports = sportsData.filter((sport) => sport.group === category && sport.active);
                return categorySports;
            }
            catch (error) {
                console.error("Error fetching category sports:", error);
                throw new Error("Failed to fetch category sports");
            }
        });
    }
    updateLiveData() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(socket_1.activeRooms.values(), "AcTiVe");
            const currentActive = this.removeInactiveRooms();
            // console.log("currentActive", currentActive);
            for (const sport of currentActive) {
                const liveData = yield this.getOdds(sport);
                // console.log("livedata", liveData);
                const liveGamesForSport = liveData.live_games;
                const todaysUpcomingGamesForSport = liveData.todays_upcoming_games;
                const futureUpcomingGamesForSport = liveData.future_upcoming_games;
                // const liveGamesForSport = livedata.live_games.filter(
                //   (game: any) => game.sport_key === sport
                // );
                // const todaysUpcomingGamesForSport = livedata.todays_upcoming_games.filter(
                //   (game: any) => game.sport_key === sport
                // );
                // const futureUpcomingGamesForSport = livedata.future_upcoming_games.filter(
                //   (game: any) => game.sport_key === sport
                // );
                // Check if there's any data for the current sport before emitting
                if (liveGamesForSport.length > 0 ||
                    todaysUpcomingGamesForSport.length > 0 ||
                    futureUpcomingGamesForSport.length > 0) {
                    server_1.io.to(sport).emit("data", {
                        type: "ODDS",
                        data: {
                            live_games: liveGamesForSport,
                            todays_upcoming_games: todaysUpcomingGamesForSport,
                            future_upcoming_games: futureUpcomingGamesForSport,
                        },
                    });
                    console.log(`Data broadcasted to room: ${sport}`);
                }
                else {
                    console.log(`No relevant data available for sport: ${sport}`);
                }
            }
        });
    }
    removeInactiveRooms() {
        const rooms = server_1.io.sockets.adapter.rooms;
        const currentRooms = new Set(rooms.keys());
        socket_1.activeRooms.forEach((room) => {
            if (!currentRooms.has(room)) {
                socket_1.activeRooms.delete(room);
            }
        });
        return socket_1.activeRooms;
    }
}
exports.default = new Store();
