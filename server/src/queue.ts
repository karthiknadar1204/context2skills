import { Queue } from "bullmq";
import IORedis from "ioredis";

export const TRAINING_QUEUE = "training";
export const INFERENCE_QUEUE = "inference";

export const createBullConnection = () =>
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err) => {
      console.error("Redis connection error:", err.message);
      return true;
    },
  });

export const trainingQueue = new Queue(TRAINING_QUEUE, {
  connection: createBullConnection(),
});

export const inferenceQueue = new Queue(INFERENCE_QUEUE, {
  connection: createBullConnection(),
});
