/**
 * The zoom loop, independent of any provider: show the model its images at a size we chose,
 * give it one tool — `zoom(image, x1, y1, x2, y2)` — and answer each call with a magnified crop
 * of the original, until it answers the question or spends its zoom budget.
 *
 * A provider enters only through `VisionChatDriver`: one function that takes the transcript so
 * far and returns the model's next turn. Two ways for the model to ask for a zoom, so any vision
 * model can use it:
 *
 *   - `native`: the provider's own function calling (OpenAI-compatible `tools`, Anthropic
 *     `tool_use`, Gemini `functionCall`). The driver declares `nativeTools`.
 *   - `text`: a protocol in the reply itself — a line `ZOOM <image> <x1> <y1> <x2> <y2>` —
 *     for models with no function calling (most small open VLMs). `parseZoomRequests` reads it.
 *
 * How a result carries its image is the driver's business, because providers disagree: some
 * accept an image inside the tool result, OpenAI-compatible APIs only accept text there, so
 * those drivers send the crop as a user image right after it. The loop hands every driver the
 * same `ZoomResult`.
 */
import {
  DEFAULT_IMAGE_BUDGET,
  toViewBox,
  type Box,
  type ImageBudget,
  type ZoomCoordinates,
} from "./zoom-geometry.ts";
import { prepareZoomSource, zoomInto, type ZoomSource } from "./zoom-image.ts";

export type ZoomPart = { type: "text"; text: string } | { type: "image"; png: Buffer };

export interface ZoomCall {
  /** Provider call id (native), or a synthetic one (text protocol). */
  id: string;
  imageIndex: number;
  box: Box;
  /** Set when the provider's arguments did not parse; the loop answers with it. */
  error?: string;
}

export interface ZoomResult {
  callId: string;
  /** Text first, then the magnified crop when the zoom succeeded. */
  parts: ZoomPart[];
  isError: boolean;
}

export type ZoomTurn =
  | { role: "user"; parts: ZoomPart[] }
  | {
    role: "assistant";
    text: string;
    calls: ZoomCall[];
    /** The provider's own assistant message, so a driver can replay it verbatim. */
    raw?: unknown;
  }
  | {
    role: "tool";
    /** True when the results answer native function calls; false for the text protocol. */
    native: boolean;
    results: ZoomResult[];
  };

export interface ZoomUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface DriverTurn {
  text: string;
  calls: ZoomCall[];
  raw?: unknown;
  usage?: ZoomUsage;
  /** The provider stopped for its own reason (length, refusal) — not a finished answer. */
  stop?: string;
}

export interface ZoomToolSpec {
  name: "zoom";
  description: string;
  /** JSON Schema of the arguments. */
  parameters: Record<string, unknown>;
}

export interface VisionChatDriver {
  model: string;
  /** True when the driver maps `ZoomToolSpec` onto the provider's function calling. */
  nativeTools: boolean;
  /** `tool` is omitted on the wrap-up turn, when the model must answer from what it has seen. */
  turn(transcript: readonly ZoomTurn[], options: { tool?: ZoomToolSpec; maxTokens: number }): Promise<DriverTurn>;
}

export interface ZoomImageInput {
  png: Buffer;
  /** Shown before the image, e.g. "Baseline screenshot". */
  label?: string;
}

export interface ZoomLoopOptions {
  /** Zoom calls allowed before the model must answer (default 6). */
  maxZooms?: number;
  maxTokens?: number;
  budget?: ImageBudget;
  coordinates?: ZoomCoordinates;
  /** Force the text protocol even when the driver has native tools. */
  protocol?: "native" | "text";
}

export interface ZoomLoopResult {
  answer: string;
  zooms: { imageIndex: number; viewBox: Box; originalBox: Box }[];
  /** Calls the loop refused (bad box, unknown image) — told to the model, not thrown. */
  rejected: { call: ZoomCall; reason: string }[];
  turns: number;
  /** True when the zoom budget ran out and the model was asked to answer. */
  wrappedUp: boolean;
  protocol: "native" | "text";
  usage: ZoomUsage;
  /** Set when the provider stopped for its own reason on the last turn. */
  stop?: string;
}

