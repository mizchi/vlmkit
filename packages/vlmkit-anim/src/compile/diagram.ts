/**
 * `diagram` → boxes and arrows laid out automatically, walked through by a
 * `sequence` of narrated beats: reveal, highlight, flow a token along an
 * edge, relabel, or just pause on a note.
 */

import type { DiagramScene, Timeline, Tone } from "../types.ts";
import { Builder, along, boxRadius, labelWidth, trimEdge } from "./builder.ts";
import { circleRadius, layoutNodes, type LayoutGroup, type LayoutInput } from "./layout.ts";

import { routeAround, segmentInside, type Box, type Seg } from "./route.ts";
import { say, type WhyEntry } from "./why.ts";
export { segmentInside } from "./route.ts";

type LayoutArgs = Omit<LayoutInput, "width" | "height" | "nodeW" | "nodeH">;

/**
 * A canvas that fits when the scene names none: the default 640×360 holds eight boxes; an imported
 * architecture graph has thirty (v23: a mermaid pipeline's nodes were laid out off the canvas). The
 * layered layout places every node at a fraction of the free area that does not depend on the size, so
 * the picture is laid out once on a unit square and scaled until the tightest pair of neighbours has
 * room — two boxes in one layer with a container edge between them need both paddings and a gap, two
 * layers need their halves and an arrow's length. A guess from counts (widest layer × widest label, then
 * group counts) was either double what the picture needed or left containers crossing.
 */
