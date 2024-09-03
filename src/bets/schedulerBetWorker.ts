import { parentPort, workerData } from 'worker_threads';
import { Redis } from 'ioredis';

// Initialize Redis client from workerData
const redis = new Redis(workerData.redisOptions);

// Function to process tasks
async function processTasks() {
  const now = Date.now();
  const tasks = await redis.zrangebyscore('scheduledTasks', 0, now);

  for (const task of tasks) {
    const { taskName, data } = JSON.parse(task);
    // Send the task to the main thread for processing
    parentPort?.postMessage({ taskName, data });

    // Remove task from the set after processing
    await redis.zrem('scheduledTasks', task);
  }
}

// Polling every 30 seconds
setInterval(() => {
  processTasks().catch(console.error);
}, 30000);
