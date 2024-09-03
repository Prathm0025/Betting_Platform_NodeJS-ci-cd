import mongoose from "mongoose";
import { config } from "./config";
import Agenda, { Job } from "agenda";
import path from "path";
import { Worker } from "worker_threads";
import betServices from "../bets/betServices";
import storeController from "../store/storeController";
import { activeRooms } from "../socket/socket";
// import Scheduler from "./scheduler";
import { redisClient } from "../redisclient";
// import scheduler from "./scheduler";

let agenda: Agenda;

const workerFilePath = path.resolve(__dirname, "../bets/schedulerBetWorker.js");
const redisOptions = {
  host: 'localhost',
  port: 6379,
};

const startWorker = (queueData: any[], activeRoomsData: string[]) => {
  const worker = new Worker(workerFilePath, {
    workerData: {redisOptions }
  });

  worker.on('message', async ({ taskName, data }: { taskName: string, data: any }) => {
    switch (taskName) {
      case 'addBetToQueue':
        await betServices.addBetToQueueAtCommenceTime(data.betId);
        break;
      // Handle other tasks if needed
      default:
        console.log(`No task found for ${taskName}`);
    }
  });
  
  // Error handling
  worker.on('error', (error) => {
    console.error('Worker encountered an error:', error);
  });
  
  // Cleanup on exit
  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }});
};

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", async () => {
      console.log("Connected to database successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.log("Error in connecting to database.", err);
    });

    await mongoose.connect(config.databaseUrl as string);

    agenda = new Agenda({
      db: { address: config.databaseUrl as string, collection: "jobs" },
    });

    agenda.define("add bet to queue", async (job: Job) => {
      const { betDetailId } = job.attrs.data;
      await betServices.addBetToQueueAtCommenceTime(betDetailId);
      console.log(`Bet ${betDetailId} is added to processing queue`);
    });

    await agenda.start();

    // scheduler.start();

      // const queueData = betServices.getPriorityQueueData();
      const activeRoomsData = Array.from(activeRooms);
      console.log(activeRoomsData, activeRooms);
     
      startWorker([], activeRoomsData);

  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
};

export { agenda };
export default connectDB;
