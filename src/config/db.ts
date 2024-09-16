import mongoose from "mongoose";
import { config } from "./config";
import { activeRooms, users } from "../socket/socket";
import { startWorkers } from "../workers/initWorker";
import { Redis } from "ioredis";
import Store from "../store/storeController";
import Notification from "../notifications/notificationController";



const connectDB = async () => {
  try {

    (async () => {
      try {
        const redisForSub = new Redis(config.redisUrl);
        const redisForPub = new Redis(config.redisUrl);
        await redisForSub.subscribe("live-update");
        await redisForSub.subscribe("bet-notifications")

        redisForSub.on("message", async (channel, message) => {

          if (channel === "bet-notifications") {
            try {
              const notificationData = JSON.parse(message);
              const { type, player, agent, betId, playerMessage, agentMessage } = notificationData;

              const playerNotification = await Notification.createNotification('alert', { message: playerMessage, betId: betId }, player._id);

              const agentNotification = await Notification.createNotification('alert', { message: agentMessage, betId: betId }, agent);

              const playerSocket = users.get(player.username);

              if (playerSocket && playerSocket.socket.connected) {
                playerSocket.sendAlert({
                  type: "NOTIFICATION",
                  payload: playerNotification
                })
              }
              redisForPub.publish("agent-notif", JSON.stringify(agentNotification))
              console.log(`Notification of type ${type} for bet ID ${betId} processed.`);

            } catch (error) {
              console.error('Error processing notification:', error);
            }
          }
          else {
            await Store.updateLiveData();
          }
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
