import { Socket } from "socket.io";
import PlayerModel from "./playerModel";
import { IBet } from "../bets/betsType";
import mongoose from "mongoose";
import BetController from "../bets/betController";
import StoreController from "../store/storeController";

interface IMessage {
    action: string;
    payload?: any;
}

export default class Player {
    private userId: mongoose.Types.ObjectId;
    private username: string;
    private credits: number;
    public socket: Socket;

    constructor(socket: Socket, userId: mongoose.Types.ObjectId, username: string, credits: number) {
        this.socket = socket;
        this.userId = userId;
        this.username = username;
        this.credits = credits;
        this.messageHandler();
        this.betHandler();
    }

    public async updateBalance(type: "credit" | "debit", amount: number): Promise<void> {
        try {
            const player = await PlayerModel.findById(this.userId).exec();
            if (player) {
                if (type === "credit") {
                    player.credits += amount;
                } else if (type === "debit") {
                    player.credits -= amount;
                    if (player.credits < 0) {
                        player.credits = 0; // Ensure credits do not go below zero
                    }
                }
                await player.save();
                this.credits = player.credits; // Update the local credits value
                this.sendAlert({ credits: this.credits });
            } else {
                console.error(`Player with ID ${this.userId} not found.`);
            }
        } catch (error) {
            console.error(`Error updating balance for player ${this.userId}:`, error);
        }
    }

    public sendMessage(message: any): void {
        try {
            this.socket.emit("message", message);
        } catch (error) {
            console.error(`Error sending message for player ${this.userId}:`, error);
        }
    }

    public sendError(message: string): void {
        try {
            this.socket.emit("error", { message });
        } catch (error) {
            console.error(`Error sending error for player ${this.userId}:`, error);
        }
    }

    public sendAlert(message: any): void {
        try {
            this.socket.emit("alert", { message });
        } catch (error) {
            console.error(`Error sending alert for player ${this.userId}:`, error);
        }
    }

    public messageHandler() {
        this.socket.on("data", async (message: IMessage) => {
            try {
                switch (message.action) {
                    case "INIT":
                        await this.handleInit();
                        break;

                    case "GET_ALL_CATEGORIES":
                        await this.handleGetAllCategories();
                        break;

                    case "GET_SPORTS_BY_CATEGORY":
                        await this.handleGetSportsByCategory(message.payload);
                        break;

                    case "GET_SPORT_EVENTS":
                        await this.handleGetSportEvents(message.payload);
                        break;

                    case "GET_SPORT_EVENT_ODDS":
                        await this.handleGetSportEventOdds(message.payload);
                        break;

                    default:
                        console.warn("Unknown action received:", message.action);
                }
            } catch (error) {
                console.error("Error handling message:", error);
                this.sendError("An error occurred while processing your request.");
            }
        });
    }

    private async handleInit() {
        const sports = await StoreController.getSportsByGroup();
        const categories = await StoreController.getAllCategories();
        this.sendMessage({ categories, sports });
    }

    private async handleGetAllCategories() {
        const categories = await StoreController.getAllCategories();
        this.sendMessage(categories);
    }

    private async handleGetSportsByCategory(category: string) {
        const sports = await StoreController.getSportsByCategoryName(category);
        this.sendMessage(sports);
    }

    private async handleGetSportEvents(sport: string) {
        const events = await StoreController.getSportEvents(sport);
        this.sendMessage(events);
    }

    private async handleGetSportEventOdds({ sport, eventId }: { sport: string; eventId: string }) {
        console.log(sport, eventId);

        const odds = await StoreController.getSportEventOdds(sport, eventId);
        this.sendMessage(odds);
    }

    public betHandler() {
        this.socket.on("bet", (message: IMessage) => {
            try {
                switch (message.action) {
                    case "ADD":
                        BetController.addBet(message.payload);
                        console.log("BET RECEIVED:", message.payload);
                        break;

                    case "START":
                        // Handle START action if needed
                        break;

                    default:
                        console.warn("Unknown action received in bet handler:", message.action);
                }
            } catch (error) {
                console.error("Error processing bet event:", error);
            }
        });
    }
}