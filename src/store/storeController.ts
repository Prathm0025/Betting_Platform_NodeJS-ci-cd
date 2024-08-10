import { Event, Sport } from "./types";
import createHttpError from 'http-errors';
import cron from 'node-cron';
import { config } from '../config/config';
import StoreService from './storeServices';


class Store {
    private sports: Sport[] = [];
    private events: { [sport: string]: Event[] } = {};
    private odds: { [eventId: string]: any } = {}; // Store odds data by event ID
    private requestedEvents: Set<string> = new Set()
    private dataService: StoreService;

    constructor() {
        this.dataService = new StoreService(config.oddsApi.url, config.oddsApi.key);
        this.getSports = this.getSports.bind(this);
        this.getSportEvents = this.getSportEvents.bind(this);
        this.init()
    }

    private async init() {
        await this.updateSportsData();
        this.scheduleSportsFetch();
        this.scheduleEventsFetch()
    }


    private async updateSportsData(): Promise<void> {
        try {
            this.sports = await this.dataService.fetchSportsData();
            console.log('Sports data updated:', this.sports);
        } catch (error) {
            console.error('Error updating sports data:', error);
            throw createHttpError(500, 'Error updating sports data');
        }
    }

    private async updateSportEvents(): Promise<void> {
        try {
            for (const sport of this.requestedEvents) {
                const events = await this.dataService.fetchSportEvents(sport);
                this.events[sport] = events;
                console.log(`Events for sport ${sport} updated:`, events);
            }
        } catch (error) {
            console.error('Error updating sports events:', error);
            throw createHttpError(500, 'Error updating sports events');
        }
    }

    public async updateOddsData(sport: string): Promise<void> {
        try {
            if (!this.events[sport] || this.events[sport].length === 0) {
                console.warn(`No events found for sport ${sport} to update odds.`);
                return;
            }
            for (const event of this.events[sport]) {
                await this.getOddsForEvent(event.id);
            }
            console.log(`Odds data for sport ${sport} updated.`);
        } catch (error) {
            console.error(`Error updating odds data for sport ${sport}:`, error);
        }
    }

    private scheduleSportsFetch() {
        cron.schedule('0 */12 * * *', () => {
            this.updateSportsData().catch((error) => console.error(error));
        });
        console.log('Scheduled sports data fetch every 12 hours');
    }

    private scheduleEventsFetch() {
        cron.schedule('*/40 * * * * *', () => {
            this.updateSportEvents().catch((error) => console.error(error));
        });
        console.log('Scheduled events data fetch every 40 seconds');
    }

    private scheduleOddsFetch(sport: string) {
        cron.schedule('*/10 * * * *', () => { // Schedule odds fetching every 10 minutes
            this.updateOddsData(sport).catch((error) => console.error(error));
        });
        console.log(`Scheduled odds data fetch for sport ${sport} every 10 minutes`);
    }

    async getSports(): Promise<Sport[]> {
        try {
            if (this.sports.length === 0) {
                await this.updateSportsData();
            }
            return this.sports
        } catch (error) {
            console.log(error);

        }
    }

    public async getSportEvents(sport: string): Promise<Event[]> {
        try {
            if (this.events[sport] && this.events[sport].length > 0) {
                return this.events[sport]
            } else {
                this.requestedEvents.add(sport);
                const events = await this.dataService.fetchSportEvents(sport);
                this.events[sport] = events;
                return events;
            }
        } catch (error) {
            console.log(error);
        }
    }

    public async getOddsForEvent(eventId: string): Promise<any> {
        try {
            if (this.odds[eventId]) {
                return this.odds[eventId]; // Return cached odds if available
            } else {
                const oddsData = await this.dataService.fetchOddsData(eventId);
                this.odds[eventId] = oddsData; // Store the fetched odds
                return oddsData;
            }
        } catch (error) {
            console.error(`Error fetching odds for event ${eventId}:`, error);
            throw createHttpError(500, `Error fetching odds for event ${eventId}`);
        }
    }

   
}

export default new Store()