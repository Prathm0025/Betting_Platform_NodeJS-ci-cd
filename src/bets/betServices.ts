import { parentPort, Worker } from "worker_threads";
import path from "path";

class BetServices {

  // Fetch odds for all bets in the queue
  public async processOddsForQueueBets(queueData: any, activeRooms: any) {
    console.log(activeRooms, "active rooms");

    const MAX_WORKER_COUNT = 8; // Limit the number of workers to 8
    const sports = new Set<string>();

    queueData.forEach((bet) => sports.add(bet._doc.sport_key));

    const sportKeysArray = Array.from(sports);
    sportKeysArray.push(...Array.from(activeRooms as string));

    const workerCount = Math.min(MAX_WORKER_COUNT, sportKeysArray.length);

    // Define chunk size
    const chunkSize = Math.ceil(sportKeysArray.length / workerCount);
    const sportKeysChunks = chunkArray(sportKeysArray, chunkSize);

    const workerFilePath = path.resolve(__dirname, "../bets/betWorker.js");

    const workerPromises = sportKeysChunks?.map((chunk) => {
      return new Promise<void>((resolve, reject) => {
        console.log("promise");

        const betsForChunk = queueData.filter(bet => chunk.includes(bet._doc.sport_key));
        console.log(betsForChunk, "bet chunk");

        const worker = new Worker(workerFilePath, {
          workerData: { sportKeys: Array.from(chunk), bets: betsForChunk },
        });

        worker.on("message", (message) => {
          if (message.type === 'updateLiveData') {
            parentPort.postMessage({
              type: 'updateLiveData',
              livedata: message.livedata,
              activeRooms: message.activeRooms,
            });
          } else {
            resolve();
          }
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
}
// Helper function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export default new BetServices();
