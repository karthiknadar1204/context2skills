import { completeStructured, type StructuredResult } from "../openai";
import {
  generatorJsonSchema,
  generatorOutputSchema,
  type GeneratorOutput,
} from "../schemas";
import {
  buildReasonerGeneratorPrompt,
  buildChallengerGeneratorPrompt,
  type ProposalForGenerator,
} from "../prompts/generator";

export type GeneratorInput = {
  proposal: ProposalForGenerator;
  existingSkills: string;
};

export async function runReasonerGenerator(
  input: GeneratorInput,
): Promise<StructuredResult<GeneratorOutput>> {
  const prompt = buildReasonerGeneratorPrompt(input);
  return completeStructured({
    model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
    userMessage: prompt,
    schema: generatorOutputSchema,
    jsonSchema: generatorJsonSchema,
    schemaName: "reasoner_skill_materialization",
  });
}

export async function runChallengerGenerator(
  input: GeneratorInput,
): Promise<StructuredResult<GeneratorOutput>> {
  const prompt = buildChallengerGeneratorPrompt(input);
  return completeStructured({
    model: process.env.BACKBONE_MODEL ?? "gpt-4.1",
    userMessage: prompt,
    schema: generatorOutputSchema,
    jsonSchema: generatorJsonSchema,
    schemaName: "challenger_skill_materialization",
  });
}
