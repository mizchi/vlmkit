/**
 * `heap` → a binary tree of fixed slots with values as tokens that sift up
 * and down. Slots and edges never move; a swap is two token `pos` tweens, so
 * the frame at any step marker is a heap the checker can read by slot.
 */

import type { HeapScene, Timeline } from "../types.ts";
import { Builder } from "./builder.ts";

export function compileHeap(scene: HeapScene): Timeline {
  const b = new Builder(scene, { width: 640, height: 400, stepMs: 550 });
  const T = b.theme;
  const isMin = (scene.type ?? "min") === "min";
  const better = (a: number, c: number): boolean => (isMin ? a < c : a > c);

  // Capacity: initial + pushes, so the slot tree is sized up front.
  const pushes = scene.ops.filter((o) => "push" in o).length;
  const cap = Math.max(1, (scene.initial?.length ?? 0) + pushes);
  const depth = Math.floor(Math.log2(cap)) + 1;
  const R = Math.max(12, Math.min(22, Math.floor(b.width / (2 ** depth * 2.6))));
  const top = 60;
  const levelH = Math.min(80, (b.height - top - 90) / Math.max(1, depth - 1));
  const slotPos = (i: number): [number, number] => {
    const level = Math.floor(Math.log2(i + 1));
    const idxInLevel = i - (2 ** level - 1);
    const count = 2 ** level;
    return [Math.round(b.width * ((idxInLevel + 0.5) / count)), Math.round(top + level * levelH)];
  };
  // Where the "incoming" / "outgoing" token parks.
  const outPos: [number, number] = [50, b.height - 70];
  const inPos: [number, number] = [b.width - 50, b.height - 70];

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });
  for (let i = 1; i < cap; i++) {
    const p = Math.floor((i - 1) / 2);
    b.node({ id: `edge-${i}`, shape: "line", points: [slotPos(p), slotPos(i)], stroke: T.muted, opacity: 0 });
  }
  for (let i = 0; i < cap; i++) b.node({ id: `slot-${i}`, shape: "circle", pos: slotPos(i), r: R, fill: "none", stroke: T.muted, opacity: 0.4 });
  b.node({ id: "out-label", shape: "text", pos: [outPos[0], outPos[1] + R + 14], text: "popped", fontSize: T.fontSize - 2, color: T.muted });

  const heap: { id: string; value: number }[] = [];
  let tokenCount = 0;
  const showSlot = (i: number, t: number): void => {
    b.set(`slot-${i}`, "opacity", 1, t);
    if (i > 0) b.set(`edge-${i}`, "opacity", 1, t);
  };
  const hideSlot = (i: number, t: number): void => {
    b.set(`slot-${i}`, "opacity", 0.4, t);
    if (i > 0) b.set(`edge-${i}`, "opacity", 0, t);
  };
  const token = (value: number, at: [number, number]): string => {
    const id = `v-${tokenCount++}`;
    b.node({ id, shape: "circle", pos: at, r: R - 2, fill: T.node, stroke: T.nodeStroke, strokeWidth: 2, text: String(value), fontSize: T.fontSize, color: T.text, opacity: 0 });
    return id;
  };
  const swap = (i: number, j: number, caption: string): void => {
    b.step(caption);
    b.set(heap[i].id, "fill", T.accent);
    b.set(heap[j].id, "fill", T.accent);
    const t0 = b.t;
    const t1 = b.advance();
    b.tween(heap[i].id, "pos", slotPos(j), t0, t1);
    b.tween(heap[j].id, "pos", slotPos(i), t0, t1);
    [heap[i], heap[j]] = [heap[j], heap[i]];
    b.set(heap[i].id, "fill", T.node, t1);
    b.set(heap[j].id, "fill", T.node, t1);
  };
  const siftUp = (i: number): void => {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (!better(heap[i].value, heap[p].value)) {
        b.step(`${heap[i].value} vs parent ${heap[p].value}: heap property holds`);
        b.advance(b.stepMs * 0.6);
        return;
      }
      swap(i, p, `${heap[i].value} ${isMin ? "<" : ">"} parent ${heap[p].value}: swap up`);
      i = p;
    }
  };
  const siftDown = (i: number): void => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let best = i;
      if (l < heap.length && better(heap[l].value, heap[best].value)) best = l;
      if (r < heap.length && better(heap[r].value, heap[best].value)) best = r;
      if (best === i) {
        if (l < heap.length) {
          b.step(`${heap[i].value} is ${isMin ? "≤" : "≥"} its children: stop`);
          b.advance(b.stepMs * 0.6);
        }
        return;
      }
      swap(i, best, `${heap[best].value} ${isMin ? "<" : ">"} ${heap[i].value}: swap down with the ${isMin ? "smaller" : "larger"} child`);
      i = best;
    }
  };

  // Initial contents appear in place, no sifting (validated to be a heap already by check.ts).
  (scene.initial ?? []).forEach((v, i) => {
    const id = token(v, slotPos(i));
    b.set(id, "opacity", 1, 0);
    showSlot(i, 0);
    heap.push({ id, value: v });
  });
  b.step(heap.length ? `${isMin ? "Min" : "Max"}-heap with ${heap.map((h) => h.value).join(", ")}` : `Empty ${isMin ? "min" : "max"}-heap`, "start");
  b.advance(b.stepMs * 0.7);

  const popped: number[] = [];
  for (const op of scene.ops) {
    if ("note" in op) {
      b.step(op.note);
      b.advance(b.stepMs * 0.8);
      continue;
    }
    if ("push" in op) {
      const i = heap.length;
      const id = token(op.push, inPos);
      b.step(op.caption ?? `push ${op.push}: place it in the next free slot`);
      b.set(id, "opacity", 1);
      const t0 = b.t;
      const t1 = b.advance();
      showSlot(i, t0);
      b.tween(id, "pos", slotPos(i), t0, t1);
      heap.push({ id, value: op.push });
      siftUp(i);
      continue;
    }
    // pop
    if (heap.length === 0) {
      b.step(op.caption ?? "pop on an empty heap: nothing happens");
      b.advance(b.stepMs * 0.6);
      continue;
    }
    const root = heap[0];
    b.step(op.caption ?? `pop: the root ${root.value} comes out`);
    const t0 = b.t;
    const t1 = b.advance();
    b.tween(root.id, "pos", outPos, t0, t1);
    b.set(root.id, "fill", T.ok, t0);
    popped.push(root.value);
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      b.step(`Move the last value ${last.value} to the root`);
      const t2 = b.t;
      const t3 = b.advance();
      hideSlot(heap.length, t2);
      b.tween(last.id, "pos", slotPos(0), t2, t3);
      siftDown(0);
    } else hideSlot(0, t1);
    b.set(root.id, "opacity", 0, b.t);
  }
  b.step(`Done. Heap: ${heap.map((h) => h.value).join(", ") || "(empty)"}${popped.length ? `; popped ${popped.join(", ")}` : ""}`, "end");
  b.advance(b.stepMs * 0.5);
  return b.build({ title: scene.title, kind: "heap", type: isMin ? "min" : "max", finalHeap: heap.map((h) => h.value), popped, slotIds: heap.map((h) => h.id) });
}
