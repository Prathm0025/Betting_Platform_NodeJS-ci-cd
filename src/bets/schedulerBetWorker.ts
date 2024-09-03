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

  const now = Date.now();
  const tasks = await redis.zrangebyscore('scheduledBets', 0, now);
console.log(tasks, "tasks");

  for (const task of tasks) {
    const { taskName, data } = JSON.parse(task);
    parentPort?.postMessage({ taskName, data });

    // Remove task from the set after processing
    await redis.zrem('scheduledBets', task);
  }
}

setInterval(() => {
    console.log("processing task");
    
  processTasks().catch(console.error);
}, 30000);
