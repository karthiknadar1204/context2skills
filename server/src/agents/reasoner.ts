import { completeChat, type CompletionResult } from "../openai";

export type ReasonerInput = {
  context: string;
  systemPrompt: string;
  reasonerSkills?: string;
  task: string;
};

export async function runReasoner(
  input: ReasonerInput,
): Promise<CompletionResult> {
  const skillsBlock = input.reasonerSkills?.trim();
  const parts = [
    skillsBlock ? `## Available Skills\n\n${skillsBlock}` : "",
    input.systemPrompt,
    input.context,
  ].filter((s) => s && s.length > 0);

  const systemPrompt = parts.join("\n\n");

  return completeChat({
    model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
    systemPrompt,
    userMessage: input.task,
  });
}
