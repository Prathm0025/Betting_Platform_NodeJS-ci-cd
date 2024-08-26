import mongoose from "mongoose";
import { config } from "./config";
import Agenda, { Job } from "agenda";
import betServices from "../bets/betServices";

let agenda: Agenda;

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", async () => {
      console.log("Connected to database successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.log("Error in connecting to database.", err);
    });

    await mongoose.connect(config.databaseUrl as string);

    // Initialize Agenda
    agenda = new Agenda({
      db: { address: config.databaseUrl as string, collection: "jobs" },
    });

    // Define a sample job
    agenda.define("add bet to queue", async (job: Job) => {
      const { betDetailId } = job.attrs.data;
      await betServices.addBetToQueueAtCommenceTime(betDetailId);
      console.log(`Bet ${betDetailId} is added to processing queue`);
    });

    agenda.define("fetch odds for queue bets", async () => {
      await betServices.fetchOddsForQueueBets();
    });

    // // Start Agenda
    await agenda.start();

    // Schedule the recurring job
    await agenda.every("30 seconds", "fetch odds for queue bets");

    console.log("Agenda started");
  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
};
export { agenda };
export default connectDB;
