/**
 * Position nodes that the author did not position.
 *
 * Layered left-to-right / top-to-bottom for graphs, a grid, or a circle. Good
 * enough to make a declared graph legible; an author who wants a particular
 * picture sets `pos` on the nodes that matter and the rest fill in around
 * them.
 */

/** A container for the layout: its own nodes and, when groups nest, the groups inside it. */
export interface LayoutGroup {
  id: string;
  nodes: string[];
  children?: LayoutGroup[];
}

export interface LayoutInput {
  ids: string[];
  edges: [string, string][];
  fixed: Map<string, [number, number]>;
  width: number;
  height: number;
  /** Space each node takes, for spacing. */
  nodeW: number;
  nodeH: number;
  /**
   * Containers (`lr` / `tb` only). A group whose layers hold nothing but its members spans the whole cross
   * axis (a "frontend" row above a "domain" row); groups that share a layer with something else each get
   * their own band across the layers, so a container drawn around its members never encloses a bystander.
   */
  groups?: LayoutGroup[];
  /**
   * `sources` (default): a node's layer is one past the deepest node with an edge into it — a walk from the
   * roots, as a graph traversal reads. `sinks`: one past the deepest node it points to — leaves at the end,
   * as a dependency map reads: two modules with the same dependencies share a layer whatever depends on them.
   */
  layering?: "sources" | "sinks";
}

export type LayoutMode = "lr" | "tb" | "grid" | "circle";

function layers(ids: string[], edges: [string, string][], from: "sources" | "sinks"): Map<string, number> {
  const known = new Set(ids);
  const out = new Map<string, number>();
  // Longest-path layering. A real cycle is cut where the walk meets itself (the `visiting` set). Declaration
  // order plays no part — it once did, treating an edge to a later-declared node as a back edge, and a
  // workspace whose packages were listed alphabetically had its dependency arrows drawn straight through
  // the boxes in one flattened column.
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    if (out.has(id)) return out.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const [a, b] of edges) {
      const [self, other] = from === "sources" ? [b, a] : [a, b];
      if (self !== id || other === id || !known.has(other)) continue;
      if (visiting.has(other)) continue; // back edge of a cycle
      d = Math.max(d, depth(other) + 1);
    }
    visiting.delete(id);
    out.set(id, d);
    return d;
  };
  for (const id of ids) depth(id);
  if (from === "sinks") {
    // Leaves are layer 0 by construction; the picture reads from the roots, so flip.
    const max = Math.max(0, ...out.values());
    for (const [id, d] of out) out.set(id, max - d);
  }
  return out;
}

/**
 * Order the members of every layer so that edges run as straight as possible: each node goes to the mean
 * cross position of its neighbours in the layers already ordered, a sweep down then up then down. Ties keep
 * declaration order. `ordered` is mutated in place; the first layer starts in declaration order.
 */
function orderLayers(ordered: string[][], edges: [string, string][]): void {
  const index = new Map<string, number>();
  const refresh = () => ordered.forEach((members) => members.forEach((id, i) => index.set(id, i / Math.max(1, members.length - 1))));
  const neighbours = new Map<string, string[]>();
  for (const [a, b] of edges) {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }
  const layerOf = new Map<string, number>();
  ordered.forEach((members, l) => members.forEach((id) => layerOf.set(id, l)));
  const sweep = (l: number, ref: number): void => {
    refresh();
    const members = ordered[l];
    const order = new Map(members.map((id, i) => [id, i]));
    const key = (id: string): number => {
      const ns = (neighbours.get(id) ?? []).filter((n) => layerOf.get(n) === ref && index.has(n));
      if (!ns.length) return order.get(id)! / Math.max(1, members.length - 1);
      return ns.reduce((s, n) => s + index.get(n)!, 0) / ns.length;
    };
    members.sort((x, y) => key(x) - key(y) || order.get(x)! - order.get(y)!);
  };
  for (let pass = 0; pass < 3; pass++) {
    if (pass % 2 === 0) for (let l = 1; l < ordered.length; l++) sweep(l, l - 1);
    else for (let l = ordered.length - 2; l >= 0; l--) sweep(l, l + 1);
  }
}

