import { z } from "zod";

export const createContextSchema = z.object({
  content: z.string().min(1, "content must be non-empty"),
  systemPrompt: z.string().optional().default(""),
});

export type CreateContextInput = z.infer<typeof createContextSchema>;

export const inferRequestSchema = z.object({
  contextId: z.string().min(1, "contextId required"),
  task: z.string().min(1, "task must be non-empty"),
  useSkills: z.boolean().optional().default(true),
});

export type InferRequestInput = z.infer<typeof inferRequestSchema>;

// ---------- Agent output schemas ----------

export const challengerOutputSchema = z.object({
  tasks: z
    .array(
      z.object({
        task: z.string(),
        rubrics: z.array(z.string()),
      }),
    )
    .min(1),
});

export type ChallengerOutput = z.infer<typeof challengerOutputSchema>;

export const challengerJsonSchema = {
  type: "object" as const,
  properties: {
    tasks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          task: { type: "string" as const },
          rubrics: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
        required: ["task", "rubrics"],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
};

export const judgeOutputSchema = z.object({
  "Grading Rationale": z.string(),
  "Requirement Satisfaction Status": z.array(z.enum(["yes", "no"])),
  "Overall Score": z.number().int().min(0).max(1),
});

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;

export const judgeJsonSchema = {
  type: "object" as const,
  properties: {
    "Grading Rationale": { type: "string" as const },
    "Requirement Satisfaction Status": {
      type: "array" as const,
      items: { type: "string" as const, enum: ["yes", "no"] },
    },
    "Overall Score": { type: "integer" as const, enum: [0, 1] },
  },
  required: [
    "Grading Rationale",
    "Requirement Satisfaction Status",
    "Overall Score",
  ],
  additionalProperties: false,
};

export const proposerOutputSchema = z.object({
  action: z.enum(["create", "edit"]),
  target_skill: z.string().nullable(),
  analysis: z.string(),
  skill_name: z.string(),
  skill_description: z.string(),
  proposed_skill: z.string(),
  justification: z.string(),
});

export type ProposerOutput = z.infer<typeof proposerOutputSchema>;

export const proposerJsonSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["create", "edit"] },
    target_skill: { type: ["string", "null"] },
    analysis: { type: "string" },
    skill_name: { type: "string" },
    skill_description: { type: "string" },
    proposed_skill: { type: "string" },
    justification: { type: "string" },
  },
  required: [
    "action",
    "target_skill",
    "analysis",
    "skill_name",
    "skill_description",
    "proposed_skill",
    "justification",
  ],
  additionalProperties: false,
} as const;

export const generatorOutputSchema = z.object({
  skill_content: z.string(),
  reasoning: z.string(),
});

export type GeneratorOutput = z.infer<typeof generatorOutputSchema>;

export const generatorJsonSchema = {
  type: "object" as const,
  properties: {
    skill_content: { type: "string" as const },
    reasoning: { type: "string" as const },
  },
  required: ["skill_content", "reasoning"],
  additionalProperties: false,
};