function autoCanvas(
  scene: DiagramScene,
  args: LayoutArgs,
  sizes: Map<string, [number, number]>,
  groupPad: number,
  groupOf: Map<string, string>,
  chains: Map<string, { id: string; pad: number }[]>,
  generous: { groups: number; nest: number } | undefined,
  why?: WhyEntry[],
): { width: number; height: number } {
  const layout = scene.layout ?? "lr";
  const maxW = Math.max(60, ...[...sizes.values()].map((s) => s[0]));
  const maxH = Math.max(20, ...[...sizes.values()].map((s) => s[1]));
  const groups = groupOf.size > 0;
  // The padding a box keeps from the edge of the picture: its outermost container's.
  const pad = (id: string) => Math.max(0, ...(chains.get(id) ?? []).map((g) => g.pad));
  // The paddings between two boxes: for each, the outermost of its containers that does not also hold the
  // other (siblings under one parent keep their own 14px apart; boxes in different roots keep the roots').
  const padBetween = (a: string, b: string): number => {
    const other = new Set((chains.get(b) ?? []).map((g) => g.id));
    const own = (chains.get(a) ?? []).filter((g) => !other.has(g.id));
    const otherOwn = (chains.get(b) ?? []).filter((g) => !new Set((chains.get(a) ?? []).map((x) => x.id)).has(g.id));
    return Math.max(0, ...own.map((g) => g.pad)) + Math.max(0, ...otherOwn.map((g) => g.pad));
  };
  if (layout === "grid" || layout === "circle") {
    const n = args.ids.length;
    const cols = Math.ceil(Math.sqrt(n * 1.5));
    const rows = Math.ceil(n / cols);
    const w = layout === "circle" ? 2 * circleRadius(n, Math.max(maxW, maxH)) + 2 * Math.max(maxW, maxH) : cols * (maxW * 1.5 + groupPad) + 80;
    const h = layout === "circle" ? w : rows * (maxH * 1.8 + groupPad) + 120;
    return { width: Math.max(640, Math.ceil(w)), height: Math.max(360, Math.ceil(h)) };
  }
  const U = 10000;
  const pos = layoutNodes({ ...args, width: U, height: U, nodeW: maxW, nodeH: maxH }, layout);
  const tb = layout === "tb";
  const cross = (id: string) => pos.get(id)![tb ? 0 : 1] / U;
  const main = (id: string) => pos.get(id)![tb ? 1 : 0] / U;
  const wOf = (id: string) => sizes.get(id)![tb ? 0 : 1];
  const hOf = (id: string) => sizes.get(id)![tb ? 1 : 0];
  const sameGroup = (a: string, b: string) => (groupOf.get(a) ?? "") === (groupOf.get(b) ?? "");
  const sameLayer = (a: string, b: string) => Math.abs(main(a) - main(b)) < 1e-4;
  // Each container's reach along the layers: two containers side by side across the picture are the ones
  // that share a layer — a row above them costs nothing across.
  const reach = new Map<string, [number, number]>();
  for (const id of args.ids) {
    const g = groupOf.get(id);
    if (!g) continue;
    const r = reach.get(g) ?? [main(id), main(id)];
    reach.set(g, [Math.min(r[0], main(id)), Math.max(r[1], main(id))]);
  }
  const besides = (a: string, b: string): boolean => {
    const ra = reach.get(groupOf.get(a) ?? "");
    const rb = reach.get(groupOf.get(b) ?? "");
    return !!ra && !!rb && ra[0] <= rb[1] + 1e-4 && rb[0] <= ra[1] + 1e-4;
  };
  const ids = args.ids;
  // The free length one axis needs: for every pair that has to keep apart along it, their room over the
  // fraction between them; for the first and last, the half box plus a padding over the fraction to the edge.
  type Fit = { px: number; a: string; b?: string; room: number; d: number };
  const fit = (pairs: (a: string, b: string) => number, coord: (id: string) => number, half: (id: string) => number): Fit => {
    let out: Fit = { px: 0, a: ids[0] ?? "", room: 0, d: 1 };
    const take = (px: number, a: string, b: string | undefined, room: number, d: number) => {
      if (px > out.px) out = { px, a, b, room, d };
    };
    for (const a of ids) {
      for (const b of ids) {
        const d = coord(b) - coord(a);
        if (d < 1e-6) continue;
        const room = pairs(a, b);
        if (room > 0) take(room / d, a, b, room, d);
      }
      take((half(a) + pad(a)) / Math.max(coord(a), 0.02), a, undefined, half(a) + pad(a), Math.max(coord(a), 0.02));
      take((half(a) + pad(a)) / Math.max(1 - coord(a), 0.02), a, undefined, half(a) + pad(a), Math.max(1 - coord(a), 0.02));
    }
    return out;
  };
  // Across: two boxes in one layer keep a gap; over a container edge, both paddings too — also between boxes
  // of two containers that share a layer, whatever layers the boxes themselves are on (a container spans all of its members).
  const across = fit(
    (a, b) => (sameLayer(a, b) ? wOf(a) / 2 + wOf(b) / 2 + 28 + (sameGroup(a, b) ? 0 : padBetween(a, b)) : !sameGroup(a, b) && besides(a, b) ? wOf(a) / 2 + wOf(b) / 2 + 28 + padBetween(a, b) : 0),
    cross,
    (id) => wOf(id) / 2,
  );
  const acrossFree = across.px;
  // Along: a layer to the next is a box and an arrow's length; over a container edge, when the two boxes are in
  // the same column of the picture, the paddings and a label band as well.
  const stacked = (a: string, b: string) => Math.abs(cross(a) - cross(b)) * acrossFree < wOf(a) / 2 + wOf(b) / 2 + padBetween(a, b);
  // Between layers: an arrow's length (56), or, over a container edge in the same column, the two containers'
  // paddings, a label band and a gap when that is more — the arrow runs inside that room, it does not add to it.
  const along = fit((a, b) => hOf(a) / 2 + hOf(b) / 2 + (!sameGroup(a, b) && stacked(a, b) ? Math.max(56, padBetween(a, b) + 16 + 12) : 56), main, (id) => hOf(id) / 2 + (groups ? 16 : 0));
  let alongMain = along.px + 90 + groupPad * 2;
  let alongCross = acrossFree + 40 + groupPad * 2;
  if (generous) {
    // A module map keeps the room it had before the pairwise estimate (v13–v23: the widest layer's count of
    // boxes, the layer count, a band per container level): the tight fit exposed a relation's arc and two
    // dependency arrows through labels on three of the corpus's maps. Growth past it is the estimate's.
    const perMain = new Map<number, number>();
    for (const id of ids) perMain.set(Math.round(main(id) * 1000), (perMain.get(Math.round(main(id) * 1000)) ?? 0) + 1);
    const widest = Math.max(1, ...perMain.values()) + Math.max(0, generous.groups - 1) * 0.6;
    alongCross = Math.max(alongCross, widest * (maxW + 36 + generous.nest) + 80 + (generous.groups ? 40 : 0));
    alongMain = Math.max(alongMain, Math.max(1, perMain.size) * (maxH + 56 + generous.nest) + 110 + (generous.groups ? 40 : 0));
  }
  const [w, h] = tb ? [alongCross, alongMain] : [alongMain, alongCross];
  // A module map's floor is the one it always had (480×280); a diagram's is the runtime's default frame.
  const out = { width: Math.max(generous ? 480 : 640, Math.ceil(w)), height: Math.max(generous ? 280 : 360, Math.ceil(h)) };
  if (why) {
    // The pair that set each axis, in the picture's names: what they needed between them and how far apart the
    // layout put them — the two levers a writer has (the label, or the structure that put them that far apart).
    const axis = (f: Fit, name: "width" | "height", total: number, margins: number, size: (id: string) => number, isCross: boolean): void => {
      const box = (id: string) => `${id} (${Math.round(size(id))}px${groupOf.has(id) ? `, in ${groupOf.get(id)}` : ""})`;
      // Larger than the boxes asked: the kind's minimum frame, or a module map's room (rounding is not a floor).
      const floor = total > Math.ceil(f.px + margins) + 1;
      const pair = f.b
        ? `${box(f.a)} and ${box(f.b)} need ${Math.round(f.room)}px between their centres${!sameGroup(f.a, f.b) ? " (both boxes' halves, a gap, and their containers' paddings)" : isCross && sameLayer(f.a, f.b) ? " (both halves and a gap)" : " (both halves and an arrow's length)"} and the layout put them ${Math.round(f.d * 100)}% of the ${name} apart`
        : `${box(f.a)} sits ${Math.round(f.d * 100)}% of the ${name} from the edge and needs ${Math.round(f.room)}px of room there`;
      const minimum = total === (name === "width" ? (generous ? 480 : 640) : generous ? 280 : 360) ? "the minimum" : "a module map's room for its arcs and labels";
      say(why, { kind: "canvas", about: name, says: floor ? `${name} ${total}: ${minimum} — the boxes needed ${Math.round(f.px)}px + ${margins}px of margins (${pair})` : `${name} ${total}: ${pair}, so ${Math.round(f.px)}px + ${margins}px of margins`, ids: f.b ? [f.a, f.b] : [f.a], n: total, across: isCross });
    };
    axis(across, tb ? "width" : "height", tb ? out.width : out.height, 40 + groupPad * 2, wOf, true);
    axis(along, tb ? "height" : "width", tb ? out.height : out.width, 90 + groupPad * 2, hOf, false);
  }
  return out;
}

