/**
 * Page-level multi-component composition diff.
 *
 * `build component` converges ONE component against ONE target crop;
 * this closes the composition gap (scenario A5): given a full-page
 * target screenshot and the current HTML/PNG, extract component bboxes
 * on both sides, pair them **spatially** (not by area rank — rank
 * pairing lies when a component is missing), and report the signals an
 * agent needs to assemble a page out of converged parts:
 *
 *   - per-component position / size deltas + fill color pair
 *   - components missing from current (target-only) and extra ones
 *   - vertical ordering violations
 *   - stacking-gap deltas between consecutive components
 *   - `--crop` writes target/current crop pairs per component so each
 *     can be drilled into with `build component`
 *
 * Deterministic: pixels + Playwright only, no VLM.
 *
 * CLI: vlmkit build page <target.png> <current.html|current.png> [options]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { cropRegion } from "@mizchi/vlmkit-core/png-utils.ts";
import {
  extractComponentsFromRgba,
  type ComponentBbox,
  type ExtractComponentsOptions,
} from "./component-bbox.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface PageComponent extends ComponentBbox {
  /** Index in the extraction order (area-desc) of its own side. */
  index: number;
  /** fillColor as "#rrggbb". */
  hex: string;
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

function iouOf(a: ComponentBbox, b: ComponentBbox): number {
  const x0 = Math.max(a.left, b.left);
  const y0 = Math.max(a.top, b.top);
  const x1 = Math.min(a.left + a.width, b.left + b.width);
  const y1 = Math.min(a.top + a.height, b.top + b.height);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.width * a.height + b.width * b.height - inter;
  return union <= 0 ? 0 : inter / union;
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
  const diag = Math.sqrt(pageWidth ** 2 + pageHeight ** 2) || 1;

  const scorePair = (t: PageComponent, c: PageComponent): number | null => {
    const ratio = Math.max(t.area, c.area) / Math.max(1, Math.min(t.area, c.area));
    if (ratio > maxAreaRatio) return null;
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
    iou: Number(iouOf(t, c).toFixed(3)),
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
  const targetComponents = toPageComponents(
    extractComponentsFromRgba(target.data, target.width, target.height, { ...options, background: targetBackground }),
  );
  const currentComponents = toPageComponents(
    extractComponentsFromRgba(current.data, current.width, current.height, { ...options, background: currentBackground }),
  );
  const { matches, missing, extra } = matchPageComponents(
    targetComponents,
    currentComponents,
    target.width,
    target.height,
    options,
  );
  return {
    targetSize: { width: target.width, height: target.height },
    currentSize: { width: current.width, height: current.height },
    matches,
    missing,
    extra,
    orderViolations: findOrderViolations(matches, options.orderTolerance ?? 8),
    gapDeltas: findGapDeltas(matches, options.gapTolerance ?? 4),
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

async function loadPng(path: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const png = PNG.sync.read(await readFile(path));
  return {
    data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
    width: png.width,
    height: png.height,
  };
}

async function renderHtmlToPng(
  htmlPath: string,
  width: number,
  height: number,
): Promise<{ data: Uint8Array; width: number; height: number; screenshotPath: string }> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: "load" });
    // Viewport-only, like `build component`: the target screenshot is bounded
    // by the requested viewport, so a full-page capture of a taller candidate
    // would report below-the-fold content as extra components.
    // animations: "disabled" captures the rest pose (finite animations
    // fast-forwarded to completion, infinite ones at their initial state) —
    // otherwise an entrance animation is caught mid-flight and every fill /
    // IoU downstream reports phantom deltas (S5-r2 finding).
    const buffer = await page.screenshot({ fullPage: false, animations: "disabled" });
    const png = PNG.sync.read(buffer);
    return {
      data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
      width: png.width,
      height: png.height,
      screenshotPath: "",
    };
  } finally {
    await browser.close();
  }
}

async function writeCrops(
  dir: string,
  composition: PageComposition,
  target: { data: Uint8Array; width: number; height: number },
  current: { data: Uint8Array; width: number; height: number },
): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const written: string[] = [];
  const save = async (name: string, img: { data: Uint8Array; width: number; height: number }, c: ComponentBbox) => {
    const crop = cropRegion(
      { width: img.width, height: img.height, data: img.data },
      c.left, c.top, c.width, c.height,
    );
    if (crop.width === 0 || crop.height === 0) return;
    const png = new PNG({ width: crop.width, height: crop.height });
    png.data = Buffer.from(crop.data.buffer, crop.data.byteOffset, crop.data.byteLength);
    const path = join(dir, name);
    await writeFile(path, PNG.sync.write(png));
    written.push(path);
  };
  for (const m of composition.matches) {
    await save(`component-${m.target.index}-target.png`, target, m.target);
    await save(`component-${m.target.index}-current.png`, current, m.current);
  }
  for (const c of composition.missing) {
    await save(`missing-${c.index}-target.png`, target, c);
  }
  for (const c of composition.extra) {
    await save(`extra-${c.index}-current.png`, current, c);
  }
  return written;
}

function printHelp(): void {
  console.log(`Usage: vlmkit build page <target.png> <current.html|current.png> [options]

Multi-component page composition diff. Extracts component bboxes from
the target screenshot and the current render, pairs them spatially, and
reports position/size/fill deltas, missing/extra components, section
ordering, and stacking-gap deltas.

Options:
  --min-area <N>    Min filled pixels per component (default 200)
  --top <N>         Max components per side (default 8)
  --crop <dir>      Write per-component target/current crop pairs
  --out <path.md>   Write the Markdown report to a file
  --json            Emit machine-readable JSON instead of Markdown
  -h, --help        Show this help`);
}

async function main(argv = process.argv.slice(2)) {
  const help = argv.includes("--help") || argv.includes("-h");
  const valueFlags = new Set(["--min-area", "--top", "--crop", "--out"]);
  const positional = argv.filter((arg, i) => !arg.startsWith("-") && !valueFlags.has(argv[i - 1] ?? ""));
  if (help || positional.length < 2) {
    printHelp();
    if (positional.length < 2 && !help) process.exit(1);
    return;
  }
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const [targetPath, currentInput] = positional;
  if (!existsSync(targetPath!)) throw new Error(`Target not found: ${targetPath}`);
  if (!existsSync(currentInput!)) throw new Error(`Current not found: ${currentInput}`);

  const options: ComposePageOptions = {
    minArea: flag("--min-area") ? Number(flag("--min-area")) : undefined,
    topN: flag("--top") ? Number(flag("--top")) : undefined,
  };

  const target = await loadPng(targetPath!);
  const current = currentInput!.toLowerCase().endsWith(".png")
    ? await loadPng(currentInput!)
    : await renderHtmlToPng(currentInput!, target.width, target.height);

  const composition = composePageDiff(target, current, options);

  const cropDir = flag("--crop");
  let crops: string[] = [];
  if (cropDir) crops = await writeCrops(cropDir, composition, target, current);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ target: targetPath, current: currentInput, composition, crops }, null, 2));
    return;
  }
  let report = renderPageCompositionMarkdown(composition, targetPath!, currentInput!);
  if (crops.length > 0) {
    report += `\n## Crops (${crops.length})\n\n${crops.map((c) => `- ${c}`).join("\n")}\n`;
  }
  const outPath = flag("--out");
  if (outPath) {
    await writeFile(outPath, report);
    console.log(`Report written to: ${outPath}`);
  } else {
    console.log(report);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "page-compose"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
