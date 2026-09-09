/**
 * The compiler's own account of a picture: why a box is on the layer it is on, why a container is a row or
 * a band and how wide, which pair of boxes set the canvas, which box an arrow went round, where an
 * annotation landed against where it was asked to go. Collected while compiling into `Timeline.meta.why`,
 * printed by `vlmkit-anim why`, and quoted by `check` where a warning has a cause the writer cannot see
 * from the picture (v24: a writer reconstructed the pair of boxes that set a 2472px canvas by dumping the
 * SVG's rects — three of five rounds went to shortening labels that were never the widest).
 */

export type WhyKind = "canvas" | "layer" | "row" | "band" | "route" | "placement";

export interface WhyEntry {
  kind: WhyKind;
  /** What the entry is about: a node, a group, an edge id, or `width` / `height` for the canvas. */
  about: string;
  /** One sentence, in the picture's own names. */
  says: string;
  /** The other parties, when there are some (the neighbour that set a layer, the boxes that set an axis, the box an arrow went round). */
  ids?: string[];
  /** The number that mattered: a layer index, a slot count, pixels of room. */
  n?: number;
  /** For a canvas entry: whether this axis runs across the layers (where bands sit side by side) or along them. */
  across?: boolean;
}

/** A sink compilers push into; `undefined` when nobody asked, so the pushes cost nothing. */
export type Why = WhyEntry[] | undefined;

export function say(why: Why, entry: WhyEntry): void {
  why?.push(entry);
}

/** An annotation that asked for one side and landed on another, as the annotation layer records it in `meta.placements`. */
export interface PlacementNote {
  path: string;
  op: string;
  at: string;
  asked: string;
  landed: string;
  reason: string;
}

const ORDER: WhyKind[] = ["canvas", "row", "band", "layer", "route", "placement"];
const HEAD: Record<WhyKind, string> = {
  canvas: "canvas — what set each axis",
  row: "rows — containers that own their layers",
  band: "bands — containers side by side, and their share",
  layer: "layers — what put each box where it is along the flow",
  route: "detours — edges bent round a box",
  placement: "annotations that did not land where they were asked",
};

/**
 * The account as text, grouped by kind in the order a writer reads a picture: the canvas first (the number
 * `check` warns about), then the containers, then every box's layer, then the edges that bent, then the
 * annotations that moved. `about` keeps only the entries that name that id (as subject or party).
 */
export function formatWhy(entries: WhyEntry[], placements: PlacementNote[] = [], about?: string): string {
  const all: WhyEntry[] = [...entries, ...placements.map((p): WhyEntry => ({ kind: "placement", about: p.path, says: `${p.path} (${p.op} at ${p.at}): asked for ${p.asked}, landed ${p.landed} — ${p.reason}`, ids: [p.at] }))];
  const kept = about ? all.filter((e) => e.about === about || e.about.startsWith(`${about} `) || e.ids?.includes(about) || e.says.includes(`(${about} `) || e.says.includes(` ${about})`)) : all;
  if (!kept.length) return about ? `nothing recorded about ${about}` : "nothing recorded: this kind lays out by its own rule (a sort's bars, a matrix's cells), and there was no decision to explain";
  const lines: string[] = [];
  for (const kind of ORDER) {
    const mine = kept.filter((e) => e.kind === kind);
    if (!mine.length) continue;
    lines.push(HEAD[kind]);
    for (const e of mine) lines.push(`  ${e.says}`);
  }
  return lines.join("\n");
}
