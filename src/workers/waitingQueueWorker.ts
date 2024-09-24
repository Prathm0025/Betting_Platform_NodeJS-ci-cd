import { redisClient } from '../redisclient';
import mongoose from 'mongoose';
import Bet, { BetDetail } from '../bets/betModel';
import { config } from '../config/config';
import { parentPort } from 'worker_threads';
import { IBetDetail } from '../bets/betsType';

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



export async function migrateAllBetsFromQueue() {
  const bets = await redisClient.zrange('waitingQueue', 0, -1); // Get all bets in the queue

  for (const bet of bets) {
    const data = JSON.parse(bet);
    const betId = data.betId;

    try {
      // Fetch the BetDetail document
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

      // Check if the bet has already been converted (new schema includes "teams" field)
      if (betDetail.teams && betDetail.teams.length > 0) {
        console.log(`Bet with ID ${betId} is already in the new schema, skipping conversion.`);
        continue; // Skip conversion for already converted bets
      }

      // If it's a legacy bet, convert it
      if (isLegacyBet(betDetail)) {
        console.log(`Migrating legacy bet with ID ${betId}...`);
        betDetail = convertLegacyBet(betDetail); // Convert legacy schema to the new format

        // Update the bet in the database to reflect the new schema
        await BetDetail.findByIdAndUpdate(betId, { $set: betDetail });
        console.log(`Bet with ID ${betId} successfully migrated to the new schema.`);
      }

    } catch (error) {
      console.log(`Error migrating bet with ID ${betId}:`, error);
    }
  }
}

// Function to check if a bet follows the legacy schema
function isLegacyBet(betDetail: IBetDetail): boolean {
  return !!(betDetail.home_team && betDetail.away_team); // Legacy schema contains `home_team` and `away_team`
}

// Function to convert legacy bet to the new schema
function convertLegacyBet(betDetail: IBetDetail): IBetDetail {
  // Convert home_team and away_team to teams array
  betDetail.teams = [
    {
      name: betDetail.home_team?.name || '',
      odds: betDetail.home_team?.odds || 0,
    },
    {
      name: betDetail.away_team?.name || '',
      odds: betDetail.away_team?.odds || 0,
    }
  ];

  // Remove the old schema fields
  delete betDetail.home_team;
  delete betDetail.away_team;

  return betDetail;
}

async function startWorker() {
  console.log("Waiting Queue Worker Started")
  setInterval(async () => {
    try {
      console.log('Migrating legacy bets to new schema...');
      await migrateAllBetsFromQueue();


      console.log("Processing bets based on commence time...");
      await checkBetsCommenceTime();
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