/**
 * Position nodes that the author did not position.
 *
 * Layered left-to-right / top-to-bottom for graphs (layer = longest path from
 * a source, cycles broken by declaration order), a grid, or a circle. Good
 * enough to make a declared graph legible; an author who wants a particular
 * picture sets `pos` on the nodes that matter and the rest fill in around
 * them.
 */

export interface LayoutInput {
  ids: string[];
  edges: [string, string][];
  fixed: Map<string, [number, number]>;
  width: number;
  height: number;
  /** Space each node takes, for spacing. */
  nodeW: number;
  nodeH: number;
}

export type LayoutMode = "lr" | "tb" | "grid" | "circle";

function layers(ids: string[], edges: [string, string][]): Map<string, number> {
  const idx = new Map(ids.map((id, i) => [id, i]));
  const out = new Map<string, number>();
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of edges) if (adj.has(a) && adj.has(b) && a !== b) adj.get(a)!.push(b);
  // Longest-path layering with cycle breaking: only follow edges to later-declared
  // nodes or nodes not yet placed, so a back edge does not push its target forward.
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    if (out.has(id)) return out.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const [a, b] of edges) {
      if (b !== id || a === id) continue;
      if (visiting.has(a)) continue; // back edge
      if ((idx.get(a) ?? 0) > (idx.get(b) ?? 0) && !out.has(a)) continue; // forward reference to a later node: treat as back edge
      d = Math.max(d, depth(a) + 1);
    }
    visiting.delete(id);
    out.set(id, d);
    return d;
  };
  for (const id of ids) depth(id);
  return out;
}

export function layoutNodes(input: LayoutInput, mode: LayoutMode): Map<string, [number, number]> {
  const { ids, width, height, nodeW, nodeH } = input;
  const pos = new Map<string, [number, number]>(input.fixed);
  const free = ids.filter((id) => !pos.has(id));
  if (free.length === 0) return pos;
  const padX = nodeW * 0.5;
  const padY = nodeH * 0.8;

  if (mode === "circle") {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.max(10, Math.min(width, height) / 2 - Math.max(nodeW, nodeH));
    free.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / free.length;
      pos.set(id, [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
    });
    return pos;
  }
  if (mode === "grid") {
    const cols = Math.max(1, Math.min(free.length, Math.floor((width - padX) / (nodeW + padX))));
    const rows = Math.ceil(free.length / cols);
    free.forEach((id, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const rowCount = r === rows - 1 ? free.length - (rows - 1) * cols : cols;
      const x = width / 2 + (c - (rowCount - 1) / 2) * (nodeW + padX);
      const y = height / 2 + (r - (rows - 1) / 2) * (nodeH + padY);
      pos.set(id, [Math.round(x), Math.round(y)]);
    });
    return pos;
  }

  const layerOf = layers(free, input.edges.filter(([a, b]) => !pos.has(a) && !pos.has(b)));
  const groups = new Map<number, string[]>();
  for (const id of free) {
    const l = layerOf.get(id) ?? 0;
    const g = groups.get(l) ?? [];
    g.push(id);
    groups.set(l, g);
  }
  const layerKeys = [...groups.keys()].sort((a, b) => a - b);
  const nLayers = layerKeys.length;
  layerKeys.forEach((l, li) => {
    const members = groups.get(l)!;
    members.forEach((id, mi) => {
      const main = nLayers === 1 ? 0.5 : (li + 0.5) / nLayers;
      const cross = (mi + 0.5) / members.length;
      if (mode === "lr") pos.set(id, [Math.round(main * width), Math.round(cross * height)]);
      else pos.set(id, [Math.round(cross * width), Math.round(main * height)]);
    });
  });
  return pos;
}
