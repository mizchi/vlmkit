/**
 * `array` → a row of boxes with named pointers underneath and an optional
 * window bracket: the picture for binary search, two-pointer walks and
 * sliding windows. Boxes swap by `pos` (like `sort`), pointers are small
 * arrows that slide between indices, the window is one rect that moves and
 * resizes. An `algorithm` generates the ops; an explicit `ops` list plays as
 * written.
 */

import type { ArrayOp, ArrayScene, Timeline } from "../types.ts";
import { Builder, labelWidth } from "./builder.ts";

const fmt = (v: number | string): string => String(v);

export function generateArrayOps(scene: ArrayScene): ArrayOp[] {
  const a = scene.values;
  const n = a.length;
  const num = (i: number): number => Number(a[i]);
  const ops: ArrayOp[] = [];
  const algo = scene.algorithm ?? "binary-search";

  if (algo === "binary-search") {
    const target = scene.target ?? Number.NaN;
    let lo = 0;
    let hi = n - 1;
    ops.push({ pointers: { lo, hi }, caption: `Search for ${target}: lo = 0, hi = ${hi}` });
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      ops.push({ pointers: { mid }, caption: `mid = (${lo} + ${hi}) / 2 = ${mid}` });
      if (num(mid) === target) {
        ops.push({ found: mid, caption: `a[${mid}] = ${a[mid]}: found ${target} at index ${mid}` });
        return ops;
      }
      if (num(mid) < target) {
        lo = mid + 1;
        ops.push({ pointers: { lo }, caption: `a[${mid}] = ${a[mid]} < ${target}: the answer is to the right, lo = ${lo}` });
      } else {
        hi = mid - 1;
        ops.push({ pointers: { hi }, caption: `a[${mid}] = ${a[mid]} > ${target}: the answer is to the left, hi = ${hi}` });
      }
    }
    ops.push({ pointers: { mid: null }, caption: `lo (${lo}) passed hi (${hi}): ${target} is not in the array` });
    return ops;
  }

  if (algo === "two-pointer-sum") {
    const target = scene.target ?? Number.NaN;
    let i = 0;
    let j = n - 1;
    ops.push({ pointers: { i, j }, caption: `Two pointers at the ends; looking for a pair that sums to ${target}` });
    while (i < j) {
      const s = num(i) + num(j);
      if (s === target) {
        ops.push({ mark: [i, j], caption: `${a[i]} + ${a[j]} = ${target}: found the pair` });
        return ops;
      }
      if (s < target) {
        i++;
        ops.push({ pointers: { i }, caption: `${a[i - 1]} + ${a[j]} = ${s} < ${target}: need more, move i right` });
      } else {
        j--;
        ops.push({ pointers: { j }, caption: `${a[i]} + ${a[j + 1]} = ${s} > ${target}: need less, move j left` });
      }
    }
    ops.push({ note: `The pointers met: no pair sums to ${target}` });
    return ops;
  }

  // sliding-window: maximum sum window of length k
  const k = Math.max(1, Math.min(n, scene.window ?? 3));
  let sum = 0;
  for (let i = 0; i < k; i++) sum += num(i);
  let best = sum;
  let bestAt = 0;
  ops.push({ window: [0, k - 1], caption: `Window of ${k}: ${a.slice(0, k).join(" + ")} = ${sum}` });
  for (let i = 1; i + k - 1 < n; i++) {
    const out = num(i - 1);
    const inn = num(i + k - 1);
    sum += inn - out;
    ops.push({ window: [i, i + k - 1], caption: `Slide: drop ${out}, add ${inn} → ${sum}${sum > best ? " (new best)" : ""}` });
    if (sum > best) {
      best = sum;
      bestAt = i;
    }
  }
  ops.push({ window: null, ms: 0 });
  ops.push({ mark: Array.from({ length: k }, (_, d) => bestAt + d), caption: `Best window: indices ${bestAt}–${bestAt + k - 1}, sum ${best}` });
  return ops;
}

