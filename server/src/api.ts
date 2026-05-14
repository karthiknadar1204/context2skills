import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { trainingQueue, inferenceQueue } from "./queue";
import {
  getContextById,
  insertContext,
  listIterations,
  listTasksForContext,
  getFinalSkill,
  listProbesByKind,
  listContexts,
} from "./db";
import { createContextSchema, inferRequestSchema } from "./schemas";

const app = new Hono();

app.use("*", cors({ origin: "*" }));

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

app.get("/contexts", (c) => {
  const rows = listContexts.all();
  return c.json({
    contexts: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      contentPreview: r.content_preview,
      hasFinalSkills: r.has_final_skills === 1,
    })),
  });
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

app.get("/contexts/:id/tasks", (c) => {
  const contextId = c.req.param("id");
  if (!getContextById.get(contextId)) {
    return c.json({ error: "context not found" }, 404);
  }
  const rows = listTasksForContext.all(contextId);
  return c.json({
    contextId,
    tasks: rows.map((r) => ({
      id: r.id,
      iterNum: r.iter_num,
      task: r.task_text,
      rubrics: JSON.parse(r.rubrics_json),
      reasonerAnswer: r.reasoner_answer,
      judgeVerdict: r.judge_verdicts ? JSON.parse(r.judge_verdicts) : null,
      solved: r.solved === 1,
    })),
  });
});

app.get("/contexts/:id/final-skills", (c) => {
  const contextId = c.req.param("id");
  if (!getContextById.get(contextId)) {
    return c.json({ error: "context not found" }, 404);
  }
  const row = getFinalSkill.get(contextId);
  if (!row) {
    return c.json({ error: "no final skills yet — training not completed" }, 404);
  }
  return c.json({
    contextId,
    selectedIter: row.selected_iter,
    content: row.content,
    createdAt: row.created_at,
  });
});

app.get("/contexts/:id/probes", (c) => {
  const contextId = c.req.param("id");
  if (!getContextById.get(contextId)) {
    return c.json({ error: "context not found" }, 404);
  }
  return c.json({
    contextId,
    hard: listProbesByKind.all(contextId, "hard").map((p) => ({
      iterNum: p.iter_num,
      taskId: p.task_id,
      task: p.task_text,
      rubrics: JSON.parse(p.rubrics_json),
    })),
    easy: listProbesByKind.all(contextId, "easy").map((p) => ({
      iterNum: p.iter_num,
      taskId: p.task_id,
      task: p.task_text,
      rubrics: JSON.parse(p.rubrics_json),
    })),
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

  let body: { M?: number; N?: number; maxTokens?: number } = {};
  try {
    if (c.req.header("content-length")) {
      body = await c.req.json();
    }
  } catch {
    // empty/non-JSON body — fine, use defaults
  }

  const job = await trainingQueue.add(
    "train-context",
    {
      contextId,
      ...(body.M ? { M: body.M } : {}),
      ...(body.N ? { N: body.N } : {}),
      ...(body.maxTokens ? { maxTokens: body.maxTokens } : {}),
    },
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

  const { contextId, task, useSkills } = parsed.data;
  if (!getContextById.get(contextId)) {
    return c.json({ error: "context not found" }, 404);
  }

  const job = await inferenceQueue.add(
    "infer",
    { contextId, task, useSkills },
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
