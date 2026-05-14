import { Worker, type Job } from "bullmq";
import {
  TRAINING_QUEUE,
  INFERENCE_QUEUE,
  createBullConnection,
} from "./queue";
import {
  upsertIteration,
  getContextById,
  insertTask,
  updateTaskAnswer,
  updateTaskVerdict,
  upsertProbe,
  upsertFinalSkill,
  getFinalSkill,
} from "./db";
import { crossTimeReplay, type IterScore } from "./replay";
import { completeChat, type CompletionResult } from "./openai";
import { runChallenger } from "./agents/challenger";
import { runReasoner } from "./agents/reasoner";
import { runJudge } from "./agents/judge";
import {
  runReasonerProposer,
  runChallengerProposer,
} from "./agents/proposer";
import {
  runReasonerGenerator,
  runChallengerGenerator,
} from "./agents/generator";
import type { TaskTrace } from "./prompts/proposer";

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

type TrainingJobData = {
  contextId: string;
  M?: number;
  N?: number;
  maxTokens?: number;
};

type IterSummary = {
  iter: number;
  solved: number;
  total: number;
  tokensUsed: number;
  reasonerEvolved: boolean;
  challengerEvolved: boolean;
};

type TrainingJobResult = {
  ok: true;
  iterations: number;
  perIter: IterSummary[];
  tokensUsed: number;
  abortedEarly: boolean;
  selectedFinalSkillIter: number | null;
  replay: {
    hardProbes: number;
    easyProbes: number;
    scoresByIter: IterScore[];
    tokensUsed: number;
  } | null;
};

type SkillEvolutionResult = {
  skillContent: string;
  tokensUsed: number;
  proposerAnalysis: string;
};

async function evolveReasonerSkills(input: {
  iter: number;
  context: string;
  systemPrompt: string;
  m: number;
  allTraces: TaskTrace[];
  failedTraces: TaskTrace[];
  existingSkills: string;
}): Promise<SkillEvolutionResult> {
  console.log(
    `[worker] reasoner side: ${input.failedTraces.length} failures → proposer`,
  );
  const proposer = await runReasonerProposer(input);
  console.log(
    `[worker] reasoner proposer: ${proposer.parsed.action} "${proposer.parsed.skill_name}" (${proposer.usage.totalTokens} tokens)`,
  );

  const generator = await runReasonerGenerator({
    proposal: proposer.parsed,
    existingSkills: input.existingSkills,
  });
  console.log(
    `[worker] reasoner generator: produced SKILL.md (${generator.usage.totalTokens} tokens)`,
  );

  return {
    skillContent: generator.parsed.skill_content,
    tokensUsed: proposer.usage.totalTokens + generator.usage.totalTokens,
    proposerAnalysis: proposer.parsed.analysis,
  };
}

async function evolveChallengerSkills(input: {
  iter: number;
  context: string;
  systemPrompt: string;
  m: number;
  allTraces: TaskTrace[];
  passedTraces: TaskTrace[];
  existingSkills: string;
}): Promise<SkillEvolutionResult> {
  console.log(
    `[worker] challenger side: ${input.passedTraces.length} easy passes → proposer`,
  );
  const proposer = await runChallengerProposer(input);
  console.log(
    `[worker] challenger proposer: ${proposer.parsed.action} "${proposer.parsed.skill_name}" (${proposer.usage.totalTokens} tokens)`,
  );

  const generator = await runChallengerGenerator({
    proposal: proposer.parsed,
    existingSkills: input.existingSkills,
  });
  console.log(
    `[worker] challenger generator: produced SKILL.md (${generator.usage.totalTokens} tokens)`,
  );

  return {
    skillContent: generator.parsed.skill_content,
    tokensUsed: proposer.usage.totalTokens + generator.usage.totalTokens,
    proposerAnalysis: proposer.parsed.analysis,
  };
}

type InferenceJobData = {
  contextId: string;
  task: string;
  useSkills?: boolean;
};
type InferenceJobResult = CompletionResult & {
  contextId: string;
  usedSkills: boolean;
  selectedIter: number | null;
};

