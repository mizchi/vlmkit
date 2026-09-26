/**
 * Drivers: the zoom loop's transcript rendered onto three wire formats. Each is a plain `fetch`
 * against the provider's public REST endpoint — the same way the rest of `vlm-client.ts` calls
 * them — so no SDK is required and a test can hand in its own `fetch`.
 *
 *   - `openAiCompatibleDriver`  OpenAI Chat Completions shape: OpenRouter (100+ vision models),
 *                               and any self-hosted server that speaks it (vLLM, Ollama, LM Studio).
 *   - `anthropicDriver`         Messages API.
 *   - `geminiDriver`            Gemini `generateContent`.
 *
 * Where they differ is exactly where a zoom result goes. Anthropic accepts an image inside a
 * `tool_result`; Gemini accepts an image part beside a `functionResponse`; OpenAI-compatible
 * APIs accept only text in a `tool` message, so the magnified crop follows it as a user image,
 * labelled with the call it answers. The text protocol needs none of this: its results are an
 * ordinary user message of text and images.
 */
import type {
  DriverTurn,
  VisionChatDriver,
  ZoomCall,
  ZoomPart,
  ZoomResult,
  ZoomToolSpec,
  ZoomTurn,
} from "./zoom-loop.ts";
import { zoomCallFromArgs } from "./zoom-loop.ts";

type Fetch = typeof fetch;

