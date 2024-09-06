import mongoose from "mongoose";
import { config } from "./config";
import { activeRooms } from "../socket/socket";
import { startWorkers } from "../workers/initWorker";

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

    startWorkers()

  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
};

export default connectDB;
