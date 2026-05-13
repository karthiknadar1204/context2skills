import { Worker, type Job } from "bullmq";
import { TRAINING_QUEUE, createBullConnection } from "./queue";

const connection = createBullConnection();

connection.on("connect", () => {
  console.log("[worker] Redis connected");
});

connection.on("error", (err) => {
  console.error("[worker] Redis error:", err);
});

connection.on("ready", () => {
  console.log("[worker] Redis ready");
});

type TrainingJobData = { contextId: string };
type TrainingJobResult = { ok: true; iterations: number };

export const startTrainingWorker = () => {
  if (!process.env.REDIS_URL) {
    console.warn(
      "[worker] WARNING: REDIS_URL not set; defaulting to redis://localhost:6379",
    );
  }

  const worker = new Worker<TrainingJobData, TrainingJobResult>(
    TRAINING_QUEUE,
    async (job: Job<TrainingJobData, TrainingJobResult>) => {
      const { contextId } = job.data;
      console.log(`[worker] start job=${job.id} context=${contextId}`);

      const total = 5;
      for (let i = 1; i <= total; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await job.updateProgress({ iter: i, total });
        console.log(`[worker] job=${job.id} iter=${i}/${total}`);
      }

      return { ok: true, iterations: total };
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 24 * 3600,
      },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[worker] training job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] training job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[worker] error:", err);
  });

  console.log("[worker] training worker started");
  return worker;
};

const worker = startTrainingWorker();

const shutdown = async () => {
  console.log("[worker] shutting down");
  await worker.close();
  await connection.quit();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
