import OpenAI from "openai";

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