function mergeSkill(existing: string, newSkill: string): string {
  return existing.trim() ? `${existing}\n\n${newSkill}` : newSkill;
}

type RunIterationOutput = {
  solved: number;
  total: number;
  tokensUsed: number;
  newReasonerSkills: string;
  newChallengerSkills: string;
  reasonerEvolved: boolean;
  challengerEvolved: boolean;
};

async function runIteration(opts: {
  contextId: string;
  iter: number;
  M: number;
  context: string;
  systemPrompt: string;
  challengerSkills: string;
  reasonerSkills: string;
  job: Job<TrainingJobData, TrainingJobResult>;
}): Promise<RunIterationOutput> {
  const {
    contextId,
    iter,
    M,
    context,
    systemPrompt,
    challengerSkills,
    reasonerSkills,
    job,
  } = opts;
  let tokensUsed = 0;

  // 1) Challenger generates M tasks (uses challengerSkills from prior iter)
  console.log(
    `[worker] iter=${iter}: challenger generating ${M} tasks (skills=${challengerSkills.length} chars)`,
  );
  const challenger = await runChallenger({
    context,
    systemPrompt,
    m: M,
    skills: challengerSkills,
  });
  tokensUsed += challenger.usage.totalTokens;
  const tasks = challenger.parsed.tasks;
  console.log(
    `[worker] iter=${iter}: challenger produced ${tasks.length} tasks (${challenger.usage.totalTokens} tokens)`,
  );

  const taskIds: number[] = [];
  for (const t of tasks) {
    const res = insertTask.run(
      contextId,
      iter,
      t.task,
      JSON.stringify(t.rubrics),
    );
    taskIds.push(Number(res.lastInsertRowid));
  }

  await job.updateProgress({ iter, phase: "reasoning", tasks: tasks.length });

  // 2) Reasoner answers all in parallel (uses reasonerSkills from prior iter)
  console.log(
    `[worker] iter=${iter}: reasoner answering ${tasks.length} tasks (skills=${reasonerSkills.length} chars)`,
  );
  const reasonerResults = await Promise.all(
    tasks.map((t) =>
      runReasoner({ context, systemPrompt, task: t.task, reasonerSkills }),
    ),
  );
  for (let k = 0; k < tasks.length; k++) {
    const r = reasonerResults[k]!;
    tokensUsed += r.usage.totalTokens;
    updateTaskAnswer.run(r.answer, taskIds[k]!);
  }

  await job.updateProgress({ iter, phase: "judging", tasks: tasks.length });

  // 3) Judge evaluates all in parallel
  const judgeResults = await Promise.all(
    tasks.map((t, k) =>
      runJudge({
        rubrics: t.rubrics,
        reasonerAnswer: reasonerResults[k]!.answer,
      }),
    ),
  );

  let solved = 0;
  for (let k = 0; k < tasks.length; k++) {
    const verdict = judgeResults[k]!.parsed;
    tokensUsed += judgeResults[k]!.usage.totalTokens;
    const score = verdict["Overall Score"];
    if (score === 1) solved++;
    updateTaskVerdict.run(JSON.stringify(verdict), score, taskIds[k]!);
  }
  console.log(
    `[worker] iter=${iter}: judge done — ${solved}/${tasks.length} solved`,
  );

  // 4) Build traces
  const allTraces: TaskTrace[] = tasks.map((t, k) => {
    const verdict = judgeResults[k]!.parsed;
    return {
      index: k + 1,
      task: t.task,
      rubrics: t.rubrics,
      rubricStatuses: verdict["Requirement Satisfaction Status"],
      reasonerAnswer: reasonerResults[k]!.answer,
      judgeRationale: verdict["Grading Rationale"],
      overallScore: verdict["Overall Score"] as 0 | 1,
    };
  });
  const failedTraces = allTraces.filter((t) => t.overallScore === 0);
  const passedTraces = allTraces.filter((t) => t.overallScore === 1);

  // 4b) Probe set accumulation (paper §3.4)
  //   - Hard: failed task with LOWEST rubric pass rate
  //   - Easy: passed task with FEWEST rubrics
  if (failedTraces.length > 0) {
    const hardest = failedTraces
      .map((t) => ({
        trace: t,
        passRate:
          t.rubricStatuses.filter((s) => s === "yes").length / t.rubrics.length,
      }))
      .sort((a, b) => a.passRate - b.passRate)[0]!;
    const taskId = taskIds[hardest.trace.index - 1]!;
    upsertProbe.run(contextId, "hard", iter, taskId);
    console.log(
      `[worker] iter=${iter}: hard probe = task ${taskId} (passRate=${hardest.passRate.toFixed(2)})`,
    );
  }
  if (passedTraces.length > 0) {
    const easiest = passedTraces
      .map((t) => ({ trace: t, rubricCount: t.rubrics.length }))
      .sort((a, b) => a.rubricCount - b.rubricCount)[0]!;
    const taskId = taskIds[easiest.trace.index - 1]!;
    upsertProbe.run(contextId, "easy", iter, taskId);
    console.log(
      `[worker] iter=${iter}: easy probe = task ${taskId} (rubricCount=${easiest.rubricCount})`,
    );
  }

  // 5) Asymmetric skill evolution — both sides run in parallel
  await job.updateProgress({ iter, phase: "skill_evolution" });

  const [reasonerUpdate, challengerUpdate] = await Promise.all([
    failedTraces.length > 0
      ? evolveReasonerSkills({
          iter,
          context,
          systemPrompt,
          m: M,
          allTraces,
          failedTraces,
          existingSkills: reasonerSkills,
        })
      : Promise.resolve(null),
    passedTraces.length > 0
      ? evolveChallengerSkills({
          iter,
          context,
          systemPrompt,
          m: M,
          allTraces,
          passedTraces,
          existingSkills: challengerSkills,
        })
      : Promise.resolve(null),
  ]);

  tokensUsed +=
    (reasonerUpdate?.tokensUsed ?? 0) +
    (challengerUpdate?.tokensUsed ?? 0);

  const newReasonerSkills = reasonerUpdate
    ? mergeSkill(reasonerSkills, reasonerUpdate.skillContent)
    : reasonerSkills;
  const newChallengerSkills = challengerUpdate
    ? mergeSkill(challengerSkills, challengerUpdate.skillContent)
    : challengerSkills;

  upsertIteration.run(
    contextId,
    iter,
    newChallengerSkills,
    newReasonerSkills,
    Date.now(),
  );

  console.log(
    `[worker] iter=${iter}: done — solved=${solved}/${tasks.length}, ` +
      `reasoner: ${reasonerUpdate ? "evolved" : "unchanged"}, ` +
      `challenger: ${challengerUpdate ? "evolved" : "unchanged"}, ` +
      `iter tokens=${tokensUsed}`,
  );

  return {
    solved,
    total: tasks.length,
    tokensUsed,
    newReasonerSkills,
    newChallengerSkills,
    reasonerEvolved: !!reasonerUpdate,
    challengerEvolved: !!challengerUpdate,
  };
}

