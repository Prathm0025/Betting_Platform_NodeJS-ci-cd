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
const http_errors_1 = __importDefault(require("http-errors"));
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = require("../config/config");
const storeServices_1 = __importDefault(require("./storeServices"));
class Store {
    constructor() {
        this.sports = [];
        this.events = {};
        this.odds = {}; // Store odds data by event ID
        this.requestedEvents = new Set();
        this.dataService = new storeServices_1.default(config_1.config.oddsApi.url, config_1.config.oddsApi.key);
        this.getSports = this.getSports.bind(this);
        this.getSportEvents = this.getSportEvents.bind(this);
        this.init();
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateSportsData();
            this.scheduleSportsFetch();
            this.scheduleEventsFetch();
        });
    }
    updateSportsData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.sports = yield this.dataService.fetchSportsData();
                console.log('Sports data updated:', this.sports);
            }
            catch (error) {
                console.error('Error updating sports data:', error);
                throw (0, http_errors_1.default)(500, 'Error updating sports data');
            }
        });
    }
    updateSportEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                for (const sport of this.requestedEvents) {
                    const events = yield this.dataService.fetchSportEvents(sport);
                    this.events[sport] = events;
                    console.log(`Events for sport ${sport} updated:`, events);
                }
            }
            catch (error) {
                console.error('Error updating sports events:', error);
                throw (0, http_errors_1.default)(500, 'Error updating sports events');
            }
        });
    }
    updateOddsData(sport) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.events[sport] || this.events[sport].length === 0) {
                    console.warn(`No events found for sport ${sport} to update odds.`);
                    return;
                }
                for (const event of this.events[sport]) {
                    yield this.getOddsForEvent(event.id);
                }
                console.log(`Odds data for sport ${sport} updated.`);
            }
            catch (error) {
                console.error(`Error updating odds data for sport ${sport}:`, error);
            }
        });
    }
    scheduleSportsFetch() {
        node_cron_1.default.schedule('0 */12 * * *', () => {
            this.updateSportsData().catch((error) => console.error(error));
        });
        console.log('Scheduled sports data fetch every 12 hours');
    }
    scheduleEventsFetch() {
        node_cron_1.default.schedule('*/40 * * * * *', () => {
            this.updateSportEvents().catch((error) => console.error(error));
        });
        console.log('Scheduled events data fetch every 40 seconds');
    }
    scheduleOddsFetch(sport) {
        node_cron_1.default.schedule('*/10 * * * *', () => {
            this.updateOddsData(sport).catch((error) => console.error(error));
        });
        console.log(`Scheduled odds data fetch for sport ${sport} every 10 minutes`);
    }
    getSports() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.sports.length === 0) {
                    yield this.updateSportsData();
                }
                return this.sports;
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    getSportEvents(sport) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.events[sport] && this.events[sport].length > 0) {
                    return this.events[sport];
                }
                else {
                    this.requestedEvents.add(sport);
                    const events = yield this.dataService.fetchSportEvents(sport);
                    this.events[sport] = events;
                    return events;
                }
            }
            catch (error) {
                console.log(error);
            }
        });
    }
    getOddsForEvent(eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.odds[eventId]) {
                    return this.odds[eventId]; // Return cached odds if available
                }
                else {
                    const oddsData = yield this.dataService.fetchOddsData(eventId);
                    this.odds[eventId] = oddsData; // Store the fetched odds
                    return oddsData;
                }
            }
            catch (error) {
                console.error(`Error fetching odds for event ${eventId}:`, error);
                throw (0, http_errors_1.default)(500, `Error fetching odds for event ${eventId}`);
            }
        });
    }
}
exports.default = new Store();
