import { Redis } from 'ioredis';
import { enqueue } from '../utils/ProcessingQueue';
import { redisClient } from '../redisclient';


// Function to process tasks
async function processTasks() {

  const now = new Date().getTime()
  const bets = await redisClient.zrangebyscore('waitingQueue', 0, now);

  for (const bet of bets) {
    const { taskName, data } = JSON.parse(bet);

    const commenceTime = data.commence_time
    const betId = data.betId

    if (now >= new Date(commenceTime).getTime()) {
      try {

        console.log("moving to ProcessingQueue");

        enqueue(betId);
        await redisClient.zrem('waitingQueue', bet);

      } catch (error) {
        console.log("ERROR IN BET QUEUE");
        console.log(error);

      }
    }
  }
}

setInterval(() => {
  processTasks().catch(console.error);
}, 10000);
