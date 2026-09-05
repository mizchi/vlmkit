/**
 * Deterministic layout reading of a timeline: at every step, which visible
 * texts sit on top of each other or on a filled box that is not their own, and
 * which run past the canvas edge.
 *
 * v11 found the first defects in ten rounds that a clean `check` did not catch
 * and a frame did — a title clipped at the left edge, a group label on a
 * column header, a relation label under a readout. This is the measurement
 * that reads those back from the compiled timeline, with the same box
 * estimates the compiler lays things out by, so a vision model's reading of a
 * contact sheet (`review.ts`) has something exact to be compared against.
 *
 * It is an estimate: text widths come from an average glyph width, not a font.
 * Overlaps count only when the intersection is a real fraction of the smaller
 * box, so two labels that touch corners are not an issue.
 */

import { sampleTimes } from "./render-svg.ts";
import { currentStep, sampleFrame, type NodeState } from "./timeline.ts";
import type { Timeline, TimelineNode } from "./types.ts";

export interface LayoutBox {
  id: string;
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutIssue {
  kind: "overlap" | "clipped";
  /** The nodes involved: two for an overlap (text first), one for a clipped text. */
  nodes: string[];
  /** Their texts, for a human or a scorer. */
  texts: string[];
  /** overlap: intersection area over the smaller box's area (0..1). clipped: pixels past the edge. */
  amount: number;
}

export interface LayoutFrame {
  index: number;
  t: number;
  step?: { index: number; caption?: string };
  issues: LayoutIssue[];
}

export interface LayoutReport {
  frames: LayoutFrame[];
  totals: { frames: number; framesWithIssues: number; overlaps: number; clipped: number };
}

export interface LayoutOptions {
  /** Intersection over the smaller box below which an overlap is not reported. Default 0.2. */
  minOverlap?: number;
  /** Pixels past the canvas edge below which a text is not reported as clipped. Default 2. */
  minClip?: number;
  /** Sample times; default every step marker. */
  times?: number[];
}

const intersection = (a: LayoutBox, b: LayoutBox): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** World position of a node at a frame: its own pos plus every ancestor's. */
function worldPos(tl: Timeline, frame: Map<string, NodeState>, id: string): [number, number] {
  let x = 0;
  let y = 0;
  let cur: string | undefined = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const st = frame.get(cur);
    if (st) {
      x += st.pos[0];
      y += st.pos[1];
    }
    cur = tl.nodes.find((n) => n.id === cur)?.parent;
  }
  return [x, y];
}

function isAncestor(tl: Timeline, maybeAncestor: string, id: string): boolean {
  let cur: string | undefined = tl.nodes.find((n) => n.id === id)?.parent;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === maybeAncestor) return true;
    seen.add(cur);
    cur = tl.nodes.find((n) => n.id === cur)?.parent;
  }
  return false;
}

/** The box a text occupies: a `text` node's glyphs, or the label centred in another shape. */
function textBox(n: TimelineNode, st: NodeState, pos: [number, number]): LayoutBox | undefined {
  const text = st.text ?? n.text;
  if (text === undefined || String(text) === "") return undefined;
  const lines = String(text).split("\n");
  const fs = n.fontSize ?? 14;
  const w = Math.max(...lines.map((l) => l.length)) * fs * 0.55;
  const h = lines.length * fs * 1.2;
  const anchor = n.shape === "text" ? n.anchor ?? "middle" : "middle";
  const left = anchor === "start" ? pos[0] : anchor === "end" ? pos[0] - w : pos[0] - w / 2;
  return { id: n.id, text: String(text), x: left, y: pos[1] - h / 2, w, h };
}

/** A filled, mostly opaque box that hides what is under it. */
function filledBox(n: TimelineNode, st: NodeState, pos: [number, number]): LayoutBox | undefined {
  if (n.shape !== "rect" && n.shape !== "ellipse" && n.shape !== "circle") return undefined;
  const fill = st.fill ?? n.fill;
  if (!fill || fill === "none" || fill === "transparent") return undefined;
  if (st.opacity < 0.5) return undefined;
  if (n.shape === "circle") {
    const r = st.r ?? n.r ?? 0;
    return { id: n.id, x: pos[0] - r, y: pos[1] - r, w: 2 * r, h: 2 * r };
  }
  const [w, h] = st.size ?? n.size ?? [0, 0];
  return { id: n.id, x: pos[0] - w / 2, y: pos[1] - h / 2, w, h };
}