export function zoomToolSpec(imageCount: number, coordinates: ZoomCoordinates): ZoomToolSpec {
  const unit = coordinates === "pixels"
    ? "in pixels of the image as you see it (origin top-left, x right, y down)"
    : "as 0-1000 of the image's width (x) and height (y), origin top-left";
  return {
    name: "zoom",
    description:
      "Crop a region of an image and see it magnified from the full-resolution original. "
      + "Use it for any detail too small to read with confidence: small text, thin lines, the exact colour or edge of an element.",
    parameters: {
      type: "object",
      properties: {
        ...(imageCount > 1
          ? { image_index: { type: "integer", description: `Which image, counting from 0 (0-${imageCount - 1})` } }
          : {}),
        x1: { type: "number", description: `Left edge, ${unit}` },
        y1: { type: "number", description: "Top edge" },
        x2: { type: "number", description: "Right edge (greater than x1)" },
        y2: { type: "number", description: "Bottom edge (greater than y1)" },
      },
      required: ["x1", "y1", "x2", "y2"],
      additionalProperties: false,
    },
  };
}

/** Arguments a native call carried, whatever shape the provider gave them in. */
export function zoomCallFromArgs(id: string, args: unknown): ZoomCall | { id: string; error: string } {
  let value = args;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return { id, error: "arguments are not valid JSON" }; }
  }
  const a = (value ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof a[k] === "number" ? a[k] as number : typeof a[k] === "string" ? Number(a[k]) : NaN);
  const box = { x1: num("x1"), y1: num("y1"), x2: num("x2"), y2: num("y2") };
  if (![box.x1, box.y1, box.x2, box.y2].every(Number.isFinite)) return { id, error: "x1, y1, x2 and y2 are required numbers" };
  const index = a.image_index === undefined ? 0 : num("image_index");
  return { id, imageIndex: Number.isFinite(index) ? Math.trunc(index) : NaN, box };
}

const ZOOM_LINE = /^\s*ZOOM\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/gim;

/**
 * Zoom requests written in a reply, one `ZOOM <image> <x1> <y1> <x2> <y2>` per line. The
 * image index is always written, even with one image, so the grammar has one shape.
 */
export function parseZoomRequests(text: string, turn: number): ZoomCall[] {
  const calls: ZoomCall[] = [];
  for (const m of text.matchAll(ZOOM_LINE)) {
    calls.push({
      id: `text-${turn}-${calls.length}`,
      imageIndex: Math.trunc(Number(m[1])),
      box: { x1: Number(m[2]), y1: Number(m[3]), x2: Number(m[4]), y2: Number(m[5]) },
    });
  }
  return calls;
}

function textProtocolInstructions(coordinates: ZoomCoordinates): string {
  const unit = coordinates === "pixels" ? "pixels of the image as you see it" : "0-1000 of the image's width and height";
  return "You can zoom: to see a region magnified from the full-resolution original, reply with only lines of the form\n"
    + "ZOOM <image> <x1> <y1> <x2> <y2>\n"
    + `where <image> counts from 0 and the box is in ${unit} (origin top-left). `
    + "You will get the magnified regions back. When you can answer, reply with the answer and no ZOOM line.";
}

/**
 * Run the loop. `images` are PNGs at any size; each is shown at `budget` and labelled with its
 * index and size. The answer is the model's last reply with no zoom request.
 */
