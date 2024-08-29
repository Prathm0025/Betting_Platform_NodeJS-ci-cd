import { workerData, parentPort } from "worker_threads";
import betServices from "./betServices"; // Adjust as needed

const { queueData, activeRooms } = workerData;
console.log(activeRooms, "cdsc");

(async () => {
  try {
    console.log("Worker processing queue data...");
    await betServices.processOddsForQueueBets(queueData, activeRooms);
    parentPort?.postMessage("Odds fetched successfully");
  } catch (error) {
    console.error("Error processing bets in worker:", error);
    parentPort?.postMessage("Error fetching odds");
  }
})();