/** Whether a node's position is between two different keyframes at `t` — a token in flight, a bar mid-swap. */
function inMotion(tl: Timeline, id: string, t: number): boolean {
  for (const tr of tl.tracks) {
    if (tr.target !== id || tr.prop !== "pos") continue;
    const ks = tr.keyframes;
    for (let i = 0; i + 1 < ks.length; i++) {
      if (ks[i].t <= t && t < ks[i + 1].t && JSON.stringify(ks[i].value) !== JSON.stringify(ks[i + 1].value)) return true;
    }
  }
  return false;
}

export function layoutFrame(tl: Timeline, t: number, opts: LayoutOptions = {}): LayoutIssue[] {
  const minOverlap = opts.minOverlap ?? 0.3;
  const minClip = opts.minClip ?? 2;
  const frame = sampleFrame(tl, t);
  const texts: LayoutBox[] = [];
  const fills: LayoutBox[] = [];
  for (const n of tl.nodes) {
    const st = frame.get(n.id);
    if (!st || st.opacity <= 0 || n.shape === "group") continue;
    const pos = worldPos(tl, frame, n.id);
    const tb = textBox(n, st, pos);
    if (tb) texts.push(tb);
    // A filled box that is on its way somewhere (a matrix token leaving its source cell at the start of a
    // beat) is where the animation wants it for an instant, not a layout defect.
    const fb = inMotion(tl, n.id, t) ? undefined : filledBox(n, st, pos);
    if (fb) fills.push(fb);
  }
  const issues: LayoutIssue[] = [];
  const { width, height } = tl.canvas;
  for (const b of texts) {
    const past = Math.max(-b.x, -b.y, b.x + b.w - width, b.y + b.h - height);
    if (past > minClip) issues.push({ kind: "clipped", nodes: [b.id], texts: [b.text ?? ""], amount: Math.round(past) });
  }
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      const inter = intersection(a, b);
      if (!inter) continue;
      const ratio = inter / Math.min(a.w * a.h, b.w * b.h);
      if (ratio >= minOverlap) issues.push({ kind: "overlap", nodes: [a.id, b.id], texts: [a.text ?? "", b.text ?? ""], amount: Math.round(ratio * 100) / 100 });
    }
  }
  for (const tb of texts) {
    for (const fb of fills) {
      if (fb.id === tb.id || isAncestor(tl, fb.id, tb.id)) continue;
      // A box drawn after the text covers it; one drawn before sits under it and hides nothing.
      const textIndex = tl.nodes.findIndex((n) => n.id === tb.id);
      const fillIndex = tl.nodes.findIndex((n) => n.id === fb.id);
      if (fillIndex < textIndex) continue;
      const inter = intersection(tb, fb);
      if (!inter) continue;
      const ratio = inter / (tb.w * tb.h);
      if (ratio >= minOverlap) issues.push({ kind: "overlap", nodes: [tb.id, fb.id], texts: [tb.text ?? "", fb.text ?? ""], amount: Math.round(ratio * 100) / 100 });
    }
  }
  return issues;
}

export function layoutReport(tl: Timeline, opts: LayoutOptions = {}): LayoutReport {
  const times = opts.times ?? sampleTimes(tl, 0);
  const frames: LayoutFrame[] = times.map((t, i) => {
    const step = currentStep(tl, t);
    return { index: i + 1, t, step: step ? { index: step.index + 1, caption: step.caption } : undefined, issues: layoutFrame(tl, t, opts) };
  });
  const all = frames.flatMap((f) => f.issues);
  return {
    frames,
    totals: {
      frames: frames.length,
      framesWithIssues: frames.filter((f) => f.issues.length).length,
      overlaps: all.filter((i) => i.kind === "overlap").length,
      clipped: all.filter((i) => i.kind === "clipped").length,
    },
  };
}

/** One line per issue, phrased for the writer: what sits on what, at which step. */
export function formatLayout(report: LayoutReport): string {
  const lines: string[] = [];
  for (const f of report.frames) {
    if (!f.issues.length) continue;
    const head = `frame ${f.index}${f.step ? ` · step ${f.step.index}` : ""} · ${Math.round(f.t)}ms${f.step?.caption ? ` — ${f.step.caption}` : ""}`;
    lines.push(head);
    for (const i of f.issues) {
      if (i.kind === "clipped") lines.push(`  clipped  "${i.texts[0]}" runs ${i.amount}px past the canvas edge (${i.nodes[0]})`);
      else lines.push(`  overlap  "${i.texts[0]}" on ${i.texts[1] ? `"${i.texts[1]}"` : i.nodes[1]} — ${Math.round(i.amount * 100)}% of the smaller box (${i.nodes.join(" × ")})`);
    }
  }
  const t = report.totals;
  lines.push(`${t.framesWithIssues} of ${t.frames} frames with layout issues · ${t.overlaps} overlap(s) · ${t.clipped} clipped`);
  return lines.join("\n");
}
