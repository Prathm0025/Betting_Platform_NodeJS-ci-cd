import { Server, Socket } from "socket.io";
import PlayerModel from "./playerModel";
import { IBet, IBetDetail } from "../bets/betsType";
import mongoose from "mongoose";
import BetController from "../bets/betController";
import Store from "../store/storeController";
import { activeRooms } from "../socket/socket";

export default class Player {
  public userId: mongoose.Types.ObjectId;
  public username: string;
  private credits: number;
  public socket: Socket;
  public currentRoom: string;
  private io: Server; // Add io instance here

  constructor(
    socket: Socket,
    userId: mongoose.Types.ObjectId,
    username: string,
    credits: number,
    io: Server // Initialize io instance in constructor
  ) {
    this.socket = socket;
    this.userId = userId;
    this.username = username;
    this.credits = credits;
    this.io = io; // Assign io instance
    this.initializeHandlers();
    this.betHandler();
  }

  public updateSocket(socket: Socket) {
    this.socket = socket;
    this.initializeHandlers();
    this.betHandler();
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
            this.sendData({
              type: "CATEGORIES",
              data: categoriesData,
            });
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
            const oddsData = await Store.getOdds(
              res.payload.sport,
              res.payload.markets,
              res.payload.regions,
              this
            );
            this.sendData({ type: "ODDS", data: oddsData });
            this.joinRoom(res.payload.sport);
            break;

          case "GET event odds":
            const eventOddsData = await Store.getEventOdds(
              res.payload.sport,
              res.payload.eventId,
              res.payload.has_outrights,
              res.payload.markets,
              res.payload.regions,
              res.payload.oddsFormat,
              res.payload.dateFormat
            );
            console.log("ODDS DATA", eventOddsData);
            this.sendData({ type: "GET event odds", data: eventOddsData });
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
    this.socket.on(
      "bet",
      async (
        message: { action: string; payload: any },
        callback: (response: { status: string; message: string }) => void
      ) => {
        try {
          const { action, payload } = message;

          switch (action) {
            case "PLACE":
              try {
                // Check if the payload is an array of bets
                if (
                  Array.isArray(payload.data) &&
                  payload.betType === "single"
                ) {
                  for (const bet of payload.data) {
                    try {
                      const betRes = await BetController.placeBet(
                        this,
                        [bet],
                        bet.amount,
                        payload.betType
                      );
                    } catch (error) {
                      console.error("Error adding bet: ", error);
                      // Send failure acknowledgment to the client for this particular bet
                      callback({
                        status: "error",
                        message: `Failed to place bet: ${bet}.`,
                      });
                      return; // Optionally, stop processing further bets on error
                    }
                  }
                } else {
                  // Handle single bet case (fallback if payload is not an array)
                  const betRes = await BetController.placeBet(
                    this,
                    payload.data,
                    payload.amount,
                    payload.betType
                  );
                  console.log("BET RECEIVED AND PROCESSED: ", payload);
                }
              } catch (error) {
                console.error("Error processing bet array: ", error);
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
          callback({
            status: "error",
            message: "Server error processing the bet.",
          });
        }
      }
    );
  }

  public joinRoom(room: string) {
    if (this.currentRoom) {
      this.socket.leave(this.currentRoom);
      const clients = this.io.sockets.adapter.rooms.get(this.currentRoom);
      console.log(clients, "clients");

      if (!clients || clients.size === 0) {
        activeRooms.delete(this.currentRoom);
        console.log(`Room ${this.currentRoom} removed from activeRooms.`);
      }
    }

    activeRooms.add(room);
    console.log(activeRooms, "active");

    this.socket.join(room);
    this.currentRoom = room;
  }
}
