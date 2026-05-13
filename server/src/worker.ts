import { Worker, type Job } from "bullmq";
import {
  TRAINING_QUEUE,
  INFERENCE_QUEUE,
  createBullConnection,
} from "./queue";
import { upsertIteration, getContextById } from "./db";
import { completeChat, type CompletionResult } from "./openai";

const trainingConnection = createBullConnection();
const inferenceConnection = createBullConnection();

trainingConnection.on("connect", () =>
  console.log("[worker] training Redis connected"),
);
trainingConnection.on("ready", () =>
  console.log("[worker] training Redis ready"),
);
trainingConnection.on("error", (err) =>
  console.error("[worker] training Redis error:", err),
);

inferenceConnection.on("connect", () =>
  console.log("[worker] inference Redis connected"),
);
inferenceConnection.on("ready", () =>
  console.log("[worker] inference Redis ready"),
);
inferenceConnection.on("error", (err) =>
  console.error("[worker] inference Redis error:", err),
);

type TrainingJobData = { contextId: string };
type TrainingJobResult = { ok: true; iterations: number };

type InferenceJobData = { contextId: string; task: string };
type InferenceJobResult = CompletionResult & { contextId: string };

export const startTrainingWorker = () => {
  const worker = new Worker<TrainingJobData, TrainingJobResult>(
    TRAINING_QUEUE,
    async (job: Job<TrainingJobData, TrainingJobResult>) => {
      const { contextId } = job.data;
      console.log(`[worker] training start job=${job.id} context=${contextId}`);

      const total = 5;
      for (let i = 1; i <= total; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        upsertIteration.run(
          contextId,
          i,
          `# Challenger skills (iter ${i}, dummy)\n`,
          `# Reasoner skills (iter ${i}, dummy)\n`,
          Date.now(),
        );

        await job.updateProgress({ iter: i, total });
        console.log(`[worker] training job=${job.id} iter=${i}/${total}`);
      }

      return { ok: true, iterations: total };
    },
    {
      connection: trainingConnection,
      concurrency: 5,
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[worker] training job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] training job ${job?.id} failed:`, err.message);
  });
  worker.on("error", (err) => {
    console.error("[worker] training error:", err);
  });

  console.log("[worker] training worker started");
  return worker;
};

export const startInferenceWorker = () => {
  const worker = new Worker<InferenceJobData, InferenceJobResult>(
    INFERENCE_QUEUE,
    async (job: Job<InferenceJobData, InferenceJobResult>) => {
      const { contextId, task } = job.data;
      console.log(
        `[worker] inference start job=${job.id} context=${contextId}`,
      );

      const ctx = getContextById.get(contextId);
      if (!ctx) {
        throw new Error(`context ${contextId} not found`);
      }

      const systemPrompt = ctx.system_prompt
        ? `${ctx.system_prompt}\n\n${ctx.content}`
        : ctx.content;

      const result = await completeChat({
        model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
        systemPrompt,
        userMessage: task,
      });

      console.log(
        `[worker] inference job=${job.id} model=${result.model} ` +
          `tokens=${result.usage.totalTokens} stub=${result.stub}`,
      );

      return { ...result, contextId };
    },
    {
      connection: inferenceConnection,
      concurrency: 20,
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[worker] inference job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] inference job ${job?.id} failed:`, err.message);
  });
  worker.on("error", (err) => {
    console.error("[worker] inference error:", err);
  });

  console.log("[worker] inference worker started");
  return worker;
};

const trainingWorker = startTrainingWorker();
const inferenceWorker = startInferenceWorker();

const shutdown = async () => {
  console.log("[worker] shutting down");
  await Promise.all([trainingWorker.close(), inferenceWorker.close()]);
  await Promise.all([trainingConnection.quit(), inferenceConnection.quit()]);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
