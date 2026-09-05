/**
 * `stack` and `queue` → fixed slots (a column for the stack, a row for the
 * queue) with values as boxes that slide in from one side and out the other.
 * A pop / dequeue moves the removed box out and fades it; a dequeue then
 * shifts every remaining box one slot toward the front. `top` / `back`
 * pointers follow the last occupied slot. The checker reads the final
 * contents back by slot.
 */

import type { QueueOp, QueueScene, StackOp, StackScene, Timeline } from "../types.ts";
import { Builder, labelWidth } from "./builder.ts";

const fmt = (v: number | string): string => String(v);

export function compileStack(scene: StackScene): Timeline {
  return compileCollection(scene, "stack");
}

export function compileQueue(scene: QueueScene): Timeline {
  return compileCollection(scene, "queue");
}

type Op = StackOp | QueueOp;

function compileCollection(scene: StackScene | QueueScene, mode: "stack" | "queue"): Timeline {
  const initial = scene.initial ?? [];
  const ops = scene.ops as Op[];
  const adds = ops.filter((o) => "push" in o || "enqueue" in o).length;
  const capacity = scene.capacity ?? Math.max(1, initial.length + adds);
  const texts = [...initial.map(fmt), ...ops.flatMap((o) => ("push" in o ? [fmt(o.push)] : "enqueue" in o ? [fmt(o.enqueue)] : []))];
  const longest = texts.reduce((a, c) => (c.length > a.length ? c : a), "");
  const fontSize = scene.theme?.fontSize ?? 14;
  const boxW = Math.max(56, Math.min(110, Math.round(labelWidth(longest || "00", fontSize))));
  const boxH = Math.round(fontSize * 2.3);
  const gap = 6;
  const title = scene.title ? 44 : 20;

  const b =
    mode === "stack"
      ? new Builder(scene, { width: Math.max(360, boxW + 260), height: title + capacity * (boxH + gap) + 90, stepMs: 550 })
      : new Builder(scene, { width: Math.max(360, capacity * (boxW + gap) + 200), height: title + boxH + 130, stepMs: 550 });
  const T = b.theme;
  const cx = mode === "stack" ? b.width / 2 - 40 : 0;
  const baseY = mode === "stack" ? b.height - 60 - boxH / 2 : title + 40 + boxH / 2;
  const x0 = mode === "queue" ? Math.round((b.width - capacity * (boxW + gap)) / 2) + 40 : 0;
  const slot = (i: number): [number, number] => (mode === "stack" ? [cx, baseY - i * (boxH + gap)] : [x0 + i * (boxW + gap) + boxW / 2, baseY]);
  const inPos: [number, number] = mode === "stack" ? [b.width - 70, slot(capacity - 1)[1]] : [b.width - 40, baseY];
  const outPos: [number, number] = mode === "stack" ? [b.width - 60, baseY] : [30, baseY];

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });
  for (let i = 0; i < capacity; i++) {
    b.node({ id: `slot-${i}`, shape: "rect", pos: slot(i), size: [boxW, boxH], rx: 4, fill: "none", stroke: T.muted, opacity: 0.5 });
    b.anchor(String(i), `slot-${i}`);
  }
  if (mode === "stack") b.anchor("top", "ptr-top");
  else {
    b.anchor("front", "ptr-front");
    b.anchor("back", "ptr-back");
  }
  if (mode === "stack") {
    b.node({ id: "base", shape: "line", points: [[cx - boxW / 2 - 10, baseY + boxH / 2 + 4], [cx + boxW / 2 + 10, baseY + boxH / 2 + 4]], stroke: T.nodeStroke, strokeWidth: 2 });
    b.node({ id: "ptr-top", shape: "text", pos: [cx + boxW / 2 + 30, baseY], text: "← top", fontSize: T.fontSize - 2, color: T.accent, anchor: "start", opacity: 0 });
    b.node({ id: "in-label", shape: "text", pos: [inPos[0] + boxW / 2 + 6, inPos[1]], text: "in", fontSize: T.fontSize - 3, color: T.muted, anchor: "start" });
    b.node({ id: "out-label", shape: "text", pos: [outPos[0] + boxW / 2 + 6, outPos[1]], text: "out", fontSize: T.fontSize - 3, color: T.muted, anchor: "start" });
  } else {
    b.node({ id: "ptr-front", shape: "text", pos: [slot(0)[0], baseY + boxH / 2 + 16], text: "front", fontSize: T.fontSize - 2, color: T.accent, opacity: 0 });
    b.node({ id: "ptr-back", shape: "text", pos: [slot(0)[0], baseY - boxH / 2 - 12], text: "back", fontSize: T.fontSize - 2, color: T.accent, opacity: 0 });
    b.node({ id: "in-label", shape: "text", pos: [inPos[0], inPos[1] + boxH / 2 + 16], text: "in", fontSize: T.fontSize - 3, color: T.muted });
    b.node({ id: "out-label", shape: "text", pos: [outPos[0], outPos[1] + boxH / 2 + 16], text: "out", fontSize: T.fontSize - 3, color: T.muted });
  }

  const items: { id: string; value: number | string }[] = [];
  let created = 0;
  const token = (v: number | string, at: [number, number]): string => {
    const id = `v-${created++}`;
    b.node({ id, shape: "rect", pos: at, size: [boxW - 4, boxH - 4], rx: 4, fill: T.node, stroke: T.nodeStroke, strokeWidth: 1.5, text: fmt(v), fontSize: T.fontSize, color: T.text, opacity: 0 });
    b.anchor(fmt(v), id); // a value is an anchor too; a duplicate value names the newest box
    return id;
  };
  const show = (id: string, on: boolean, t: number): void => {
    if (b.valueAt(id, "opacity", t) !== (on ? 1 : 0)) b.set(id, "opacity", on ? 1 : 0, t);
  };
  const pointers = (t: number, animate: boolean): void => {
    const n = items.length;
    if (mode === "stack") {
      show("ptr-top", n > 0, t);
      if (n > 0) {
        const p: [number, number] = [cx + boxW / 2 + 30, slot(n - 1)[1]];
        if (animate) b.tween("ptr-top", "pos", p, t, t + b.stepMs * 0.6);
        else b.set("ptr-top", "pos", p, t);
      }
    } else {
      show("ptr-front", n > 0, t);
      show("ptr-back", n > 0, t);
      if (n > 0) {
        const p: [number, number] = [slot(n - 1)[0], baseY - boxH / 2 - 12];
        if (animate) b.tween("ptr-back", "pos", p, t, t + b.stepMs * 0.6);
        else b.set("ptr-back", "pos", p, t);
      }
    }
  };

  initial.forEach((v, i) => {
    const id = token(v, slot(i));
    b.set(id, "opacity", 1, 0);
    items.push({ id, value: v });
  });
  pointers(0, false);
  const name = mode === "stack" ? "Stack" : "Queue";
  const order = (): string => (items.length ? items.map((it) => fmt(it.value)).join(", ") : "empty");
  b.step(scene.title ?? `${name}: ${order()}`, "start");
  b.advance(b.stepMs * 0.7);

  const removed: (number | string)[] = [];
  const refused: (number | string)[] = [];
  for (const op of ops) {
    if (b.annotate(op)) continue;
    if ("note" in op) {
      b.step(op.note);
      b.advance(b.stepMs);
      continue;
    }
    if ("push" in op || "enqueue" in op) {
      const v = "push" in op ? op.push : op.enqueue;
      if (items.length >= capacity) {
        refused.push(v);
        const id = token(v, inPos);
        b.step(op.caption ?? `${mode === "stack" ? "push" : "enqueue"} ${fmt(v)}: the ${mode} is full (${capacity}), refused`);
        const t0 = b.t;
        b.set(id, "opacity", 1, t0);
        b.set(id, "fill", T.bad, t0);
        b.tween(id, "opacity", 0, t0 + b.stepMs * 0.6, t0 + b.stepMs);
        b.advance(b.stepMs * 1.2);
        continue;
      }
      const i = items.length;
      const id = token(v, inPos);
      b.step(op.caption ?? (mode === "stack" ? `push ${fmt(v)}: it goes on top` : `enqueue ${fmt(v)}: it joins at the back`));
      const t0 = b.t;
      const t1 = t0 + b.stepMs;
      b.set(id, "opacity", 1, t0);
      b.set(id, "fill", T.accent, t0);
      b.tween(id, "pos", slot(i), t0, t1);
      b.set(id, "fill", T.node, t1);
      items.push({ id, value: v });
      pointers(t0, true);
      b.advance(b.stepMs * 1.2);
      continue;
    }
    if ("pop" in op || "dequeue" in op) {
      if (items.length === 0) {
        b.step(op.caption ?? `${mode === "stack" ? "pop" : "dequeue"} on an empty ${mode}: nothing to remove`);
        b.advance(b.stepMs);
        continue;
      }
      const it = mode === "stack" ? items.pop()! : items.shift()!;
      removed.push(it.value);
      b.step(op.caption ?? (mode === "stack" ? `pop → ${fmt(it.value)}: the last one in is the first one out` : `dequeue → ${fmt(it.value)}: the first one in is the first one out`));
      const t0 = b.t;
      const t1 = t0 + b.stepMs;
      b.set(it.id, "fill", T.ok, t0);
      b.tween(it.id, "pos", outPos, t0, t1);
      b.tween(it.id, "opacity", 0, t1, t1 + b.stepMs * 0.4);
      if (mode === "queue") items.forEach((rest, k) => b.tween(rest.id, "pos", slot(k), t0 + b.stepMs * 0.3, t1 + b.stepMs * 0.2));
      pointers(t0 + b.stepMs * 0.3, true);
      b.advance(b.stepMs * 1.4);
      continue;
    }
    // peek
    if (items.length === 0) {
      b.step(op.caption ?? `peek on an empty ${mode}: nothing there`);
      b.advance(b.stepMs);
      continue;
    }
    const it = mode === "stack" ? items[items.length - 1] : items[0];
    b.step(op.caption ?? `peek → ${fmt(it.value)}: ${mode === "stack" ? "the top" : "the front"}, left in place`);
    const t0 = b.t;
    b.tween(it.id, "fill", T.accent, t0, t0 + 150);
    b.tween(it.id, "fill", T.node, t0 + b.stepMs * 0.8, t0 + b.stepMs);
    b.advance(b.stepMs * 1.1);
  }
  b.step(`${name}: ${order()}${removed.length ? ` · removed ${removed.map(fmt).join(", ")}` : ""}`, "end");
  b.advance(b.stepMs * 0.5);
  return b.build({ title: scene.title, kind: mode, finalContents: items.map((it) => it.value), removed, refused, slots: Array.from({ length: capacity }, (_, i) => slot(i)) });
}
