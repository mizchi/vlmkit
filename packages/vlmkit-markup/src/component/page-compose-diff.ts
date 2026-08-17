/**
 * Page-composition diff: pairing components between a target and an attempt, and
 * reporting what is missing, extra, out of order, or spaced differently.
 *
 * Split out of `page-compose.ts`, which held this alongside the PNG loading,
 * Playwright rendering and crop writing that feed it. The two halves have nothing
 * to say to each other beyond a data type: everything here is arithmetic over
 * bounding boxes and produces either a report object or a Markdown string. Keeping
 * them together meant a spatial-pairing bug could only be reproduced by rendering
 * a page first.
 *
 * `page-compose.ts` remains the CLI entry point and re-exports these, so existing
 * imports and `vlmkit build page` are unaffected.
 */
import {
  extractComponentsFromRgba,
  type ComponentBbox,
  type ExtractComponentsOptions,
} from "./component-bbox.ts";
import { classifyRegion, kindsCanPair, type ComponentKindInfo } from "./component-classify.ts";
import { iou } from "@mizchi/vlmkit-core/rect-overlap.ts";

export interface PageComponent extends ComponentBbox {
  /** Index in the extraction order (area-desc) of its own side. */
  index: number;
  /** fillColor as "#rrggbb". */
  hex: string;
  /** Pixel-stat kind (attached by composePage; optional for callers). */
  kind?: ComponentKindInfo;
}

export interface PageMatch {
  target: PageComponent;
  current: PageComponent;
  deltaTop: number;
  deltaLeft: number;
  deltaWidth: number;
  deltaHeight: number;
  iou: number;
  /** Euclidean RGB distance between the two fill samples. */
  fillDistance: number;
}

export interface PageOrderViolation {
  /** Pair of matched target indices whose vertical order flipped in current. */
  first: number;
  second: number;
  targetTops: [number, number];
  currentTops: [number, number];
}

export interface PageGapDelta {
  /** Matched target indices of the two consecutive components. */
  above: number;
  below: number;
  targetGap: number;
  currentGap: number;
  delta: number;
}

export interface PageComposition {
  targetSize: { width: number; height: number };
  currentSize: { width: number; height: number };
  matches: PageMatch[];
  /** In target but not matched in current — the agent hasn't built these yet. */
  missing: PageComponent[];
  /** In current but not matched in target — invented or duplicated parts. */
  extra: PageComponent[];
  orderViolations: PageOrderViolation[];
  gapDeltas: PageGapDelta[];
}

export interface ComposePageOptions extends ExtractComponentsOptions {
  /**
   * Max normalized center distance (fraction of the page diagonal) for
   * a pairing to be considered. Default 0.25.
   */
  maxCenterDistance?: number;
  /** Max area ratio for a pairing. Default 6 (looser than rank matching — position already constrains). */
  maxAreaRatio?: number;
  /** Max Euclidean RGB distance between fills for a pairing. Default 80. */
  maxFillDistance?: number;
  /** |gap delta| below this is not reported. Default 4px. */
  gapTolerance?: number;
  /** Vertical-order comparisons ignore flips smaller than this. Default 8px. */
  orderTolerance?: number;
}

