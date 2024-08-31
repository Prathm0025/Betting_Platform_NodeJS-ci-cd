import mongoose from "mongoose";
import { config } from "./config";
import Agenda, { Job } from "agenda";
import path from "path";
import { Worker } from "worker_threads";
import betServices from "../bets/betServices";
import storeController from "../store/storeController";
import { activeRooms } from "../socket/socket";

let agenda: Agenda;

const workerFilePath = path.resolve(__dirname, "../bets/betWorkerScheduler.js");

const startWorker = (queueData: any[], activeRoomsData: string[]) => {
  const worker = new Worker(workerFilePath, {
    workerData: { queueData, activeRoomsData },
  });

  worker.on("message", (message) => {
    console.log("Worker message:", message);

    if (message.type === 'updateLiveData') {
      const { livedata } = message;
      storeController.updateLiveData(livedata);
    }
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });
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

    setInterval(async () => {
      const queueData = betServices.getPriorityQueueData();
      const activeRoomsData = Array.from(activeRooms);
      console.log(activeRoomsData, activeRooms);
     
      startWorker(queueData, activeRoomsData);
    }, 120000);

  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
};

export { agenda };
export default connectDB;
