import { Socket } from "socket.io";
import PlayerModel from "./playerModel";
import { IBet } from "../bets/betsType";
import mongoose from "mongoose";
import BetController from "../bets/betController";
import StoreController from "../store/storeController";

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
        this.messageHandler()
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
        this.socket.on("data", async (message) => {
            try {
                const res = message;

                switch (res.action) {
                    case "INIT":
                        const sports = await StoreController.getSportsByGroup();
                        const categories = await StoreController.getAllCategories()
                        this.sendMessage({
                            categories: categories,
                            sports: sports
                        });
                        break;

                    case "EVENT":
                        const event = res.payload;
                        console.log("Event : ", event);

                        const eventData = await StoreController.getSportEvents(event);
                        console.log("Event Data : ", eventData);

                        this.sendMessage(eventData)
                        break;


                    case "CATEGORY":

                }


            } catch (error) {
                console.log(error);
            }
        })
    }

    public betHandler() {
        this.socket.on("bet", (message) => {
            try {
                const res = message;

                switch (res.action) {
                    case "ADD":
                        const payload = res.payload
                        BetController.addBet(payload)
                        console.log("BET RECEIVED : ", res.payload);
                        break;

                    case "START":
                        break;

                    default:
                        console.log("UNKOWN ACTION : ", res.payload);

                }
            } catch (error) {
                console.error("Error processing bet event:", error);
            }
        });
    }


}