function rgbToHex(fill: string): string {
  const m = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return "#000000";
  const c = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${c(m[1]!)}${c(m[2]!)}${c(m[3]!)}`;
}

function fillDistance(a: PageComponent, b: PageComponent): number {
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a.hex);
  const [br, bg, bb] = parse(b.hex);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

function toPageComponents(bboxes: ComponentBbox[]): PageComponent[] {
  return bboxes.map((bbox, index) => ({ ...bbox, index, hex: rgbToHex(bbox.fillColor) }));
}

function center(c: ComponentBbox): [number, number] {
  return [c.left + c.width / 2, c.top + c.height / 2];
}

/**
 * Greedy spatial matching: every (target, current) pair is scored by
 * normalized center distance plus a size-mismatch penalty; pairs are
 * accepted best-first while both sides are unclaimed. Rank order plays
 * no part, so a missing hero can't cascade into nonsense pairings.
 */
export function matchPageComponents(
  target: PageComponent[],
  current: PageComponent[],
  pageWidth: number,
  pageHeight: number,
  options: ComposePageOptions = {},
): { matches: PageMatch[]; missing: PageComponent[]; extra: PageComponent[] } {
  const maxCenter = options.maxCenterDistance ?? 0.25;
  const maxAreaRatio = options.maxAreaRatio ?? 6;
  const maxFillDistance = options.maxFillDistance ?? 80;
  const diag = Math.sqrt(pageWidth ** 2 + pageHeight ** 2) || 1;

  // A hairline (1-2px thin) and a blob are never the same element even
  // when their centers and areas agree — in S7 a 76x11 text fragment
  // paired with a 368x1 divider, hiding a real missing divider AND a
  // real extra fragment behind one nonsense match.
  const isHairline = (p: PageComponent): boolean => p.height <= 2 || p.width <= 2;

  const scorePair = (t: PageComponent, c: PageComponent): number | null => {
    const ratio = Math.max(t.area, c.area) / Math.max(1, Math.min(t.area, c.area));
    if (ratio > maxAreaRatio) return null;
    if (isHairline(t) !== isHairline(c)) return null;
    // Fill acts as identity, not just a report: a pair whose fills are
    // this far apart (#b3b6bd text vs #e2e8f0 line; S6's #e2edfe vs
    // #3c5ab6, d=233) is two different elements, and matching them
    // suppresses both real residuals. Deliberate-but-wrong colors the
    // agent still has to fix surface as a missing+extra pair instead —
    // strictly more actionable than a silently poisoned match.
    if (fillDistance(t, c) > maxFillDistance) return null;
    // Kind identity, the principled version of the two gates above:
    // a confident solid never pairs with a confident text/image.
    // Unconfident classifications never gate (see component-classify).
    if (!kindsCanPair(t.kind, c.kind)) return null;
    const [tx, ty] = center(t);
    const [cx, cy] = center(c);
    const centerDist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2) / diag;
    if (centerDist > maxCenter) return null;
    const sizePenalty =
      (Math.abs(t.width - c.width) / Math.max(t.width, c.width, 1)
        + Math.abs(t.height - c.height) / Math.max(t.height, c.height, 1)) / 2;
    return centerDist + sizePenalty * 0.5;
  };

  interface Scored { t: PageComponent; c: PageComponent; score: number }
  const scored: Scored[] = [];
  for (const t of target) {
    for (const c of current) {
      const score = scorePair(t, c);
      if (score !== null) scored.push({ t, c, score });
    }
  }
  scored.sort((a, b) => a.score - b.score);

  const usedT = new Set<number>();
  const usedC = new Set<number>();
  const assigned: { t: PageComponent; c: PageComponent }[] = [];
  for (const { t, c } of scored) {
    if (usedT.has(t.index) || usedC.has(c.index)) continue;
    usedT.add(t.index);
    usedC.add(c.index);
    assigned.push({ t, c });
  }

  // Greedy is not globally optimal: two near-identical thin components (1px
  // panel/card borders ~20px apart) can end up cross-paired — the first pick
  // grabs the closest current line, leaving its true partner to a worse,
  // *crossed* pairing that then reads as a phantom vertical-ordering
  // violation (S5-r3 mobile). A 2-opt pass exchanges the currents of any two
  // matches when the swap strictly lowers the same score the greedy pass
  // used, so it can only improve the assignment.
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const a = assigned[i]!;
        const b = assigned[j]!;
        const currentScore = scorePair(a.t, a.c)! + scorePair(b.t, b.c)!;
        const swappedA = scorePair(a.t, b.c);
        const swappedB = scorePair(b.t, a.c);
        if (swappedA === null || swappedB === null) continue;
        if (swappedA + swappedB < currentScore - 1e-9) {
          const tmp = a.c;
          a.c = b.c;
          b.c = tmp;
          improved = true;
        }
      }
    }
  }

  const matches: PageMatch[] = assigned.map(({ t, c }) => ({
    target: t,
    current: c,
    deltaTop: c.top - t.top,
    deltaLeft: c.left - t.left,
    deltaWidth: c.width - t.width,
    deltaHeight: c.height - t.height,
    iou: Number(iou(t, c).toFixed(3)),
    fillDistance: Number(fillDistance(t, c).toFixed(1)),
  }));
  matches.sort((a, b) => a.target.top - b.target.top || a.target.left - b.target.left);
  return {
    matches,
    missing: target.filter((t) => !usedT.has(t.index)),
    extra: current.filter((c) => !usedC.has(c.index)),
  };
}

function findOrderViolations(matches: PageMatch[], tolerance: number): PageOrderViolation[] {
  // matches are already sorted by target top.
  const violations: PageOrderViolation[] = [];
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const a = matches[i]!;
      const b = matches[j]!;
      // Only compare pairs that are clearly stacked in the target.
      if (b.target.top - a.target.top < tolerance) continue;
      if (a.current.top - b.current.top > tolerance) {
        violations.push({
          first: a.target.index,
          second: b.target.index,
          targetTops: [a.target.top, b.target.top],
          currentTops: [a.current.top, b.current.top],
        });
      }
    }
  }
  return violations;
}

function findGapDeltas(matches: PageMatch[], tolerance: number): PageGapDelta[] {
  const deltas: PageGapDelta[] = [];
  // Consecutive-by-target-top pairs with real vertical separation.
  for (let i = 0; i + 1 < matches.length; i++) {
    const above = matches[i]!;
    const below = matches[i + 1]!;
    const targetGap = below.target.top - (above.target.top + above.target.height);
    if (targetGap < 0) continue; // overlapping in target — not a stacking pair
    const currentGap = below.current.top - (above.current.top + above.current.height);
    const delta = currentGap - targetGap;
    if (Math.abs(delta) < tolerance) continue;
    deltas.push({
      above: above.target.index,
      below: below.target.index,
      targetGap,
      currentGap,
      delta,
    });
  }
  return deltas;
}

/**
 * Dominant page color via sparse whole-image sampling (mode over /8
 * quantized bins, averaged within the winning bin). Unlike perimeter
 * sampling this is stable on pages with full-bleed dark headers or
 * sidebars that dominate the edges of one render but not the other.
 */
export function dominantPageColor(
  img: { data: Uint8Array; width: number; height: number },
  stride = 7,
): [number, number, number] {
  const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
  const total = img.width * img.height;
  for (let p = 0; p < total; p += stride) {
    const i = p * 4;
    const r = img.data[i]!, g = img.data[i + 1]!, b = img.data[i + 2]!;
    const key = `${r >> 3},${g >> 3},${b >> 3}`;
    const bucket = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b;
    counts.set(key, bucket);
  }
  let best: { n: number; r: number; g: number; b: number } | undefined;
  for (const bucket of counts.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }
  if (!best) return [255, 255, 255];
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}

export function composePageDiff(
  target: { data: Uint8Array; width: number; height: number },
  current: { data: Uint8Array; width: number; height: number },
  options: ComposePageOptions = {},
): PageComposition {
  // One shared background reference for BOTH extractions, anchored on the
  // target: per-image edge detection can disagree between the two renders
  // (full-bleed dark header case), making the component sets incomparable.
  // But sharing is only valid while the current render actually has the
  // target's background — early in reconstruction (blank scaffold vs dark
  // target) or across themes the backgrounds genuinely differ, and forcing
  // the target reference onto current would mark every current background
  // pixel as foreground, fusing the page into one giant component.
  const tolerance = options.bgTolerance ?? 12;
  const targetBackground = options.background ?? dominantPageColor(target);
  let currentBackground = targetBackground;
  if (!options.background) {
    const detected = dominantPageColor(current);
    const agrees =
      Math.abs(detected[0] - targetBackground[0]) <= tolerance
      && Math.abs(detected[1] - targetBackground[1]) <= tolerance
      && Math.abs(detected[2] - targetBackground[2]) <= tolerance;
    if (!agrees) currentBackground = detected;
  }
  const attachKinds = (
    components: PageComponent[],
    image: { data: Uint8Array; width: number },
  ): PageComponent[] =>
    components.map((c) => ({ ...c, kind: classifyRegion(image.data, image.width, c) }));
  // Ranking-boundary stabilization (S13, third segmentation-fitting
  // occurrence): the Nth area-ranked slot is a seat both sides fight
  // for — an ink-weight difference of a few pixels swaps which
  // fragment occupies it, and the orphaned counterpart then reads as
  // missing/extra/ordering although both pages render it. MATCH over a
  // larger pool than the report covers: a top-N component whose
  // counterpart sits just below the other side's cutoff pairs with it
  // and is silently absorbed. Only unmatched components ranked inside
  // top-N are reported, and ordering/gap chains use in-top-N pairs
  // only — behavior is byte-identical when no boundary is straddled.
  const topN = options.topN ?? 8;
  const poolMargin = 6;
  const targetComponents = attachKinds(
    toPageComponents(
      extractComponentsFromRgba(target.data, target.width, target.height, { ...options, topN: topN + poolMargin, background: targetBackground }),
    ),
    target,
  );
  const currentComponents = attachKinds(
    toPageComponents(
      extractComponentsFromRgba(current.data, current.width, current.height, { ...options, topN: topN + poolMargin, background: currentBackground }),
    ),
    current,
  );
  const { matches, missing, extra } = matchPageComponents(
    targetComponents,
    currentComponents,
    target.width,
    target.height,
    options,
  );
  const reportMatches = matches.filter((m) => m.target.index < topN && m.current.index < topN);
  return {
    targetSize: { width: target.width, height: target.height },
    currentSize: { width: current.width, height: current.height },
    matches: reportMatches,
    missing: missing.filter((m) => m.index < topN),
    extra: extra.filter((e) => e.index < topN),
    orderViolations: findOrderViolations(reportMatches, options.orderTolerance ?? 8),
    gapDeltas: findGapDeltas(reportMatches, options.gapTolerance ?? 4),
  };
}

// ---------------------------------------------------------------------------
// Report rendering

function bboxLabel(c: PageComponent): string {
  return `#${c.index} (${c.left},${c.top}) ${c.width}x${c.height}`;
}