async function postJson(fetcher: Fetch, url: string, headers: Record<string, string>, body: unknown, provider: string): Promise<any> {
  const res = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${provider} API error: ${res.status} ${text.slice(0, 300)}`);
  }
  return await res.json();
}

/** A call the provider made whose arguments did not parse still needs an answer; this one says why. */
function callsFrom(parsed: (ZoomCall | { id: string; error: string })[]): { calls: ZoomCall[]; broken: { id: string; error: string }[] } {
  const calls: ZoomCall[] = [];
  const broken: { id: string; error: string }[] = [];
  for (const p of parsed) ("error" in p ? broken : calls).push(p as never);
  return { calls, broken };
}

/** Merge adjacent messages of one role: every provider accepts that, not every one accepts the split. */
function mergeAdjacent<T extends { role: string }>(messages: T[], join: (a: T, b: T) => T): T[] {
  const out: T[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) out[out.length - 1] = join(last, m);
    else out.push(m);
  }
  return out;
}

const b64 = (png: Buffer) => png.toString("base64");

// ---------------------------------------------------------------------------
// OpenAI-compatible (OpenRouter, vLLM, Ollama, LM Studio, …)

export interface OpenAiCompatibleDriverOptions {
  model: string;
  apiKey?: string;
  /** Chat Completions URL (default OpenRouter's). */
  url?: string;
  headers?: Record<string, string>;
  /** False for a server without function calling: the loop then uses the text protocol. */
  nativeTools?: boolean;
  fetch?: Fetch;
}

export function openAiCompatibleDriver(options: OpenAiCompatibleDriverOptions): VisionChatDriver {
  const url = options.url ?? "https://openrouter.ai/api/v1/chat/completions";
  const fetcher = options.fetch ?? fetch;
  const headers = {
    ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    ...options.headers,
  };
  const content = (parts: ZoomPart[]) => parts.map((p) => p.type === "text"
    ? { type: "text", text: p.text }
    : { type: "image_url", image_url: { url: `data:image/png;base64,${b64(p.png)}` } });

  type Msg = { role: string; content?: unknown; tool_calls?: unknown; tool_call_id?: string };
  const render = (transcript: readonly ZoomTurn[]): Msg[] => {
    const out: Msg[] = [];
    for (const t of transcript) {
      if (t.role === "user") out.push({ role: "user", content: content(t.parts) });
      else if (t.role === "assistant") {
        out.push(t.raw !== undefined
          ? t.raw as Msg
          : { role: "assistant", content: t.text });
      } else if (t.native) {
        // Native results: text in the tool message, the image in a user message after them.
        const images: ZoomPart[] = [];
        for (const r of t.results) {
          out.push({ role: "tool", tool_call_id: r.callId, content: textOf(r) });
          const img = r.parts.filter((p) => p.type === "image");
          if (img.length > 0) images.push({ type: "text", text: `Zoom result for call ${r.callId}:` }, ...img);
        }
        if (images.length > 0) out.push({ role: "user", content: content(images) });
      } else {
        out.push({ role: "user", content: content(t.results.flatMap((r) => r.parts)) });
      }
    }
    return out;
  };

  return {
    model: options.model,
    nativeTools: options.nativeTools ?? true,
    async turn(transcript, { tool, maxTokens }) {
      const data = await postJson(fetcher, url, headers, {
        model: options.model,
        max_tokens: maxTokens,
        messages: render(transcript),
        ...(tool ? { tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }] } : {}),
      }, "OpenAI-compatible");
      const choice = data.choices?.[0];
      const message = choice?.message ?? {};
      const toolCalls: { id: string; function?: { name?: string; arguments?: unknown } }[] = message.tool_calls ?? [];
      const { calls, broken } = callsFrom(toolCalls
        .filter((c) => c.function?.name === "zoom")
        .map((c) => zoomCallFromArgs(c.id, c.function?.arguments)));
      return withBroken({
        text: typeof message.content === "string" ? message.content : "",
        calls,
        raw: { role: "assistant", content: message.content ?? null, ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) },
        usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0 },
        ...(choice?.finish_reason && !["stop", "tool_calls"].includes(choice.finish_reason) ? { stop: choice.finish_reason } : {}),
      }, broken);
    },
  };
}

// ---------------------------------------------------------------------------
// Anthropic Messages API

export interface AnthropicDriverOptions {
  model: string;
  apiKey: string;
  /** Default https://api.anthropic.com (or ANTHROPIC_BASE_URL when the caller passes it). */
  baseUrl?: string;
  fetch?: Fetch;
}

export function anthropicDriver(options: AnthropicDriverOptions): VisionChatDriver {
  const url = `${(options.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;
  const fetcher = options.fetch ?? fetch;
  const blocks = (parts: ZoomPart[]) => parts.map((p) => p.type === "text"
    ? { type: "text", text: p.text }
    : { type: "image", source: { type: "base64", media_type: "image/png", data: b64(p.png) } });

  type Msg = { role: "user" | "assistant"; content: unknown[] };
  const render = (transcript: readonly ZoomTurn[]): Msg[] => {
    const out: Msg[] = [];
    for (const t of transcript) {
      if (t.role === "user") out.push({ role: "user", content: blocks(t.parts) });
      else if (t.role === "assistant") {
        out.push({
          role: "assistant",
          content: t.raw !== undefined
            ? t.raw as unknown[]
            : [
              ...(t.text ? [{ type: "text", text: t.text }] : []),
              ...t.calls.filter((c) => !c.id.startsWith("text-")).map((c) => ({ type: "tool_use", id: c.id, name: "zoom", input: { image_index: c.imageIndex, ...c.box } })),
            ],
        });
      } else if (t.native) {
        out.push({
          role: "user",
          content: t.results.map((r) => ({ type: "tool_result", tool_use_id: r.callId, content: blocks(r.parts), ...(r.isError ? { is_error: true } : {}) })),
        });
      } else {
        out.push({ role: "user", content: blocks(t.results.flatMap((r) => r.parts)) });
      }
    }
    return mergeAdjacent(out, (a, b) => ({ role: a.role, content: [...a.content, ...b.content] }));
  };

  return {
    model: options.model,
    nativeTools: true,
    async turn(transcript, { tool, maxTokens }) {
      const data = await postJson(fetcher, url, { "x-api-key": options.apiKey, "anthropic-version": "2023-06-01" }, {
        model: options.model,
        max_tokens: maxTokens,
        messages: render(transcript),
        ...(tool ? { tools: [{ name: tool.name, description: tool.description, input_schema: tool.parameters }] } : {}),
      }, "Anthropic");
      const content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] = data.content ?? [];
      const { calls, broken } = callsFrom(content
        .filter((b) => b.type === "tool_use" && b.name === "zoom")
        .map((b) => zoomCallFromArgs(b.id!, b.input)));
      return withBroken({
        text: content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
        calls,
        raw: content,
        usage: { promptTokens: data.usage?.input_tokens ?? 0, completionTokens: data.usage?.output_tokens ?? 0 },
        ...(data.stop_reason && !["end_turn", "tool_use", "stop_sequence"].includes(data.stop_reason) ? { stop: data.stop_reason } : {}),
      }, broken);
    },
  };
}

// ---------------------------------------------------------------------------
// Gemini generateContent

export interface GeminiDriverOptions {
  /** e.g. `gemini-2.5-flash` (no `gemini:` prefix). */
  model: string;
  apiKey: string;
  baseUrl?: string;
  fetch?: Fetch;
}

/** Gemini's function schemas are an OpenAPI subset without `additionalProperties`. */
function geminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { additionalProperties: _drop, ...rest } = schema;
  return rest;
}

