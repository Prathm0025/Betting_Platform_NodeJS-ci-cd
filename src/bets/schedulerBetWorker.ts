import { parentPort, workerData } from 'worker_threads';
import { Redis } from 'ioredis';

// Initialize Redis client from workerData
const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});
console.log();
redis.on('connect', () => {
  console.log('Redis client xc');
});

// Function to process tasks
async function processTasks() {

  const now = new Date().getTime()
  const tasks = await redis.zrangebyscore('scheduledBets', 0, now);

  for (const task of tasks) {
    const { taskName, data } = JSON.parse(task);

    const commenceTime = data.commence_time
    // console.log("comparing times");
    // console.log("com", new Date(commenceTime).getTime());
    // console.log("com", new Date(commenceTime));
    // console.log("now", now);
    // console.log("now", new Date(now));


    if (now >= new Date(commenceTime).getTime()) {
      parentPort?.postMessage({ taskName, data });
      //FIX: schedule bets are being moved to processing queue after 30 seconds
      // Remove task from the set after processing
      await redis.zrem('scheduledBets', task);
    }
  }
}

setInterval(() => {
  console.log("processing task 30 s");

  processTasks().catch(console.error);
}, 30000);
