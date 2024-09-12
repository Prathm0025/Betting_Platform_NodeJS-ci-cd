import mongoose from "mongoose";
import { config } from "./config";
import { activeRooms } from "../socket/socket";
import { startWorkers } from "../workers/initWorker";
import notificationController from "../notifications/notificationController";
import { ObjectId } from "mongodb";
import { Redis } from "ioredis";

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
    // notificationController.createNotification(new ObjectId("66cd981c91d869aec34302db"), "error",  "An error Occured","bet",  new ObjectId("66dfc865131e4336ec269fe3"),  "refund" )
    startWorkers()




  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
};

export default connectDB;