export function compileDiagram(scene: DiagramScene, kindName: "diagram" | "modules" = "diagram"): Timeline {
  const fontSize = scene.theme?.fontSize ?? 14;
  const ids = scene.nodes.map((n) => n.id);
  const fixed = new Map<string, [number, number]>();
  for (const n of scene.nodes) if (n.pos) fixed.set(n.id, n.pos);
  const sizes = new Map<string, [number, number]>();
  for (const n of scene.nodes) {
    const label = n.label ?? n.id;
    const w = labelWidth(label, fontSize);
    const h = fontSize * 1.2 * label.split("\n").length + fontSize * 1.4;
    sizes.set(n.id, n.shape === "circle" ? [Math.max(w, h), Math.max(w, h)] : [w, h]);
  }
  const maxW = Math.max(...[...sizes.values()].map((s) => s[0]));
  const maxH = Math.max(...[...sizes.values()].map((s) => s[1]));
  // A forbidden edge is drawn but says nothing about where things go: the layout never sees it.
  const edges = (scene.edges ?? []).filter((e) => e.style !== "forbidden").map((e): [string, string] => [e.from, e.to]);
  const groups = scene.groups ?? [];
  // Nesting (v20): a group's members are its own nodes plus every descendant's; the layout bands by the
  // outermost group and keeps each inner group's members together; a parent's box wraps its children's with
  // room for their labels.
  const byId = new Map(groups.map((g) => [g.id, g]));
  const childrenOf = (id: string) => groups.filter((g) => g.parent === id);
  const membersOf = (g: (typeof groups)[number]): string[] => {
    const seen = new Set<string>();
    const walk = (x: (typeof groups)[number]): void => {
      x.nodes.forEach((n) => seen.add(n));
      childrenOf(x.id).forEach(walk);
    };
    walk(g);
    return [...seen];
  };
  const depthBelow = (g: (typeof groups)[number]): number => Math.max(0, ...childrenOf(g.id).map((c) => depthBelow(c) + 1));
  const depthOf = (g: (typeof groups)[number]): number => (g.parent && byId.has(g.parent) ? depthOf(byId.get(g.parent)!) + 1 : 0);
  const roots = groups.filter((g) => !g.parent || !byId.has(g.parent));
  // node → the innermost group it belongs to: the container whose padding it keeps from a neighbour.
  const innermost = new Map<string, string>();
  for (const g of groups) for (const n of g.nodes) innermost.set(n, g.id);
  const maxDepth = Math.max(0, ...groups.map(depthBelow));
  const tree = (g: (typeof groups)[number]): LayoutGroup => ({ id: g.id, nodes: g.nodes, children: childrenOf(g.id).map(tree) });
  // Containers need room for their padding and label: the free area shrinks by a band per group level.
  const groupPad = groups.length ? 18 + maxDepth * 14 : 0;
  const why: WhyEntry[] = [];
  const tbLayout = (scene.layout ?? "lr") === "tb";
  const layoutArgs: LayoutArgs = {
    ids,
    edges,
    fixed,
    // A band is as wide as its fullest layer's boxes, not their count (v24).
    sizeOf: (id) => sizes.get(id)![tbLayout ? 0 : 1],
    // The group tree: a parent's range is shared out among its children the way the picture is among the
    // roots, so two sibling containers get their own slots instead of one band that spreads their members
    // evenly (pa, pb, v23: an imported pipeline's three tracks under one "Parallel" subgraph were one
    // full-width row, and the middle track's widest box crossed both neighbours until the canvas was 2700px).
    groups: roots.map(tree),
    // A module map layers from its leaves: what two modules depend on decides their layer, not what
    // depends on them (fa, v13: the same dependency set landed on different layers under the root walk).
    layering: kindName === "modules" ? "sinks" : "sources",
  };
  // A scene that names its canvas, or places a node itself, is drawn as written; otherwise the canvas fits the picture.
  const named = scene.canvas?.width !== undefined && scene.canvas?.height !== undefined;
  // A container's padding grows by 24 per level it holds — what two neighbours over a container edge keep between them.
  const padOfGroup = (g: (typeof groups)[number]) => 14 + depthBelow(g) * 24;
  const chains = new Map<string, { id: string; pad: number }[]>();
  for (const g of groups) {
    const chain: { id: string; pad: number }[] = [];
    for (let cur: (typeof groups)[number] | undefined = g; cur; cur = cur.parent ? byId.get(cur.parent) : undefined) chain.push({ id: cur.id, pad: padOfGroup(cur) });
    for (const n of g.nodes) chains.set(n, chain);
  }
  const generous = kindName === "modules" ? { groups: groups.length, nest: maxDepth * 48 } : undefined;
  const fit = named || fixed.size ? { width: 640, height: 360 } : autoCanvas(scene, { ...layoutArgs, fixed: new Map() }, sizes, groupPad, innermost, chains, generous, why);
  if (named) say(why, { kind: "canvas", about: "canvas", says: `canvas ${scene.canvas!.width}×${scene.canvas!.height}: as the scene names it — the layout fills it and does not clip; a smaller one draws the same picture smaller`, n: scene.canvas!.width });
  const b = new Builder(scene, { ...fit, stepMs: 700 });
  const T = b.theme;
  // Colour roles for a still (gb, v13, v14: "no colour field on deps edges — colouring one edge requires reaching
  // into the beat/sequence/highlight machinery on what is supposed to be a motion-free still figure").
  const toneStroke = (tone: Tone | undefined, plain: string): string => (tone === "accent" ? T.accent : tone === "bad" ? T.bad : tone === "muted" ? T.muted : plain);
  const nodeFill = (n: { fill?: string; tone?: Tone }): string => n.fill ?? (n.tone === "accent" ? T.accent : T.node);
  const pos = layoutNodes(
    {
      ...layoutArgs,
      why,
      width: b.width - 40 - groupPad * 2,
      height: b.height - 90 - groupPad * 2,
      nodeW: maxW + groupPad,
      nodeH: maxH + groupPad,
    },
    scene.layout ?? "lr",
  );
  for (const [id, p] of pos) if (!fixed.has(id)) pos.set(id, [p[0] + 20 + groupPad, p[1] + 40 + groupPad]);

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });

  // Edge geometry first — where each runs and where its label sits — so containers and their labels can keep
  // out of the way: "infrastructure" under "emits" was the first thing the layout geometry found in this
  // kind's own example (v12), and "core" with an arrow through it the first thing v13's writers drew.
  const boxOf = (id: string): Box => {
    const p = pos.get(id)!;
    const s = sizes.get(id)!;
    return { x: p[0] - s[0] / 2, y: p[1] - s[1] / 2, w: s[0], h: s[1] };
  };
  // An edge that would run behind a box that is not one of its ends bends around it: a waypoint level with
  // the box, just past its nearer side, then on. Passes repeat while a new segment finds a new box (fa, fc
  // and the workspace map, v13: dependency arrows from two layers up vanished behind a module in between).
  const route = (e: { from: string; to: string }, i: number): [number, number][] =>
    routeAround(pos.get(e.from)!, pos.get(e.to)!, scene.nodes.map((n) => ({ id: n.id, box: boxOf(n.id) })), new Set([e.from, e.to]), why, `edge-${i} (${e.from} → ${e.to})`);
  const isCircle = (id: string) => scene.nodes.find((n) => n.id === id)?.shape === "circle";
  const rawGeom = (scene.edges ?? []).map((e, i) => {
    const centres = route(e, i);
    const first = centres[1];
    const last = centres[centres.length - 2];
    const a = centres[0];
    const c = centres[centres.length - 1];
    const d0 = [first[0] - a[0], first[1] - a[1]];
    const l0 = Math.hypot(d0[0], d0[1]) || 1;
    const d1 = [c[0] - last[0], c[1] - last[1]];
    const l1 = Math.hypot(d1[0], d1[1]) || 1;
    const sa = sizes.get(e.from)!;
    const sc = sizes.get(e.to)!;
    const ra = isCircle(e.from) ? sa[0] / 2 : boxRadius(sa[0], sa[1], d0[0] / l0, d0[1] / l0);
    const rc = isCircle(e.to) ? sc[0] / 2 : boxRadius(sc[0], sc[1], d1[0] / l1, d1[1] / l1);
    const headless = e.style === "line";
    const [p] = trimEdge(a, first, ra + 2, 0);
    const [, q] = trimEdge(last, c, 0, rc + (headless ? 2 : 6));
    const pts: [number, number][] = [p, ...centres.slice(1, -1), q];
    return { e, i, id: `edge-${i}`, pts, headless };
  });
  // Several edges at one box leave (or land) spread along its side, in the order their far ends lie, instead
  // of all from the point nearest the other box: a fan of six arrows out of one corner was the reason four of
  // nine v21 readers could not say which tail went with which head ("pairing each line to its exact head is a
  // best-effort read"). Circles keep their radial ends.
  {
    type End = { g: (typeof rawGeom)[number]; at: 0 | 1 };
    const bySide = new Map<string, End[]>();
    for (const g of rawGeom) {
      for (const at of [0, 1] as const) {
        const node = at === 0 ? g.e.from : g.e.to;
        if (isCircle(node)) continue;
        const c = pos.get(node)!;
        const s = sizes.get(node)!;
        const pt = at === 0 ? g.pts[0] : g.pts[g.pts.length - 1];
        const dx = (pt[0] - c[0]) / (s[0] / 2);
        const dy = (pt[1] - c[1]) / (s[1] / 2);
        const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "bottom" : "top";
        const key = `${node} ${side}`;
        bySide.set(key, [...(bySide.get(key) ?? []), { g, at }]);
      }
    }
    for (const [key, ends] of bySide) {
      if (ends.length < 2) continue;
      const node = key.slice(0, key.lastIndexOf(" "));
      const side = key.slice(key.lastIndexOf(" ") + 1);
      const c = pos.get(node)!;
      const s = sizes.get(node)!;
      const horizontal = side === "top" || side === "bottom";
      const length = horizontal ? s[0] : s[1];
      if (length < ends.length * 10) continue;
      const far = (en: End): [number, number] => (en.at === 0 ? en.g.pts[1] : en.g.pts[en.g.pts.length - 2]);
      const axis = horizontal ? 0 : 1;
      // Left to right (top to bottom) by where the far end is; a tie by its angle, so the fan never crosses itself.
      ends.sort((u, v) => far(u)[axis] - far(v)[axis] || Math.atan2(far(u)[1] - c[1], far(u)[0] - c[0]) - Math.atan2(far(v)[1] - c[1], far(v)[0] - c[0]));
      const start = (horizontal ? c[0] - s[0] / 2 : c[1] - s[1] / 2) + length * 0.18;
      const span = length * 0.64;
      ends.forEach((en, k) => {
        const along = start + (ends.length === 1 ? span / 2 : (span * k) / (ends.length - 1));
        const margin = en.at === 0 ? 2 : en.g.headless ? 2 : 6;
        const perp = side === "top" ? c[1] - s[1] / 2 - margin : side === "bottom" ? c[1] + s[1] / 2 + margin : side === "left" ? c[0] - s[0] / 2 - margin : c[0] + s[0] / 2 + margin;
        const pt: [number, number] = horizontal ? [along, perp] : [perp, along];
        en.g.pts[en.at === 0 ? 0 : en.g.pts.length - 1] = pt;
      });
    }
  }
  const edgeGeom = rawGeom.map((g) => {
    const { e, i, id, pts } = g;
    const p = pts[0];
    const q = pts[pts.length - 1];
    const label = e.label ?? (e.style === "forbidden" ? "✗" : undefined);
    // The label sits off the middle of the longest segment, on its left-hand normal.
    let best = 0;
    for (let k = 1; k + 1 < pts.length; k++) if (Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) > Math.hypot(pts[best + 1][0] - pts[best][0], pts[best + 1][1] - pts[best][1])) best = k;
    const [sa0, sa1] = [pts[best], pts[best + 1]];
    const sl = Math.hypot(sa1[0] - sa0[0], sa1[1] - sa0[1]) || 1;
    const mid = along(sa0, sa1, 0.5);
    const labelPos: [number, number] = [mid[0] + (-(sa1[1] - sa0[1]) / sl) * 11, mid[1] + ((sa1[0] - sa0[0]) / sl) * 11];
    return { e, i, id, p, q, pts, label, labelPos };
  });
  const occupied: Box[] = [];
  for (const n of scene.nodes) {
    const p = pos.get(n.id)!;
    const s = sizes.get(n.id)!;
    occupied.push({ x: p[0] - s[0] / 2, y: p[1] - s[1] / 2, w: s[0], h: s[1] });
  }
  for (const g of edgeGeom) {
    if (!g.label) continue;
    const w = labelWidth(g.label, T.fontSize - 2);
    occupied.push({ x: g.labelPos[0] - w / 2, y: g.labelPos[1] - 10, w, h: 20 });
  }
  const segs: Seg[] = edgeGeom.filter((g) => !g.e.hidden).flatMap((g) => g.pts.slice(1).map((pt, k): Seg => [g.pts[k], pt]));
  const hits = (bx: Box) => occupied.some((o) => bx.x < o.x + o.w && o.x < bx.x + bx.w && bx.y < o.y + o.h && o.y < bx.y + bx.h);
  const crossed = (bx: Box) => segs.reduce((s, seg) => s + segmentInside(seg, bx), 0);

  // Containers first, so they sit behind everything they hold: the members' bounding box with padding, the
  // label in the first corner that nothing occupies and no edge runs through — inside first, then just outside.
  const groupIds = new Set(groups.map((g) => g.id));
  // Outer containers first, so an inner one draws over its parent's outline and its label is placed after.
  const drawOrder = [...groups].sort((a, c) => depthOf(a) - depthOf(c));
  // Every container's box before any is drawn, so one that grows for its label knows what it must not touch.
  const bounds = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
  for (const g of groups) {
    const members = membersOf(g).filter((id) => pos.has(id));
    if (!members.length) continue;
    const xs = members.flatMap((id) => [pos.get(id)![0] - sizes.get(id)![0] / 2, pos.get(id)![0] + sizes.get(id)![0] / 2]);
    const ys = members.flatMap((id) => [pos.get(id)![1] - sizes.get(id)![1] / 2, pos.get(id)![1] + sizes.get(id)![1] / 2]);
    const pad = 14 + depthBelow(g) * 24;
    bounds.set(g.id, { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad - (g.label ? 16 : 0), x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad });
  }
  const isAncestorGroup = (a: string, d: string): boolean => {
    let cur = byId.get(d)?.parent;
    while (cur) {
      if (cur === a) return true;
      cur = byId.get(cur)?.parent;
    }
    return false;
  };
  for (const g of drawOrder) {
    const bd = bounds.get(g.id);
    if (!bd) continue;
    const labelH = g.label ? 16 : 0;
    let { x0, x1 } = bd;
    const y0 = bd.y0;
    let y1 = bd.y1;
    let labelNode: Parameters<typeof b.node>[0] | undefined;
    if (g.label) {
      const fs = T.fontSize - 2;
      const lw = labelWidth(g.label, fs) - fs * 1.6;
      // Inside the top corners, inside the bottom corners (the container grows a band for it), then just outside;
      // then the middles — inside top and bottom, outside above and below, and beside the container at its
      // mid-height — for a small container under a fan of edges, where every corner has one through it (hd, v14:
      // two one-module containers straight below the root, both labels crossed at every corner).
      type Corner = { pos: [number, number]; anchor: "start" | "end" | "middle"; bottom?: boolean };
      const ym = (y0 + y1) / 2;
      const xm = (x0 + x1) / 2;
      const corners: Corner[] = [
        { pos: [x0 + 10, y0 + 12], anchor: "start" },
        { pos: [x1 - 10, y0 + 12], anchor: "end" },
        { pos: [x0 + 10, y1 + labelH - 12], anchor: "start", bottom: true },
        { pos: [x1 - 10, y1 + labelH - 12], anchor: "end", bottom: true },
        { pos: [x0 + 4, y0 - 10], anchor: "start" },
        { pos: [x1 - 4, y0 - 10], anchor: "end" },
        { pos: [x0 + 4, y1 + 10], anchor: "start" },
        { pos: [x1 - 4, y1 + 10], anchor: "end" },
        { pos: [xm, y0 + 12], anchor: "middle" },
        { pos: [xm, y1 + labelH - 12], anchor: "middle", bottom: true },
        { pos: [xm, y0 - 10], anchor: "middle" },
        { pos: [xm, y1 + 10], anchor: "middle" },
        { pos: [x0 - 6, ym], anchor: "end" },
        { pos: [x1 + 6, ym], anchor: "start" },
      ];
      const boxAt = (c: Corner): Box => ({ x: c.anchor === "start" ? c.pos[0] : c.anchor === "end" ? c.pos[0] - lw : c.pos[0] - lw / 2, y: c.pos[1] - fs * 0.65, w: lw, h: fs * 1.3 });
      const onCanvas = (bx: Box) => bx.y >= 4 && bx.x >= 0 && bx.x + bx.w <= b.width && bx.y + bx.h <= b.height - 40;
      const free = corners.filter((c) => onCanvas(boxAt(c)) && !hits(boxAt(c)));
      // A free corner no edge runs through; failing that the free corner with the least edge through it; failing
      // that the first corner.
      let clear = free.find((c) => crossed(boxAt(c)) < 4);
      let corner = clear ?? free.sort((c, d) => crossed(boxAt(c)) - crossed(boxAt(d)))[0] ?? corners[0];
      // A label anywhere but a top corner reads as something else — "the container label 'core' sits at the
      // bottom-left … reads like a caption for the box above it" (v21, two readers; a third read a container
      // whose label was low as a module). When both top corners are taken, the container grows sideways, up to
      // 48px, until a top corner is clear — inside its parent and off every other container.
      if (!clear || (clear !== corners[0] && clear !== corners[1])) {
        const others = groups.filter((h) => h.id !== g.id && bounds.has(h.id) && !isAncestorGroup(h.id, g.id) && !isAncestorGroup(g.id, h.id)).map((h) => bounds.get(h.id)!);
        const parentB = g.parent ? bounds.get(g.parent) : undefined;
        const touches = (nx0: number, nx1: number) => others.some((o) => nx0 < o.x1 && o.x0 < nx1 && y0 < o.y1 && o.y0 < y1);
        grow: for (const dir of ["left", "right"] as const) {
          for (let k = 1; k <= 4; k++) {
            const nx0 = dir === "left" ? x0 - 12 * k : x0;
            const nx1 = dir === "right" ? x1 + 12 * k : x1;
            if (nx0 < 4 || nx1 > b.width - 4 || touches(nx0, nx1)) break;
            if (parentB && (nx0 < parentB.x0 + 6 || nx1 > parentB.x1 - 6)) break;
            const cand: Corner = dir === "left" ? { pos: [nx0 + 10, y0 + 12], anchor: "start" } : { pos: [nx1 - 10, y0 + 12], anchor: "end" };
            if (onCanvas(boxAt(cand)) && !hits(boxAt(cand)) && crossed(boxAt(cand)) < 4) {
              x0 = nx0;
              x1 = nx1;
              corner = cand;
              clear = cand;
              break grow;
            }
          }
        }
      }
      if (corner.bottom) y1 += labelH;
      // Hemmed in on every side (a one-module container straight under the root, hd, v14): the least-crossed
      // spot, with a halo so the edge breaks around the glyphs — the same treatment an edge label gets.
      labelNode = { id: `${g.id}-label`, shape: "text", pos: corner.pos, text: g.label, fontSize: fs, color: T.muted, anchor: corner.anchor, ...(clear ? {} : { halo: true }) };
      occupied.push(boxAt(corner));
    }
    b.node({ id: g.id, shape: "rect", pos: [(x0 + x1) / 2, (y0 + y1) / 2], size: [x1 - x0, y1 - y0], rx: 10, fill: "none", stroke: T.muted, strokeWidth: 1.2 });
    if (labelNode) b.node(labelNode);
    b.anchor(g.id, g.id);
  }

  const edgeEnds = new Map<string, [number, number][]>();
  const edgeId = new Map<string, string>();
  const edgeStroke = new Map<string, string>();
  for (const g of edgeGeom) {
    const { e, id, p, q, pts } = g;
    const stroke = toneStroke(e.tone, e.style === "forbidden" ? T.bad : T.nodeStroke);
    edgeEnds.set(`${e.from}->${e.to}`, pts);
    edgeId.set(`${e.from}->${e.to}`, id);
    edgeStroke.set(id, stroke);
    const dashed = e.style === "dashed" || e.style === "implements" || e.style === "forbidden" ? true : undefined;
    // A realisation of an interface carries a hollow head (UML), so it reads as "implements", not "calls".
    const head = e.style === "line" ? false : e.style === "implements" ? ("hollow" as const) : true;
    if (pts.length === 2) {
      b.node({ id, shape: e.style === "line" ? "line" : "arrow", points: [p, q], stroke, dashed, ...(head === "hollow" ? { head } : {}), opacity: e.hidden ? 0 : 1 });
    } else {
      // A bent edge is a path through its waypoints, drawn from its first point.
      const r = (v: number) => Math.round(v * 10) / 10;
      const d = pts.map((pt, k) => `${k === 0 ? "M" : "L"} ${r(pt[0] - p[0])} ${r(pt[1] - p[1])}`).join(" ");
      b.node({ id, shape: "path", pos: p, d, head, fill: "none", stroke, dashed, opacity: e.hidden ? 0 : 1 });
    }
    if (g.label) {
      // An edge label sits on a line by design: the halo breaks the line around the glyphs, so an edge that
      // crosses it stays a readable label rather than a struck-through one.
      b.node({ id: `${id}-label`, shape: "text", pos: g.labelPos, text: g.label, fontSize: T.fontSize - 2, color: toneStroke(e.tone, e.style === "forbidden" ? T.bad : T.text), halo: true, opacity: e.hidden ? 0 : 1 });
    }
  }
  for (const n of scene.nodes) {
    const p = pos.get(n.id)!;
    const s = sizes.get(n.id)!;
    const shape = n.shape ?? "rect";
    b.node({
      id: n.id,
      shape,
      pos: p,
      ...(shape === "circle" ? { r: s[0] / 2 } : { size: s, rx: 6 }),
      fill: nodeFill(n),
      stroke: n.tone === "bad" ? T.bad : n.tone === "muted" ? T.muted : T.nodeStroke,
      strokeWidth: 1.5,
      // A dashed outline: a box that is not (or no longer) there — a removed module in a diff figure (v22).
      ...(n.dashed ? { dashed: true } : {}),
      text: n.label ?? n.id,
      fontSize: T.fontSize,
      color: n.tone === "bad" ? T.bad : n.tone === "muted" ? T.muted : T.text,
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
      const on = "highlight" in st;
      const color = on ? T.accent : T.node;
      if (ms > 0) b.step(st.caption ?? (on ? `Focus on ${targets.join(", ")}` : undefined));
      const t0 = b.t;
      b.advance(ms);
      // Instant, like the sort and matrix highlights: the frame at the step shows the focus.
      for (const id of targets) {
        if (groupIds.has(id)) {
          // A container has no fill to change: its outline takes the accent instead.
          b.set(id, "stroke", on ? T.accent : T.muted, t0);
          continue;
        }
        const eid = edgeId.get(id.replace(/\s+/g, "")) ?? (id.includes("->") ? edgeId.get(id.split("->").reverse().join("->")) : undefined);
        if (eid) {
          // An edge lights up along its length, its label with it (fd and fc, v13, both reached for this).
          b.set(eid, "stroke", on ? T.accent : edgeStroke.get(eid)!, t0);
          if (b.has(`${eid}-label`)) b.set(`${eid}-label`, "color", on ? T.accent : T.text, t0);
          continue;
        }
        const original = nodeFill(scene.nodes.find((n) => n.id === id)!);
        const fill = on ? color : original ?? color;
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
      const pts = reversed ? [...ends].reverse() : ends;
      b.step(st.caption ?? `${from} → ${to}`);
      const eid = edgeId.get(reversed ? `${to}->${from}` : `${from}->${to}`)!;
      b.set(eid, "stroke", T.accent);
      b.set("token", "pos", pts[0]);
      b.set("token", "opacity", 1);
      const t0 = b.t;
      const t1 = b.advance(ms);
      // The token follows the edge's waypoints, each leg taking its share of the beat by length.
      const legs = pts.slice(1).map((pt, k) => Math.hypot(pt[0] - pts[k][0], pt[1] - pts[k][1]));
      const total = legs.reduce((s, l) => s + l, 0) || 1;
      let at = t0;
      pts.slice(1).forEach((pt, k) => {
        const end = k === legs.length - 1 ? t1 : at + ((t1 - t0) * legs[k]) / total;
        b.tween("token", "pos", pt, at, end, legs.length === 1 ? "ease-in-out" : "linear");
        at = end;
      });
      b.set("token", "opacity", 0, t1);
      b.set(eid, "stroke", edgeStroke.get(eid)!, t1);
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
  // Every edge by its ends, for `check` to name a crossing's edge as `a → b` rather than by id alone.
  const edgeNames = Object.fromEntries(rawGeom.map((g) => [g.id, `${g.e.from} → ${g.e.to}`]));
  return b.build({ title: scene.title, kind: kindName, why, edges: edgeNames });
}
