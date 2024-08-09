import axios from "axios";
import { Event, Sport } from "./types";
import createHttpError from "http-errors";
import cron from "node-cron";
import { NextFunction, Request, Response } from "express";
import { config } from "../config/config";
import StoreService from "./storeServices";

class Store {
  private sports: Sport[] = [];
  private events: Event[] = [];
  private requestedEvents: Set<string> = new Set();
  private dataService: StoreService;

  constructor() {
    this.dataService = new StoreService(config.oddsApi.url, config.oddsApi.key);
    this.getRequestCount = this.getRequestCount.bind(this);
    this.getSports = this.getSports.bind(this);
    this.getSportEvents = this.getSportEvents.bind(this);
    this.init();
  }

  private async init() {
    await this.updateSportsData();
    this.scheduleSportsFetch();
    this.scheduleEventsFetch();
  }

  private async updateSportsData(): Promise<void> {
    try {
      this.sports = await this.dataService.fetchSportsData();
    } catch (error) {
      console.error("Error updating sports data:", error);
      throw createHttpError(500, "Error updating sports data");
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
      console.error("Error updating sports events:", error);
      throw createHttpError(500, "Error updating sports events");
    }
  }

  private scheduleSportsFetch() {
    cron.schedule("0 */12 * * *", () => {
      this.updateSportsData().catch((error) => console.error(error));
    });
    console.log("Scheduled sports data fetch every 12 hours");
  }

  private scheduleEventsFetch() {
    cron.schedule("*/40 * * * * *", () => {
      this.updateSportEvents().catch((error) => console.error(error));
    });
    console.log("Scheduled events data fetch every 40 seconds");
  }

  async getSports(): Promise<Sport[]> {
    console.log("test");
    try {
      if (this.sports.length === 0) {
        await this.updateSportsData();
      }
      return this.sports;
    } catch (error) {
      console.log("error getting sports: ", error);
    }
  }

  public async getSportEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const sport = req.params.sport;
    try {
      if (this.requestedEvents.has(sport) && this.events[sport]) {
        res.status(200).json(this.events[sport]);
      } else {
        this.requestedEvents.add(sport);
        res.status(200).json(
          this.events[sport] || {
            message: `Fetching events for sport ${sport}`,
          }
        );
      }
    } catch (error) {
      next(error);
    }
  }

  public getRequestCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      const requestCount = this.dataService.getRequestCount();
      res.status(200).json({ requestCount });
    } catch (error) {
      next(createHttpError(500, "Error fetching request count"));
    }
  }
}

export default new Store();
