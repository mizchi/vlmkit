import { createUnifiedLLMClient } from "@mizchi/vlmkit-ai";
import type { ModelTier } from "./types.ts";
import { billedCost } from "./cost.ts";

export type ReviewVerdict = "accept" | "reject" | "unsure";
export type IntentSource = "expectedChange" | "gitContext" | "vision-only";

export interface VrtReviewInput {
  baselinePng: Buffer;
  actualPng: Buffer;
  diffPng?: Buffer;
  expectedChange?: string;
  gitContext?: string;
  tier: ModelTier;
}

export interface VrtReview {
  verdict: ReviewVerdict;
  confidence: number;
  reason: string;
  intentSource: IntentSource;
  costUsd: number;
}

// --- Intent resolution (layered: expectedChange > gitContext > vision-only) ---

export interface ResolvedIntent {
  intentSource: IntentSource;
  text: string;
}

export function resolveIntent(input: { expectedChange?: string; gitContext?: string }): ResolvedIntent {
  if (input.expectedChange?.trim()) return { intentSource: "expectedChange", text: input.expectedChange.trim() };
  if (input.gitContext?.trim()) return { intentSource: "gitContext", text: input.gitContext.trim() };
  return { intentSource: "vision-only", text: "" };
}

// --- Prompt + parsing (pure, unit-tested) ---

export function buildReviewPrompt(intent: ResolvedIntent): string {
  const head =
    "You are reviewing a failed visual regression test. You are shown the BASELINE " +
    "(before), the ACTUAL (after), and optionally a DIFF heatmap. Decide whether the " +
    "change is an INTENDED change (accept = safe to update the baseline) or a " +
    "REGRESSION (reject). If you cannot tell, answer unsure.\n\n" +
    "Reply in EXACTLY this format:\n" +
    "VERDICT: accept | reject | unsure\n" +
    "CONFIDENCE: <0.0-1.0>\n" +
    "REASON: <one sentence>\n\n";
  const intentLine =
    intent.intentSource === "vision-only"
      ? "There is no declared intent — judge from the images alone and keep CONFIDENCE modest."
      : `Declared intended change (${intent.intentSource}):\n${intent.text}\n` +
        "If the visual change matches this intent, lean accept; if it contradicts or adds " +
        "unrelated breakage, lean reject.";
  return head + intentLine;
}

export function parseReview(content: string, intentSource: IntentSource, costUsd: number): VrtReview {
  const verdictMatch = content.match(/VERDICT:\s*(accept|reject|unsure)/i);
  const confMatch = content.match(/CONFIDENCE:\s*([0-9]*\.?[0-9]+)/i);
  const reasonMatch = content.match(/REASON:\s*(.+)/i);
  const verdict = (verdictMatch?.[1]?.toLowerCase() as ReviewVerdict) ?? "unsure";
  let confidence = confMatch ? parseFloat(confMatch[1]) : 0;
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));
  return {
    verdict,
    confidence,
    reason: reasonMatch?.[1]?.trim() ?? "",
    intentSource,
    costUsd,
  };
}

// --- The judge (LLM call; judgment only, no side effects on baselines) ---

export async function reviewVrtDiff(input: VrtReviewInput): Promise<VrtReview> {
  const intent = resolveIntent(input);
  const prompt = buildReviewPrompt(intent);
  const imgs: Array<{ label: string; png: Buffer }> = [
    { label: "BASELINE (before)", png: input.baselinePng },
    { label: "ACTUAL (after)", png: input.actualPng },
    ...(input.diffPng ? [{ label: "DIFF heatmap", png: input.diffPng }] : []),
  ];

  if (input.tier.baseURL) {
    const res = await callOpenAICompat(input.tier, prompt, imgs, process.env.VLMKIT_HEAL_BASEURL_KEY);
    return parseReview(res.content, intent.intentSource, billedCost(input.tier, 0, res));
  }

  const client = createUnifiedLLMClient({ provider: input.tier.provider, model: input.tier.model, vision: true });
  if (!client) throw new Error(`no API key for provider "${input.tier.provider}" (model ${input.tier.model})`);
  const content = [
    { type: "text" as const, text: prompt },
    ...imgs.flatMap((i) => [
      { type: "text" as const, text: `${i.label}:` },
      { type: "image" as const, base64: i.png.toString("base64"), mimeType: "image/png" },
    ]),
  ];
  const res = await client.completeWithImages(content);
  return parseReview(res.content, intent.intentSource, billedCost(input.tier, res.costUsd, res));
}

// Multi-image OpenAI-compatible chat call (for a tier.baseURL self-hosted VLM).
async function callOpenAICompat(
  tier: ModelTier,
  prompt: string,
  imgs: Array<{ label: string; png: Buffer }>,
  apiKey?: string,
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const content = [
    { type: "text", text: prompt },
    ...imgs.flatMap((i) => [
      { type: "text", text: `${i.label}:` },
      { type: "image_url", image_url: { url: `data:image/png;base64,${i.png.toString("base64")}` } },
    ]),
  ];
  const url = `${tier.baseURL!.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: tier.model, max_tokens: 512, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`${tier.baseURL} error: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return {
    content: j.choices?.[0]?.message?.content ?? "",
    promptTokens: j.usage?.prompt_tokens ?? 0,
    completionTokens: j.usage?.completion_tokens ?? 0,
  };
}
