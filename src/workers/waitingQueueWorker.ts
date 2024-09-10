import { redisClient } from '../redisclient';
import mongoose from 'mongoose';
import Bet, { BetDetail } from '../bets/betModel';
import { config } from '../config/config';
import { parentPort } from 'worker_threads';

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

async function startWorker() {
  console.log("Waiting Queue Worker Started")
  setInterval(async () => {
    try {
      console.log("Checking bets commence time...");

      await checkBetsCommenceTime();

    } catch (error) {
      console.error("Error in setInterval Waiting Queue Worker:", error);
    }
  }, 30000); // Runs every 30 seconds
}

const bets = [

]

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

parentPort.on('message', async (message) => {
  if (message === "start") {
    startWorker();

    // const bets = await getAllBetsForPlayerAndUpdateStatus('66dee5b9cae56250cc64b370')
    // const data = extractDataField(bets)
    // console.log(data);



    // await addMultipleBetsToProcessingQueue(data)
  }
})