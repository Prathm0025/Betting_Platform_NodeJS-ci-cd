import { workerData, parentPort } from "worker_threads";
import betServices from "./betServices"; // Adjust as needed

const { queueData, activeRoomsData } = workerData;

(async () => {
  try {
    console.log("Worker processing queue data...");
    await betServices.processOddsForQueueBets(queueData, activeRoomsData);
    parentPort?.postMessage("Odds fetched successfully");
  } catch (error) {
    console.error("Error processing bets in worker:", error);
    parentPort?.postMessage("Error fetching odds");
  }
})();
