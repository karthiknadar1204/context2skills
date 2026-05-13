import { Hono } from "hono";
import { trainingQueue } from "./queue";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.post("/train/:contextId", async (c) => {
  const contextId = c.req.param("contextId");
  const job = await trainingQueue.add(
    "train-context",
    { contextId },
    { removeOnComplete: 100, removeOnFail: 100 },
  );
  return c.json({ jobId: job.id, contextId });
});

app.get("/train/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const job = await trainingQueue.getJob(jobId);
  if (!job) return c.json({ error: "job not found" }, 404);

  const state = await job.getState();
  return c.json({
    jobId: job.id,
    state,
    progress: job.progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
  });
});

const port = Number(process.env.PORT ?? 3000);
console.log(`[api] listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
