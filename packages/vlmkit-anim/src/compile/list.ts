/**
 * `list` → a singly linked list: boxes in a row with an arrow between each
 * adjacent pair and a `head` marker on the first. Nodes move between fixed
 * slots (insert shifts the tail right, remove shifts it left, reverse trades
 * places), so the arrows are fixed geometry per slot gap — one forward and
 * one backward line each — toggled by opacity. `find` walks a cursor from
 * the head. The checker reads the final order back by x.
 */

import type { ListOp, ListScene, Timeline } from "../types.ts";
import { Builder, labelWidth } from "./builder.ts";

const fmt = (v: number | string): string => String(v);

export function compileList(scene: ListScene): Timeline {
  const initial = scene.initial ?? [];
  const inserts = scene.ops.filter((o) => "insert" in o).length;
  const capacity = Math.max(1, initial.length + inserts);
  const texts = [...initial.map(fmt), ...scene.ops.flatMap((o) => ("insert" in o ? [fmt(o.insert.value)] : []))];
  const longest = texts.reduce((a, c) => (c.length > a.length ? c : a), "");
  const fontSize = scene.theme?.fontSize ?? 14;
  const boxW = Math.max(44, Math.min(96, Math.round(labelWidth(longest || "00", fontSize))));
  const boxH = Math.round(fontSize * 2.3);
  const gapW = 34;
  const slotW = boxW + gapW;
  const title = scene.title ? 44 : 20;
  const b = new Builder(scene, { width: Math.max(360, capacity * slotW + 140), height: title + 96 + boxH + 90, stepMs: 550 });
  const T = b.theme;
  const x0 = Math.round((b.width - (capacity * slotW + 40)) / 2) + 20;
  const yRow = title + 96 + boxH / 2;
  const x = (i: number): number => x0 + i * slotW + boxW / 2;
  // Where a node appears before dropping in / after being unlinked: above the row, clear of the head marker.
  const above = (i: number): [number, number] => [x(i), yRow - boxH - 58];

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });
  b.node({ id: "head-label", shape: "text", pos: [x(0), yRow - boxH / 2 - 26], text: "head", fontSize: T.fontSize - 2, color: T.accent });
  b.node({ id: "head-arrow", shape: "arrow", points: [[x(0), yRow - boxH / 2 - 18], [x(0), yRow - boxH / 2 - 4]], stroke: T.accent, strokeWidth: 1.5 });
  for (let i = 0; i + 1 < capacity; i++) {
    const a: [number, number] = [x(i) + boxW / 2 + 2, yRow];
    const c: [number, number] = [x(i + 1) - boxW / 2 - 6, yRow];
    b.node({ id: `arr-${i}`, shape: "arrow", points: [a, c], stroke: T.nodeStroke, strokeWidth: 1.5, opacity: 0 });
    b.node({ id: `arr-${i}-rev`, shape: "arrow", points: [[c[0] + 4, yRow], [a[0] + 4, yRow]], stroke: T.accent, strokeWidth: 1.5, opacity: 0 });
  }
  b.node({ id: "nil", shape: "text", pos: [x(initial.length) - boxW / 2 + 10, yRow], text: "∅", fontSize: T.fontSize + 2, color: T.muted, anchor: "start", opacity: initial.length ? 1 : 1 });
  b.node({ id: "cursor", shape: "circle", pos: [x(0), yRow + boxH / 2 + 18], r: 6, fill: T.accent, stroke: T.nodeStroke, opacity: 0 });

  const nodes: { id: string; value: number | string }[] = [];
  let created = 0;
  const token = (v: number | string, at: [number, number]): string => {
    const id = `n-${created++}`;
    b.node({ id, shape: "rect", pos: at, size: [boxW - 4, boxH - 4], rx: 4, fill: T.node, stroke: T.nodeStroke, strokeWidth: 1.5, text: fmt(v), fontSize: T.fontSize, color: T.text, opacity: 0 });
    return id;
  };
  let shownArrows = 0;
  /** Show exactly `n - 1` forward arrows and park the ∅ after the last node. */
  const relink = (t: number): void => {
    const want = Math.max(0, nodes.length - 1);
    for (let i = 0; i < capacity - 1; i++) b.set(`arr-${i}`, "opacity", i < want ? 1 : 0, t);
    shownArrows = want;
    b.set("nil", "pos", [x(nodes.length) - boxW / 2 + 10, yRow], t);
  };
  initial.forEach((v, i) => {
    const id = token(v, [x(i), yRow]);
    b.set(id, "opacity", 1, 0);
    nodes.push({ id, value: v });
  });
  relink(0);
  const order = (): string => (nodes.length ? nodes.map((n) => fmt(n.value)).join(" → ") + " → ∅" : "∅ (empty)");
  b.step(scene.title ?? `List: ${order()}`, "start");
  b.advance(b.stepMs * 0.7);

  const finds: { value: number | string; hops: number; found: boolean }[] = [];
  for (const op of scene.ops) {
    if ("note" in op) {
      b.step(op.note);
      b.advance(b.stepMs);
      continue;
    }
    if ("insert" in op) {
      const { value: v } = op.insert;
      let p: number;
      let why: string;
      if (op.insert.after !== undefined) {
        const k = nodes.findIndex((n) => n.value === op.insert.after);
        if (k < 0) {
          b.step(op.caption ?? `Insert ${fmt(v)} after ${fmt(op.insert.after)}: ${fmt(op.insert.after)} is not in the list, nothing inserted`);
          b.advance(b.stepMs);
          continue;
        }
        p = k + 1;
        why = `after ${fmt(op.insert.after)}`;
      } else {
        p = Math.max(0, Math.min(nodes.length, op.insert.at ?? nodes.length));
        why = p === 0 ? "at the head" : p === nodes.length ? "at the tail" : `at position ${p}`;
      }
      const id = token(v, above(p));
      const prev = p > 0 ? nodes[p - 1] : undefined;
      const next = nodes[p];
      b.step(op.caption ?? `Insert ${fmt(v)} ${why}${prev ? `: ${fmt(prev.value)} will point to ${fmt(v)}` : ": it becomes the new head"}${next ? `, and ${fmt(v)} to ${fmt(next.value)}` : ""}`);
      const t0 = b.t;
      const tShift = t0 + b.stepMs * 0.6;
      const t1 = tShift + b.stepMs * 0.6;
      b.set(id, "opacity", 1, t0);
      b.set(id, "fill", T.accent, t0);
      // Everything from p on slides one slot right, then the new node drops in.
      for (let i = p; i < nodes.length; i++) b.tween(nodes[i].id, "pos", [x(i + 1), yRow], t0, tShift);
      b.set(`arr-${Math.max(0, shownArrows - 1)}`, "opacity", shownArrows ? 0 : 0, t0);
      b.tween(id, "pos", [x(p), yRow], tShift, t1);
      b.set(id, "fill", T.node, t1);
      nodes.splice(p, 0, { id, value: v });
      relink(t1);
      b.advance(b.stepMs * 1.5);
      continue;
    }
    if ("remove" in op) {
      const k = nodes.findIndex((n) => n.value === op.remove);
      if (k < 0) {
        b.step(op.caption ?? `Remove ${fmt(op.remove)}: it is not in the list`);
        b.advance(b.stepMs);
        continue;
      }
      const [gone] = nodes.splice(k, 1);
      const prev = nodes[k - 1];
      const next = nodes[k];
      b.step(op.caption ?? `Remove ${fmt(gone.value)}: ${prev ? `${fmt(prev.value)} now points to ${next ? fmt(next.value) : "∅"}` : next ? `${fmt(next.value)} becomes the head` : "the list is empty"}`);
      const t0 = b.t;
      const t1 = t0 + b.stepMs * 0.6;
      b.set(gone.id, "fill", T.bad, t0);
      b.tween(gone.id, "pos", above(k), t0, t1);
      b.tween(gone.id, "opacity", 0, t1, t1 + b.stepMs * 0.4);
      for (let i = k; i < nodes.length; i++) b.tween(nodes[i].id, "pos", [x(i), yRow], t1, t1 + b.stepMs * 0.6);
      for (let i = 0; i < capacity - 1; i++) if (i >= k - (k > 0 ? 1 : 0)) b.set(`arr-${i}`, "opacity", 0, t0);
      relink(t1 + b.stepMs * 0.6);
      b.advance(b.stepMs * 1.5);
      continue;
    }
    if ("find" in op) {
      const target = op.find;
      b.set("cursor", "pos", [x(0), yRow + boxH / 2 + 18]);
      b.set("cursor", "opacity", nodes.length ? 1 : 0);
      let hops = 0;
      let found = false;
      for (const [i, n] of nodes.entries()) {
        const t0 = b.t;
        const t1 = t0 + b.stepMs * 0.7;
        b.tween("cursor", "pos", [x(i), yRow + boxH / 2 + 18], t0, t0 + Math.min(200, b.stepMs * 0.4));
        b.tween(n.id, "fill", T.accent, t0, t0 + 150);
        if (n.value === target) {
          found = true;
          b.step(op.caption ?? `${fmt(n.value)} = ${fmt(target)}: found it after ${hops} hop${hops === 1 ? "" : "s"}`, undefined, t0);
          b.tween(n.id, "fill", T.ok, t0 + 200, t0 + 350);
          b.tween(n.id, "fill", T.node, t1 + b.stepMs * 0.4, t1 + b.stepMs * 0.6);
          b.advance(b.stepMs * 1.2);
          break;
        }
        b.step(`${fmt(n.value)} ≠ ${fmt(target)}: follow next`, undefined, t0);
        b.tween(n.id, "fill", T.node, t1 - 150, t1);
        hops++;
        b.advance(b.stepMs * 0.7);
      }
      if (!found) {
        b.step(op.caption ?? `Reached ∅ after ${hops} hop${hops === 1 ? "" : "s"}: ${fmt(target)} is not in the list`);
        b.advance(b.stepMs);
      }
      b.set("cursor", "opacity", 0);
      finds.push({ value: target, hops, found });
      continue;
    }
    // reverse: flip the arrows in place first, then let the boxes trade places so the list reads head-first again.
    const n = nodes.length;
    b.step(op.caption ?? `Reverse: every next pointer turns around; the old tail ${n ? fmt(nodes[n - 1].value) : ""} is the new head`);
    const t0 = b.t;
    const tFlip = t0 + b.stepMs * 0.8;
    const t1 = tFlip + b.stepMs;
    for (let i = 0; i < n - 1; i++) {
      b.set(`arr-${i}`, "opacity", 0, t0 + 150);
      b.set(`arr-${i}-rev`, "opacity", 1, t0 + 150);
    }
    if (n) {
      b.set("head-label", "pos", [x(n - 1), yRow - boxH / 2 - 26], t0 + 150);
      b.set("head-arrow", "opacity", 0, t0 + 150);
    }
    nodes.forEach((node, i) => b.tween(node.id, "pos", [x(n - 1 - i), yRow], tFlip, t1));
    nodes.reverse();
    for (let i = 0; i < n - 1; i++) b.set(`arr-${i}-rev`, "opacity", 0, t1);
    b.set("head-label", "pos", [x(0), yRow - boxH / 2 - 26], t1);
    b.set("head-arrow", "opacity", 1, t1);
    relink(t1);
    b.advance(b.stepMs * 2);
  }
  b.step(`List: ${order()}`, "end");
  b.advance(b.stepMs * 0.5);
  return b.build({ title: scene.title, kind: "list", finalOrder: nodes.map((n) => n.value), finds, slotX: Array.from({ length: capacity }, (_, i) => x(i)) });
}