export async function runZoomLoop(
  driver: VisionChatDriver,
  images: readonly ZoomImageInput[],
  question: string,
  options: ZoomLoopOptions = {},
): Promise<ZoomLoopResult> {
  if (images.length === 0) throw new RangeError("runZoomLoop needs at least one image");
  const budget = options.budget ?? DEFAULT_IMAGE_BUDGET;
  const coordinates = options.coordinates ?? "pixels";
  const maxZooms = Math.max(0, options.maxZooms ?? 6);
  const maxTokens = options.maxTokens ?? 2048;
  const protocol: "native" | "text" = options.protocol ?? (driver.nativeTools ? "native" : "text");
  if (protocol === "native" && !driver.nativeTools) throw new Error(`${driver.model}: this driver has no native tools; use protocol "text"`);

  const sources: ZoomSource[] = images.map((img) => prepareZoomSource(img.png, budget));
  const intro: ZoomPart[] = [];
  sources.forEach((src, i) => {
    const label = images[i]!.label ? `${images[i]!.label} — ` : "";
    intro.push({ type: "text", text: `${label}Image ${i} (${src.view.width}x${src.view.height} pixels):` });
    intro.push({ type: "image", png: src.viewPng });
  });
  const coordNote = coordinates === "pixels"
    ? "Coordinates are absolute pixels of the image as shown, origin top-left."
    : "Coordinates are 0-1000 of each image's width and height, origin top-left.";
  intro.push({
    type: "text",
    text: `${question}\n\n${coordNote} ${protocol === "native"
      ? "Use the zoom tool to examine any detail too small to read confidently."
      : textProtocolInstructions(coordinates)}`,
  });

  const transcript: ZoomTurn[] = [{ role: "user", parts: intro }];
  const tool = zoomToolSpec(images.length, coordinates);
  const usage: ZoomUsage = { promptTokens: 0, completionTokens: 0 };
  const zooms: ZoomLoopResult["zooms"] = [];
  const rejected: ZoomLoopResult["rejected"] = [];
  let turns = 0;
  let wrappedUp = false;

  for (;;) {
    const offerTool = !wrappedUp;
    const reply = await driver.turn(transcript, {
      ...(offerTool && protocol === "native" ? { tool } : {}),
      maxTokens,
    });
    turns++;
    usage.promptTokens += reply.usage?.promptTokens ?? 0;
    usage.completionTokens += reply.usage?.completionTokens ?? 0;
    const calls = protocol === "native" ? reply.calls : parseZoomRequests(reply.text, turns);
    const done = (answer: string) => ({
      answer, zooms, rejected, turns, wrappedUp, protocol, usage,
      ...(reply.stop ? { stop: reply.stop } : {}),
    });
    if (calls.length === 0 || wrappedUp) {
      return done(protocol === "text" ? reply.text.replace(ZOOM_LINE, "").trim() : reply.text.trim());
    }
    transcript.push({ role: "assistant", text: reply.text, calls, ...(reply.raw !== undefined ? { raw: reply.raw } : {}) });

    const results: ZoomResult[] = [];
    for (const call of calls) {
      if (zooms.length >= maxZooms) {
        results.push({ callId: call.id, isError: true, parts: [{ type: "text", text: "Zoom budget used up; answer from what you have seen." }] });
        continue;
      }
      if (call.error) {
        rejected.push({ call, reason: call.error });
        results.push({ callId: call.id, isError: true, parts: [{ type: "text", text: `Error: ${call.error}` }] });
        continue;
      }
      const source = sources[call.imageIndex];
      if (!source) {
        const reason = `no image ${call.imageIndex} (there are ${sources.length}, counting from 0)`;
        rejected.push({ call, reason });
        results.push({ callId: call.id, isError: true, parts: [{ type: "text", text: `Error: ${reason}` }] });
        continue;
      }
      const outcome = zoomInto(source, toViewBox(call.box, source.view, coordinates), budget);
      if (!outcome.ok) {
        rejected.push({ call, reason: outcome.text });
        results.push({ callId: call.id, isError: true, parts: [{ type: "text", text: outcome.text }] });
        continue;
      }
      zooms.push({ imageIndex: call.imageIndex, viewBox: outcome.viewBox, originalBox: outcome.originalBox });
      results.push({ callId: call.id, isError: false, parts: [{ type: "text", text: outcome.text }, { type: "image", png: outcome.png }] });
    }
    transcript.push({ role: "tool", native: protocol === "native", results });
    // A model that keeps naming boxes the loop refuses would never spend its budget; the turn
    // cap ends that the same way the budget does.
    if (zooms.length >= maxZooms || turns >= maxZooms + 3) {
      wrappedUp = true;
      transcript.push({
        role: "user",
        parts: [{ type: "text", text: "You have used your zoom budget. Answer the original question now, based on everything you have seen." }],
      });
    }
  }
}
