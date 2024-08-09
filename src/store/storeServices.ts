import axios from "axios";
import { Event, Sport } from "./types";
import createHttpError from 'http-errors';


class StoreService {
    private apiUrl: string;
    private apiKey: string;
    private requestCount: number = 0;


    constructor(url: string, key: string) {
        this.apiUrl = url;
        this.apiKey = key;
    }

    private incrementRequestCount() {
        this.requestCount += 1;
    }

    public getRequestCount(): number {
        return this.requestCount;
    }


    public async fetchSportsData(): Promise<Sport[]> {
        try {
            const response = await axios.get(`${this.apiUrl}/sports`, {
                params: { apiKey: this.apiKey },
            });
            this.incrementRequestCount()
            return response.data;
        } catch (error) {
            console.error('Error fetching sports data:', error);
            throw createHttpError(500, 'Error fetching sports data');
        }
    }

    public async fetchSportEvents(sport: string): Promise<Event[]> {
        try {
            const response = await axios.get(`${this.apiUrl}/sports/${sport}/events`, {
                params: { apiKey: this.apiKey },
            });
            this.incrementRequestCount()

            return response.data;
        } catch (error) {
            console.error(`Error fetching events for sport ${sport}:`, error);
            throw createHttpError(500, `Error fetching events for sport ${sport}`);
        }
    }
}

export default StoreService