export function compileArray(scene: ArrayScene): Timeline {
  const values = scene.values;
  const n = values.length;
  const ops = scene.ops ?? generateArrayOps(scene);
  const T0 = { fontSize: scene.theme?.fontSize ?? 14 };
  const texts = [...values.map(fmt), ...ops.flatMap((op) => ("set" in op ? [fmt(op.set.value)] : []))];
  const longest = texts.reduce((x, y) => (y.length > x.length ? y : x), "");
  const boxW = Math.max(44, Math.min(90, Math.round(labelWidth(longest || "00", T0.fontSize))));
  const boxH = Math.round(T0.fontSize * 2.4);
  const pointerNames: string[] = [];
  for (const op of ops) if ("pointers" in op) for (const name of Object.keys(op.pointers)) if (!pointerNames.includes(name)) pointerNames.push(name);
  const lanes = pointerNames.length;
  const top = (scene.title ? 44 : 20) + 16; // room for the window bracket above the boxes
  const laneH = 24;
  const b = new Builder(scene, { width: Math.max(320, n * boxW + 80), height: top + boxH + 20 + lanes * laneH + 56, stepMs: 600 });
  const T = b.theme;
  const x0 = Math.round((b.width - n * boxW) / 2);
  const x = (i: number): number => x0 + i * boxW + boxW / 2;
  const yBox = top + boxH / 2;
  const yIndex = top + boxH + 12;
  const yLane = (lane: number): number => yIndex + 14 + lane * laneH;

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });
  b.node({ id: "window", shape: "rect", pos: [x(0), yBox], size: [boxW - 2, boxH + 10], rx: 6, fill: "none", stroke: T.accent, strokeWidth: 2, opacity: 0 });
  values.forEach((v, i) => {
    b.node({ id: `cell-${i}`, shape: "group", pos: [x(i), yBox] });
    b.node({ id: `cell-${i}-rect`, shape: "rect", parent: `cell-${i}`, pos: [0, 0], size: [boxW - 6, boxH - 6], rx: 4, fill: T.node, stroke: T.nodeStroke, text: fmt(v), fontSize: T.fontSize, color: T.text });
    b.node({ id: `idx-${i}`, shape: "text", pos: [x(i), yIndex], text: String(i), fontSize: T.fontSize - 4, color: T.muted });
  });
  values.forEach((_, i) => b.anchor(String(i), `cell-${i}-rect`));
  b.anchor("window", "window");
  pointerNames.forEach((name, lane) => {
    b.anchor(name, `ptr-${name}`);
    b.node({ id: `ptr-${name}`, shape: "group", pos: [x(0), yLane(lane)], opacity: 0 });
    b.node({ id: `ptr-${name}-head`, shape: "path", parent: `ptr-${name}`, pos: [0, -6], d: "M 0 0 L -5 7 L 5 7 Z", fill: T.accent, stroke: T.accent });
    b.node({ id: `ptr-${name}-label`, shape: "text", parent: `ptr-${name}`, pos: [0, 9], text: name, fontSize: T.fontSize - 3, color: T.text });
  });

  const slots = values.map((_, i) => `cell-${i}`);
  const cur = [...values];
  const state = new Map<string, "plain" | "lit" | "marked">();
  const pointerAt = new Map<string, number>();
  let windowOn = false;
  const paint = (i: number, s: "plain" | "lit" | "marked" | "found", t = b.t): void => {
    const id = `${slots[i]}-rect`;
    if (s === "plain" && state.get(id) === "marked") s = "marked";
    state.set(id, s === "found" ? "marked" : s);
    b.set(id, "fill", s === "lit" ? T.accent : s === "marked" || s === "found" ? T.ok : T.node, t);
  };
  const arr = (v: number | number[]): number[] => (Array.isArray(v) ? v : [v]);
  let lit: number[] = [];

  b.step(scene.title ?? `Array: ${cur.join(", ")}`, "start");
  b.advance(b.stepMs * 0.6);
  for (const op of ops) {
    if (b.annotate(op)) continue;
    const ms = op.ms ?? b.stepMs;
    const caption = "caption" in op ? op.caption : undefined;
    // A compare highlight lasts one beat.
    for (const i of lit) paint(i, "plain");
    lit = [];
    if ("note" in op) {
      b.step(op.note);
      b.advance(ms);
    } else if ("pointers" in op) {
      const moves = Object.entries(op.pointers);
      if (ms > 0) b.step(caption ?? moves.map(([k, v]) => (v === null ? `drop ${k}` : `${k} = ${v}`)).join(", "));
      const t0 = b.t;
      const t1 = t0 + ms;
      for (const [name, idx] of moves) {
        const id = `ptr-${name}`;
        if (idx === null) {
          b.tween(id, "opacity", 0, t0, t0 + Math.min(200, ms));
          pointerAt.delete(name);
          continue;
        }
        const lane = pointerNames.indexOf(name);
        if (!pointerAt.has(name)) {
          b.set(id, "pos", [x(idx), yLane(lane)], t0);
          b.tween(id, "opacity", 1, t0, t0 + Math.min(200, ms));
        } else b.tween(id, "pos", [x(idx), yLane(lane)], t0, t1);
        pointerAt.set(name, idx);
      }
      b.advance(ms);
    } else if ("window" in op) {
      const t0 = b.t;
      const t1 = t0 + ms;
      if (op.window === null) {
        if (ms > 0) b.step(caption);
        if (ms > 0) b.tween("window", "opacity", 0, t0, t0 + Math.min(200, ms));
        else b.set("window", "opacity", 0, t0);
        windowOn = false;
      } else {
        const [i, j] = op.window;
        if (ms > 0) b.step(caption ?? `Window [${i}, ${j}]: ${cur.slice(i, j + 1).join(", ")}`);
        const cx = (x(i) + x(j)) / 2;
        const w = (j - i + 1) * boxW - 2;
        if (!windowOn) {
          b.set("window", "pos", [cx, yBox], t0);
          b.set("window", "size", [w, boxH + 10], t0);
          b.tween("window", "opacity", 1, t0, t0 + Math.min(200, ms));
          windowOn = true;
        } else {
          b.tween("window", "pos", [cx, yBox], t0, t1);
          b.tween("window", "size", [w, boxH + 10], t0, t1);
        }
      }
      b.advance(ms);
    } else if ("compare" in op) {
      const [i, j] = op.compare;
      b.step(caption ?? `Compare a[${i}] = ${cur[i]} and a[${j}] = ${cur[j]}`);
      paint(i, "lit");
      paint(j, "lit");
      lit = [i, j];
      b.advance(ms);
    } else if ("swap" in op) {
      const [i, j] = op.swap;
      b.step(caption ?? `Swap a[${i}] = ${cur[i]} and a[${j}] = ${cur[j]}`);
      const t0 = b.t;
      const t1 = t0 + ms;
      paint(i, "lit");
      paint(j, "lit");
      b.tween(slots[i], "pos", [x(j), yBox], t0, t1);
      b.tween(slots[j], "pos", [x(i), yBox], t0, t1);
      [slots[i], slots[j]] = [slots[j], slots[i]];
      [cur[i], cur[j]] = [cur[j], cur[i]];
      lit = [i, j];
      b.advance(ms);
    } else if ("set" in op) {
      const { index: i, value } = op.set;
      b.step(caption ?? `a[${i}] = ${fmt(value)}`);
      paint(i, "lit");
      b.set(`${slots[i]}-rect`, "text", fmt(value));
      cur[i] = value;
      lit = [i];
      b.advance(ms);
    } else if ("highlight" in op) {
      const idx = arr(op.highlight);
      if (ms > 0) b.step(caption ?? `Look at ${idx.map((i) => `a[${i}] = ${cur[i]}`).join(", ")}`);
      for (const i of idx) paint(i, "lit");
      b.advance(ms);
    } else if ("unhighlight" in op) {
      if (ms > 0) b.step(caption);
      const idx = op.unhighlight === "all" ? slots.map((_, i) => i).filter((i) => state.get(`${slots[i]}-rect`) === "lit") : arr(op.unhighlight);
      for (const i of idx) paint(i, "plain");
      b.advance(ms * 0.5);
    } else if ("mark" in op) {
      const idx = arr(op.mark);
      if (ms > 0) b.step(caption ?? (idx.length === 1 ? `a[${idx[0]}] = ${cur[idx[0]]} is settled` : `Indices ${idx.join(", ")} are settled`));
      for (const i of idx) paint(i, "marked");
      b.advance(ms);
    } else if ("found" in op) {
      const i = op.found;
      b.step(caption ?? `Found ${cur[i]} at index ${i}`);
      const t0 = b.t;
      paint(i, "found", t0);
      b.tween(slots[i], "scale", 1.15, t0, t0 + ms * 0.4, "ease-out");
      b.tween(slots[i], "scale", 1, t0 + ms * 0.4, t0 + ms * 0.8, "ease-in-out");
      b.advance(ms);
    }
  }
  for (const i of lit) paint(i, "plain");
  b.step(undefined, "end");
  b.advance(b.stepMs * 0.4);
  const found = ops.filter((op) => "found" in op).map((op) => (op as { found: number }).found);
  return b.build({
    title: scene.title,
    kind: "array",
    finalOrder: cur,
    slots,
    slotX: values.map((_, i) => x(i)),
    found: found.length ? found[found.length - 1] : undefined,
    pointers: Object.fromEntries(pointerAt),
  });
}
