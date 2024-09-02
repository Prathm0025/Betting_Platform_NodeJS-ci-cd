import Redis from 'ioredis';

// Create and configure your Redis client
const redisClient = new Redis({
  port: 6379, // Redis port
  host: 'localhost', // Redis host
  // Add other configuration options if needed
});

// Log errors from Redis
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Ensure that Redis is connected before proceeding
redisClient.on('connect', () => {
  console.log('Redis client connected');
});

export { redisClient };
