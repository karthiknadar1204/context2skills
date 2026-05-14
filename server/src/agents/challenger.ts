import { completeStructured, type StructuredResult } from "../openai";
import {
  challengerJsonSchema,
  challengerOutputSchema,
  type ChallengerOutput,
} from "../schemas";
import { buildChallengerPrompt } from "../prompts/challenger";

export type ChallengerInput = {
  context: string;
  systemPrompt: string;
  m: number;
  skills?: string;
};

export async function runChallenger(
  input: ChallengerInput,
): Promise<StructuredResult<ChallengerOutput>> {
  const prompt = buildChallengerPrompt(input);

  return completeStructured({
    model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
    userMessage: prompt,
    schema: challengerOutputSchema,
    jsonSchema: challengerJsonSchema,
    schemaName: "challenger_tasks",
  });
}
