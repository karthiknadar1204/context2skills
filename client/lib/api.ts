import type {
  ContextDetail,
  ContextListItem,
  FinalSkill,
  InferenceJobState,
  Iteration,
  ProbeSet,
  TaskRecord,
  TrainingJobState,
} from "./types";

const BASE = "/api";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new Error(
      `${res.status} ${res.statusText}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
    );
  }
  return res.json();
}

export const api = {
  // Contexts
  listContexts: () =>
    http<{ contexts: ContextListItem[] }>("/contexts").then((r) => r.contexts),
  getContext: (id: string) => http<ContextDetail>(`/contexts/${id}`),
  createContext: (input: { content: string; systemPrompt?: string }) =>
    http<{ contextId: string }>("/contexts", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Iterations / tasks / probes / skills
  listIterations: (contextId: string) =>
    http<{ iterations: Iteration[] }>(`/contexts/${contextId}/iterations`).then(
      (r) => r.iterations,
    ),
  listTasks: (contextId: string) =>
    http<{ tasks: TaskRecord[] }>(`/contexts/${contextId}/tasks`).then(
      (r) => r.tasks,
    ),
  listProbes: (contextId: string) =>
    http<ProbeSet>(`/contexts/${contextId}/probes`),
  getFinalSkills: (contextId: string) =>
    http<FinalSkill>(`/contexts/${contextId}/final-skills`),

  // Training
  startTraining: (
    contextId: string,
    opts: { N?: number; M?: number; maxTokens?: number },
  ) =>
    http<{ jobId: string; contextId: string }>(`/train/${contextId}`, {
      method: "POST",
      body: JSON.stringify(opts),
    }),
  getTrainingJob: (jobId: string) =>
    http<TrainingJobState>(`/train/${jobId}`),

  // Inference
  startInference: (input: {
    contextId: string;
    task: string;
    useSkills?: boolean;
  }) =>
    http<{ jobId: string; contextId: string }>("/infer", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getInferenceJob: (jobId: string) =>
    http<InferenceJobState>(`/infer/${jobId}`),
};
