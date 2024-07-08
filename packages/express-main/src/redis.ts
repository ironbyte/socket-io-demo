import Redis from 'ioredis';

// Redis client
export const redisClient = new Redis();
export const redisSubscriber = new Redis();
