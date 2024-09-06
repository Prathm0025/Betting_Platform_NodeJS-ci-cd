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
          console.log(`BetDetail not found for betId: ${betId}`);
          continue;
        }

        const multi = redisClient.multi();

        // Add the entire betDetail data to the processing queue
        multi.lpush('processingQueue', JSON.stringify(betDetail));

        // Remove the bet from the waiting queue
        multi.zrem('waitingQueue', bet)

        await multi.exec();

      } catch (error) {
        console.log("Error in Waiting Queue Worker : ", error);
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

parentPort.on('message', (message) => {
  if (message === "start") {
    startWorker()
  }
})