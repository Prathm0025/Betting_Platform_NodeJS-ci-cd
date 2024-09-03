import { Worker, workerData } from 'worker_threads';
import { Redis } from 'ioredis';
import betServices from '../bets/betServices';
import { redisClient } from '../redisclient';
import path from 'path';

const redisOptions = {
  host: 'localhost',
  port: 6379,
};

const workerFilePath = path.resolve(__dirname, "../bets/schedulerBetWorker.js")
const worker = new Worker(workerFilePath, {
  workerData: {redisOptions }
});

// Handle messages from the worker
worker.on('message', async ({ taskName, data }: { taskName: string, data: any }) => {
  switch (taskName) {
    case 'addBetToQueue':
      await betServices.addBetToQueueAtCommenceTime(data.betId);
      break;
    // Handle other tasks if needed
    default:
      console.log(`No task found for ${taskName}`);
  }
});

// Error handling
worker.on('error', (error) => {
  console.error('Worker encountered an error:', error);
});

// Cleanup on exit
worker.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Worker stopped with exit code ${code}`);
  }
});

// Function to schedule a task
async function scheduleBets(taskName: string, runAt: Date, data: any) {
  const timestamp = runAt.getTime();
  await redisClient.zadd('scheduledBets', timestamp.toString(), JSON.stringify({ taskName, data }));
}

export { scheduleBets };
