import { enqueue } from '../utils/ProcessingQueue';
import { redisClient } from '../redisclient';
import mongoose from 'mongoose';
import Bet, { BetDetail } from '../bets/betModel';
import { config } from '../config/config';

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
async function setProcessingQueueItem(betDetailId: string) {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const betDetail = await BetDetail.findById(betDetailId).session(session);
    if (!betDetail) {
      console.error("BetDetail not found:", betDetailId);
      await session.abortTransaction();
      return;
    }

    const bet = await Bet.findById(betDetail.key).session(session);
    if (!bet) {
      console.error("Parent Bet not found:", betDetail.key);
      await session.abortTransaction();
      return;
    }

    // betDetail.status = winner === betDetail.bet_on ? "won" : "lost";
    await betDetail.save({ session });


    await session.commitTransaction();


    enqueue(JSON.stringify(betDetail));
  } catch (error) {
    console.error("Error processing completed bet:", error);
    await session.abortTransaction();
  } finally {
    session.endSession();
  }
}
// Function to process tasks
async function processTasks() {

  const now = new Date().getTime()
  const bets = await redisClient.zrangebyscore('waitingQueue', 0, now);

  for (const bet of bets) {
    const { taskName, data } = JSON.parse(bet);

    const commenceTime = data.commence_time
    const betDetailId = data.betId

    if (now >= new Date(commenceTime).getTime()) {
      try {


        //querying db for betdetail and pushing it to processing QUEUE
        await setProcessingQueueItem(betDetailId);
        // enqueue(betDetailId)
        await redisClient.zrem('waitingQueue', bet);

      } catch (error) {
        console.log("ERROR IN BET QUEUE");
        console.log(error);

      }
    }
  }
}

setInterval(() => {
  processTasks().catch(console.error);
}, 10000);
