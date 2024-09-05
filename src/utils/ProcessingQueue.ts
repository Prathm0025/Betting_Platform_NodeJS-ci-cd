import { redisClient } from "../redisclient";

const QUEUE_NAME = 'processingQueue';

// Enqueue an item to the queue
export async function enqueue(item: string): Promise<void> {
  await redisClient.lpush(QUEUE_NAME, item);
}

// Dequeue an item from the queue
export async function dequeue(): Promise<string | null> {
  return redisClient.rpop(QUEUE_NAME);
}

// Peek at the next item to be dequeued
export async function peek(): Promise<string | null> {
  const items = await redisClient.lrange(QUEUE_NAME, -1, -1);
  return items[0] || null;
}
// get all items in the queue
export async function getAll(): Promise<string[]> {
  return redisClient.lrange(QUEUE_NAME, 0, -1);
}
//size of the queue
export async function size(): Promise<number> {
  return redisClient.llen(QUEUE_NAME);
}
// Remove a specific item from the queue
export async function removeItem(item: string): Promise<number> {
  return redisClient.lrem(QUEUE_NAME, 0, item);
}
