/**
 * `diagram` → boxes and arrows laid out automatically, walked through by a
 * `sequence` of narrated beats: reveal, highlight, flow a token along an
 * edge, relabel, or just pause on a note.
 */

import type { DiagramScene, Timeline } from "../types.ts";
import { Builder, along, boxRadius, labelWidth, trimEdge } from "./builder.ts";
import { layoutNodes } from "./layout.ts";

export function compileDiagram(scene: DiagramScene, kindName: "diagram" | "modules" = "diagram"): Timeline {
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
  const groups = scene.groups ?? [];
  // Containers need room for their padding and label: the free area shrinks by a band per group.
  const groupPad = groups.length ? 18 : 0;
  const pos = layoutNodes(
    { ids, edges, fixed, width: b.width - 40 - groupPad * 2, height: b.height - 90 - groupPad * 2, nodeW: maxW + groupPad, nodeH: maxH + groupPad, groups },
    scene.layout ?? "lr",
  );
  for (const [id, p] of pos) if (!fixed.has(id)) pos.set(id, [p[0] + 20 + groupPad, p[1] + 40 + groupPad]);

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });

  // Where every edge label will sit, before anything is drawn: group labels pick a corner that none of
  // them (and no node) occupies — "infrastructure" under "emits" was the first thing the layout geometry
  // found in this kind's own example.
  const occupied: { x: number; y: number; w: number; h: number }[] = [];
  for (const n of scene.nodes) {
    const p = pos.get(n.id)!;
    const s = sizes.get(n.id)!;
    occupied.push({ x: p[0] - s[0] / 2, y: p[1] - s[1] / 2, w: s[0], h: s[1] });
  }
  for (const e of scene.edges ?? []) {
    if (!e.label) continue;
    const a = pos.get(e.from)!;
    const c = pos.get(e.to)!;
    const mid = along(a, c, 0.5);
    const w = labelWidth(e.label, T.fontSize - 2);
    occupied.push({ x: mid[0] - w / 2, y: mid[1] - 20, w, h: 40 });
  }
  const hits = (bx: { x: number; y: number; w: number; h: number }) => occupied.some((o) => bx.x < o.x + o.w && o.x < bx.x + bx.w && bx.y < o.y + o.h && o.y < bx.y + bx.h);

  // Containers first, so they sit behind everything they hold: the members' bounding box with padding,
  // the label in the first free corner (top-left, top-right, bottom-left, bottom-right).
  const groupIds = new Set(groups.map((g) => g.id));
  for (const g of groups) {
    const members = g.nodes.filter((id) => pos.has(id));
    if (!members.length) continue;
    const xs = members.flatMap((id) => [pos.get(id)![0] - sizes.get(id)![0] / 2, pos.get(id)![0] + sizes.get(id)![0] / 2]);
    const ys = members.flatMap((id) => [pos.get(id)![1] - sizes.get(id)![1] / 2, pos.get(id)![1] + sizes.get(id)![1] / 2]);
    const pad = 14;
    const labelH = g.label ? 16 : 0;
    const x0 = Math.min(...xs) - pad;
    const y0 = Math.min(...ys) - pad - labelH;
    const x1 = Math.max(...xs) + pad;
    const y1 = Math.max(...ys) + pad + (g.label ? 0 : 0);
    b.node({ id: g.id, shape: "rect", pos: [(x0 + x1) / 2, (y0 + y1) / 2], size: [x1 - x0, y1 - y0], rx: 10, fill: "none", stroke: T.muted, strokeWidth: 1.2 });
    if (g.label) {
      const fs = T.fontSize - 2;
      const lw = labelWidth(g.label, fs) - fs * 1.6;
      const corners: { pos: [number, number]; anchor: "start" | "end" }[] = [
        { pos: [x0 + 10, y0 + 12], anchor: "start" },
        { pos: [x1 - 10, y0 + 12], anchor: "end" },
        { pos: [x0 + 10, y1 - 12], anchor: "start" },
        { pos: [x1 - 10, y1 - 12], anchor: "end" },
      ];
      const boxAt = (c: { pos: [number, number]; anchor: "start" | "end" }) => ({ x: c.anchor === "start" ? c.pos[0] : c.pos[0] - lw, y: c.pos[1] - fs * 0.65, w: lw, h: fs * 1.3 });
      const corner = corners.find((c) => !hits(boxAt(c))) ?? corners[0];
      b.node({ id: `${g.id}-label`, shape: "text", pos: corner.pos, text: g.label, fontSize: fs, color: T.muted, anchor: corner.anchor });
      occupied.push(boxAt(corner));
    }
    b.anchor(g.id, g.id);
  }

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
  for (const n of scene.nodes) b.anchor(n.id, n.id);
  for (const [key, id] of edgeId) b.anchor(key, id);

  const arr = (v: string | string[]): string[] => (Array.isArray(v) ? v : [v]);
  b.step(scene.title ? scene.title : undefined, "start");
  b.advance(b.stepMs * 0.5);
  for (const st of scene.sequence ?? []) {
    if (b.annotate(st, "sequence")) continue;
    const ms = st.ms ?? b.stepMs;
    if ("show" in st || "hide" in st) {
      const targets = arr("show" in st ? st.show : st.hide);
      const to = "show" in st ? 1 : 0;
      // `ms: 0`: applied at the cursor inside the surrounding beat, no step of its own (the
      // convention `pointers` / `highlight` follow elsewhere; v10's generated change maps need it).
      // Otherwise the fade is short and the step marker sits at its end, so a frame taken at the
      // step (`render --step`, the contact sheet) shows the node the caption is talking about.
      const t0 = b.t;
      const fadeMs = Math.min(ms, 250);
      if (ms > 0) b.step(st.caption ?? `${to ? "Show" : "Hide"} ${targets.join(", ")}`, undefined, t0 + fadeMs);
      const t1 = b.advance(ms);
      const fade = (id: string): void => (ms > 0 ? b.tween(id, "opacity", to, t0, t0 + fadeMs) : b.set(id, "opacity", to, t0));
      for (const id of targets) {
        fade(id);
        // Edges touching a node follow its visibility so an arrow never points at nothing.
        for (const [key, eid] of edgeId) {
          const [from, dest] = key.split("->");
          if (from !== id && dest !== id) continue;
          const other = from === id ? dest : from;
          const otherVisible = (b.valueAt(other, "opacity", t1) ?? 1) as number;
          if (to === 1 && otherVisible < 1) continue;
          fade(eid);
          if (b.has(`${eid}-label`)) fade(`${eid}-label`);
        }
      }
    } else if ("highlight" in st || "unhighlight" in st) {
      const targets = arr("highlight" in st ? st.highlight : st.unhighlight);
      const color = "highlight" in st ? T.accent : T.node;
      if (ms > 0) b.step(st.caption ?? ("highlight" in st ? `Focus on ${targets.join(", ")}` : undefined));
      const t0 = b.t;
      b.advance(ms);
      // Instant, like the sort and matrix highlights: the frame at the step shows the focus.
      for (const id of targets) {
        if (groupIds.has(id)) {
          // A container has no fill to change: its outline takes the accent instead.
          b.set(id, "stroke", "highlight" in st ? T.accent : T.muted, t0);
          continue;
        }
        const original = scene.nodes.find((n) => n.id === id)?.fill;
        const fill = "highlight" in st ? color : original ?? color;
        if (b.valueAt(id, "fill", t0) !== fill) b.set(id, "fill", fill, t0);
      }
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
  return b.build({ title: scene.title, kind: kindName });
}