/** The ring radius on which `n` boxes of `size` sit without touching: the chord between neighbours is the size plus a gap. */
export function circleRadius(n: number, size: number): number {
  if (n <= 1) return 0;
  return Math.ceil((size + 12) / (2 * Math.sin(Math.PI / n)));
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
    // Wide enough that neighbours on the ring do not touch (lb, v18: four states on a 270px frame were laid on
    // a 35px ring, every state on every other); the compilers size the canvas from `circleRadius` first.
    const r = Math.max(10, Math.min(width, height) / 2 - Math.max(nodeW, nodeH), circleRadius(free.length, Math.max(nodeW, nodeH)));
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

  const edges = input.edges.filter(([a, b]) => !pos.has(a) && !pos.has(b));
  const layerOf = layers(free, edges, input.layering ?? "sources");
  const byLayer = new Map<number, string[]>();
  for (const id of free) {
    const l = layerOf.get(id) ?? 0;
    byLayer.set(l, [...(byLayer.get(l) ?? []), id]);
  }
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
  const nLayers = layerKeys.length;
  const ordered = layerKeys.map((l) => byLayer.get(l)!);
  const place = (id: string, main: number, cross: number): void => {
    if (mode === "lr") pos.set(id, [Math.round(main * width), Math.round(cross * height)]);
    else pos.set(id, [Math.round(cross * width), Math.round(main * height)]);
  };
  const mainOf = (li: number) => (nLayers === 1 ? 0.5 : (li + 0.5) / nLayers);

  if (input.groups?.length) {
    orderLayers(ordered, edges);
    const layerIndex = new Map<number, number>(layerKeys.map((l, i) => [l, i]));
    const li = (id: string) => layerIndex.get(layerOf.get(id) ?? 0) ?? 0;
    const allMembers = (g: LayoutGroup): string[] => [...new Set([...g.nodes, ...(g.children ?? []).flatMap(allMembers)])];
    // Members of one level, its groups, and the range of the cross axis they may use. A group whose layers hold
    // nothing else at this level spans the whole range (a row); the rest share the range as bands, each as wide
    // as its fullest layer, the ungrouped last. Inside a group the same rule places its own nodes and its
    // children (v23: a parent's children were spread evenly through the parent's band, so two sibling
    // containers crossed wherever one child's layer was wider than another's).
    const assign = (members: string[], groups: LayoutGroup[], lo: number, hi: number): void => {
      const here = new Set(members);
      const bandOf = new Map<string, LayoutGroup>();
      for (const g of groups) for (const n of allMembers(g)) if (here.has(n) && !bandOf.has(n)) bandOf.set(n, g);
      const span = new Map<LayoutGroup, [number, number]>();
      for (const id of members) {
        const g = bandOf.get(id);
        if (!g) continue;
        const l = li(id);
        const sp = span.get(g) ?? [l, l];
        span.set(g, [Math.min(sp[0], l), Math.max(sp[1], l)]);
      }
      const exclusive = new Set<LayoutGroup>();
      for (const [g, [glo, ghi]] of span) {
        if (!members.every((id) => bandOf.get(id) === g || li(id) < glo || li(id) > ghi)) continue;
        // …and no other group reaches across its layers: a full-width row through a column another group spans
        // is two containers crossing (fe, v21: "Adapters" drawn as a row through the "Core domain" column, and
        // the reader put the port inside both).
        const crossed = [...span].some(([h, [lo2, hi2]]) => h !== g && lo2 < glo && hi2 > ghi);
        if (!crossed) exclusive.add(g);
      }
      // What goes where at this level: a row group's members within the whole range, recursively; a band
      // group's within its band; the ungrouped in the last band.
      const inside = (g: LayoutGroup, blo: number, bhi: number): void => {
        const mine = members.filter((id) => bandOf.get(id) === g);
        if (g.children?.length) assign(mine, g.children, blo, bhi);
        else {
          const cells = new Map<number, string[]>();
          for (const id of ordered.flat()) if (mine.includes(id)) cells.set(li(id), [...(cells.get(li(id)) ?? []), id]);
          for (const cell of cells.values()) cell.forEach((id, mi) => place(id, mainOf(li(id)), blo + ((mi + 0.5) / cell.length) * (bhi - blo)));
        }
      };
      for (const g of exclusive) inside(g, lo, hi);
      const bands: (LayoutGroup | " none")[] = [...groups.filter((g) => span.has(g) && !exclusive.has(g)), " none"];
      const bandSize = new Map<LayoutGroup | " none", number>();
      for (const b of bands) {
        const mine = members.filter((id) => (b === " none" ? !bandOf.has(id) : bandOf.get(id) === b));
        const perLayer = new Map<number, number>();
        for (const id of mine) perLayer.set(li(id), (perLayer.get(li(id)) ?? 0) + 1);
        if (mine.length) bandSize.set(b, Math.max(...perLayer.values()));
      }
      const used = bands.filter((b) => bandSize.has(b));
      const total = Math.max(1, used.reduce((sum, b) => sum + bandSize.get(b)!, 0));
      let start = lo;
      for (const b of used) {
        const width = ((hi - lo) * bandSize.get(b)!) / total;
        if (b === " none") {
          const cells = new Map<number, string[]>();
          for (const id of ordered.flat()) if (here.has(id) && !bandOf.has(id)) cells.set(li(id), [...(cells.get(li(id)) ?? []), id]);
          for (const cell of cells.values()) cell.forEach((id, mi) => place(id, mainOf(li(id)), start + ((mi + 0.5) / cell.length) * width));
        } else inside(b, start, start + width);
        start += width;
      }
    };
    assign(free, input.groups, 0, 1);
    return pos;
  }
  orderLayers(ordered, edges);
  ordered.forEach((members, li) => members.forEach((id, mi) => place(id, mainOf(li), (mi + 0.5) / members.length)));
  return pos;
}
