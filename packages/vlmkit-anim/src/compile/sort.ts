/**
 * `sort` → bars that swap places, with compare highlights and captions.
 *
 * Every bar is a `group` node holding a rect and its value label; a swap is a
 * `pos` tween on the two groups (values never change, positions do), so the
 * final frame's left-to-right order IS the sorted order and `check.ts` can
 * read it back. An `algorithm` generates the op list by actually running the
 * algorithm; an explicit `ops` list plays as written.
 */

import type { SortOp, SortScene, Timeline } from "../types.ts";
import { Builder } from "./builder.ts";

export function generateSortOps(values: number[], algorithm: NonNullable<SortScene["algorithm"]>): SortOp[] {
  const a = [...values];
  const ops: SortOp[] = [];
  const n = a.length;
  if (algorithm === "bubble") {
    for (let end = n - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) {
        ops.push({ compare: [i, i + 1] });
        if (a[i] > a[i + 1]) {
          [a[i], a[i + 1]] = [a[i + 1], a[i]];
          ops.push({ swap: [i, i + 1] });
          swapped = true;
        }
      }
      ops.push({ done: end });
      if (!swapped) {
        ops.push({ done: Array.from({ length: end }, (_, i) => i), caption: "No swaps in this pass: the rest is already sorted" });
        return ops;
      }
    }
    ops.push({ done: 0 });
  } else if (algorithm === "selection") {
    for (let i = 0; i < n - 1; i++) {
      let min = i;
      for (let j = i + 1; j < n; j++) {
        ops.push({ compare: [min, j] });
        if (a[j] < a[min]) min = j;
      }
      if (min !== i) {
        [a[i], a[min]] = [a[min], a[i]];
        ops.push({ swap: [i, min], caption: `Smallest of the rest is ${a[i]}: swap it into place` });
      }
      ops.push({ done: i });
    }
    ops.push({ done: n - 1 });
  } else {
    // insertion: shown as adjacent swaps so positions stay the whole story.
    ops.push({ done: 0, caption: `First element ${a[0]} is a sorted run of one` });
    for (let i = 1; i < n; i++) {
      let j = i;
      ops.push({ compare: [j - 1, j], caption: `Insert ${a[i]} into the sorted run` });
      while (j > 0 && a[j - 1] > a[j]) {
        [a[j - 1], a[j]] = [a[j], a[j - 1]];
        ops.push({ swap: [j - 1, j] });
        j--;
        if (j > 0) ops.push({ compare: [j - 1, j] });
      }
      ops.push({ done: Array.from({ length: i + 1 }, (_, k) => k) });
    }
  }
  return ops;
}

export function compileSort(scene: SortScene): Timeline {
  const b = new Builder(scene, { width: 640, height: 360, stepMs: 500 });
  const T = b.theme;
  const values = scene.values;
  const n = values.length;
  const ops = scene.ops ?? generateSortOps(values, scene.algorithm ?? "bubble");
  const captions = scene.captions !== false;

  const gap = Math.max(4, Math.round(b.width / (n * 12)));
  const barW = Math.floor((b.width - 80 - gap * (n - 1)) / n);
  const maxV = Math.max(...values.map((v) => Math.abs(v)), 1);
  const baseY = b.height - 60;
  const usableH = b.height - 130;
  const slotX = (i: number): number => 40 + i * (barW + gap) + barW / 2;

  // slot i holds bar id `bar-<originalIndex>`; positions are the story, values are fixed.
  const slots: string[] = values.map((_, i) => `bar-${i}`);
  values.forEach((v, i) => {
    const h = Math.max(6, Math.round((Math.abs(v) / maxV) * usableH));
    const id = `bar-${i}`;
    b.node({ id, shape: "group", pos: [slotX(i), baseY] });
    b.node({ id: `${id}-rect`, shape: "rect", parent: id, pos: [0, -h / 2], size: [barW, h], fill: T.node, stroke: T.nodeStroke, rx: 3 });
    b.node({ id: `${id}-label`, shape: "text", parent: id, pos: [0, 16], text: String(v), fontSize: T.fontSize, color: T.text });
  });
  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 24], text: scene.title, fontSize: T.fontSize + 4, color: T.text });

  const highlight = (indices: number[], color: string): void => {
    for (const i of indices) b.set(`${slots[i]}-rect`, "fill", color);
  };
  let lit: number[] = [];
  const cur = [...values];
  const done = new Set<number>();

  b.step(captions ? `Start: ${cur.join(", ")}` : undefined, "start");
  b.advance(b.stepMs * 0.6);

  for (const op of ops) {
    const caption = "caption" in op ? op.caption : undefined;
    // Reset previous compare highlight (kept when the slot has been marked done).
    highlight(lit.filter((i) => !done.has(i)), T.node);
    lit = [];
    if ("compare" in op) {
      const [i, j] = op.compare;
      highlight([i, j], T.accent);
      lit = [i, j];
      b.step(captions ? caption ?? `Compare ${cur[i]} and ${cur[j]}${cur[i] > cur[j] ? ": out of order" : ": in order"}` : undefined);
      b.advance(b.stepMs * 0.8);
    } else if ("swap" in op) {
      const [i, j] = op.swap;
      highlight([i, j], T.bad);
      lit = [i, j];
      b.step(captions ? caption ?? `Swap ${cur[i]} and ${cur[j]}` : undefined);
      const t0 = b.t;
      const t1 = b.advance();
      b.tween(slots[i], "pos", [slotX(j), baseY], t0, t1);
      b.tween(slots[j], "pos", [slotX(i), baseY], t0, t1);
      [slots[i], slots[j]] = [slots[j], slots[i]];
      [cur[i], cur[j]] = [cur[j], cur[i]];
    } else if ("done" in op) {
      const idx = Array.isArray(op.done) ? op.done : [op.done];
      for (const i of idx) done.add(i);
      highlight(idx, T.ok);
      b.step(captions ? caption ?? (idx.length === 1 ? `${cur[idx[0]]} is in its final place` : `Positions ${idx.join(", ")} are sorted`) : undefined);
      b.advance(b.stepMs * 0.6);
    } else if ("set" in op) {
      const { index, value } = op.set;
      highlight([index], T.accent);
      lit = [index];
      b.set(`${slots[index]}-label`, "text", String(value));
      const h = Math.max(6, Math.round((Math.abs(value) / maxV) * usableH));
      const t0 = b.t;
      const t1 = b.advance();
      b.tween(`${slots[index]}-rect`, "size", [barW, h], t0, t1);
      b.tween(`${slots[index]}-rect`, "pos", [0, -h / 2], t0, t1);
      cur[index] = value;
      b.step(captions ? caption ?? `Set position ${index} to ${value}` : undefined, undefined, t0);
    } else if ("note" in op) {
      b.step(op.note);
      b.advance(b.stepMs * 0.8);
    }
  }
  highlight(lit.filter((i) => !done.has(i)), T.node);
  b.step(captions ? `Sorted: ${cur.join(", ")}` : undefined, "end");
  b.advance(b.stepMs * 0.5);
  return b.build({ title: scene.title, kind: "sort", finalOrder: cur, slots });
}
