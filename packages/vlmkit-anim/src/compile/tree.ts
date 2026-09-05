/**
 * `tree` → a binary search tree with values as circles. x is the value's
 * in-order rank among every value the scene ever holds (fixed for a BST), y
 * is its current depth, so an insert lands where it belongs and a delete
 * that promotes a successor is a `pos` tween of that subtree. Edges never
 * follow a moving node: every (parent, child, geometry) that ever exists is
 * its own line, toggled with opacity when the shape changes. A token walks
 * the comparisons for insert / search and the visiting order for traverse.
 */

import type { Timeline, TreeOp, TreeScene } from "../types.ts";
import { Builder, trimEdge } from "./builder.ts";

interface BstNode {
  value: number;
  left?: number;
  right?: number;
  parent?: number;
}

class Bst {
  nodes = new Map<number, BstNode>();
  root?: number;

  has(v: number): boolean {
    return this.nodes.has(v);
  }

  /** Values compared on the way down, then where `v` attaches (or `undefined` when it is already present). */
  path(v: number): { visited: number[]; parent?: number; side?: "left" | "right"; present: boolean } {
    const visited: number[] = [];
    let cur = this.root;
    let parent: number | undefined;
    let side: "left" | "right" | undefined;
    while (cur !== undefined) {
      visited.push(cur);
      if (v === cur) return { visited, present: true };
      parent = cur;
      side = v < cur ? "left" : "right";
      cur = this.nodes.get(cur)![side];
    }
    return { visited, parent, side, present: false };
  }

  insert(v: number): void {
    const p = this.path(v);
    if (p.present) return;
    this.nodes.set(v, { value: v, parent: p.parent });
    if (p.parent === undefined) this.root = v;
    else this.nodes.get(p.parent)![p.side!] = v;
  }

  min(v: number): number {
    let cur = v;
    for (;;) {
      const l = this.nodes.get(cur)!.left;
      if (l === undefined) return cur;
      cur = l;
    }
  }

  /** Replace the link into `u` (from its parent or the root) with `w`. */
  private relink(u: number, w: number | undefined): void {
    const n = this.nodes.get(u)!;
    if (n.parent === undefined) this.root = w;
    else {
      const p = this.nodes.get(n.parent)!;
      if (p.left === u) p.left = w;
      else p.right = w;
    }
    if (w !== undefined) this.nodes.get(w)!.parent = n.parent;
  }

  /** Returns how the deletion happened, for the narration. */
  delete(v: number): { kind: "leaf" | "one-child" | "two-children"; successor?: number } | undefined {
    const n = this.nodes.get(v);
    if (!n) return undefined;
    if (n.left === undefined && n.right === undefined) {
      this.relink(v, undefined);
      this.nodes.delete(v);
      return { kind: "leaf" };
    }
    if (n.left === undefined || n.right === undefined) {
      this.relink(v, n.left ?? n.right);
      this.nodes.delete(v);
      return { kind: "one-child" };
    }
    // Two children: the in-order successor (min of the right subtree) takes v's place.
    const s = this.min(n.right);
    const sn = this.nodes.get(s)!;
    // Detach s (it has no left child), then splice it into v's position.
    this.relink(s, sn.right);
    sn.left = n.left;
    sn.right = n.right === s ? sn.right : n.right;
    if (sn.left !== undefined) this.nodes.get(sn.left)!.parent = s;
    if (sn.right !== undefined) this.nodes.get(sn.right)!.parent = s;
    this.relink(v, s);
    this.nodes.delete(v);
    return { kind: "two-children", successor: s };
  }

  depth(v: number): number {
    let d = 0;
    let cur = this.nodes.get(v)!.parent;
    while (cur !== undefined) {
      d++;
      cur = this.nodes.get(cur)!.parent;
    }
    return d;
  }

  edges(): [number, number][] {
    const out: [number, number][] = [];
    for (const n of this.nodes.values()) {
      if (n.left !== undefined) out.push([n.value, n.left]);
      if (n.right !== undefined) out.push([n.value, n.right]);
    }
    return out;
  }

  traverse(order: "inorder" | "preorder" | "postorder" | "levelorder"): number[] {
    const out: number[] = [];
    if (this.root === undefined) return out;
    if (order === "levelorder") {
      const q = [this.root];
      while (q.length) {
        const v = q.shift()!;
        out.push(v);
        const n = this.nodes.get(v)!;
        if (n.left !== undefined) q.push(n.left);
        if (n.right !== undefined) q.push(n.right);
      }
      return out;
    }
    const walk = (v: number | undefined): void => {
      if (v === undefined) return;
      const n = this.nodes.get(v)!;
      if (order === "preorder") out.push(v);
      walk(n.left);
      if (order === "inorder") out.push(v);
      walk(n.right);
      if (order === "postorder") out.push(v);
    };
    walk(this.root);
    return out;
  }
}

