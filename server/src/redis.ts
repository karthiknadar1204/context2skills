import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export default redis;
