/**
 * The annotation layer: six ops every kind accepts in its own op list, drawn
 * by the Builder so no compiler has to know how.
 *
 *   {"value":    {"id", "label", "text", "at"?, "side"?}}   a named readout; a later op with the same id updates it
 *   {"callout":  {"at", "text", "id"?, "side"?} | null}       a text box with a pointer at an anchor; null hides
 *   {"snapshot": {"of", "label"}}                             a frozen copy of what the anchor shows right now
 *   {"group":    {"around": [anchors], "label"?, "id"?} | null}  a dashed outline around several anchors
 *   {"text":     {"id"?, "lines": [...], "highlight"?, "at"?, "side"?} | null}  a multi-line block, one line highlightable
 *   {"relate":   {"from", "to", "label"?, "style"?, "id"?} | null}  a labelled arrow (or line) between two anchors
 *
 * v9 asked for every one of them: a value that tracks a number next to its
 * owner (three writers), a callout pointing at one thing, a frozen earlier
 * value to compare against, a bracket around a batch, a code block; v10 asked
 * for the pairwise line `relate` draws (a group would enclose a bystander). All are
 * things a `vector` scene could draw by hand with coordinates; the point is
 * that the writer never types one.
 *
 * **Anchors** are names each compiler registers for the things a viewer can
 * point at — an index, a cell, a node id, a state, a value — mapped to the
 * timeline nodes that draw them. Readouts without `at` go to a panel on the
 * right, which the Builder adds to the canvas only when something uses it.
 */

import { ANNOTATION_ACTIONS, type AnnotationOp, type AnnotationSide as Side, type CalloutSpec, type Diagnostic, type GroupSpec, type RelateSpec, type SnapshotSpec, type TextSpec, type ValueSpec, type Vec2 } from "../types.ts";
import type { Builder } from "./builder.ts";
import { boxRadius, labelWidth } from "./builder.ts";

export { ANNOTATION_ACTIONS };
export type { AnnotationOp };
export type AnnotationAction = (typeof ANNOTATION_ACTIONS)[number];

export function isAnnotationOp(op: unknown): op is AnnotationOp {
  return typeof op === "object" && op !== null && ANNOTATION_ACTIONS.some((k) => k in (op as object));
}

