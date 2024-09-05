import { parentPort } from "worker_threads";
import { redisClient } from "../redisclient";

export async function checkBetsCommenceTime() {
    const now = new Date().getTime();
    const bets = await redisClient.zrangebyscore('waitingQueue', 0, now);

    for (const bet of bets) {
        const data = JSON.parse(bet);
        const commenceTime = data.commence_time;

        if (now >= new Date(commenceTime).getTime()) {
            try {
                const multi = redisClient.multi();

                // Add the bet to the processing queue
                multi.lpush('processingQueue', bet);

                // Remove the bet from the waiting queue
                multi.zrem('waitingQueue', bet)

                await multi.exec();

            } catch (error) {
                console.log("Error in Waiting Queue Worker : ", error);
            }

        }
    }
}

async function startWorker() {
    console.log("Waiting Queue Worker Started")
    setInterval(async () => {
        try {
            console.log("Checking bets commence time...");
            await checkBetsCommenceTime();
        } catch (error) {
            console.error("Error in setInterval Waiting Queue Worker:", error);
        }
    }, 30000); // Runs every 30 seconds
}


parentPort.on('message', (message) => {
    if (message === "start") {
        startWorker()
    }
})