export function compileTree(scene: TreeScene): Timeline {
  // Dry run to learn every value that will ever exist and the deepest level reached.
  const all = new Set<number>(scene.initial ?? []);
  for (const op of scene.ops) if ("insert" in op) all.add(op.insert);
  const ranks = [...all].sort((a, b) => a - b);
  const rank = new Map(ranks.map((v, i) => [v, i]));
  const dry = new Bst();
  let maxDepth = 0;
  // Every (parent, child, depths) an edge ever has, in first-seen order, so the lines can be
  // created up front and drawn under the circles.
  const edgeGeoms: [number, number, number, number][] = [];
  const seenGeom = new Set<string>();
  const measure = (): void => {
    for (const v of dry.nodes.keys()) maxDepth = Math.max(maxDepth, dry.depth(v));
    for (const [p, c] of dry.edges()) {
      const key = `${p}-${c}-${dry.depth(p)}-${dry.depth(c)}`;
      if (seenGeom.has(key)) continue;
      seenGeom.add(key);
      edgeGeoms.push([p, c, dry.depth(p), dry.depth(c)]);
    }
  };
  for (const v of scene.initial ?? []) dry.insert(v);
  measure();
  let traversals = 0;
  for (const op of scene.ops) {
    if ("insert" in op) dry.insert(op.insert);
    else if ("delete" in op) dry.delete(op.delete);
    else if ("traverse" in op) traversals++;
    measure();
  }

  const N = Math.max(1, ranks.length);
  const R = 18;
  const colW = Math.max(44, Math.min(72, Math.floor(560 / N)));
  const levelH = 64;
  const top = (scene.title ? 44 : 20) + 30;
  const outputH = traversals ? 48 : 0;
  const b = new Builder(scene, { width: Math.max(360, N * colW + 80), height: top + maxDepth * levelH + R + 30 + outputH + 56, stepMs: 550 });
  const T = b.theme;
  const x0 = Math.round((b.width - N * colW) / 2);
  const x = (v: number): number => x0 + rank.get(v)! * colW + colW / 2;
  const y = (depth: number): number => top + depth * levelH;
  const yOut = b.height - 40 - (traversals ? 6 : 0);
  const cursorHome: [number, number] = [b.width - 30, top - 26];

  if (scene.title) b.node({ id: "title", shape: "text", pos: [b.width / 2, 22], text: scene.title, fontSize: T.fontSize + 4, color: T.text });
  // One line per distinct edge geometry, all created before the circles so they draw underneath; toggled by opacity.
  const edgeNodes = new Map<string, string>();
  const shownEdges = new Set<string>();
  const edgeKey = (p: number, c: number, pd: number, cd: number): string => `${p}-${c}-${pd}-${cd}`;
  for (const [p, c, pd, cd] of edgeGeoms) {
    const id = `edge-${edgeNodes.size}`;
    edgeNodes.set(edgeKey(p, c, pd, cd), id);
    const [a, z] = trimEdge([x(p), y(pd)], [x(c), y(cd)], R + 1, R + 1);
    b.node({ id, shape: "line", points: [a, z], stroke: T.muted, strokeWidth: 1.5, opacity: 0 });
  }
  const ensureEdge = (p: number, c: number, pd: number, cd: number): string => {
    const id = edgeNodes.get(edgeKey(p, c, pd, cd));
    if (!id) throw new Error(`tree: edge ${p}→${c} at depths ${pd}/${cd} was not seen in the dry run`);
    return id;
  };
  for (const v of ranks) {
    b.node({ id: `v-${v}`, shape: "circle", pos: [x(v), y(0)], r: R, fill: T.node, stroke: T.nodeStroke, strokeWidth: 1.5, text: String(v), fontSize: T.fontSize, color: T.text, opacity: 0 });
    b.anchor(String(v), `v-${v}`);
  }
  b.node({ id: "cursor", shape: "circle", pos: cursorHome, r: 7, fill: T.accent, stroke: T.nodeStroke, opacity: 0 });
  b.anchor("cursor", "cursor");
  let outputs = 0;

  const bst = new Bst();
  /** Bring every edge line in step with the tree at time `t` (nodes are moved by the caller). */
  const syncEdges = (t: number): void => {
    const want = new Set<string>();
    for (const [p, c] of bst.edges()) {
      const id = ensureEdge(p, c, bst.depth(p), bst.depth(c));
      want.add(id);
      if (!shownEdges.has(id)) b.set(id, "opacity", 1, t);
    }
    for (const id of shownEdges) if (!want.has(id)) b.set(id, "opacity", 0, t);
    shownEdges.clear();
    for (const id of want) shownEdges.add(id);
  };
  /** Tween every present node to its current depth (after a promotion). */
  const settle = (t0: number, t1: number): void => {
    for (const v of bst.nodes.keys()) {
      const target: [number, number] = [x(v), y(bst.depth(v))];
      const at = b.valueAt(`v-${v}`, "pos", t0) as [number, number];
      if (at[0] !== target[0] || at[1] !== target[1]) b.tween(`v-${v}`, "pos", target, t0, t1);
    }
  };

  for (const v of scene.initial ?? []) {
    bst.insert(v);
    b.set(`v-${v}`, "pos", [x(v), y(bst.depth(v))], 0);
    b.set(`v-${v}`, "opacity", 1, 0);
  }
  syncEdges(0);
  b.step(bst.nodes.size ? `BST with ${bst.traverse("inorder").join(", ")}` : "Empty tree", "start");
  b.advance(b.stepMs * 0.7);

  /** Walk the cursor down the comparisons; returns the time it arrives at the last compared node. */
  const walk = (visited: number[], v: number, what: string): void => {
    b.set("cursor", "pos", cursorHome, b.t);
    b.set("cursor", "opacity", 1, b.t);
    for (const [k, u] of visited.entries()) {
      const t0 = b.t;
      const t1 = t0 + b.stepMs * 0.8;
      b.tween("cursor", "pos", [x(u) + R + 8, y(bst.depth(u)) - R], t0, t1);
      const rel = v === u ? "=" : v < u ? "<" : ">";
      const compare = v === u ? `${v} = ${u}: this is the node` : `${v} ${rel} ${u}: go ${v < u ? "left" : "right"}`;
      b.step(k === 0 ? `${what} ${v}: start at the root ${u}. ${compare}` : compare, undefined, t0);
      b.tween(`v-${u}`, "fill", T.accent, t0, t0 + 150);
      b.tween(`v-${u}`, "fill", T.node, t1, t1 + 150);
      b.advance(b.stepMs * 0.8);
    }
  };

  const outputsOf: number[][] = [];
  const searches: { value: number; found: boolean }[] = [];
  const deletions: string[] = [];
  for (const op of scene.ops) {
    if (b.annotate(op)) continue;
    if ("note" in op) {
      b.step(op.note);
      b.advance(b.stepMs);
      continue;
    }
    if ("insert" in op) {
      const v = op.insert;
      const p = bst.path(v);
      if (p.present) {
        walk(p.visited, v, "Insert");
        b.step(op.caption ?? `${v} is already in the tree: a BST holds each value once`);
        b.advance(b.stepMs);
        b.set("cursor", "opacity", 0);
        continue;
      }
      if (p.visited.length === 0) b.step(op.caption ?? `Insert ${v}: the tree is empty, it becomes the root`);
      else walk(p.visited, v, "Insert");
      bst.insert(v);
      const d = bst.depth(v);
      const t0 = b.t;
      const t1 = t0 + b.stepMs;
      if (p.visited.length) b.step(op.caption ?? `Attach ${v} as the ${p.side} child of ${p.parent}`, undefined, t0);
      b.set(`v-${v}`, "pos", p.visited.length ? [x(p.parent!) + R + 8, y(d - 1) - R] : cursorHome, t0);
      b.set("cursor", "opacity", 0, t0);
      b.tween(`v-${v}`, "opacity", 1, t0, t0 + 150);
      b.tween(`v-${v}`, "pos", [x(v), y(d)], t0, t1);
      syncEdges(t1);
      b.advance(b.stepMs * 1.2);
      continue;
    }
    if ("search" in op) {
      const v = op.search;
      const p = bst.path(v);
      searches.push({ value: v, found: p.present });
      if (p.visited.length === 0) b.step(op.caption ?? `Search ${v}: the tree is empty`);
      else walk(p.visited, v, "Search");
      const t0 = b.t;
      if (p.present) {
        b.step(op.caption ?? `Found ${v} after ${p.visited.length} comparison${p.visited.length === 1 ? "" : "s"}`, undefined, t0);
        b.tween(`v-${v}`, "fill", T.ok, t0, t0 + 200);
        b.tween(`v-${v}`, "scale", 1.15, t0, t0 + 200, "ease-out");
        b.tween(`v-${v}`, "scale", 1, t0 + 300, t0 + 500);
        b.tween(`v-${v}`, "fill", T.node, t0 + b.stepMs, t0 + b.stepMs + 200);
      } else if (p.visited.length) b.step(op.caption ?? `${p.parent} has no ${p.side} child: ${v} is not in the tree`, undefined, t0);
      b.set("cursor", "opacity", 0, t0 + b.stepMs);
      b.advance(b.stepMs * 1.2);
      continue;
    }
    if ("delete" in op) {
      const v = op.delete;
      const p = bst.path(v);
      if (!p.present) {
        walk(p.visited, v, "Delete");
        b.step(op.caption ?? `${v} is not in the tree: nothing to delete`);
        b.set("cursor", "opacity", 0);
        b.advance(b.stepMs);
        continue;
      }
      walk(p.visited, v, "Delete");
      const n = bst.nodes.get(v)!;
      const children = (n.left === undefined ? 0 : 1) + (n.right === undefined ? 0 : 1);
      const how = bst.delete(v)!;
      deletions.push(how.kind);
      const t0 = b.t;
      const t1 = t0 + b.stepMs;
      b.set("cursor", "opacity", 0, t0);
      if (how.kind === "leaf") b.step(op.caption ?? `${v} is a leaf: remove it`, undefined, t0);
      else if (how.kind === "one-child") b.step(op.caption ?? `${v} has one child: the child takes its place`, undefined, t0);
      else b.step(op.caption ?? `${v} has two children: its in-order successor ${how.successor} (the smallest value on the right) takes its place`, undefined, t0);
      void children;
      b.tween(`v-${v}`, "fill", T.bad, t0, t0 + 150);
      b.tween(`v-${v}`, "opacity", 0, t0 + 150, t0 + 450);
      // Edges into the old shape go first, nodes slide, edges of the new shape appear when they settle.
      for (const id of shownEdges) b.set(id, "opacity", 0, t0 + 150);
      shownEdges.clear();
      settle(t0 + 300, t1 + 300);
      syncEdges(t1 + 300);
      b.advance(b.stepMs * 1.8);
      continue;
    }
    // traverse
    if (!("traverse" in op)) continue;
    const order = bst.traverse(op.traverse);
    outputsOf.push(order);
    const rowIndex = outputs++;
    const yRow = yOut - (traversals - 1 - rowIndex) * 0;
    b.node({ id: `out-label-${rowIndex}`, shape: "text", pos: [x0, yRow], text: `${op.traverse}:`, fontSize: T.fontSize - 2, color: T.muted, anchor: "start", opacity: 0 });
    b.step(op.caption ?? `${op.traverse[0].toUpperCase()}${op.traverse.slice(1)} traversal${op.traverse === "inorder" ? ": left subtree, node, right subtree — the values come out sorted" : op.traverse === "preorder" ? ": node first, then its subtrees" : op.traverse === "postorder" ? ": both subtrees, then the node" : ": level by level, left to right"}`);
    b.set(`out-label-${rowIndex}`, "opacity", 1);
    b.set("cursor", "opacity", 1);
    b.set("cursor", "pos", cursorHome);
    b.advance(b.stepMs * 0.8);
    const labelW = (op.traverse.length + 1) * (T.fontSize - 2) * 0.6 + 10;
    order.forEach((v, k) => {
      const t0 = b.t;
      const t1 = t0 + b.stepMs * 0.7;
      b.tween("cursor", "pos", [x(v) + R + 8, y(bst.depth(v)) - R], t0, t1);
      b.tween(`v-${v}`, "fill", T.accent, t0, t0 + 150);
      b.tween(`v-${v}`, "fill", T.ok, t1, t1 + 150);
      const id = `out-${rowIndex}-${k}`;
      b.node({ id, shape: "text", pos: [x0 + labelW + k * 30 + 10, yRow], text: String(v), fontSize: T.fontSize - 1, color: T.text, opacity: 0 });
      b.set(id, "opacity", 1, t1);
      b.advance(b.stepMs * 0.7);
    });
    const tEnd = b.t;
    b.set("cursor", "opacity", 0, tEnd);
    for (const v of order) b.tween(`v-${v}`, "fill", T.node, tEnd, tEnd + 300);
    b.step(`${op.traverse}: ${order.join(", ")}`, undefined, tEnd);
    b.advance(b.stepMs);
  }
  b.step(`Tree holds ${bst.traverse("inorder").join(", ") || "nothing"}`, "end");
  b.advance(b.stepMs * 0.5);
  return b.build({
    title: scene.title,
    kind: "tree",
    finalInorder: bst.traverse("inorder"),
    finalDepths: Object.fromEntries([...bst.nodes.keys()].map((v) => [v, bst.depth(v)])),
    traversals: outputsOf,
    searches,
    deletions,
  });
}
