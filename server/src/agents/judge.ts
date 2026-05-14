import { completeStructured, type StructuredResult } from "../openai";
import {
  judgeJsonSchema,
  judgeOutputSchema,
  type JudgeOutput,
} from "../schemas";
import { buildJudgePrompt } from "../prompts/judge";

export type JudgeInput = {
  rubrics: string[];
  reasonerAnswer: string;
};

export async function runJudge(
  input: JudgeInput,
): Promise<StructuredResult<JudgeOutput>> {
  const prompt = buildJudgePrompt(input);

  return completeStructured({
    model: process.env.JUDGE_MODEL ?? "gpt-5.1",
    userMessage: prompt,
    schema: judgeOutputSchema,
    jsonSchema: judgeJsonSchema,
    schemaName: "judge_verdict",
  });
}
