import { redisClient } from "../redisclient";

async function checkBetsCommenceTime() {
    const now = new Date().getTime();
    const bets = await redisClient.zrangebyscore('waitingQueue', 0, now);

    for (const bet of bets) {
        const data = JSON.parse(bet);
        const commenceTime = data.commence_time;

        if (now >= new Date(commenceTime).getTime()) {
            const multi = redisClient.multi();

            // Add the bet to the processing queue
            multi.lpush('processingQueue', bet);

            // Remove the bet from the waiting queue
            multi.zrem('waitingQueue', bet)

            await multi.exec();
        }
    }
}

export async function startWorker() {
    console.log("Waiting Queue worker started......")

    setInterval(async () => {
        try {
            console.log("Checking bets commence time...");
            await checkBetsCommenceTime();
        } catch (error) {
            console.error("Error in bet worker:", error);
        }
    }, 30000); // Run every 30 seconds
}

