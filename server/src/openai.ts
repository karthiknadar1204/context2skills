import OpenAI from "openai";
import type { z } from "zod";

const apiKey = process.env.OPENAI_API_KEY;
export const openaiAvailable = Boolean(apiKey && apiKey.length > 0);

export const openai: OpenAI | null = openaiAvailable
  ? new OpenAI({ apiKey })
  : null;

export type CompletionUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type CompletionResult = {
  answer: string;
  model: string;
  usage: CompletionUsage;
  stub: boolean;
};

export async function completeChat(opts: {
  model: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<CompletionResult> {
  if (!openai) {
    return {
      answer:
        `[STUB — no OPENAI_API_KEY set]\n` +
        `system prompt length: ${opts.systemPrompt.length} chars\n` +
        `user task: ${opts.userMessage.slice(0, 200)}`,
      model: "stub",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      stub: true,
    };
  }

  const resp = await openai.chat.completions.create({
    model: opts.model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userMessage },
    ],
  });

  const choice = resp.choices[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no content");
  }

  return {
    answer: content,
    model: resp.model,
    usage: {
      promptTokens: resp.usage?.prompt_tokens ?? 0,
      completionTokens: resp.usage?.completion_tokens ?? 0,
      totalTokens: resp.usage?.total_tokens ?? 0,
    },
    stub: false,
  };
}

export type StructuredResult<T> = {
  parsed: T;
  model: string;
  usage: CompletionUsage;
};

export async function completeStructured<TSchema extends z.ZodTypeAny>(opts: {
  model: string;
  systemPrompt?: string;
  userMessage: string;
  schema: TSchema;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
}): Promise<StructuredResult<z.infer<TSchema>>> {
  if (!openai) {
    throw new Error(
      "OPENAI_API_KEY not set — structured outputs require a real API key",
    );
  }

  const messages: { role: "system" | "user"; content: string }[] = [];
  if (opts.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt });
  }
  messages.push({ role: "user", content: opts.userMessage });

  const resp = await openai.chat.completions.create({
    model: opts.model,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: opts.schemaName,
        strict: true,
        schema: opts.jsonSchema,
      },
    },
  });

  const content = resp.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no content for structured output");
  }

  const json: unknown = JSON.parse(content);
  const parsed = opts.schema.parse(json) as z.infer<TSchema>;

  return {
    parsed,
    model: resp.model,
    usage: {
      promptTokens: resp.usage?.prompt_tokens ?? 0,
      completionTokens: resp.usage?.completion_tokens ?? 0,
      totalTokens: resp.usage?.total_tokens ?? 0,
    },
  };
}