export function geminiDriver(options: GeminiDriverOptions): VisionChatDriver {
  const base = (options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const url = `${base}/models/${encodeURIComponent(options.model)}:generateContent`;
  const fetcher = options.fetch ?? fetch;
  const parts = (ps: ZoomPart[]) => ps.map((p) => p.type === "text"
    ? { text: p.text }
    : { inlineData: { mimeType: "image/png", data: b64(p.png) } });

  type Msg = { role: "user" | "model"; parts: unknown[] };
  const render = (transcript: readonly ZoomTurn[]): Msg[] => {
    const out: Msg[] = [];
    for (const t of transcript) {
      if (t.role === "user") out.push({ role: "user", parts: parts(t.parts) });
      else if (t.role === "assistant") {
        out.push({
          role: "model",
          parts: t.raw !== undefined
            ? t.raw as unknown[]
            : [
              ...(t.text ? [{ text: t.text }] : []),
              ...t.calls.filter((c) => !c.id.startsWith("text-")).map((c) => ({ functionCall: { name: "zoom", args: { image_index: c.imageIndex, ...c.box } } })),
            ],
        });
      } else if (t.native) {
        out.push({
          role: "user",
          parts: t.results.flatMap((r) => [
            { functionResponse: { name: "zoom", response: { result: textOf(r), ...(r.isError ? { error: true } : {}) } } },
            ...parts(r.parts.filter((p) => p.type === "image")),
          ]),
        });
      } else {
        out.push({ role: "user", parts: parts(t.results.flatMap((r) => r.parts)) });
      }
    }
    return mergeAdjacent(out, (a, b) => ({ role: a.role, parts: [...a.parts, ...b.parts] }));
  };

  return {
    model: options.model,
    nativeTools: true,
    async turn(transcript, { tool, maxTokens }) {
      const data = await postJson(fetcher, url, { "x-goog-api-key": options.apiKey }, {
        contents: render(transcript),
        generationConfig: { maxOutputTokens: maxTokens },
        ...(tool ? { tools: [{ functionDeclarations: [{ name: tool.name, description: tool.description, parameters: geminiSchema(tool.parameters) }] }] } : {}),
      }, "Gemini");
      const candidate = data.candidates?.[0];
      const ps: { text?: string; functionCall?: { name?: string; args?: unknown } }[] = candidate?.content?.parts ?? [];
      // Gemini function calls carry no id; the call's position in the turn is one.
      const { calls, broken } = callsFrom(ps
        .filter((p) => p.functionCall?.name === "zoom")
        .map((p, i) => zoomCallFromArgs(`gemini-${i}`, p.functionCall!.args)));
      return withBroken({
        text: ps.map((p) => p.text ?? "").join(""),
        calls,
        raw: ps,
        usage: { promptTokens: data.usageMetadata?.promptTokenCount ?? 0, completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0 },
        ...(candidate?.finishReason && candidate.finishReason !== "STOP" ? { stop: candidate.finishReason } : {}),
      }, broken);
    },
  };
}

// ---------------------------------------------------------------------------

function textOf(r: ZoomResult): string {
  return r.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
}

/**
 * A native call whose arguments did not parse still travels as a call, carrying its error, so
 * the loop answers it with a message the model can act on instead of dropping it — an
 * unanswered tool call is a 400 on the next request with every provider.
 */
function withBroken(turn: DriverTurn, broken: { id: string; error: string }[]): DriverTurn {
  if (broken.length === 0) return turn;
  return { ...turn, calls: [...turn.calls, ...broken.map((b) => ({ id: b.id, imageIndex: 0, box: { x1: 0, y1: 0, x2: 0, y2: 0 }, error: b.error }))] };
}

export type { ZoomToolSpec };
