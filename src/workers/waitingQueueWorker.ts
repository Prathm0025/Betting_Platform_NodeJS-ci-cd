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


async function migrateLegacyBet(betDetail: any) {
  try {
    // If no `teams` array exists, we need to migrate from `home_team` and `away_team`
    if (!betDetail.teams || betDetail.teams.length === 0 || betDetail.home_team || betDetail.away_team) {
      console.log(`Migrating legacy bet with ID ${betDetail._id}...`);

      // Convert home_team and away_team into the teams array
      const newTeams = [
        { name: betDetail.home_team?.name, odds: betDetail.home_team?.odds },
        { name: betDetail.away_team?.name, odds: betDetail.away_team?.odds }
      ];

      let newBetOn: any;

      if (betDetail.bet_on === "home_team" && betDetail.home_team) {
        newBetOn = {
          name: betDetail.home_team.name,
          odds: betDetail.home_team.odds
        }
      } else if (betDetail.bet_on === "away_team" && betDetail.away_team) {
        newBetOn = {
          name: betDetail.away_team.name,
          odds: betDetail.away_team.odds
        }
      } else if (["Over", "Under"].includes(betDetail.bet_on)) {
        newBetOn = {
          name: betDetail.bet_on,
          odds: 0
        }
      } else {
        console.error(`Invalid bet_on value: ${betDetail.bet_on}`);
        return
      }

      // Update the existing document and remove the old fields using $unset
      // const updatedBetDetail = await BetDetail.findByIdAndUpdate(betDetail._id, {
      //   $set: {
      //     key: betDetail.key,
      //     teams: newTeams,
      //     bet_on: newBetOn,
      //     event_id: betDetail.event_id,
      //     sport_title: betDetail.sport_title,
      //     sport_key: betDetail.sport_key,
      //     commence_time: betDetail.commence_time,
      //     category: betDetail.market,
      //     bookmaker: betDetail.selected,
      //     oddsFormat: betDetail.oddsFormat,
      //     status: betDetail.status,
      //     isResolved: betDetail.isResolved
      //   },
      //   $unset: { home_team: 1, away_team: 1 } // Unset old fields
      // }, { new: true });

      const result = await BetDetail.updateOne(
        { _id: betDetail._id },
        {
          $set: {
            teams: newTeams,
            bet_on: newBetOn,
          },
          $unset: { home_team: "", away_team: "" }
        },
        { new: true, strict: false }
      );

      if (result) {
        console.log("Updated BetDetail:", result);
      }
      else {
        console.log("Failed to update BetDetail:", result);
      }

      console.log(`Bet with ID ${betDetail._id} successfully migrated.`);
    } else {
      console.log(`Bet with ID ${betDetail._id} is already fully migrated, skipping.`);
    }
  } catch (error) {
    console.error(`Error migrating legacy bet with ID ${betDetail._id}:`, error);
  }
}

export async function migrateAllBetsFromQueue() {
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


// Function to check if a bet follows the legacy schema

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