import mongoose from "mongoose";
import { config } from "./config";
import { activeRooms } from "../socket/socket";
import { startWorkers } from "../workers/initWorker";
import { Redis } from "ioredis";
import { io } from "../server";
import Store from "../store/storeController";

const connectDB = async () => {
  try {

    //TODO: implement live update
    //Subscribe to live-update 
    (async () => {
      try {
        const redisForSub = new Redis(config.redisUrl);
        await redisForSub.subscribe("live-update");
        redisForSub.on("message", async (channel, message) => {
          console.log(channel, message, "subss");
          await Store.updateLiveData()
        });
      } catch (err) {
        console.log(err)
      }
    })()


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
