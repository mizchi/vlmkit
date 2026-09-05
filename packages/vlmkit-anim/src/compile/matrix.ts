/**
 * `matrix` → a grid of cells with optional row / column labels. Cells are
 * children of row groups, so a row swap is one `pos` tween per row and a
 * column swap is one per cell; a `set` writes the cell's text, with a token
 * flying in from each `from` cell when the value was computed from others
 * (a DP table filling, a matrix product). Positions are the story here too:
 * the checker reads the final grid back by slot.
 */

import type { CellRef, MatrixOp, MatrixScene, MatrixTarget, Timeline } from "../types.ts";
import { Builder, labelWidth, themeOf } from "./builder.ts";

const cellText = (v: number | string | null): string => (v === null ? "" : String(v));

export function compileMatrix(scene: MatrixScene): Timeline {
  const T = themeOf(scene);
  const rows = scene.cells.length;
  const cols = scene.cells[0]?.length ?? 0;
  const ops = scene.ops ?? [];

  // Cell size from the widest text that will ever be shown (initial cells and `set` values).
  const texts = scene.cells.flat().map(cellText);
  for (const op of ops) if ("set" in op) texts.push(String(op.set.value));
  const longest = texts.reduce((a, b) => (b.length > a.length ? b : a), "");
  const cellW = Math.max(44, Math.min(120, Math.round(labelWidth(longest || "00", T.fontSize))));
  const cellH = Math.round(T.fontSize * 2.4);
  const rowLabelW = scene.rowLabels ? Math.round(labelWidth(scene.rowLabels.reduce((a, b) => (b.length > a.length ? b : a), ""), T.fontSize)) : 0;
  const top = (scene.title ? 44 : 20) + (scene.colLabels ? 24 : 0);
  const left = 24 + rowLabelW;
  const b = new Builder(scene, { width: Math.max(320, left + cols * cellW + 24), height: top + rows * cellH + 60, stepMs: 600 });
  // Centre the grid when the author gave a wider canvas.
  const x0 = Math.round((b.width - (left + cols * cellW + 24)) / 2) + left;
  const x = (c: number): number => x0 + c * cellW + cellW / 2;
  const y = (r: number): number => top + r * cellH + cellH / 2;

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });
  scene.colLabels?.forEach((l, c) => b.node({ id: `col-label-${c}`, shape: "text", pos: [x(c), top - 12], text: l, fontSize: T.fontSize - 1, color: T.muted }));
  scene.cells.forEach((row, r) => {
    b.node({ id: `row-${r}`, shape: "group", pos: [0, y(r)] });
    if (scene.rowLabels) b.node({ id: `row-label-${r}`, shape: "text", parent: `row-${r}`, pos: [x0 - 10, 0], text: scene.rowLabels[r] ?? "", fontSize: T.fontSize - 1, color: T.muted, anchor: "end" });
    row.forEach((v, c) => {
      b.node({
        id: `cell-${r}-${c}`,
        shape: "rect",
        parent: `row-${r}`,
        pos: [x(c), 0],
        size: [cellW - 4, cellH - 4],
        rx: 3,
        fill: v === null ? "#f3f4f6" : T.node,
        stroke: T.nodeStroke,
        text: cellText(v),
        fontSize: T.fontSize,
        color: T.text,
      });
    });
  });
  // Anchors: "r,c" for a cell, "row:<label or index>" and "col:<label or index>" for a line of cells.
  scene.cells.forEach((row, r) => {
    row.forEach((_, c) => b.anchor(`${r},${c}`, `cell-${r}-${c}`));
    const rowIds = row.map((_, c) => `cell-${r}-${c}`);
    b.anchor(`row:${r}`, ...rowIds);
    if (scene.rowLabels?.[r] !== undefined) b.anchor(`row:${scene.rowLabels[r]}`, ...rowIds);
  });
  (scene.cells[0] ?? []).forEach((_, c) => {
    const colIds = scene.cells.map((_, r) => `cell-${r}-${c}`);
    b.anchor(`col:${c}`, ...colIds);
    if (scene.colLabels?.[c] !== undefined) b.anchor(`col:${scene.colLabels[c]}`, ...colIds);
  });
  const maxFrom = Math.max(0, ...ops.map((op) => ("set" in op ? op.set.from?.length ?? 0 : 0)));
  for (let k = 0; k < maxFrom; k++) b.node({ id: `token-${k}`, shape: "circle", pos: [0, 0], r: 6, fill: T.accent, stroke: T.nodeStroke, opacity: 0 });

  // slot → original index
  const rowAt = scene.cells.map((_, r) => r);
  const colAt = (scene.cells[0] ?? []).map((_, c) => c);
  const cur = scene.cells.map((row) => row.map(cellText));
  const idAt = (r: number, c: number): string => `cell-${rowAt[r]}-${colAt[c]}`;
  const state = new Map<string, "plain" | "lit" | "marked">();
  const baseFill = (id: string): string => {
    const [, r, c] = id.split("-").map(Number);
    const v = cur[rowAt.indexOf(r)]?.[colAt.indexOf(c)];
    return v === "" ? "#f3f4f6" : T.node;
  };
  const targets = (t: MatrixTarget): CellRef[] => {
    if ("cell" in t) return [t.cell];
    if ("cells" in t) return t.cells;
    if ("row" in t) return colAt.map((_, c): CellRef => [t.row, c]);
    return rowAt.map((_, r): CellRef => [r, t.col]);
  };
  const name = (t: MatrixTarget): string => {
    if ("row" in t) return `row ${scene.rowLabels?.[t.row] ?? t.row}`;
    if ("col" in t) return `column ${scene.colLabels?.[t.col] ?? t.col}`;
    const refs = "cell" in t ? [t.cell] : t.cells;
    return (refs.length === 1 ? "cell " : "cells ") + refs.map(ref).join(", ");
  };
  const ref = ([r, c]: CellRef): string => (scene.rowLabels || scene.colLabels ? `(${scene.rowLabels?.[r] ?? r}, ${scene.colLabels?.[c] ?? c})` : `[${r}, ${c}]`);
  const paint = (id: string, s: "plain" | "lit" | "marked", t = b.t): void => {
    if (s === "plain" && state.get(id) === "marked") s = "marked";
    state.set(id, s);
    b.set(id, "fill", s === "lit" ? T.accent : s === "marked" ? T.ok : baseFill(id), t);
  };

  b.step(scene.title ?? "Start", "start");
  b.advance(b.stepMs * 0.6);

  for (const op of ops) {
    if (b.annotate(op)) continue;
    const ms = op.ms ?? b.stepMs;
    const caption = "caption" in op ? op.caption : undefined;
    if ("note" in op) {
      b.step(op.note);
      b.advance(ms);
    } else if ("set" in op) {
      const [r, c] = op.set.cell;
      const id = idAt(r, c);
      const from = op.set.from ?? [];
      b.step(caption ?? `${ref([r, c])} = ${op.set.value}${from.length ? ` (from ${from.map(ref).join(", ")})` : ""}`);
      const t0 = b.t;
      const tArrive = t0 + ms * 0.6;
      for (const [k, src] of from.entries()) {
        paint(idAt(src[0], src[1]), "lit", t0);
        b.set(`token-${k}`, "pos", [x(src[1]), y(src[0])], t0);
        b.set(`token-${k}`, "opacity", 1, t0);
        b.tween(`token-${k}`, "pos", [x(c), y(r)], t0, tArrive);
        b.set(`token-${k}`, "opacity", 0, tArrive);
      }
      cur[r][c] = String(op.set.value);
      b.set(id, "text", cur[r][c], from.length ? tArrive : t0);
      paint(id, "lit", from.length ? tArrive : t0);
      const t1 = b.advance(ms);
      for (const src of from) paint(idAt(src[0], src[1]), "plain", t1);
      paint(id, "plain", t1);
    } else if ("highlight" in op) {
      b.step(caption ?? `Look at ${name(op.highlight)}`);
      for (const [r, c] of targets(op.highlight)) paint(idAt(r, c), "lit");
      b.advance(ms);
    } else if ("unhighlight" in op) {
      b.step(caption);
      const refs = op.unhighlight === "all" ? [...state.entries()].filter(([, s]) => s === "lit").map(([id]) => id) : targets(op.unhighlight).map(([r, c]) => idAt(r, c));
      for (const id of refs) paint(id, "plain");
      b.advance(ms * 0.5);
    } else if ("mark" in op) {
      b.step(caption ?? `${name(op.mark)} is done`);
      for (const [r, c] of targets(op.mark)) paint(idAt(r, c), "marked");
      b.advance(ms);
    } else if ("swap" in op) {
      const t0 = b.t;
      const t1 = t0 + ms;
      if ("rows" in op.swap) {
        const [i, j] = op.swap.rows;
        b.step(caption ?? `Swap rows ${scene.rowLabels?.[i] ?? i} and ${scene.rowLabels?.[j] ?? j}`);
        b.tween(`row-${rowAt[i]}`, "pos", [0, y(j)], t0, t1);
        b.tween(`row-${rowAt[j]}`, "pos", [0, y(i)], t0, t1);
        [rowAt[i], rowAt[j]] = [rowAt[j], rowAt[i]];
        [cur[i], cur[j]] = [cur[j], cur[i]];
      } else {
        const [i, j] = op.swap.cols;
        b.step(caption ?? `Swap columns ${scene.colLabels?.[i] ?? i} and ${scene.colLabels?.[j] ?? j}`);
        for (const r of rowAt) {
          b.tween(`cell-${r}-${colAt[i]}`, "pos", [x(j), 0], t0, t1);
          b.tween(`cell-${r}-${colAt[j]}`, "pos", [x(i), 0], t0, t1);
        }
        if (scene.colLabels) {
          b.tween(`col-label-${colAt[i]}`, "pos", [x(j), top - 12], t0, t1);
          b.tween(`col-label-${colAt[j]}`, "pos", [x(i), top - 12], t0, t1);
        }
        [colAt[i], colAt[j]] = [colAt[j], colAt[i]];
        for (const row of cur) [row[i], row[j]] = [row[j], row[i]];
      }
      b.advance(ms);
    }
  }
  b.step(undefined, "end");
  b.advance(b.stepMs * 0.4);
  return b.build({ title: scene.title, kind: "matrix", finalCells: cur, rowOrder: rowAt, colOrder: colAt, slots: { x: colAt.map((_, c) => x(c)), y: rowAt.map((_, r) => y(r)) } });
}

export type { MatrixOp };
