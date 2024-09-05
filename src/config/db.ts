import mongoose from "mongoose";
import { config } from "./config";
import path from "path";
import { Worker } from "worker_threads";
import { activeRooms } from "../socket/socket";





const schedulerWorkerFilePath = path.resolve(__dirname, "../workers/waitingQueueWorker.js");
const betWorkerFilePath = path.resolve(__dirname, "../workers/betWorker.js")

const startSchedulingWorker = () => {
  const worker = new Worker(schedulerWorkerFilePath, {
  });
  worker.on('error', (error) => {
    console.error('Worker encountered an error:', error);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });
};



const startBetsProcessingWorker = () => {
  const worker = new Worker(betWorkerFilePath, {
  });

  worker.on('error', (error) => {
    console.error('Worker encountered an error:', error);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });
}
// export const connectDForWorkers = async () => {
//   try {
//     mongoose.connection.on("connected", async () => {
//       console.log("Connected to database successfully");
//     });

//     mongoose.connection.on("error", (err) => {
//       console.log("Error in connecting to database.", err);
//     });

//     await mongoose.connect(config.databaseUrl as string);
//   } catch (err) {
//     console.error("Failed to connect to database.", err);
//     process.exit(1);
//   }
// };




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
    console.log(activeRoomsData, activeRooms);

    startSchedulingWorker();
    startBetsProcessingWorker();

  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
};

export default connectDB;
