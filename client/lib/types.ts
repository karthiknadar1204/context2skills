export type ContextListItem = {
  id: string;
  createdAt: number;
  contentPreview: string;
  hasFinalSkills: boolean;
};

export type ContextDetail = {
  id: string;
  content: string;
  systemPrompt: string;
  createdAt: number;
};

export type Iteration = {
  iterNum: number;
  challengerSkills: string;
  reasonerSkills: string;
  completedAt: number;
};

export type JudgeVerdict = {
  "Grading Rationale": string;
  "Requirement Satisfaction Status": ("yes" | "no")[];
  "Overall Score": 0 | 1;
};

export type TaskRecord = {
  id: number;
  iterNum: number;
  task: string;
  rubrics: string[];
  reasonerAnswer: string | null;
  judgeVerdict: JudgeVerdict | null;
  solved: boolean;
};

export type Probe = {
  iterNum: number;
  taskId: number;
  task: string;
  rubrics: string[];
};

export type ProbeSet = {
  contextId: string;
  hard: Probe[];
  easy: Probe[];
};

export type FinalSkill = {
  contextId: string;
  selectedIter: number;
  content: string;
  createdAt: number;
};

export type IterSummary = {
  iter: number;
  solved: number;
  total: number;
  tokensUsed: number;
  reasonerEvolved: boolean;
  challengerEvolved: boolean;
};

export type IterScore = {
  iter: number;
  rhoH: number;
  rhoE: number;
  score: number;
  hardPassed: number;
  hardTotal: number;
  easyPassed: number;
  easyTotal: number;
};

export type TrainingJobReturn = {
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

export type TrainingJobState = {
  jobId: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed" | "stalled" | "prioritized" | "unknown";
  progress:
    | number
    | {
        iter?: number;
        totalIters?: number;
        phase?: string;
        tasks?: number;
        solved?: number;
        failed?: number;
        tokensUsedTotal?: number;
        perIter?: IterSummary[];
      };
  data: { contextId: string; M?: number; N?: number };
  returnvalue: TrainingJobReturn | null;
  failedReason?: string;
  timestamp: number;
  finishedOn?: number;
};

export type InferenceJobReturn = {
  answer: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  stub: boolean;
  contextId: string;
  usedSkills: boolean;
  selectedIter: number | null;
};

export type InferenceJobState = {
  jobId: string;
  state: TrainingJobState["state"];
  data: { contextId: string; task: string; useSkills?: boolean };
  returnvalue: InferenceJobReturn | null;
  failedReason?: string;
  timestamp: number;
  finishedOn?: number;
};
