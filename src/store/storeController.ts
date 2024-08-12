import { config } from "../config/config";
import { LRUCache } from "lru-cache";
import axios from "axios";

class Store {
    private sportsCache: LRUCache<string, any>;
    private scoresCache: LRUCache<string, any>;
    private oddsCache: LRUCache<string, any>;
    private eventsCache: LRUCache<string, any>;
    private eventOddsCache: LRUCache<string, any>;

    constructor() {
        this.sportsCache = new LRUCache<string, any>({
            max: 100,
            ttl: 12 * 60 * 60 * 1000,
        }); // 12 hours
        this.scoresCache = new LRUCache<string, any>({
            max: 100,
            ttl: 1 * 60 * 1000,
        }); // 1 minute
        this.oddsCache = new LRUCache<string, any>({
            max: 100,
            ttl: 5 * 60 * 1000,
        }); // 5 minutes
        this.eventsCache = new LRUCache<string, any>({
            max: 100,
            ttl: 10 * 60 * 1000,
        }); // 10 minutes
        this.eventOddsCache = new LRUCache<string, any>({
            max: 100,
            ttl: 5 * 60 * 1000,
        }); // 5 minutes
    }

    private async fetchFromApi(
        url: string,
        params: any,
        cache: LRUCache<string, any>,
        cacheKey: string
    ): Promise<any> {
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        try {
            const response = await axios.get(url, {
                params: { ...params, apiKey: config.oddsApi.key },
            });
            cache.set(cacheKey, response.data);
            return response.data;
        } catch (error) {
            throw new Error("Error fetching data");
        }
    }

    private getPollingInterval(
        marketType: string,
        eventStartTime: string
    ): number {
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
        } else {
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
            } else {
                // Between 0 and 6 hours before the event
                return Math.max(60 * 1000, (minutesUntilEvent / 360) * 60 * 1000); // Linearly interpolate between 60 seconds and 5 minutes
            }
        }
    }

    private async pollForUpdates(
        marketType: string,
        eventStartTime: string
    ): Promise<void> {
        const pollingInterval = this.getPollingInterval(marketType, eventStartTime);

        try {
            // Refresh event odds data
            await this.getEventOdds(
                "example_sport",
                "example_event_id",
                "us",
                "head_to_head",
                "iso",
                "decimal"
            );
        } catch (error) {
            console.error("Error during polling:", error.message);
        }
        setTimeout(
            () => this.pollForUpdates(marketType, eventStartTime),
            pollingInterval
        );
    }

    public startPollingForEvent(
        sport: string,
        eventId: string,
        marketType: string
    ): void {
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

    public getSports(): Promise<any> {
        return this.fetchFromApi(
            `${config.oddsApi.url}/sports`,
            {},
            this.sportsCache,
            "sportsList"
        );
    }

    public getScores(
        sport: string,
        daysFrom: string | undefined,
        dateFormat: string | undefined
    ): Promise<any> {
        const cacheKey = `scores_${sport}_${daysFrom}_${dateFormat || "iso"}`;
        return this.fetchFromApi(
            `${config.oddsApi.url}/sports/${sport}/scores`,
            { daysFrom, dateFormat },
            this.scoresCache,
            cacheKey
        );
    }

    public getOdds(
        sport: string,
        markets: string | undefined,
        regions: string | undefined
    ): Promise<any> {
        const cacheKey = `odds_${sport}_${markets}_${regions}`;
        return this.fetchFromApi(
            `${config.oddsApi.url}/sports/${sport}/odds`,
            { markets, regions },
            this.oddsCache,
            cacheKey
        );
    }

    public getEvents(sport: string, dateFormat?: string): Promise<any> {
        const cacheKey = `events_${sport}_${dateFormat || "iso"}`;
        return this.fetchFromApi(
            `${config.oddsApi.url}/sports/${sport}/events`,
            { dateFormat },
            this.eventsCache,
            cacheKey
        );
    }

    public getEventOdds(
        sport: string,
        eventId: string,
        regions: string | undefined,
        markets: string | undefined,
        dateFormat: string | undefined,
        oddsFormat: string | undefined
    ): Promise<any> {
        const cacheKey = `eventOdds_${sport}_${eventId}_${regions}_${markets}_${dateFormat || "iso"
            }_${oddsFormat || "decimal"}`;
        return this.fetchFromApi(
            `${config.oddsApi.url}/sports/${sport}/events/${eventId}/odds`,
            { regions, markets, dateFormat, oddsFormat },
            this.eventOddsCache,
            cacheKey
        );
    }

    public async getCategories(): Promise<string[]> {
        try {
            const sportsData = await this.fetchFromApi(
                `${config.oddsApi.url}/sports`,
                {},
                this.sportsCache,
                "sportsList"
            );

            // Ensure sportsData is treated as an array of objects with known structure
            const categories = (
                sportsData as Array<{ group: string; active: boolean }>
            ).reduce<string[]>((acc, sport) => {
                if (sport.active && !acc.includes(sport.group)) {
                    acc.push(sport.group);
                }
                return acc;
            }, []);

            return categories;
        } catch (error) {
            console.error("Error fetching categories:", error);
            throw new Error("Failed to fetch categories");
        }
    }

    public async getCategorySports(category: string): Promise<any> {
        try {
            const sportsData = await this.fetchFromApi(
                `${config.oddsApi.url}/sports`,
                {},
                this.sportsCache,
                "sportsList"
            );

            const categorySports = sportsData.filter(
                (sport: any) => sport.group === category && sport.active
            );

            return categorySports;
        } catch (error) {
            console.error("Error fetching category sports:", error);
            throw new Error("Failed to fetch category sports");
        }
    }
}

export default new Store();
