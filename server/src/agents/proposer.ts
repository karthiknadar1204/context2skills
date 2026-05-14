import { completeStructured, type StructuredResult } from "../openai";
import {
  proposerJsonSchema,
  proposerOutputSchema,
  type ProposerOutput,
} from "../schemas";
import {
  buildReasonerProposerPrompt,
  buildChallengerProposerPrompt,
  type TaskTrace,
} from "../prompts/proposer";

export type ReasonerProposerInput = {
  iter: number;
  context: string;
  systemPrompt: string;
  m: number;
  allTraces: TaskTrace[];
  failedTraces: TaskTrace[];
  existingSkills: string;
};

export async function runReasonerProposer(
  input: ReasonerProposerInput,
): Promise<StructuredResult<ProposerOutput>> {
  const prompt = buildReasonerProposerPrompt(input);
  return completeStructured({
    model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
    userMessage: prompt,
    schema: proposerOutputSchema,
    jsonSchema: proposerJsonSchema as Record<string, unknown>,
    schemaName: "reasoner_proposer_diagnosis",
  });
}

export type ChallengerProposerInput = {
  iter: number;
  context: string;
  systemPrompt: string;
  m: number;
  allTraces: TaskTrace[];
  passedTraces: TaskTrace[];
  existingSkills: string;
};

export async function runChallengerProposer(
  input: ChallengerProposerInput,
): Promise<StructuredResult<ProposerOutput>> {
  const prompt = buildChallengerProposerPrompt(input);
  return completeStructured({
    model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
    userMessage: prompt,
    schema: proposerOutputSchema,
    jsonSchema: proposerJsonSchema as Record<string, unknown>,
    schemaName: "challenger_proposer_diagnosis",
  });
}
