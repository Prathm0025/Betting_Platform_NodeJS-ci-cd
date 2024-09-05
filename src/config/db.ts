import mongoose from "mongoose";
import { config } from "./config";
import path from "path";
import { Worker } from "worker_threads";
import { activeRooms } from "../socket/socket";

import { getAll } from "../utils/ProcessingQueue";
import { startWorkers } from "../workers/initWorker";


const fetchAndProcessQueue = async () => {
  try {
    const queueData = await getAll();

    if (!queueData || queueData.length === 0) {
      console.log('No data in the processing queue.');
      return;
    }

    const parsedQueueData = queueData.map(item => JSON.parse(item));

    console.log("Fetched all queue data:", parsedQueueData);

    await processOddsForQueueBets(parsedQueueData, activeRooms);
  } catch (error) {
    console.error('Error fetching or processing queue data:', error);
  }
};

async function processOddsForQueueBets(queueData: any, activeRooms: any) {
  console.log(activeRooms, "active rooms");

  const MAX_WORKER_COUNT = 8;
  const sports = new Set<string>();

  queueData.forEach((bet) => sports.add(bet._doc.sport_key));

  const sportKeysArray = Array.from(sports);
  sportKeysArray.push(...Array.from(activeRooms as string));

  const workerCount = Math.min(MAX_WORKER_COUNT, sportKeysArray.length);

  const chunkSize = Math.ceil(sportKeysArray.length / workerCount);
  const sportKeysChunks = chunkArray(sportKeysArray, chunkSize);

  const workerFilePath = path.resolve(__dirname, "../workers/betWorker.js");

  const workerPromises = sportKeysChunks?.map((chunk) => {
    return new Promise<void>((resolve, reject) => {
      console.log("promise");

      const betsForChunk = queueData.filter(bet => chunk.includes(bet._doc.sport_key));
      console.log(betsForChunk, "bet chunk");

      const worker = new Worker(workerFilePath, {
        workerData: { sportKeys: Array.from(chunk), bets: betsForChunk },
      });

      worker.on("message", (message) => {
        resolve();
      });

      worker.on("error", (error) => {
        reject(error);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  });

  try {
    await Promise.all(workerPromises);
    console.log("All workers completed processing.");
  } catch (error) {
    console.error("Error during worker processing:", error);
  }
}

// Helper function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}


const connectDB = async () => {
  try {
    mongoose.connection.on("connected", async () => {

      console.log("Connected to database successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.log("Error in connecting to database.", err);
    });

    await mongoose.connect(config.databaseUrl as string);

    const activeRoomsData = Array.from(activeRooms);

    startWorkers()
    fetchAndProcessQueue();

  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
};

export default connectDB;
