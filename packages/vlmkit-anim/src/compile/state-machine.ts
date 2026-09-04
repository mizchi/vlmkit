/**
 * `state-machine` → states as circles, transitions as labelled arrows, and a
 * token that walks the trace. The active state is filled with the accent
 * colour; each fired event is one step with a caption "on <event>: a → b".
 */

import type { StateMachineScene, Timeline } from "../types.ts";
import { Builder, along, labelWidth, trimEdge } from "./builder.ts";
import { layoutNodes } from "./layout.ts";

export function compileStateMachine(scene: StateMachineScene): Timeline {
  const states = scene.states.map((s) => (typeof s === "string" ? { id: s } : s));
  const layout = scene.layout ?? "lr";
  const fontSize = scene.theme?.fontSize ?? 14;
  const radius = new Map(states.map((s) => [s.id, Math.max(28, Math.ceil(labelWidth(s.label ?? s.id, fontSize) / 2) - 2)]));
  const R = Math.max(...radius.values());
  // Room between neighbouring states for the widest transition label.
  const widestLabel = Math.max(60, ...scene.transitions.map((t) => labelWidth(t.note ? `${t.on} ${t.note}` : t.on, fontSize - 2)));
  const span = states.length * R * 2 + (states.length - 1) * (widestLabel + 16) + 80;
  const b = new Builder(scene, {
    width: layout === "lr" ? Math.max(640, Math.round(span)) : 640,
    height: layout === "tb" ? Math.max(360, states.length * (R * 2 + 70)) : 360,
    stepMs: 700,
  });
  const T = b.theme;
  const ids = states.map((s) => s.id);
  // Pinned states are given in canvas coordinates; the layout works in a frame
  // inset by the title and caption bands, so translate pins into it and back.
  const fixed = new Map<string, [number, number]>();
  for (const s of states) if (s.pos) fixed.set(s.id, [s.pos[0] - 30, s.pos[1] - 40]);
  const pos = layoutNodes(
    { ids, edges: scene.transitions.map((t) => [t.from, t.to]), fixed, width: b.width - 60, height: b.height - 90, nodeW: R * 2.5, nodeH: R * 2.5 },
    layout,
  );
  for (const [id, p] of pos) pos.set(id, [p[0] + 30, p[1] + 40]);

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });

  // Transitions first so states draw over the arrow ends.
  const seen = new Map<string, { k: number; n: [number, number] }>();
  scene.transitions.forEach((tr, i) => {
    const a = pos.get(tr.from)!;
    const c = pos.get(tr.to)!;
    const id = `tr-${i}`;
    const label = tr.note ? `${tr.on} ${tr.note}` : tr.on;
    const ra = radius.get(tr.from)!;
    const rc = radius.get(tr.to)!;
    if (tr.from === tr.to) {
      // Self loop: a small arc above the state.
      const d = `M ${a[0] - 12} ${a[1] - ra + 4} C ${a[0] - 40} ${a[1] - ra - 50}, ${a[0] + 40} ${a[1] - ra - 50}, ${a[0] + 12} ${a[1] - ra + 4}`;
      b.node({ id, shape: "path", d, stroke: T.nodeStroke, fill: "none" });
      b.node({ id: `${id}-label`, shape: "text", pos: [a[0], a[1] - ra - 48], text: label, fontSize: T.fontSize - 2, color: T.text });
      return;
    }
    // Parallel edges (a→b and b→a) share one perpendicular, fixed by the first of
    // the pair, so the partner is offset to the side AWAY from the first edge's
    // label. The first edge's label sits on the -n side (above a rightward arrow);
    // each further edge is shifted along +n and its label placed beyond it.
    const key = [tr.from, tr.to].sort().join("|");
    const [p, q] = trimEdge(a, c, ra + 2, rc + 6);
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const pair = seen.get(key) ?? { k: 0, n: [-dy / len, dx / len] as [number, number] };
    seen.set(key, { k: pair.k + 1, n: pair.n });
    const [nx, ny] = pair.n;
    const off = pair.k * 14;
    const pp: [number, number] = [p[0] + nx * off, p[1] + ny * off];
    const qq: [number, number] = [q[0] + nx * off, q[1] + ny * off];
    b.node({ id, shape: "arrow", points: [pp, qq], stroke: T.nodeStroke });
    const mid = along(pp, qq, 0.5);
    const labelOff = pair.k === 0 ? -13 : off + 13;
    b.node({ id: `${id}-label`, shape: "text", pos: [mid[0] + nx * labelOff, mid[1] + ny * labelOff], text: label, fontSize: T.fontSize - 2, color: T.text });
  });

  for (const s of states) {
    const p = pos.get(s.id)!;
    const r = radius.get(s.id)!;
    if (s.final) b.node({ id: `state-${s.id}-ring`, shape: "circle", pos: p, r: r + 5, fill: "none", stroke: T.nodeStroke });
    b.node({ id: `state-${s.id}`, shape: "circle", pos: p, r, fill: T.node, stroke: T.nodeStroke, strokeWidth: 2, text: s.label ?? s.id, fontSize: T.fontSize, color: T.text });
  }
  b.node({ id: "token", shape: "circle", pos: pos.get(scene.initial)!, r: 7, fill: T.accent, stroke: T.nodeStroke, opacity: 1 });

  const table = new Map<string, Map<string, { to: string; index: number }>>();
  scene.transitions.forEach((tr, i) => {
    const row = table.get(tr.from) ?? new Map();
    row.set(tr.on, { to: tr.to, index: i });
    table.set(tr.from, row);
  });

  let cur = scene.initial;
  const visited = [cur];
  b.set(`state-${cur}`, "fill", T.accent, 0);
  b.step(`Start in "${cur}"`, "start");
  b.advance(b.stepMs * 0.8);
  for (const ev of scene.trace) {
    const hit = table.get(cur)?.get(ev);
    if (!hit) break; // validator reports this; compile what is legal.
    const next = hit.to;
    b.step(`on ${ev}: ${cur} → ${next}`, ev);
    b.set(`tr-${hit.index}`, "stroke", T.accent);
    const t0 = b.t;
    const t1 = b.advance();
    b.tween("token", "pos", pos.get(next)!, t0, t1);
    b.set(`state-${cur}`, "fill", T.node, t0 + (t1 - t0) * 0.5);
    b.set(`state-${next}`, "fill", T.accent, t1);
    b.set(`tr-${hit.index}`, "stroke", T.nodeStroke, t1);
    b.advance(b.stepMs * 0.4);
    cur = next;
    visited.push(cur);
  }
  const finalState = states.find((s) => s.id === cur);
  b.step(finalState?.final ? `End in final state "${cur}"` : `End in "${cur}"`, "end");
  b.advance(b.stepMs * 0.5);
  return b.build({ title: scene.title, kind: "state-machine", visited });
}