/** Thrown by the Builder when an op names an anchor the compiler never registered. */
export class AnchorError extends Error {
  readonly diagnostic: Diagnostic;
  constructor(diagnostic: Diagnostic) {
    // No parameter property: Node runs this file with type stripping only, which refuses that syntax.
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}

export const PANEL_WIDTH = 220;
const PANEL_GAP = 16;
/** The renderer and runtime draw the current caption in the bottom band of the canvas; nothing else goes there. */
const CAPTION_BAND = 32;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const box = (cx: number, cy: number, w: number, h: number): Box => ({ x: cx - w / 2, y: cy - h / 2, w, h });
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const intersects = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Whether the segment p→q passes through `b` (slab clipping). */
function segmentHitsBox(p: Vec2, q: Vec2, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const d: Vec2 = [q[0] - p[0], q[1] - p[1]];
  const lo: Vec2 = [b.x, b.y];
  const hi: Vec2 = [b.x + b.w, b.y + b.h];
  for (const i of [0, 1] as const) {
    if (Math.abs(d[i]) < 1e-9) {
      if (p[i] < lo[i] || p[i] > hi[i]) return false;
      continue;
    }
    let ta = (lo[i] - p[i]) / d[i];
    let tb = (hi[i] - p[i]) / d[i];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * Per-builder annotation state. Compilers call `anchor()` while laying out and
 * `apply()` from their op loop; everything else is drawing.
 */
export class Annotations {
  private readonly anchors = new Map<string, string[]>();
  private readonly readouts = new Map<string, { text: string; box: string; label: string }>();
  private readonly callouts = new Map<string, string[]>();
  private readonly groups = new Map<string, string[]>();
  private readonly blocks = new Map<string, { lines: string[]; hl: string[]; box: string }>();
  private readonly relations = new Map<string, string[]>();
  private panelRows = 0;
  private panelUsed = false;
  private panelNeed = PANEL_WIDTH;
  private serial = 0;

  private readonly b: Builder;

  constructor(b: Builder) {
    this.b = b;
  }

  /** Name the thing(s) a writer can point at. Later registrations of the same name replace it. */
  anchor(name: string, ...nodeIds: string[]): void {
    this.anchors.set(name, nodeIds);
  }

  anchorNames(): string[] {
    return [...this.anchors.keys()];
  }

  /** Extra canvas width the panel needs; 0 when nothing used it. */
  extraWidth(): number {
    return this.panelUsed ? this.panelNeed + PANEL_GAP : 0;
  }

  /** True when `op` was an annotation op and has been applied at `t`. */
  apply(op: unknown, t: number, path: string): boolean {
    if (!isAnnotationOp(op)) return false;
    if ("value" in op) this.value(op.value, t, path);
    else if ("callout" in op) this.callout(op.callout, t, path);
    else if ("snapshot" in op) this.snapshot(op.snapshot, t, path);
    else if ("group" in op) this.group(op.group, t, path);
    else if ("text" in op) this.text(op.text, t, path);
    else this.relate(op.relate, t, path);
    return true;
  }

  /** The caption an annotation op gets when the writer wrote none. */
  caption(op: AnnotationOp): string | undefined {
    if ("value" in op) return `${op.value.label ?? this.readouts.get(op.value.id)?.label ?? op.value.id} = ${op.value.text}`;
    if ("callout" in op) return op.callout ? op.callout.text : undefined;
    if ("snapshot" in op) return op.snapshot.label ?? `snapshot of ${op.snapshot.of}`;
    if ("group" in op) return op.group?.label;
    // A block narrates its highlighted line, else its first: the reader hears what they should look at.
    if ("text" in op) return op.text ? op.text.lines[op.text.highlight ?? 0] ?? op.text.lines[0] : undefined;
    return op.relate ? op.relate.label ?? `${op.relate.from} → ${op.relate.to}` : undefined;
  }

  // ---- resolution ------------------------------------------------------------

  private resolve(name: string, path: string): string[] {
    const ids = this.anchors.get(name);
    if (ids && ids.length) return ids;
    const names = this.anchorNames();
    const near = closestName(name, names);
    throw new AnchorError({
      severity: "error",
      path,
      message: `no anchor named "${name}" in this ${this.b.kindName} scene`,
      hint: `${near ? `did you mean "${near}"? ` : ""}anchors here: ${names.length ? names.slice(0, 24).map((n) => `"${n}"`).join(", ") + (names.length > 24 ? ", …" : "") : "(none)"}`,
    });
  }

  private nodeBox(id: string, t: number): Box {
    const n = this.b.nodes.find((x) => x.id === id);
    if (!n) return box(0, 0, 0, 0);
    const [x, y] = (this.b.valueAt(id, "pos", t) as Vec2 | undefined) ?? [0, 0];
    const [px, py] = n.parent ? ((this.b.valueAt(n.parent, "pos", t) as Vec2 | undefined) ?? [0, 0]) : [0, 0];
    const cx = x + px;
    const cy = y + py;
    switch (n.shape) {
      case "rect":
      case "ellipse": {
        const s = (this.b.valueAt(id, "size", t) as Vec2 | undefined) ?? n.size ?? [0, 0];
        return box(cx, cy, s[0], s[1]);
      }
      case "circle": {
        const r = (this.b.valueAt(id, "r", t) as number | undefined) ?? n.r ?? 0;
        return box(cx, cy, r * 2, r * 2);
      }
      case "text": {
        const text = String(this.b.valueAt(id, "text", t) ?? n.text ?? "");
        const fs = n.fontSize ?? this.b.theme.fontSize;
        const w = labelWidth(text, fs) - fs * 1.6;
        const anchor = n.anchor ?? "middle";
        const left = anchor === "start" ? cx : anchor === "end" ? cx - w : cx - w / 2;
        return { x: left, y: cy - fs * 0.65, w, h: fs * 1.3 };
      }
      case "line":
      case "arrow": {
        const [p, q] = n.points ?? [[0, 0], [0, 0]];
        return union(box(cx + p[0], cy + p[1], 0, 0), box(cx + q[0], cy + q[1], 0, 0));
      }
      default:
        return box(cx, cy, 0, 0);
    }
  }

  private anchorBox(name: string, t: number, path: string): Box {
    return this.resolve(name, path).map((id) => this.nodeBox(id, t)).reduce(union);
  }

  /** Distance from `b`'s edge to the canvas edge in direction `sign · n` (dominant axis). */
  private room(b: Box, n: Vec2, sign: 1 | -1): number {
    const dx = n[0] * sign;
    const dy = n[1] * sign;
    // The panel, when something used it, widens the canvas to the right; the caption owns the bottom band.
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? this.b.width + this.extraWidth() - (b.x + b.w) : b.x;
    return dy > 0 ? this.b.height - CAPTION_BAND - (b.y + b.h) : b.y;
  }

  /**
   * How far from the centre line ca→cc, towards `sign · n`, a parallel line must run to clear everything
   * visible in the pair's lane (the band between the two centres): the pair's own boxes, a row label beside
   * them, a readout already anchored to one of them.
   */
  private laneClearance(ca: Vec2, cc: Vec2, u: Vec2, n: Vec2, sign: 1 | -1, t: number): number {
    const along = (v: Vec2) => (v[0] - ca[0]) * u[0] + (v[1] - ca[1]) * u[1];
    const across = (v: Vec2) => ((v[0] - ca[0]) * n[0] + (v[1] - ca[1]) * n[1]) * sign;
    const lo = Math.min(0, along(cc)) - 4;
    const hi = Math.max(0, along(cc)) + 4;
    let far = 0;
    for (const node of this.b.nodes) {
      if (node.shape === "group" || (this.b.valueAt(node.id, "opacity", t) ?? 1) === 0) continue;
      const b = this.nodeBox(node.id, t);
      if (b.w === 0 && b.h === 0) continue;
      const corners: Vec2[] = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
      const spans = corners.map(along);
      if (Math.max(...spans) < lo || Math.min(...spans) > hi) continue;
      far = Math.max(far, ...corners.map(across));
    }
    return far + 14;
  }

  /**
   * Whether the segment p→q runs through some other anchor's visible box — one that is neither of the pair's
   * nor touching them (a cell inside the row it relates, a column spanning both, the edge between two nodes).
   */
  private crossesBystander(p: Vec2, q: Vec2, a: Box, c: Box, from: string, to: string, t: number): boolean {
    for (const [name, ids] of this.anchors) {
      if (name === from || name === to) continue;
      const visible = ids.filter((id) => (this.b.valueAt(id, "opacity", t) ?? 1) !== 0);
      if (!visible.length) continue;
      const b = visible.map((id) => this.nodeBox(id, t)).reduce(union);
      if (b.w === 0 && b.h === 0) continue;
      if (intersects(b, a) || intersects(b, c)) continue;
      if (segmentHitsBox(p, q, b)) return true;
    }
    return false;
  }

  private anchorText(name: string, t: number, path: string): string {
    const texts = this.resolve(name, path).map((id) => {
      const v = this.b.valueAt(id, "text", t);
      return v === undefined ? undefined : String(v);
    }).filter((s): s is string => s !== undefined && s !== "");
    return texts.length > 1 ? `[${texts.join(", ")}]` : texts[0] ?? "";
  }

  /** Where a box of `w×h` sits on `side` of `target`, with a gap. */
  private beside(target: Box, w: number, h: number, side: Side, gap = 14): Vec2 {
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    switch (side) {
      case "above": return [cx, target.y - gap - h / 2];
      case "below": return [cx, target.y + target.h + gap + h / 2];
      case "left": return [target.x - gap - w / 2, cy];
      case "right": return [target.x + target.w + gap + w / 2, cy];
    }
  }

  private panelSlot(rows: number): Vec2 {
    this.panelUsed = true;
    const x = this.b.width + PANEL_GAP + PANEL_WIDTH / 2;
    const y = (this.b.hasTitle ? 56 : 32) + this.panelRows * 24;
    this.panelRows += rows;
    return [x, y];
  }

  private fit(text: string, fontSize: number): void {
    this.panelNeed = Math.max(this.panelNeed, Math.ceil(labelWidth(text, fontSize)) + 8);
  }

  private show(id: string, on: boolean, t: number): void {
    if (this.b.valueAt(id, "opacity", t) !== (on ? 1 : 0)) this.b.set(id, "opacity", on ? 1 : 0, t);
  }

  // ---- the six ops -------------------------------------------------------------

  private value(spec: ValueSpec, t: number, path: string): void {
    const T = this.b.theme;
    const text = String(spec.text);
    const existing = this.readouts.get(spec.id);
    if (existing) {
      this.b.set(existing.text, "text", text, t);
      this.fit(`${existing.label}: ${text}`, T.fontSize);
      return;
    }
    const label = spec.label ?? spec.id;
    const textId = `value-${spec.id}`;
    const labelId = `value-${spec.id}-label`;
    if (spec.at) {
      const target = this.anchorBox(spec.at, t, `${path}.value.at`);
      const side = spec.side ?? "below";
      const w = labelWidth(`${label}: ${text}`, T.fontSize - 1);
      const h = T.fontSize * 1.4;
      const [cx, cy] = this.beside(target, w, h, side, 10);
      this.b.node({ id: labelId, shape: "text", pos: [cx - w / 2, cy], text: `${label}:`, fontSize: T.fontSize - 2, color: T.muted, anchor: "start", opacity: 0 });
      const lx = cx - w / 2 + labelWidth(`${label}:`, T.fontSize - 2) - (T.fontSize - 2) * 1.2;
      this.b.node({ id: textId, shape: "text", pos: [lx, cy], text, fontSize: T.fontSize, color: T.accent, anchor: "start", opacity: 0 });
    } else {
      const [cx, cy] = this.panelSlot(1);
      const left = cx - PANEL_WIDTH / 2;
      this.fit(`${label}: ${text}`, T.fontSize);
      this.b.node({ id: labelId, shape: "text", pos: [left, cy], text: `${label}:`, fontSize: T.fontSize - 2, color: T.muted, anchor: "start", opacity: 0 });
      this.b.node({ id: textId, shape: "text", pos: [left + labelWidth(`${label}:`, T.fontSize - 2) - (T.fontSize - 2) * 1.2, cy], text, fontSize: T.fontSize, color: T.accent, anchor: "start", opacity: 0 });
    }
    this.b.set(labelId, "opacity", 1, t);
    this.b.set(textId, "opacity", 1, t);
    this.readouts.set(spec.id, { text: textId, box: labelId, label });
  }

  private callout(spec: CalloutSpec | null, t: number, path: string): void {
    // `null` hides every callout; a spec replaces the one with its id.
    const stale = spec ? [spec.id ?? "main"] : [...this.callouts.keys()];
    for (const id of stale) {
      for (const nodeId of this.callouts.get(id) ?? []) this.show(nodeId, false, t);
      this.callouts.delete(id);
    }
    if (!spec) return;
    const id = spec.id ?? "main";
    const T = this.b.theme;
    const target = this.anchorBox(spec.at, t, `${path}.callout.at`);
    const side = spec.side ?? "above";
    const fs = T.fontSize - 1;
    const w = labelWidth(spec.text, fs);
    const h = fs * 1.9;
    const [cx, cy] = this.beside(target, w, h, side, 26);
    const k = this.serial++;
    const ids = [`callout-${id}-${k}-box`, `callout-${id}-${k}-text`, `callout-${id}-${k}-arrow`];
    // The pointer runs from the box edge nearest the target to the target's edge.
    const from: Vec2 = side === "above" ? [cx, cy + h / 2] : side === "below" ? [cx, cy - h / 2] : side === "left" ? [cx + w / 2, cy] : [cx - w / 2, cy];
    const tx = target.x + target.w / 2;
    const ty = target.y + target.h / 2;
    const to: Vec2 = side === "above" ? [tx, target.y - 3] : side === "below" ? [tx, target.y + target.h + 3] : side === "left" ? [target.x - 3, ty] : [target.x + target.w + 3, ty];
    this.b.node({ id: ids[0], shape: "rect", pos: [cx, cy], size: [w, h], rx: 6, fill: T.accent, stroke: T.nodeStroke, strokeWidth: 1, opacity: 0 });
    this.b.node({ id: ids[1], shape: "text", pos: [cx, cy], text: spec.text, fontSize: fs, color: T.nodeStroke, opacity: 0 });
    this.b.node({ id: ids[2], shape: "arrow", points: [[from[0] - cx, from[1] - cy], [to[0] - cx, to[1] - cy]], pos: [cx, cy], stroke: T.nodeStroke, strokeWidth: 1.5, opacity: 0 });
    for (const nodeId of ids) this.b.set(nodeId, "opacity", 1, t);
    this.callouts.set(id, ids);
  }

  private snapshot(spec: SnapshotSpec, t: number, path: string): void {
    const T = this.b.theme;
    const text = this.anchorText(spec.of, t, `${path}.snapshot.of`);
    const label = spec.label ?? spec.of;
    const k = this.serial++;
    const [cx, cy] = this.panelSlot(1);
    const left = cx - PANEL_WIDTH / 2;
    this.fit(`${label}: ${text}`, T.fontSize);
    const labelId = `snapshot-${k}-label`;
    const textId = `snapshot-${k}`;
    this.b.node({ id: labelId, shape: "text", pos: [left, cy], text: `${label}:`, fontSize: T.fontSize - 2, color: T.muted, anchor: "start", opacity: 0 });
    this.b.node({ id: textId, shape: "text", pos: [left + labelWidth(`${label}:`, T.fontSize - 2) - (T.fontSize - 2) * 1.2, cy], text, fontSize: T.fontSize, color: T.text, anchor: "start", opacity: 0 });
    this.b.set(labelId, "opacity", 1, t);
    this.b.set(textId, "opacity", 1, t);
  }

  private group(spec: GroupSpec | null, t: number, path: string): void {
    const stale = spec ? [spec.id ?? "main"] : [...this.groups.keys()];
    for (const id of stale) {
      for (const nodeId of this.groups.get(id) ?? []) this.show(nodeId, false, t);
      this.groups.delete(id);
    }
    if (!spec) return;
    const id = spec.id ?? "main";
    const T = this.b.theme;
    const names = Array.isArray(spec.around) ? spec.around : [spec.around];
    const bb = names.map((n) => this.anchorBox(n, t, `${path}.group.around`)).reduce(union);
    const pad = 10;
    const k = this.serial++;
    const rectId = `group-${id}-${k}`;
    const ids = [rectId];
    this.b.node({ id: rectId, shape: "rect", pos: [bb.x + bb.w / 2, bb.y + bb.h / 2], size: [bb.w + pad * 2, bb.h + pad * 2], rx: 8, fill: "none", stroke: T.accent, strokeWidth: 1.5, opacity: 0 });
    if (spec.label) {
      const labelId = `group-${id}-${k}-label`;
      ids.push(labelId);
      this.b.node({ id: labelId, shape: "text", pos: [bb.x - pad + 4, bb.y - pad - 9], text: spec.label, fontSize: T.fontSize - 2, color: T.accent, anchor: "start", opacity: 0 });
    }
    for (const nodeId of ids) this.b.set(nodeId, "opacity", 1, t);
    this.groups.set(id, ids);
  }

  private text(spec: TextSpec | null, t: number, path: string): void {
    const T = this.b.theme;
    if (!spec) {
      for (const [id, blk] of this.blocks) {
        for (const nodeId of [...blk.lines, ...blk.hl, blk.box]) this.show(nodeId, false, t);
        this.blocks.delete(id);
      }
      return;
    }
    const id = spec.id ?? "main";
    const existing = this.blocks.get(id);
    const fs = T.fontSize - 1;
    const lineH = fs * 1.5;
    if (existing && existing.lines.length === spec.lines.length) {
      // Same shape: update lines in place and move the highlight.
      spec.lines.forEach((line, i) => {
        if (this.b.valueAt(existing.lines[i], "text", t) !== line) this.b.set(existing.lines[i], "text", line, t);
      });
      existing.hl.forEach((hlId, i) => this.show(hlId, spec.highlight === i, t));
      for (const nodeId of [...existing.lines, existing.box]) this.show(nodeId, true, t);
      return;
    }
    if (existing) for (const nodeId of [...existing.lines, ...existing.hl, existing.box]) this.show(nodeId, false, t);
    const w = Math.max(...spec.lines.map((l) => labelWidth(l, fs)), fs * 4);
    const h = spec.lines.length * lineH + fs;
    let cx: number;
    let cy: number;
    if (spec.at) {
      [cx, cy] = this.beside(this.anchorBox(spec.at, t, `${path}.text.at`), w, h, spec.side ?? "right");
    } else {
      const rows = Math.ceil(h / 24);
      const [px, py] = this.panelSlot(rows + 1);
      this.fit(spec.lines.reduce((a, c) => (c.length > a.length ? c : a), ""), fs);
      cx = px;
      cy = py + h / 2 - 12;
    }
    const k = this.serial++;
    const boxId = `text-${id}-${k}-box`;
    this.b.node({ id: boxId, shape: "rect", pos: [cx, cy], size: [w, h], rx: 6, fill: T.node, stroke: T.muted, strokeWidth: 1, opacity: 0 });
    const lines: string[] = [];
    const hl: string[] = [];
    const top = cy - h / 2 + fs * 0.5 + lineH / 2;
    spec.lines.forEach((line, i) => {
      const y = top + i * lineH;
      const hlId = `text-${id}-${k}-hl-${i}`;
      const lineId = `text-${id}-${k}-line-${i}`;
      this.b.node({ id: hlId, shape: "rect", pos: [cx, y], size: [w - 6, lineH - 2], rx: 3, fill: T.accent, opacity: 0 });
      this.b.node({ id: lineId, shape: "text", pos: [cx - w / 2 + fs * 0.8, y], text: line, fontSize: fs, color: T.text, anchor: "start", opacity: 0 });
      hl.push(hlId);
      lines.push(lineId);
      this.b.set(lineId, "opacity", 1, t);
      if (spec.highlight === i) this.b.set(hlId, "opacity", 0.35, t);
    });
    this.b.set(boxId, "opacity", 1, t);
    this.blocks.set(id, { lines, hl, box: boxId });
  }

  private relate(spec: RelateSpec | null, t: number, path: string): void {
    const stale = spec ? [spec.id ?? "main"] : [...this.relations.keys()];
    for (const id of stale) {
      for (const nodeId of this.relations.get(id) ?? []) this.show(nodeId, false, t);
      this.relations.delete(id);
    }
    if (!spec) return;
    const id = spec.id ?? "main";
    const T = this.b.theme;
    const a = this.anchorBox(spec.from, t, `${path}.relate.from`);
    const c = this.anchorBox(spec.to, t, `${path}.relate.to`);
    const ca: Vec2 = [a.x + a.w / 2, a.y + a.h / 2];
    const cc: Vec2 = [c.x + c.w / 2, c.y + c.h / 2];
    const d = Math.hypot(cc[0] - ca[0], cc[1] - ca[1]) || 1;
    let u: Vec2 = [(cc[0] - ca[0]) / d, (cc[1] - ca[1]) / d];
    // Edge to edge: trim each end at its anchor's box, plus a gap, so the line touches neither label.
    const ra = boxRadius(a.w, a.h, u[0], u[1]) + 5;
    const rc = boxRadius(c.w, c.h, u[0], u[1]) + (spec.style === "line" ? 5 : 9);
    let p: Vec2 = [ca[0] + u[0] * ra, ca[1] + u[1] * ra];
    let q: Vec2 = [cc[0] - u[0] * rc, cc[1] - u[1] * rc];
    let n: Vec2 = [-u[1], u[0]];
    const pair = union(a, c);
    const tooShort = (q[0] - p[0]) * u[0] + (q[1] - p[1]) * u[1] < 16;
    const beside = tooShort || this.crossesBystander(p, q, a, c, spec.from, spec.to, t);
    if (beside) {
      // Adjacent boxes (two neighbouring rows, cells, bars) leave nothing between their edges, and a pair with
      // something else in between (rows A and C of three) would have the line drawn across the bystander — the
      // very thing `relate` exists to avoid. Either way the line runs beside them instead, along the pair's
      // dominant axis (horizontal for bars side by side, vertical for stacked rows) so bars of different heights
      // still get a level line.
      u = Math.abs(u[0]) >= Math.abs(u[1]) ? [Math.sign(u[0]) || 1, 0] : [0, Math.sign(u[1]) || 1];
      n = [-u[1], u[0]];
    }
    // The label (and, when beside, the whole line) goes to the side of the pair that is nearer to free space:
    // the smaller clearance past everything drawn in the pair's lane wins, as long as the canvas has room for it.
    const clearance = (sign: 1 | -1) => this.laneClearance(ca, cc, u, n, sign, t);
    const fits = (sign: 1 | -1, off: number) => off - boxRadius(pair.w, pair.h, n[0], n[1]) + 24 <= this.room(pair, n, sign);
    const [offPlus, offMinus] = [clearance(1), clearance(-1)];
    let outward: 1 | -1 = offPlus <= offMinus ? 1 : -1;
    if (!fits(outward, outward === 1 ? offPlus : offMinus) && fits(-outward as 1 | -1, outward === 1 ? offMinus : offPlus)) outward = -outward as 1 | -1;
    if (beside) {
      // Level with the first anchor's centre, offset just past everything in the lane (the pair's own boxes,
      // a row label, a readout beside a row); the arrow ends level with the second anchor's centre.
      const off = outward === 1 ? offPlus : offMinus;
      const span = (cc[0] - ca[0]) * u[0] + (cc[1] - ca[1]) * u[1];
      p = [ca[0] + n[0] * off * outward, ca[1] + n[1] * off * outward];
      q = [p[0] + u[0] * span, p[1] + u[1] * span];
    }
    const mid: Vec2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const k = this.serial++;
    const lineId = `relate-${id}-${k}`;
    const ids = [lineId];
    this.b.node({ id: lineId, shape: spec.style === "line" ? "line" : "arrow", pos: mid, points: [[p[0] - mid[0], p[1] - mid[1]], [q[0] - mid[0], q[1] - mid[1]]], stroke: T.accent, strokeWidth: 2, opacity: 0 });
    if (spec.label) {
      const labelId = `relate-${id}-${k}-label`;
      ids.push(labelId);
      // A vertical line's label is beside it, start-anchored, so it reads left to right off the line.
      const vertical = Math.abs(u[1]) > Math.abs(u[0]);
      const gap = vertical ? 8 : 12;
      this.b.node({
        id: labelId,
        shape: "text",
        pos: [mid[0] + n[0] * gap * outward, mid[1] + n[1] * gap * outward],
        text: spec.label,
        fontSize: T.fontSize - 2,
        color: T.accent,
        anchor: vertical ? (n[0] * outward > 0 ? "start" : "end") : "middle",
        opacity: 0,
      });
    }
    for (const nodeId of ids) this.b.set(nodeId, "opacity", 1, t);
    this.relations.set(id, ids);
  }
}

/** Nearest anchor name for a did-you-mean, by edit distance, when close enough. */
function closestName(name: string, names: string[]): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const n of names) {
    const d = editDistance(name.toLowerCase(), n.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best !== undefined && bestD <= Math.max(2, Math.floor(name.length / 3)) ? best : undefined;
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
