/**
 * `compose` → several scenes in one canvas. Each pane is compiled by its own
 * kind, then translated into its slot: node positions and every `pos` track
 * shift by the pane's origin, ids get a pane prefix, and the steps merge.
 *
 * `timing: "sequence"` (default) plays the panes one after another — the
 * second starts when the first ends — so captions never collide. `"parallel"`
 * starts them together for a before / after that runs in lockstep; beats that
 * coincide share one step and their captions join with " · ", which is the
 * same rule two simultaneous messages already follow.
 *
 * v9: three writers produced two scenes because one kind could not hold the
 * story (history then comparison; HTTP/1.1 then HTTP/2; a run then its fork).
 * None wanted two animations; each wanted two panes.
 */

import { TIMELINE_FORMAT, type ComposeScene, type Step, type Timeline, type TimelineNode, type Track, type Vec2 } from "../types.ts";
import { themeOf } from "./builder.ts";
import { compileScene } from "./index.ts";

const DEFAULT_GAP = 32;
const PANE_TITLE_H = 30;

export interface PaneLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** ms the pane's own timeline is shifted by. */
  offset: number;
  duration: number;
}

export function compileCompose(scene: ComposeScene): Timeline {
  const theme = themeOf(scene);
  const gap = scene.gap ?? DEFAULT_GAP;
  const titleH = scene.title ? 44 : 16;
  const children = scene.panes.map((p, i) => ({ id: p.id ?? `pane-${i + 1}`, title: p.title, tl: compileScene(p.scene) }));
  const layout = scene.layout ?? "row";
  const cols = layout === "row" ? children.length : layout === "column" ? 1 : 2;

  // Slots: rows of `cols` panes; a row is as tall as its tallest pane, a column as wide as its widest.
  const rows: typeof children[] = [];
  for (let i = 0; i < children.length; i += cols) rows.push(children.slice(i, i + cols));
  const colWidth = Array.from({ length: cols }, (_, c) => Math.max(0, ...rows.map((r) => r[c]?.tl.canvas.width ?? 0)));
  const rowHeight = rows.map((r) => Math.max(...r.map((c) => c.tl.canvas.height)) + (r.some((c) => c.title) ? PANE_TITLE_H : 0));
  const x0 = (c: number): number => gap + colWidth.slice(0, c).reduce((a, w) => a + w + gap, 0);
  const y0 = (r: number): number => titleH + rowHeight.slice(0, r).reduce((a, h) => a + h + gap, 0);
  const width = gap + colWidth.reduce((a, w) => a + w + gap, 0);
  const height = titleH + rowHeight.reduce((a, h) => a + h + gap, 0) + 24;

  const nodes: TimelineNode[] = [];
  const tracks: Track[] = [];
  const steps: Step[] = [];
  const panes: PaneLayout[] = [];
  if (scene.title) nodes.push({ id: "title", shape: "text", pos: [width / 2, 22], text: scene.title, fontSize: theme.fontSize + 4, color: theme.text });

  let clock = 0;
  children.forEach((child, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const px = x0(c);
    const py = y0(r) + (child.title ? PANE_TITLE_H : 0);
    const dur = duration(child.tl);
    const offset = scene.timing === "parallel" ? 0 : clock;
    clock = Math.max(clock, offset + dur);
    const prefix = `${child.id}:`;
    if (child.title) nodes.push({ id: `${prefix}pane-title`, shape: "text", pos: [px + child.tl.canvas.width / 2, py - PANE_TITLE_H / 2 - 2], text: child.title, fontSize: theme.fontSize + 1, color: theme.muted });
    // A pane's background so the reader sees where one picture ends and the next begins.
    nodes.push({ id: `${prefix}pane-bg`, shape: "rect", pos: [px + child.tl.canvas.width / 2, py + child.tl.canvas.height / 2], size: [child.tl.canvas.width, child.tl.canvas.height], rx: 8, fill: child.tl.canvas.background ?? theme.background, stroke: theme.muted, strokeWidth: 1, opacity: 0.6 });
    const shift = (p: Vec2): Vec2 => [p[0] + px, p[1] + py];
    for (const n of child.tl.nodes) {
      const moved: TimelineNode = { ...n, id: prefix + n.id };
      if (n.parent) moved.parent = prefix + n.parent;
      else moved.pos = shift(n.pos ?? [0, 0]);
      nodes.push(moved);
    }
    const topLevel = new Set(child.tl.nodes.filter((n) => !n.parent).map((n) => n.id));
    for (const tr of child.tl.tracks) {
      const moved: Track = {
        target: prefix + tr.target,
        prop: tr.prop,
        keyframes: tr.keyframes.map((k) => ({ ...k, t: k.t + offset, value: tr.prop === "pos" && topLevel.has(tr.target) ? shift(k.value as Vec2) : k.value })),
      };
      tracks.push(moved);
    }
    for (const s of child.tl.steps ?? []) {
      // A pane's own closing marker is not the composition's end; the composition adds one at its clock.
      if (s.label === "end" && !s.caption) continue;
      const caption = s.caption;
      const paneCaption = caption && child.title && scene.timing === "parallel" ? `${child.title}: ${caption}` : caption;
      mergeStep(steps, { t: s.t + offset, ...(s.label && s.label !== "end" ? { label: s.label } : {}), ...(paneCaption ? { caption: paneCaption } : {}) });
    }
    panes.push({ id: child.id, x: px, y: py, width: child.tl.canvas.width, height: child.tl.canvas.height, offset, duration: dur });
  });
  // A pane's own t=0 "start" beat is a chapter marker inside the composition, not the start of it.
  if (!steps.some((s) => s.t === 0)) steps.unshift({ t: 0, label: "start", caption: scene.title });
  mergeStep(steps, { t: Math.round(clock), label: "end" });
  steps.sort((a, b) => a.t - b.t);
  return {
    format: TIMELINE_FORMAT,
    canvas: { width: Math.round(width), height: Math.round(height), background: theme.background },
    duration: Math.round(clock),
    nodes,
    tracks,
    steps,
    meta: { title: scene.title, kind: "compose", panes, timing: scene.timing ?? "sequence", layout },
  };
}

function duration(tl: Timeline): number {
  return tl.duration ?? Math.max(0, ...tl.tracks.flatMap((tr) => tr.keyframes.map((k) => k.t)), ...(tl.steps ?? []).map((s) => s.t));
}

/** Same rule as Builder.step: coincident beats share one step and join their captions. */
function mergeStep(steps: Step[], s: Step): void {
  const idx = steps.findIndex((x) => Math.abs(x.t - s.t) < 1e-9);
  if (idx < 0) {
    steps.push(s);
    return;
  }
  const prev = steps[idx];
  const joined = prev.caption && s.caption && prev.caption !== s.caption ? `${prev.caption} · ${s.caption}` : s.caption ?? prev.caption;
  steps[idx] = { t: s.t, ...(prev.label || s.label ? { label: prev.label ?? s.label } : {}), ...(joined ? { caption: joined } : {}) };
}
