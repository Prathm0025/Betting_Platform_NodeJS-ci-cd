import { redisClient } from '../redisclient';
// Function to schedule a task
async function scheduleBets(taskName: string, runAt: Date, data: any) {
  console.log("cancelled");

  const timestamp = runAt.getTime() / 1000
  await redisClient.zadd('waitingQueue', timestamp.toString(), JSON.stringify({ taskName, data }));
}

export { scheduleBets };
