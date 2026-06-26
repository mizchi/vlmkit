import type { ModelTier } from "./types.ts";

// Minimal OpenAI-compatible chat-completions client, used when a ModelTier sets
// `baseURL` (e.g. a self-hosted ui-tars endpoint) — createUnifiedLLMClient in
// @mizchi/vlmkit-ai does not take a baseURL, so we call the endpoint directly.

export interface ChatUsage {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

type Block =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Build an OpenAI `content` array from a text prompt + optional PNG screenshot. */
export function buildUserContent(text: string, screenshotPng?: Buffer): string | Block[] {
  if (!screenshotPng) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: `data:image/png;base64,${screenshotPng.toString("base64")}` } },
  ];
}

/** Parse an OpenAI chat-completions response into content + token usage. */
export function parseChatCompletion(json: unknown): ChatUsage {
  const j = json as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    content: j.choices?.[0]?.message?.content ?? "",
    promptTokens: j.usage?.prompt_tokens ?? 0,
    completionTokens: j.usage?.completion_tokens ?? 0,
  };
}

/** Call a tier's self-hosted OpenAI-compatible endpoint. `baseURL` is the API
 * base (e.g. http://localhost:8000/v1); `/chat/completions` is appended. */
export async function openAICompatComplete(opts: {
  tier: ModelTier;
  text: string;
  screenshotPng?: Buffer;
  maxTokens?: number;
  apiKey?: string;
}): Promise<ChatUsage> {
  const { tier, text, screenshotPng, maxTokens = 1024, apiKey } = opts;
  if (!tier.baseURL) throw new Error("openAICompatComplete requires tier.baseURL");
  const url = `${tier.baseURL.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: tier.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: buildUserContent(text, screenshotPng) }],
    }),
  });
  if (!res.ok) throw new Error(`${tier.baseURL} error: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return parseChatCompletion(await res.json());
}
