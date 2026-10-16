/**
 * TypeSafe's Jev (System One): typed questions about a state, typed answers back. No prose.
 *
 * Jev generates no text. A request is a `state` (text, objects, images) and a map of questions,
 * each one of four types, and every answer is a value the caller can use as is:
 *
 *   - `box`    → one bounding box, edges as fractions of the image (0-1, top-left origin) + confidence
 *   - `noul`   → the probability a statement is true (0-1)
 *   - `choice` → one option key + a probability per option + confidence
 *   - `score`  → a position on an ordered rubric + a probability per level + confidence
 *
 * That shape is why it fits vlmkit's judges and benches: nothing here parses a reply. Images and
 * `box` are behind `TypeSafe-Danger-Zone-Images: true` (Jev 1.14 for `box`); docs
 * https://docs.typesafe.ai/go/images and https://docs.typesafe.ai/go/box.
 *
 * Images are referenced, not inlined: each asset has a key, and any string in `state`,
 * `instructions` or `criteria` that equals (or contains) the key becomes that image. Every asset
 * must be referenced, and each reference adds a copy to what the model reads — put a shared image
 * in `state` once rather than in every question's instructions.
 */
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_DEFAULT_MODEL = "jev-1.14.0";
/** USD per input token ($42 per billion, 2026-10). Output tokens are free. */
export const JEV_INPUT_USD_PER_TOKEN = 42e-9;

/** Images outside these are rejected by the API, not resized (docs.typesafe.ai/go/images). */
export const JEV_IMAGE_LIMITS = {
  minEdge: 280,
  maxEdge: 1568,
  minPixels: 78_400,
  maxPixels: 2_458_624,
  maxFileBytes: 16 * 1024 * 1024,
} as const;

export type JevQuestion =
  | { type: "box"; instructions: string }
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: readonly string[] };

/** Edges as fractions of the image: left/right of its width, top/bottom of its height. */
export interface JevBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type JevAnswer =
  | { type: "box"; box: JevBox; confidence: number }
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | {
      type: "score";
      score: number;
      confidence: number;
      probabilities: Record<string, number>;
      legend?: Record<string, string>;
    };

export interface JevImage {
  bytes: Uint8Array;
  format: "png" | "jpg" | "jpeg";
}

export interface JevRequest<Q extends Record<string, JevQuestion> = Record<string, JevQuestion>> {
  model?: string;
  state: unknown;
  /** Reference key → image. Every key must appear somewhere in `state` or a question. */
  assets?: Record<string, JevImage>;
  questions: Q;
}

export interface JevResponse<Q extends Record<string, JevQuestion> = Record<string, JevQuestion>> {
  model: string;
  answers: { [K in keyof Q]: Extract<JevAnswer, { type: Q[K]["type"] }> };
  usage: { input_tokens: number; output_tokens: number };
  latencyMs: number;
  costUsd: number;
}

export interface JevClientOptions {
  apiKey?: string;
  endpoint?: string;
  /** Extra headers; `Danger-Zone-Long-Context` goes here when wanted. */
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  /** Retries on 429 / 5xx, honouring `retry-after` (default 3). */
  retries?: number;
  signal?: AbortSignal;
}

export class JevApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Jev API ${status}: ${body.slice(0, 500)}`);
    this.name = "JevApiError";
  }
}

/** Why an image would be refused, or null. Checked locally so a bench fails before it spends. */
export function jevImageProblem(width: number, height: number, bytes?: number): string | null {
  const L = JEV_IMAGE_LIMITS;
  if (width < L.minEdge || height < L.minEdge) return `${width}x${height}: each edge must be >= ${L.minEdge}px`;
  if (width > L.maxEdge || height > L.maxEdge) return `${width}x${height}: each edge must be <= ${L.maxEdge}px`;
  const px = width * height;
  if (px < L.minPixels || px > L.maxPixels)
    return `${width}x${height}: ${px} pixels outside ${L.minPixels}-${L.maxPixels}`;
  if (bytes !== undefined && bytes > L.maxFileBytes) return `${bytes} bytes exceeds ${L.maxFileBytes}`;
  return null;
}

export function pngImage(bytes: Uint8Array): JevImage {
  return { bytes, format: "png" };
}

/** Width and height from a PNG's IHDR, without decoding it. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** A box answer in the pixel space of an image of `width` x `height`. */
export function jevBoxToPixels(box: JevBox, width: number, height: number) {
  return { x1: box.left * width, y1: box.top * height, x2: box.right * width, y2: box.bottom * height };
}

/** The multipart body: a `request` JSON part, then one file part per asset (`a0`, `a1`, …). */
export function buildJevForm(req: JevRequest): FormData {
  const assets: Record<string, { type: "image"; part: string }> = {};
  const form = new FormData();
  const files: [string, Blob][] = [];
  Object.entries(req.assets ?? {}).forEach(([key, img], i) => {
    const part = `a${i}`;
    assets[key] = { type: "image", part };
    const mime = img.format === "png" ? "image/png" : "image/jpeg";
    files.push([part, new Blob([img.bytes as Uint8Array<ArrayBuffer>], { type: mime })]);
  });
  const body = { model: req.model ?? JEV_DEFAULT_MODEL, state: req.state, assets, questions: req.questions };
  form.append("request", new Blob([JSON.stringify(body)], { type: "application/json" }));
  for (const [part, blob] of files) form.append(part, blob, part);
  return form;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function askJev<Q extends Record<string, JevQuestion>>(
  req: JevRequest<Q>,
  options: JevClientOptions = {},
): Promise<JevResponse<Q>> {
  const apiKey = options.apiKey ?? process.env.TYPESAFEAI_API_KEY ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("Jev needs TYPESAFEAI_API_KEY (console.typesafe.ai/keys)");
  const hasImages = Object.keys(req.assets ?? {}).length > 0;
  const hasBox = Object.values(req.questions).some((q) => q.type === "box");
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, ...options.headers };
  if (hasImages || hasBox) headers["TypeSafe-Danger-Zone-Images"] = "true";
  const doFetch = options.fetch ?? fetch;
  const retries = options.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    const res = await doFetch(options.endpoint ?? JEV_ENDPOINT, {
      method: "POST",
      headers,
      body: buildJevForm(req),
      signal: options.signal,
    });
    const latencyMs = performance.now() - started;
    if (res.ok) {
      const json = (await res.json()) as Omit<JevResponse<Q>, "latencyMs" | "costUsd">;
      return { ...json, latencyMs, costUsd: json.usage.input_tokens * JEV_INPUT_USD_PER_TOKEN };
    }
    const text = await res.text();
    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
      const after = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt);
      continue;
    }
    throw new JevApiError(res.status, text);
  }
}

/** Decode-free sanity: a PNG Buffer that Jev would accept, or the reason it would not. */
export function checkPngForJev(bytes: Uint8Array): string | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return "not a PNG";
  const { width, height } = pngSize(bytes);
  return jevImageProblem(width, height, bytes.length);
}
