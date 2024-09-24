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


        // Assuming you have a method to check if the odds have changed and to cache the odds
        // const cachedOdds = await getCachedOdds(eventId);
        // if (!cachedOdds) {
        //   await cacheOdds(eventId, latestOdds);
        //   continue; 
        // }

        // Compare the odds to check if they have changed
        // const oddsChanged = compareOdds(cachedOdds, latestOdds);
        // if (oddsChanged) {
        //   console.log(`Odds have changed for event: ${eventId}, sportKey: ${sportKey}`);

        //   // Assuming betSlip is defined and accessible here

        //   await cacheOdds(eventId, latestOdds);
        // }
      }
    }
  } catch (error) {
    console.error("Error fetching latest odds:", error);
  }
}

async function cacheOdds(eventId: string, odds: any) {
  const cacheKey = `odds:${eventId}`;
  await this.redisSetAsync(cacheKey, JSON.stringify(odds), "EX", 120);
}

function compareOdds(betSlipOdds: any, latestOdds: any): boolean {
  return JSON.stringify(betSlipOdds) !== JSON.stringify(latestOdds);
}
async function getCachedOdds(eventId: string): Promise<any> {
  const cacheKey = 'globalEventRooms';
  const cachedOdds = await this.redisGetAsync(cacheKey);
  return cachedOdds ? JSON.parse(cachedOdds) : null;
}

async function migrateAllBetsFromWaitingQueue() {
  const bets = await redisClient.zrange('waitingQueue', 0, -1); // Get all bets in the queue

  for (const bet of bets) {
    const data = JSON.parse(bet);
    const betId = data.betId;

    try {
      // Fetch the BetDetail document using projection to exclude `home_team` and `away_team`
      let betDetail = await BetDetail.findById(betId).lean();


      // Check if the betDetail exists
      if (!betDetail) {
        console.log(`BetDetail not found for betId: ${betId}, skipping this bet.`);
        continue; // Skip to the next bet if betDetail doesn't exist
      }

      // Check if the key (reference to the parent Bet) exists
      if (!betDetail.key) {
        console.log(`BetDetail with ID ${betId} is missing the 'key' field, skipping.`);
        continue; // Skip if no key reference
      }

      // Fetch the parent Bet document using the key from betDetail
      const betParent = await Bet.findById(betDetail.key).lean();

      // If parent Bet doesn't exist, log the error and skip the bet
      if (!betParent) {
        console.log(`Parent Bet not found for betId: ${betId}, skipping.`);
        continue; // Skip further processing for this bet
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

async function getAllBetsForPlayerAndUpdateStatus(playerId) {
  try {
    // Ensure the provided playerId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      throw new Error('Invalid player ID');
    }

    // Find all bets for the given playerId and populate the BetDetail data
    const bets = await Bet.find({ player: playerId })
      .populate({
        path: 'data', // Populate the 'data' field referencing BetDetail
        model: 'BetDetail',
      })
      .lean(); // Use lean() for performance boost

    if (!bets || bets.length === 0) {
      console.log(`No bets found for player with ID: ${playerId}`);
      return [];
    }

    // Update each BetDetail and the parent Bet
    for (const bet of bets) {
      const betDetailsIds = bet.data.map(detail => detail._id);

      // Update all bet details to status 'pending' and isResolved 'false'
      await BetDetail.updateMany(
        { _id: { $in: betDetailsIds } },
        { $set: { status: 'pending', isResolved: false } }
      );

      // Update the parent bet to status 'pending'
      await Bet.findByIdAndUpdate(bet._id, { status: 'pending', isResolved: false });
    }

    return bets; // Return the bets with updated status for further use
  } catch (error) {
    console.error(`Error retrieving or updating bets for player with ID ${playerId}:`, error);
    throw error; // Rethrow the error to handle it in the calling function
  }
}

async function addMultipleBetsToProcessingQueue(bets) {
  try {
    // Start a Redis multi transaction to push multiple bets at once
    const multi = redisClient.multi();

    // Loop through each bet and add to Redis multi command
    for (const bet of bets) {
      // Serialize each bet object to a JSON string
      const serializedBet = JSON.stringify(bet);
      // Add the serialized bet to the processingQueue
      multi.lpush('processingQueue', serializedBet);
    }

    // Execute all commands in the multi queue
    await multi.exec();

    console.log(`${bets.length} bets added to processingQueue`);
  } catch (error) {
    console.error("Error adding bets to processing queue:", error);
  }
}

function extractDataField(betsArray) {
  let extractedData = [];

  for (let bet of betsArray) {
    if (bet.data && Array.isArray(bet.data)) {
      extractedData = [...extractedData, ...bet.data];
    }
  }

  return extractedData;
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