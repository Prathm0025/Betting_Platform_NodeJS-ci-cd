import { Bookmaker } from "./types";
import { activeRooms } from "../socket/socket";
import { Server } from "socket.io";
import { io } from "../server";
import Store from "./storeController";

class StoreService {
  public selectBookmaker(bookmakers: Bookmaker[]): Bookmaker | null {
    let bestBookmaker: Bookmaker | null = null;
    let highestMargin = -Infinity;

    bookmakers.forEach((bookmaker: Bookmaker) => {
      bookmaker.markets.forEach((market) => {
        let totalImpliedProbability = 0;

        market.outcomes.forEach((outcome) => {
          const impliedProbability = 1 / outcome.price;
          totalImpliedProbability += impliedProbability;
        });

        // Calculate the bookmaker's margin for the current market
        const bookmakerMargin = (totalImpliedProbability - 1) * 100;

        // Update the highest margin and best bookmaker if needed
        if (bookmakerMargin > highestMargin) {
          highestMargin = bookmakerMargin;
          bestBookmaker = bookmaker;
        }
      });
    });

    return bestBookmaker;
  }

  public async updateLiveData() {
    console.log("i will update the live data");
    const currentActive = this.removeInactiveRooms();
    if (currentActive.size <= 0) {
      console.log("no active rooms to update");
      return;
    }
    for (const sport of currentActive) {
      console.log("sending req again");
      const { live_games, upcoming_games } = await Store.getOdds(sport);
      io.to(sport).emit("data", {
        type: "ODDS",
        data: {
          live_games,
          upcoming_games,
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
        console.log(`Removed inactive room: ${room}`);
      }
    });
    return activeRooms;
  }
}

export default StoreService;