export function renderPageCompositionMarkdown(
  composition: PageComposition,
  targetPath: string,
  currentInput: string,
): string {
  const lines: string[] = [];
  lines.push(`# Page composition diff`);
  lines.push("");
  lines.push(`Target: ${targetPath} (${composition.targetSize.width}x${composition.targetSize.height})`);
  lines.push(`Current: ${currentInput} (${composition.currentSize.width}x${composition.currentSize.height})`);
  lines.push("");

  lines.push(`## Matched components (${composition.matches.length})`);
  lines.push("");
  if (composition.matches.length === 0) {
    lines.push("_none — nothing in current spatially corresponds to the target_");
  } else {
    lines.push(`| Target | Current | dPos | dSize | IoU | Fill target -> current |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const m of composition.matches) {
      const fill = m.fillDistance > 30
        ? `\`${m.target.hex}\` -> \`${m.current.hex}\` (d${m.fillDistance})`
        : `\`${m.target.hex}\` ok`;
      lines.push(
        `| ${bboxLabel(m.target)} | ${bboxLabel(m.current)} | (${m.deltaLeft.toFixed(0)},${m.deltaTop.toFixed(0)}) | (${m.deltaWidth.toFixed(0)},${m.deltaHeight.toFixed(0)}) | ${m.iou.toFixed(2)} | ${fill} |`,
      );
    }
  }
  lines.push("");

  lines.push(`## Missing from current (${composition.missing.length}) — build these`);
  lines.push("");
  if (composition.missing.length === 0) {
    lines.push("_none_");
  } else {
    lines.push(`| Target component | Fill | Suggested action |`);
    lines.push(`|---|---|---|`);
    for (const c of composition.missing) {
      lines.push(`| ${bboxLabel(c)} | \`${c.hex}\` | add a ~${c.width}x${c.height} block near (${c.left},${c.top}); drill in via \`build component\` on its crop |`);
    }
  }
  lines.push("");

  lines.push(`## Extra in current (${composition.extra.length}) — not in target`);
  lines.push("");
  if (composition.extra.length === 0) {
    lines.push("_none_");
  } else {
    lines.push(`| Current component | Fill |`);
    lines.push(`|---|---|`);
    for (const c of composition.extra) {
      lines.push(`| ${bboxLabel(c)} | \`${c.hex}\` |`);
    }
  }
  lines.push("");

  if (composition.orderViolations.length > 0) {
    lines.push(`## Vertical ordering violations (${composition.orderViolations.length})`);
    lines.push("");
    for (const v of composition.orderViolations) {
      lines.push(
        `- target #${v.first} (y=${v.targetTops[0]}) is above #${v.second} (y=${v.targetTops[1]}), but current renders them at y=${v.currentTops[0]} / y=${v.currentTops[1]} — sections are swapped`,
      );
    }
    lines.push("");
  }

  if (composition.gapDeltas.length > 0) {
    lines.push(`## Stacking gap deltas (${composition.gapDeltas.length})`);
    lines.push("");
    lines.push(`| Between | Target gap | Current gap | d |`);
    lines.push(`|---|---|---|---|`);
    for (const g of composition.gapDeltas) {
      const hint = g.delta > 0 ? "reduce" : "add";
      lines.push(`| #${g.above} -> #${g.below} | ${g.targetGap}px | ${g.currentGap}px | ${g.delta > 0 ? "+" : ""}${g.delta}px (${hint} ${Math.abs(g.delta)}px) |`);
    }
    lines.push("");
  }

  lines.push(`## Suggested next step`);
  lines.push("");
  if (composition.missing.length > 0) {
    const biggest = composition.missing.reduce((a, b) => (a.area >= b.area ? a : b));
    lines.push(`1. Build the largest missing component first: ${bboxLabel(biggest)} fill \`${biggest.hex}\`.`);
    lines.push(`2. Re-run \`build page\` after each component lands; drill into a single component with \`build component <crop> <html>\`.`);
  } else if (composition.orderViolations.length > 0) {
    lines.push(`1. Fix section order first — the swapped sections above dominate every other delta.`);
  } else {
    const worst = [...composition.matches].sort((a, b) => a.iou - b.iou)[0];
    if (worst && worst.iou < 0.9) {
      lines.push(`1. Composition is complete; tighten the worst-aligned component ${bboxLabel(worst.target)} (IoU ${worst.iou.toFixed(2)}) using the dPos/dSize columns.`);
    } else {
      lines.push(`1. Composition matches. Move to the decoration pass (\`check palette\`, \`check tokens\`, \`build component\` per part).`);
    }
    if (composition.gapDeltas.length > 0) {
      lines.push(`2. Then normalize the stacking gaps listed above.`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
