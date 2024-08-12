import { Socket } from "socket.io";
import PlayerModel from "./playerModel";
import { IBet } from "../bets/betsType";
import mongoose from "mongoose";
import BetController from "../bets/betController";
import Store from "../store/storeController";

export default class Player {
    private userId: mongoose.Types.ObjectId;
    private username: string;
    private credits: number;
    public socket: Socket;

    constructor(
        socket: Socket,
        userId: mongoose.Types.ObjectId,
        username: string,
        credits: number
    ) {
        this.socket = socket;
        this.userId = userId;
        this.username = username;
        this.credits = credits;
        this.initializeHandlers();
        this.betHandler();
    }
    public updateSocket(socket: Socket) {
        this.socket = socket;
        this.initializeHandlers();
        this.betHandler()
    }

    public async updateBalance(
        type: "credit" | "debit",
        amount: number
    ): Promise<void> {
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

    public sendData(data: any): void {
        try {
            this.socket.emit("data", data);
        } catch (error) {
            console.error(`Error sending data for player ${this.userId}:`, error);
        }
    }

    private initializeHandlers() {
        this.socket.on("data", async (message) => {
            try {
                const res = message as { action: string; payload: any };

                switch (res.action) {
                    case "INIT":
                        // Fetch initial data from Store
                        const sports = await Store.getCategories();
                        this.sendData({ type: "CATEGORIES", data: sports });
                        break;

                    case "CATEGORIES":
                        const categoriesData = await Store.getCategories();
                        this.sendData({ type: "CATEGORIES", data: ["All", ...categoriesData] });
                        break;

                    case "CATEGORY_SPORTS":
                        const categorySportsData = await Store.getCategorySports(
                            res.payload
                        );
                        this.sendData({
                            type: "CATEGORY_SPORTS",
                            data: categorySportsData,
                        });
                        break;


                    case "EVENTS":
                        const eventsData = await Store.getEvents(
                            res.payload.sport,
                            res.payload.dateFormat
                        );
                        this.sendData({ type: "EVENTS", data: eventsData });
                        break;

                    case "SCORES":
                        const scoresData = await Store.getScores(
                            res.payload.sport,
                            res.payload.daysFrom,
                            res.payload.dateFormat
                        );
                        this.sendData({ scores: scoresData });
                        break;

                    case "ODDS":
                        console.log("ODDS : ", res);

                        const oddsData = await Store.getOdds(
                            res.payload.sport,
                            res.payload.markets,
                            res.payload.regions
                        );
                        this.sendData({ type: "ODDS", data: oddsData });
                        break;

                    case "EVENT_ODDS":
                        const eventOddsData = await Store.getEventOdds(
                            res.payload.sport,
                            res.payload.eventId,
                            res.payload.regions,
                            res.payload.markets,
                            res.payload.dateFormat,
                            res.payload.oddsFormat
                        );
                        this.sendData({ type: "EVENT_ODDS", data: eventOddsData });
                        break;

                    case "SPORTS":
                        const sportsData = await Store.getSports();
                        this.sendData({ sports: sportsData });
                        break;

                    default:
                        console.warn(`Unknown action: ${res.action}`);
                        this.sendError(`Unknown action: ${res.action}`);
                }
            } catch (error) {
                console.log(error);
                this.sendError("An error occurred while processing your request.");
            }
        });
    }

    public betHandler() {
        this.socket.on("bet", async (message: { action: string; payload: IBet }, callback: (response: { status: string; message: string }) => void) => {
            try {
                const { action, payload } = message;

                switch (action) {
                    case "PLACE":
                        try {
                            await BetController.placeBet(payload);
                            console.log("BET RECEIVED AND PROCESSED: ", payload);
                            // Send success acknowledgment to the client
                            callback({ status: "success", message: "Bet placed successfully." });
                        } catch (error) {
                            console.error("Error adding bet: ", error);
                            // Send failure acknowledgment to the client
                            callback({ status: "error", message: "Failed to place bet." });
                        }
                        break;

                    case "START":
                        // Handle "START" action if needed
                        break;

                    default:
                        console.log("UNKNOWN ACTION: ", payload);
                        // Send error acknowledgment for unknown actions
                        callback({ status: "error", message: "Unknown action." });
                }
            } catch (error) {
                console.error("Error processing bet event:", error);
                // Send failure acknowledgment to the client if an exception occurs
                callback({ status: "error", message: "Server error processing the bet." });
            }
        });
    }
}
