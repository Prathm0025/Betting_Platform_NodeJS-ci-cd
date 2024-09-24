import { redisClient } from '../redisclient';
import mongoose from 'mongoose';
import Bet, { BetDetail } from '../bets/betModel';
import { config } from '../config/config';
import { parentPort } from 'worker_threads';
import { IBetDetail } from '../bets/betsType';
import { migrateLegacyBet } from '../utils/migration';
import Store from '../store/storeController';

async function connectDB() {
  try {
    mongoose.connection.on("connected", async () => {
      console.log("Connected to database successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.log("Error in connecting to database.", err);
    });

    await mongoose.connect(config.databaseUrl as string);
  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
}

connectDB();

export async function checkBetsCommenceTime() {
  const now = new Date().getTime();
  const bets = await redisClient.zrangebyscore('waitingQueue', 0, now);

  for (const bet of bets) {
    const data = JSON.parse(bet);

    const commenceTime = data.commence_time;
    const betId = data.betId;

    if (now >= new Date(commenceTime).getTime()) {
      try {

        const betDetail = await BetDetail.findById(betId).lean();
        const betParent = await Bet.findById(betDetail.key).lean();

        if (!betDetail || !betParent) {
          console.log(`BetDetail or BetParent not found for betId: ${betId}, removing from queue`);

          // Remove the problematic bet from the waiting queue
          await redisClient.zrem('waitingQueue', bet);
          continue; // Skip further processing for this bet
        }

        const multi = redisClient.multi();

        // Add the entire betDetail data to the processing queue
        multi.lpush('processingQueue', JSON.stringify(betDetail));

        // Remove the bet from the waiting queue
        multi.zrem('waitingQueue', bet)

        await multi.exec();

      } catch (error) {
        console.log(`Error processing bet with ID ${betId}:`, error);

        // Remove the problematic bet from the waiting queue if an error occurs
        await redisClient.zrem('waitingQueue', bet);
      }

    }
  }
}


async function getLatestOddsForAllEvents() {
  try {
    // Fetch globalEventRooms data from Redis
    const redisKey = 'globalEventRooms';
    const eventRoomsData = await redisClient.get(redisKey);

    if (!eventRoomsData) {
      console.log("No event rooms data found in Redis.");
      return;
    }


    // Parse the data from Redis into a Map<string, Set<string>>
    const eventRoomsMap = new Map<string, Set<string>>(
      JSON.parse(eventRoomsData, (key, value) => {
        if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
          return new Set(value);
        }
        return value;
      })
    );

    for (const [sportKey, eventIdsSet] of eventRoomsMap.entries()) {
      for (const eventId of eventIdsSet) {
        console.log(eventId, "EVENT ID IN WAITING QUEUE");

        const latestOdds = await Store.getEventOdds(sportKey, eventId);
        const oddsUpdate = {
          eventId,
          latestOdds,
        };

        await redisClient.publish("live-update-odds", JSON.stringify(oddsUpdate));
        console.log(`Published latest odds for event: ${eventId} on channel: live-update-odds`);
      }
    }
  } catch (error) {
    console.error("Error fetching latest odds:", error);
  }
}



async function migrateAllBetsFromWaitingQueue() {
  const bets = await redisClient.zrange('waitingQueue', 0, -1); 

  for (const bet of bets) {
    const data = JSON.parse(bet);
    const betId = data.betId;
    try {
      let betDetail = await BetDetail.findById(betId).lean();

      if (!betDetail) {
        console.log(`BetDetail not found for betId: ${betId}, skipping this bet.`);
        continue; 
      }

      if (!betDetail.key) {
        console.log(`BetDetail with ID ${betId} is missing the 'key' field, skipping.`);
        continue; 
      }

      const betParent = await Bet.findById(betDetail.key).lean();

      if (!betParent) {
        console.log(`Parent Bet not found for betId: ${betId}, skipping.`);
        continue; 
      }

      await migrateLegacyBet(betDetail);

    } catch (error) {
      console.log(`Error migrating bet with ID ${betId}:`, error);
    }
  }
}

async function migrateLegacyResolvedBets() {
  const bets = await BetDetail.find({ isResolved: true, status: { $ne: 'pending' } }).lean();
  for (const bet of bets) {
    try {
      await migrateLegacyBet(bet);
    } catch (error) {
      console.log(`Error updating bet with ID ${bet._id}:`, error);
    }
  }
}



async function startWorker() {
  console.log("Waiting Queue Worker Started")
  setInterval(async () => {
    try {
      await migrateAllBetsFromWaitingQueue();
      await migrateLegacyResolvedBets();
      await checkBetsCommenceTime();
      await getLatestOddsForAllEvents();
    } catch (error) {
      console.error("Error in setInterval Waiting Queue Worker:", error);
    }
  }, 30000); // Runs every 30 seconds
}

parentPort.on('message', async (message) => {
  if (message === "start") {
    startWorker();
  }
})