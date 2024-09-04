import { config } from "../config/config";
import { LRUCache } from "lru-cache";
import axios from "axios";
import StoreService from "./storeServices";
import { activeRooms } from "../socket/socket";
import { Server } from "socket.io";
import { io } from "../server";
import { Worker } from "worker_threads";
class Store {
  private sportsCache: LRUCache<string, any>;
  private scoresCache: LRUCache<string, any>;
  private oddsCache: LRUCache<string, any>;
  private eventsCache: LRUCache<string, any>;
  private eventOddsCache: LRUCache<string, any>;
  private storeService: StoreService;

  constructor() {
    this.sportsCache = new LRUCache<string, any>({
      max: 100,
      ttl: 12 * 60 * 60 * 1000, // 12 hours
    });

    this.scoresCache = new LRUCache<string, any>({
      max: 100,
      ttl: 30 * 1000, // 30 seconds
    });

    this.oddsCache = new LRUCache<string, any>({
      max: 100,
      ttl: 30 * 1000, // 30 seconds
    });

    this.eventsCache = new LRUCache<string, any>({
      max: 100,
      ttl: 30 * 1000, // 30 seconds
    });

    this.eventOddsCache = new LRUCache<string, any>({
      max: 100,
      ttl: 30 * 1000, // 30 seconds
    });

    this.storeService = new StoreService();
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

      // Log the quota-related headers
      const requestsRemaining = response.headers["x-requests-remaining"];
      const requestsUsed = response.headers["x-requests-used"];
      const requestsLast = response.headers["x-requests-last"];

      console.log(`Requests Remaining: ${requestsRemaining}`);
      console.log(`Requests Used: ${requestsUsed}`);
      console.log(`Requests Last: ${requestsLast}`);

      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.log("EVENT ODDS ERROR", error);
      throw new Error(error.message || "Error Fetching Data");
    }
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

  // HANDLE ODDS
  public async getOdds(
    sport: string,
    markets?: string | undefined,
    regions?: string | undefined,
    player?: any
  ): Promise<any> {
    try {
      const cacheKey = `odds_${sport}_h2h_us`;
      console.log("CACHE KEY : ", cacheKey);

      // Fetch data from the API
      const oddsResponse = await this.fetchFromApi(
        `${config.oddsApi.url}/sports/${sport}/odds`,
        {
          markets: "h2h", // Default to 'h2h' if not provided
          regions: "us", // Default to 'us' if not provided
          oddsFormat: "decimal",
        },
        this.oddsCache,
        cacheKey
      );

      const scoresResponse = await this.getScores(sport, "1", "iso");

      // Get the current time for filtering live games
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      // Process the data
      const processedData = oddsResponse.map((game: any) => {
        // Select one bookmaker (e.g., the first one)

        const bookmaker = this.storeService.selectBookmaker(game.bookmakers);
        const matchedScore = scoresResponse.find(
          (score: any) => score.id === game.id
        );
        if (bookmaker === undefined) {
          return {};
        }
        return {
          id: game?.id,
          sport_key: game?.sport_key,
          sport_title: game?.sport_title,
          commence_time: game?.commence_time,
          home_team: game?.home_team,
          away_team: game?.away_team,
          markets: bookmaker?.markets || [],
          scores: matchedScore?.scores || [],
          completed: matchedScore?.completed,
          last_update: matchedScore?.last_update,
          selected: bookmaker?.key,
        };
      });

      // console.log(processedData, "pd");

      // Get the current time for filtering live games
      // Filter live games
      const liveGames = processedData.filter((game: any) => {
        const commenceTime = new Date(game.commence_time);
        return commenceTime <= now && !game.completed;
      });

      // console.log(liveGames, "liveGames");

      // Filter today's upcoming games
      const todaysUpcomingGames = processedData.filter((game: any) => {
        const commenceTime = new Date(game.commence_time);
        return (
          commenceTime > now &&
          commenceTime >= startOfToday &&
          commenceTime <= endOfToday &&
          !game.completed
        );
      });

      // console.log(todaysUpcomingGames, "todaysUpcomingGames");

      // Filter future upcoming games
      const futureUpcomingGames = processedData.filter((game: any) => {
        const commenceTime = new Date(game.commence_time);
        return commenceTime > endOfToday && !game.completed;
      });

      // console.log(futureUpcomingGames, "futureUpcomingGames");

      const completedGames = processedData.filter(
        (game: any) => game.completed
      );

      // console.log(liveGames, todaysUpcomingGames, futureUpcomingGames, completedGames);

      return {
        live_games: liveGames,
        todays_upcoming_games: todaysUpcomingGames,
        future_upcoming_games: futureUpcomingGames,
        completed_games: completedGames || [],
      };
    } catch (error) {
      console.log(error.message);
      if (player) {
        player.sendError(error.message);
      }
    }
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

  public async getEventOdds(
    sport: string,
    eventId: string,
    has_outrights: boolean,
    markets?: string | undefined,
    regions?: string | undefined,
    oddsFormat?: string | undefined,
    dateFormat?: string | undefined
  ): Promise<any> {
    console.log(
      "in event odds",
      sport,
      eventId,
      markets,
      regions,
      oddsFormat,
      dateFormat,
      has_outrights
    );
    if (has_outrights) {
      markets = "outright";
    } else {
      markets = "h2h,spreads,totals";
    }
    const cacheKey = `eventOdds_${sport}_${eventId}_${regions}_${markets}_${
      dateFormat || "iso"
    }_${oddsFormat || "decimal"}`;
    const data = await this.fetchFromApi(
      `${config.oddsApi.url}/sports/${sport}/events/${eventId}/odds`,
      { regions, markets, dateFormat: "iso", oddsFormat: "decimal" },
      this.eventOddsCache,
      cacheKey
    );
    const bookmakers = this.storeService.selectBookmaker(data.bookmakers);
    data.bookmakers = bookmakers.markets;
    return data;
  }

  public async getCategories(): Promise<
    {
      category: string;
      events: any;
    }[]
  > {
    try {
      const sportsData = await this.fetchFromApi(
        `${config.oddsApi.url}/sports`,
        {},
        this.sportsCache,
        "sportsList"
      );
      const groupedData: { [key: string]: any[] } = {};
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

      if (category.toLowerCase() === "all") {
        // If the category is "all", return all sports
        return sportsData.filter((sport: any) => sport.active);
      }

      // Otherwise, filter by the specified category
      const categorySports = sportsData.filter(
        (sport: any) => sport.group === category && sport.active
      );

      return categorySports;
    } catch (error) {
      console.error("Error fetching category sports:", error);
      throw new Error("Failed to fetch category sports");
    }
  }

  public async updateLiveData(livedata: any) {
    const currentActive = this.removeInactiveRooms();

    for (const sport of currentActive) {
      const { live_games, todays_upcoming_games, future_upcoming_games } =
        livedata;
      io.to(sport).emit("data", {
        type: "ODDS",
        data: {
          live_games,
          todays_upcoming_games,
          future_upcoming_games,
        },
      });

      console.log(`Data broadcasted to room: ${sport}`);
    }
  }

  public removeInactiveRooms() {
    const rooms = io.sockets.adapter.rooms;

    const currentRooms = new Set(rooms.keys());

    activeRooms.forEach((room) => {
      if (!currentRooms.has(room)) {
        activeRooms.delete(room);
      }
    });

    return activeRooms;
  }
}

export default new Store();
