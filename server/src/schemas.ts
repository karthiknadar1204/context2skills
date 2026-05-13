import { z } from "zod";

export const createContextSchema = z.object({
  content: z.string().min(1, "content must be non-empty"),
  systemPrompt: z.string().optional().default(""),
});

export type CreateContextInput = z.infer<typeof createContextSchema>;

export const inferRequestSchema = z.object({
  contextId: z.string().min(1, "contextId required"),
  task: z.string().min(1, "task must be non-empty"),
});

export type InferRequestInput = z.infer<typeof inferRequestSchema>;
