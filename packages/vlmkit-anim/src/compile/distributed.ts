/**
 * `distributed` → a sequence-diagram-like picture: one box per node along
 * the top, a lifeline under each, and messages as dots travelling between
 * lifelines while their arrow draws in behind them. Time runs down the
 * canvas, so message order is visible at a glance; status events recolour
 * a node's box and its lifeline from that moment on.
 */

import type { DistributedScene, Timeline } from "../types.ts";
import { Builder, labelWidth } from "./builder.ts";

const STATUS_FILL: Record<string, keyof import("../types.ts").Theme> = { up: "node", down: "bad", leader: "accent", busy: "muted" };

export function compileDistributed(scene: DistributedScene): Timeline {
  const b = new Builder(scene, { width: 640, height: 400, stepMs: 600 });
  const T = b.theme;
  const nodes = scene.nodes.map((n) => (typeof n === "string" ? { id: n } : n));
  const n = nodes.length;
  const laneX = (i: number): number => Math.round(b.width * ((i + 0.5) / n));
  const laneOf = new Map(nodes.map((nd, i) => [nd.id, i]));
  const boxY = scene.title ? 60 : 40;
  const boxH = T.fontSize * 2.2;
  const lifeTop = boxY + boxH / 2 + 4;
  const lifeBottom = b.height - 40;

  // Resolve message times first: default is sequential; `after` anchors to when a
  // labelled earlier message lands, so a latency change upstream moves everything
  // that was written relative to it.
  const msgs = scene.messages.map((m) => ({ ...m, at: undefined as number | undefined, atRaw: m.at }));
  const landed = new Map<string, number>();
  let cursor = 0;
  let prevStart = 0;
  for (const m of msgs) {
    m.latency = m.latency ?? b.stepMs;
    if (typeof m.atRaw === "number") m.at = m.atRaw;
    else if (m.atRaw === "<") m.at = prevStart; // together with the previous message
    else if (m.after !== undefined) m.at = (landed.get(m.after) ?? cursor) + (m.delay ?? 0);
    else m.at = cursor;
    prevStart = m.at;
    cursor = Math.max(cursor, m.at + m.latency);
    if (m.label !== undefined) landed.set(m.label, m.at + m.latency);
  }
  const events = (scene.events ?? [])
    .map((e) => ({ ...e, at: e.at ?? (landed.get(e.after ?? "") ?? cursor) + (e.delay ?? 0) }))
    .sort((a, c) => a.at - c.at);
  const end = Math.max(cursor, ...events.map((e) => e.at + b.stepMs * 0.5), b.stepMs);
  // Vertical position is proportional to time.
  const yAt = (t: number): number => Math.round(lifeTop + 16 + ((lifeBottom - lifeTop - 24) * t) / Math.max(1, end));

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });
  nodes.forEach((nd, i) => {
    const x = laneX(i);
    const w = Math.min(labelWidth(nd.label ?? nd.id, T.fontSize), b.width / n - 12);
    const fill = T[STATUS_FILL[nd.status ?? "up"]];
    b.node({ id: `life-${nd.id}`, shape: "line", points: [[x, lifeTop], [x, lifeBottom]], stroke: nd.status === "down" ? T.bad : T.muted, strokeWidth: 1 });
    b.node({ id: `node-${nd.id}`, shape: "rect", pos: [x, boxY], size: [w, boxH], rx: 6, fill: String(fill), stroke: T.nodeStroke, strokeWidth: 1.5, text: nd.label ?? nd.id, fontSize: T.fontSize, color: T.text });
  });

  msgs.forEach((m, i) => {
    const from = laneOf.get(m.from)!;
    const to = laneOf.get(m.to)!;
    const y0 = yAt(m.at!);
    const y1 = yAt(m.at! + m.latency!);
    const x0 = laneX(from);
    const x1 = laneX(to);
    const dir = x1 > x0 ? 1 : -1;
    const p: [number, number] = [x0 + dir * 4, y0];
    const q: [number, number] = [x1 - dir * 8, y1];
    const id = `msg-${i}`;
    b.node({ id, shape: "arrow", points: [p, q], stroke: m.lost ? T.bad : T.nodeStroke, dash: 0, opacity: 0 });
    b.node({ id: `${id}-dot`, shape: "circle", pos: p, r: 6, fill: m.lost ? T.bad : T.accent, stroke: T.nodeStroke, opacity: 0 });
    if (m.label) {
      b.node({ id: `${id}-label`, shape: "text", pos: [(p[0] + q[0]) / 2, Math.min(y0, y1) - 9], text: m.label, fontSize: T.fontSize - 2, color: T.text, opacity: 0 });
    }
    const t0 = m.at!;
    const t1 = m.at! + m.latency!;
    b.step(m.caption ?? `${m.from} → ${m.to}${m.label ? `: ${m.label}` : ""}${m.lost ? " (lost)" : ""}`, undefined, t0);
    b.set(id, "opacity", 1, t0);
    b.set(`${id}-dot`, "opacity", 1, t0);
    if (m.label) b.set(`${id}-label`, "opacity", 1, t0);
    if (m.lost) {
      const tMid = t0 + (t1 - t0) * 0.55;
      b.tween(`${id}-dot`, "pos", [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], t0, tMid, "linear");
      b.tween(id, "dash", 0.5, t0, tMid, "linear");
      b.tween(`${id}-dot`, "opacity", 0, tMid, tMid + 150);
    } else {
      b.tween(`${id}-dot`, "pos", q, t0, t1, "linear");
      b.tween(id, "dash", 1, t0, t1, "linear");
      b.set(`${id}-dot`, "opacity", 0, t1);
    }
  });

  for (const e of events) {
    const fill = String(T[STATUS_FILL[e.status]]);
    b.step(e.caption ?? `${e.node} is ${e.status}`, undefined, e.at);
    b.tween(`node-${e.node}`, "fill", fill, e.at, e.at + 200);
    b.set(`life-${e.node}`, "stroke", e.status === "down" ? T.bad : T.muted, e.at);
  }
  b.t = end;
  b.step("end", "end");
  b.advance(b.stepMs * 0.3);
  const tl = b.build({
    title: scene.title,
    kind: "distributed",
    delivered: msgs.filter((m) => !m.lost).length,
    lost: msgs.filter((m) => m.lost).length,
    // Resolved timing, so the checker judges what was actually compiled.
    messageTimes: msgs.map((m) => [m.at!, m.at! + m.latency!]),
    eventTimes: events.map((e) => e.at),
  });
  // First step marker should exist at 0 for the runtime's "start" chapter.
  if (!tl.steps?.some((s) => s.t === 0)) tl.steps = [{ t: 0, label: "start", caption: scene.title }, ...(tl.steps ?? [])];
  return tl;
}
