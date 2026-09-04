/**
 * `diagram` → boxes and arrows laid out automatically, walked through by a
 * `sequence` of narrated beats: reveal, highlight, flow a token along an
 * edge, relabel, or just pause on a note.
 */

import type { DiagramScene, Timeline } from "../types.ts";
import { Builder, along, boxRadius, labelWidth, trimEdge } from "./builder.ts";
import { layoutNodes } from "./layout.ts";

export function compileDiagram(scene: DiagramScene): Timeline {
  const b = new Builder(scene, { width: 640, height: 360, stepMs: 700 });
  const T = b.theme;
  const ids = scene.nodes.map((n) => n.id);
  const fixed = new Map<string, [number, number]>();
  for (const n of scene.nodes) if (n.pos) fixed.set(n.id, n.pos);
  const sizes = new Map<string, [number, number]>();
  for (const n of scene.nodes) {
    const label = n.label ?? n.id;
    const w = labelWidth(label, T.fontSize);
    const h = T.fontSize * 1.2 * label.split("\n").length + T.fontSize * 1.4;
    sizes.set(n.id, n.shape === "circle" ? [Math.max(w, h), Math.max(w, h)] : [w, h]);
  }
  const maxW = Math.max(...[...sizes.values()].map((s) => s[0]));
  const maxH = Math.max(...[...sizes.values()].map((s) => s[1]));
  const edges = (scene.edges ?? []).map((e): [string, string] => [e.from, e.to]);
  const pos = layoutNodes({ ids, edges, fixed, width: b.width - 40, height: b.height - 90, nodeW: maxW, nodeH: maxH }, scene.layout ?? "lr");
  for (const [id, p] of pos) if (!fixed.has(id)) pos.set(id, [p[0] + 20, p[1] + 40]);

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });

  const edgeEnds = new Map<string, [[number, number], [number, number]]>();
  const edgeId = new Map<string, string>();
  (scene.edges ?? []).forEach((e, i) => {
    const a = pos.get(e.from)!;
    const c = pos.get(e.to)!;
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const sa = sizes.get(e.from)!;
    const sc = sizes.get(e.to)!;
    const ra = scene.nodes.find((n) => n.id === e.from)?.shape === "circle" ? sa[0] / 2 : boxRadius(sa[0], sa[1], dx / len, dy / len);
    const rc = scene.nodes.find((n) => n.id === e.to)?.shape === "circle" ? sc[0] / 2 : boxRadius(sc[0], sc[1], dx / len, dy / len);
    const [p, q] = trimEdge(a, c, ra + 2, rc + (e.style === "line" ? 2 : 6));
    const id = `edge-${i}`;
    edgeEnds.set(`${e.from}->${e.to}`, [p, q]);
    edgeId.set(`${e.from}->${e.to}`, id);
    b.node({ id, shape: e.style === "line" ? "line" : "arrow", points: [p, q], stroke: T.nodeStroke, opacity: e.hidden ? 0 : 1 });
    if (e.label) {
      const mid = along(p, q, 0.5);
      const nx = -dy / len;
      const ny = dx / len;
      b.node({ id: `${id}-label`, shape: "text", pos: [mid[0] + nx * 11, mid[1] + ny * 11], text: e.label, fontSize: T.fontSize - 2, color: T.text, opacity: e.hidden ? 0 : 1 });
    }
  });
  for (const n of scene.nodes) {
    const p = pos.get(n.id)!;
    const s = sizes.get(n.id)!;
    const shape = n.shape ?? "rect";
    b.node({
      id: n.id,
      shape,
      pos: p,
      ...(shape === "circle" ? { r: s[0] / 2 } : { size: s, rx: 6 }),
      fill: n.fill ?? T.node,
      stroke: T.nodeStroke,
      strokeWidth: 1.5,
      text: n.label ?? n.id,
      fontSize: T.fontSize,
      color: T.text,
      opacity: n.hidden ? 0 : 1,
    });
  }
  b.node({ id: "token", shape: "circle", pos: [0, 0], r: 6, fill: T.accent, stroke: T.nodeStroke, opacity: 0 });

  const arr = (v: string | string[]): string[] => (Array.isArray(v) ? v : [v]);
  b.step(scene.title ? scene.title : undefined, "start");
  b.advance(b.stepMs * 0.5);
  for (const st of scene.sequence ?? []) {
    const ms = st.ms ?? b.stepMs;
    if ("show" in st || "hide" in st) {
      const targets = arr("show" in st ? st.show : st.hide);
      const to = "show" in st ? 1 : 0;
      b.step(st.caption ?? `${to ? "Show" : "Hide"} ${targets.join(", ")}`);
      const t0 = b.t;
      const t1 = b.advance(ms);
      for (const id of targets) {
        b.tween(id, "opacity", to, t0, t1);
        // Edges touching a node follow its visibility so an arrow never points at nothing.
        for (const [key, eid] of edgeId) {
          const [from, dest] = key.split("->");
          if (from !== id && dest !== id) continue;
          const other = from === id ? dest : from;
          const otherVisible = (b.valueAt(other, "opacity", t1) ?? 1) as number;
          if (to === 1 && otherVisible < 1) continue;
          b.tween(eid, "opacity", to, t0, t1);
          if (b.has(`${eid}-label`)) b.tween(`${eid}-label`, "opacity", to, t0, t1);
        }
      }
    } else if ("highlight" in st || "unhighlight" in st) {
      const targets = arr("highlight" in st ? st.highlight : st.unhighlight);
      const color = "highlight" in st ? T.accent : T.node;
      b.step(st.caption ?? ("highlight" in st ? `Focus on ${targets.join(", ")}` : undefined));
      const t0 = b.t;
      const t1 = b.advance(ms);
      for (const id of targets) {
        const original = scene.nodes.find((n) => n.id === id)?.fill;
        b.tween(id, "fill", "highlight" in st ? color : original ?? color, t0, t0 + Math.min(200, ms / 2));
      }
      void t1;
    } else if ("flow" in st) {
      const [from, to] = typeof st.flow === "string" ? st.flow.split("->").map((x) => x.trim()) : st.flow;
      let ends = edgeEnds.get(`${from}->${to}`);
      let reversed = false;
      if (!ends) {
        ends = edgeEnds.get(`${to}->${from}`);
        reversed = true;
      }
      if (!ends) continue; // validator reports the missing edge
      const [p, q] = reversed ? [ends[1], ends[0]] : ends;
      b.step(st.caption ?? `${from} → ${to}`);
      const eid = edgeId.get(reversed ? `${to}->${from}` : `${from}->${to}`)!;
      b.set(eid, "stroke", T.accent);
      b.set("token", "pos", p);
      b.set("token", "opacity", 1);
      const t0 = b.t;
      const t1 = b.advance(ms);
      b.tween("token", "pos", q, t0, t1, "ease-in-out");
      b.set("token", "opacity", 0, t1);
      b.set(eid, "stroke", T.nodeStroke, t1);
    } else if ("note" in st) {
      b.step(st.note);
      b.advance(ms);
    } else if ("relabel" in st) {
      b.step(st.caption ?? `${st.relabel.id}: "${st.relabel.text}"`);
      b.set(st.relabel.id, "text", st.relabel.text);
      b.advance(ms);
    }
  }
  b.step(undefined, "end");
  b.advance(b.stepMs * 0.3);
  return b.build({ title: scene.title, kind: "diagram" });
}