export const startTrainingWorker = () => {
  const worker = new Worker<TrainingJobData, TrainingJobResult>(
    TRAINING_QUEUE,
    async (job: Job<TrainingJobData, TrainingJobResult>) => {
      const { contextId, M = 5, N = 5, maxTokens } = job.data;
      const ctx = getContextById.get(contextId);
      if (!ctx) throw new Error(`context ${contextId} not found`);

      console.log(
        `[worker] training start job=${job.id} context=${contextId} N=${N} M=${M}` +
          (maxTokens ? ` maxTokens=${maxTokens}` : ""),
      );

      let challengerSkills = "";
      let reasonerSkills = "";
      let tokensUsed = 0;
      const perIter: IterSummary[] = [];
      let abortedEarly = false;

      for (let i = 1; i <= N; i++) {
        if (maxTokens && tokensUsed >= maxTokens) {
          console.log(
            `[worker] token budget reached (${tokensUsed} >= ${maxTokens}), stopping before iter ${i}`,
          );
          abortedEarly = true;
          break;
        }

        const result = await runIteration({
          contextId,
          iter: i,
          M,
          context: ctx.content,
          systemPrompt: ctx.system_prompt,
          challengerSkills,
          reasonerSkills,
          job,
        });

        tokensUsed += result.tokensUsed;
        reasonerSkills = result.newReasonerSkills;
        challengerSkills = result.newChallengerSkills;
        perIter.push({
          iter: i,
          solved: result.solved,
          total: result.total,
          tokensUsed: result.tokensUsed,
          reasonerEvolved: result.reasonerEvolved,
          challengerEvolved: result.challengerEvolved,
        });

        await job.updateProgress({
          iter: i,
          totalIters: N,
          phase: "iter_done",
          solved: result.solved,
          failed: result.total - result.solved,
          tokensUsedTotal: tokensUsed,
          perIter,
        });
      }

      console.log(
        `[worker] training done job=${job.id}: ${perIter.length} iterations, ${tokensUsed} tokens` +
          (abortedEarly ? " (aborted on budget)" : ""),
      );

      // Cross-Time Replay (paper §3.4): select the most generalizable skill set
      let selectedFinalSkillIter: number | null = null;
      let replayInfo: TrainingJobResult["replay"] = null;

      if (perIter.length > 0) {
        await job.updateProgress({
          iter: perIter.length,
          totalIters: N,
          phase: "cross_time_replay",
          tokensUsedTotal: tokensUsed,
          perIter,
        });
        const replay = await crossTimeReplay({
          contextId,
          context: ctx.content,
          systemPrompt: ctx.system_prompt,
        });

        tokensUsed += replay.tokensUsed;
        selectedFinalSkillIter = replay.selectedIter;
        replayInfo = {
          hardProbes: replay.hardProbeCount,
          easyProbes: replay.easyProbeCount,
          scoresByIter: replay.scoresByIter,
          tokensUsed: replay.tokensUsed,
        };

        upsertFinalSkill.run(
          contextId,
          replay.selectedIter,
          replay.selectedSkills,
          Date.now(),
        );
        console.log(
          `[worker] final skills persisted: iter=${replay.selectedIter}, ` +
            `${replay.selectedSkills.length} chars, replay tokens=${replay.tokensUsed}`,
        );
      }

      return {
        ok: true,
        iterations: perIter.length,
        perIter,
        tokensUsed,
        abortedEarly,
        selectedFinalSkillIter,
        replay: replayInfo,
      };
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
      const { contextId, task, useSkills = true } = job.data;
      console.log(
        `[worker] inference start job=${job.id} context=${contextId} useSkills=${useSkills}`,
      );

      const ctx = getContextById.get(contextId);
      if (!ctx) {
        throw new Error(`context ${contextId} not found`);
      }

      const finalSkill = useSkills ? getFinalSkill.get(contextId) : null;
      const skillsPrefix = finalSkill
        ? `## Available Skills\n\n${finalSkill.content}\n\n`
        : "";
      const systemPrompt = ctx.system_prompt
        ? `${skillsPrefix}${ctx.system_prompt}\n\n${ctx.content}`
        : `${skillsPrefix}${ctx.content}`;

      const result = await completeChat({
        model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
        systemPrompt,
        userMessage: task,
      });

      console.log(
        `[worker] inference job=${job.id} model=${result.model} ` +
          `tokens=${result.usage.totalTokens} stub=${result.stub} ` +
          `skillsApplied=${finalSkill ? `iter${finalSkill.selected_iter}` : "none"}`,
      );

      return {
        ...result,
        contextId,
        usedSkills: !!finalSkill,
        selectedIter: finalSkill?.selected_iter ?? null,
      };
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
