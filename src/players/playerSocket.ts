import { Socket } from "socket.io";
import PlayerModel from "./playerModel";
import { IBet } from "../bets/betsType";
import mongoose from "mongoose";

export default class Player {
  private userId: mongoose.Types.ObjectId;
  private username: string;
  private credits: number;
  public socket: Socket;
  // private previousBets: IBet[]
  public bets: IBet[];

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
}
