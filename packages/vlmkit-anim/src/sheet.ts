/**
 * A contact sheet: every sampled frame on one image, in reading order, each
 * tile labelled with its step number, time and caption.
 *
 * This is the form to hand a vision model when the question is "does this
 * animation explain the thing?" — one call, the whole story visible at once,
 * and the labels tie the model's answer back to a step. It is NOT the form for
 * correctness (the checker reads that back from frames deterministically), and
 * it degrades when tiles get small: keep the tile width at 300px or more and
 * the frame count around a dozen, or a VLM stops reading the labels inside
 * the frames. `vlmkit check animation --strip` is the same idea applied to an
 * arbitrary page's animations.
 */

import { renderFrameSvg } from "./render-svg.ts";
import { currentCaption, currentStep } from "./timeline.ts";
import type { Timeline } from "./types.ts";

export interface SheetOptions {
  /** Tiles per row. Default 3. */
  cols?: number;
  /** CSS width of one tile in px; height follows the canvas aspect. Default 400. */
  tileWidth?: number;
  title?: string;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSheetHtml(tl: Timeline, times: number[], opts: SheetOptions = {}): string {
  const cols = Math.max(1, opts.cols ?? 3);
  const tileWidth = Math.max(120, opts.tileWidth ?? 400);
  const title = opts.title ?? String(tl.meta?.title ?? tl.meta?.kind ?? "animation");
  const tiles = times
    .map((t, i) => {
      const step = currentStep(tl, t);
      const caption = currentCaption(tl, t) ?? "";
      const label = `${i + 1}${step ? ` · step ${step.index + 1}` : ""} · ${Math.round(t)}ms`;
      // Captions are drawn under the tile, so the frame itself is rendered without one.
      const svg = renderFrameSvg(tl, t, { caption: false }).replace(/ width="[\d.]+" height="[\d.]+"/, "");
      return `<figure><div class="frame">${svg}</div><figcaption><b>${esc(label)}</b>${caption ? `<span>${esc(caption)}</span>` : ""}</figcaption></figure>`;
    })
    .join("\n");
  const gap = 12;
  const width = cols * tileWidth + (cols + 1) * gap;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)} — sheet</title>
<style>
  body { margin: 0; width: ${width}px; background: #fff; color: #1f2328; font-family: system-ui, sans-serif; }
  h1 { font-size: 15px; font-weight: 600; margin: 0; padding: ${gap}px ${gap}px 0; }
  main { display: grid; grid-template-columns: repeat(${cols}, ${tileWidth}px); gap: ${gap}px; padding: ${gap}px; }
  figure { margin: 0; border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; background: #fff; }
  .frame svg { display: block; width: ${tileWidth}px; height: auto; }
  figcaption { border-top: 1px solid #d0d7de; padding: 6px 8px; font-size: 12px; line-height: 1.35; display: flex; flex-direction: column; gap: 2px; min-height: 2.9em; }
  figcaption b { color: #57606a; font-weight: 600; }
</style></head>
<body><h1>${esc(title)} — ${times.length} frames</h1><main>
${tiles}
</main></body></html>
`;
}
