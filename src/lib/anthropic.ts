import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Claude client + helpers.
 *
 * Every LLM-backed feature (resume scoring, outreach drafting, JD generation)
 * is gated on ANTHROPIC_API_KEY and falls back to an offline path when it is
 * absent, so the app works with or without a key. The model is overridable via
 * ANTHROPIC_MODEL; it defaults to Claude Opus 4.8.
 */

const DEFAULT_MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export function getAnthropicClient(): Anthropic {
  if (!client) {
    // Reads ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL) from the environment.
    client = new Anthropic();
  }
  return client;
}

/**
 * Runs a single JSON-constrained completion and returns the parsed object.
 * Uses structured outputs so the response validates against `schema`. Throws on
 * transport/parse errors — callers catch and fall back to their offline path.
 */
export async function completeJson<T>(params: {
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const response = await getAnthropicClient().messages.create({
    model: getModel(),
    max_tokens: params.maxTokens ?? 1024,
    ...(params.system ? { system: params.system } : {}),
    messages: [{ role: "user", content: params.prompt }],
    output_config: { format: { type: "json_schema", schema: params.schema } },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }
  return JSON.parse(textBlock.text) as T;
}

/**
 * Runs a single plain-text completion and returns the text.
 */
export async function completeText(params: {
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await getAnthropicClient().messages.create({
    model: getModel(),
    max_tokens: params.maxTokens ?? 2048,
    ...(params.system ? { system: params.system } : {}),
    messages: [{ role: "user", content: params.prompt }],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}
