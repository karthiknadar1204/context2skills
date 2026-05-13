import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { trainingQueue, inferenceQueue } from "./queue";
import {
  getContextById,
  insertContext,
  listIterations,
} from "./db";
import { createContextSchema, inferRequestSchema } from "./schemas";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.post("/contexts", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const parsed = createContextSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: z.flattenError(parsed.error) }, 400);
  }

  const id = randomUUID();
  const createdAt = Date.now();
  insertContext.run(id, parsed.data.content, parsed.data.systemPrompt, createdAt);

  return c.json({ contextId: id }, 201);
});

app.get("/contexts/:id", (c) => {
  const row = getContextById.get(c.req.param("id"));
  if (!row) return c.json({ error: "context not found" }, 404);
  return c.json({
    id: row.id,
    content: row.content,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
  });
});

app.get("/contexts/:id/iterations", (c) => {
  const contextId = c.req.param("id");
  if (!getContextById.get(contextId)) {
    return c.json({ error: "context not found" }, 404);
  }
  const rows = listIterations.all(contextId);
  return c.json({
    contextId,
    iterations: rows.map((r) => ({
      iterNum: r.iter_num,
      challengerSkills: r.challenger_skills,
      reasonerSkills: r.reasoner_skills,
      completedAt: r.completed_at,
    })),
  });
});

app.post("/train/:contextId", async (c) => {
  const contextId = c.req.param("contextId");
  if (!getContextById.get(contextId)) {
    return c.json({ error: "context not found" }, 404);
  }

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

app.post("/infer", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const parsed = inferRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: z.flattenError(parsed.error) }, 400);
  }

  const { contextId, task } = parsed.data;
  if (!getContextById.get(contextId)) {
    return c.json({ error: "context not found" }, 404);
  }

  const job = await inferenceQueue.add(
    "infer",
    { contextId, task },
    { removeOnComplete: 100, removeOnFail: 100 },
  );
  return c.json({ jobId: job.id, contextId });
});

app.get("/infer/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const job = await inferenceQueue.getJob(jobId);
  if (!job) return c.json({ error: "job not found" }, 404);

  const state = await job.getState();
  return c.json({
    jobId: job.id,
    state,
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
