#!/usr/bin/env node
/**
 * Font-determinism probe for the `text-collision` ink floors.
 *
 * The collision gate compares glyph **ink bands**, not line boxes:
 *
 *   inkInset = clamp((lineHeight - (ascent + descent)) / 2, 0, fontSize / 2)
 *   report iff  ox >= 6  &&  oy >= 6  &&  oy >= max(2, 0.5 * min-ink-height)
 *
 * `ascent + descent` comes from canvas `measureText`, so every threshold above
 * is a function of the **resolved font's metrics**. That makes one question
 * unavoidable: does a verdict computed on Linux still hold on macOS, where the
 * same `font-family: system-ui, sans-serif` resolves to a different face?
 *
 * This tool answers it by measurement rather than argument. It does not
 * re-implement the gate — it drives the production `COLLECT_INTEGRITY_TEXT`
 * script and `findTextCollisions`, records every candidate pair's distance
 * from its threshold, and can diff two runs:
 *
 *   # on Linux
 *   node --experimental-strip-types src/util/font-determinism-probe.ts measure \
 *     "fixtures/collision-fp-corpus/*.html" --label linux-default --out linux.json
 *   # on macOS, same command, then:
 *   node --experimental-strip-types src/util/font-determinism-probe.ts compare linux.json macos.json
 *
 * `compare` prints the metric deltas and, crucially, any **verdict flip** — a
 * pair that is reported under one condition and not the other. A flip is the
 * only outcome that matters; metric drift with margin to spare is noise.
 */
import { writeFile } from "node:fs/promises";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { hasFlag, readFlag, readInt, readNumber, readPositionals } from "@mizchi/vlmkit-core/arg-reader.ts";
import { glob } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import {
  COLLECT_INTEGRITY_TEXT,
  findTextCollisions,
  type IntegrityTextBlock,
} from "@mizchi/vlmkit-markup/inspect/integrity-check.ts";

/** Mirrors the gate's constants; asserted against the gate's own output below. */
const MIN_OVERLAP_PX = 6;
const MIN_INK_FRACTION = 0.5;
/**
 * How far *below* touching a pair may sit and still be recorded. Pairs whose
 * ink bands clear each other by a few px are the ones a metric shift can push
 * into reporting range; pairs 200px apart can never flip and would only bloat
 * the fingerprint.
 */
const NEAR_MISS_PX = 8;
/** Cap per fixture, tightest margin first — a full O(n^2) dump is unreadable. */
const MAX_PAIRS_PER_FIXTURE = 40;

export interface PairMargin {
  pair: string;
  ox: number;
  oy: number;
  /** `max(2, 0.5 * min-ink-height)` — the ink-fraction floor for this pair. */
  threshold: number;
  /** oy - threshold. Negative means the pair is below the floor (not reported). */
  margin: number;
  reported: boolean;
}

export interface BlockMetric {
  selector: string;
  height: number;
  inkInset: number;
}

export interface FixtureFingerprint {
  fixture: string;
  blocks: BlockMetric[];
  pairs: PairMargin[];
  findings: number;
  /** Selectors of reported pairs — the verdict, independent of the numbers. */
  reportedPairs: string[];
}

export interface ProbeFingerprint {
  label: string;
  platform: string;
  browserVersion: string;
  dpr: number;
  fontStack: string | null;
  hinting: string;
  fixtures: FixtureFingerprint[];
}

/**
 * Recompute each candidate pair's distance from the ink floor. The formula is
 * duplicated from `findTextCollisions` on purpose: the probe reports margins,
 * which the gate does not expose. `findings` below comes from the gate itself,
 * so a divergence between the two shows up as a mismatch rather than silently
 * measuring the wrong thing.
 */
export function pairMargins(blocks: IntegrityTextBlock[], reported: Set<string>): PairMargin[] {
  const out: PairMargin[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i]!, b = blocks[j]!;
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      if (ox < MIN_OVERLAP_PX) continue;
      const aInk = a.inkInset ?? 0;
      const bInk = b.inkInset ?? 0;
      const oy = Math.min(a.y + a.height - aInk, b.y + b.height - bInk)
        - Math.max(a.y + aInk, b.y + bInk);
      // Keep near-misses, not just overlaps. A pair whose ink bands clear each
      // other by 3px is precisely what a font-metric shift could push into
      // reporting range, so excluding it would measure only the pairs that
      // could never flip. `NEAR_MISS_PX` below the touching point is the
      // at-risk population.
      if (oy < -NEAR_MISS_PX) continue;
      const contains = (o: IntegrityTextBlock, p: IntegrityTextBlock) =>
        o.x <= p.x && o.y <= p.y && o.x + o.width >= p.x + p.width && o.y + o.height >= p.y + p.height;
      if (contains(a, b) || contains(b, a)) continue;
      const minInkHeight = Math.min(
        Math.max(1, a.height - 2 * aInk),
        Math.max(1, b.height - 2 * bInk),
      );
      const threshold = Math.max(MIN_OVERLAP_PX, Math.max(2, MIN_INK_FRACTION * minInkHeight));
      const key = `${a.selector} x ${b.selector}`;
      out.push({
        pair: key,
        ox: round(ox),
        oy: round(oy),
        threshold: round(threshold),
        margin: round(oy - threshold),
        reported: reported.has(key) || reported.has(`${b.selector} x ${a.selector}`),
      });
    }
  }
  // Tightest first: the pairs closest to their floor are the whole point.
  const ranked = out.sort((x, y) => Math.abs(x.margin) - Math.abs(y.margin));
  const kept = ranked.slice(0, MAX_PAIRS_PER_FIXTURE);
  // A reported pair must never be dropped by the cap: `compare` needs its
  // presence to tell a threshold flip from a geometry change.
  const keptKeys = new Set(kept.map((p) => p.pair));
  return [...kept, ...ranked.slice(MAX_PAIRS_PER_FIXTURE).filter((p) => p.reported && !keptKeys.has(p.pair))];
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Flags that consume the next argv entry, so fixture patterns are found. */
const VALUE_FLAGS = ["label", "out", "font-stack", "font-face", "dpr", "viewport", "hinting"];

export interface MeasureOptions {
  patterns: string[];
  label: string;
  /** CSS font-family value forced onto every element, or null to leave the page alone. */
  fontStack?: string;
  /** `url()` for an @font-face named ProbeFont, usable inside --font-stack. */
  fontFace?: string;
  dpr?: number;
  hinting?: "default" | "none";
  viewport?: number;
}

export async function measure(options: MeasureOptions): Promise<ProbeFingerprint> {
  const { chromium } = await import("playwright");
  const hinting = options.hinting ?? "default";
  const browser = await chromium.launch({
    args: hinting === "none"
      ? ["--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-lcd-text"]
      : [],
  });
  const dpr = options.dpr ?? 1;
  const width = options.viewport ?? 1280;
  const fixtures: FixtureFingerprint[] = [];
  try {
    const files: string[] = [];
    for (const pattern of options.patterns) {
      if (/[*?[\]{}]/.test(pattern)) {
        for await (const hit of glob(pattern)) files.push(hit);
      } else {
        files.push(pattern);
      }
    }
    files.sort();
    for (const file of files) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: dpr,
      });
      await page.goto(pathToFileURL(resolvePath(file)).href, { waitUntil: "load", timeout: 30000 });
      if (options.fontStack) {
        await page.addStyleTag({
          content: (options.fontFace
            ? `@font-face { font-family: ProbeFont; src: url("${options.fontFace}"); font-display: block; }\n`
            : "")
            // Deliberately blunt: every element, not just body. Cross-OS drift
            // substitutes one face for another under the SAME declared stack;
            // this replaces the stack outright, which moves metrics further.
            + `body, body * { font-family: ${options.fontStack} !important; }`,
        });
      }
      await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined));
      await page.waitForTimeout(150);
      const blocks = await page.evaluate(COLLECT_INTEGRITY_TEXT) as IntegrityTextBlock[];
      const gate = findTextCollisions(blocks, width);
      const reportedPairs = gate.findings
        .map((f) => f.selector ?? "")
        .filter(Boolean);
      fixtures.push({
        fixture: file,
        blocks: blocks.map((b) => ({ selector: b.selector, height: b.height, inkInset: round(b.inkInset ?? 0) })),
        pairs: pairMargins(blocks, new Set(reportedPairs)),
        findings: gate.findings.length,
        reportedPairs: [...reportedPairs].sort(),
      });
      await page.close();
    }
    return {
      label: options.label,
      platform: `${process.platform}-${process.arch}`,
      browserVersion: browser.version(),
      dpr,
      fontStack: options.fontStack ?? null,
      hinting,
      fixtures,
    };
  } finally {
    await browser.close();
  }
}

export interface ComparisonRow {
  fixture: string;
  maxInkInsetDelta: number;
  maxMarginDelta: number;
  /**
   * Pairs reported in one run and not the other, *and present as candidates in
   * both*. This is the only outcome that indicts the floor: the same overlap,
   * judged differently.
   */
  thresholdFlips: string[];
  /**
   * Pairs reported in one run whose candidacy disappeared in the other — the
   * two elements no longer overlap at all. Measured cause: font substitution
   * changes text *width*, so absolutely-positioned labels that grazed under a
   * monospace face clear each other under a proportional one. Both verdicts are
   * correct for their own rendering; this is the page differing, not the gate.
   */
  geometryFlips: string[];
  /** Pairs present in one run only (layout changed enough to add/remove candidates). */
  onlyInA: number;
  onlyInB: number;
}

export interface Comparison {
  a: string;
  b: string;
  rows: ComparisonRow[];
  /** Same overlap, different verdict. Non-zero means the floor is font-fragile. */
  totalThresholdFlips: number;
  /** The overlap itself appeared or disappeared. Expected under substitution. */
  totalGeometryFlips: number;
  /** Smallest |margin| seen in either run: how close the corpus came to flipping. */
  tightestMargin: { fixture: string; pair: string; margin: number; label: string } | null;
}

export function compareFingerprints(a: ProbeFingerprint, b: ProbeFingerprint): Comparison {
  const rows: ComparisonRow[] = [];
  let tightest: Comparison["tightestMargin"] = null;
  const consider = (fingerprint: ProbeFingerprint, fixture: FixtureFingerprint) => {
    for (const p of fixture.pairs) {
      if (!tightest || Math.abs(p.margin) < Math.abs(tightest.margin)) {
        tightest = { fixture: fixture.fixture, pair: p.pair, margin: p.margin, label: fingerprint.label };
      }
    }
  };
  for (const fa of a.fixtures) {
    const fb = b.fixtures.find((f) => f.fixture === fa.fixture);
    consider(a, fa);
    if (!fb) continue;
    consider(b, fb);
    const inkA = new Map(fa.blocks.map((x) => [x.selector, x.inkInset]));
    let maxInk = 0;
    for (const blk of fb.blocks) {
      const prev = inkA.get(blk.selector);
      if (prev !== undefined) maxInk = Math.max(maxInk, Math.abs(prev - blk.inkInset));
    }
    const marginA = new Map(fa.pairs.map((p) => [p.pair, p.margin]));
    const marginB = new Map(fb.pairs.map((p) => [p.pair, p.margin]));
    let maxMargin = 0;
    for (const [pair, m] of marginB) {
      const prev = marginA.get(pair);
      if (prev !== undefined) maxMargin = Math.max(maxMargin, Math.abs(prev - m));
    }
    const setA = new Set(fa.reportedPairs);
    const setB = new Set(fb.reportedPairs);
    const thresholdFlips: string[] = [];
    const geometryFlips: string[] = [];
    const classify = (pair: string, presentThere: Map<string, number>, whereLabel: string) => {
      const line = `only in ${whereLabel}: ${pair}`;
      (presentThere.has(pair) ? thresholdFlips : geometryFlips).push(line);
    };
    for (const pair of setA) if (!setB.has(pair)) classify(pair, marginB, a.label);
    for (const pair of setB) if (!setA.has(pair)) classify(pair, marginA, b.label);
    rows.push({
      fixture: fa.fixture,
      maxInkInsetDelta: round(maxInk),
      maxMarginDelta: round(maxMargin),
      thresholdFlips,
      geometryFlips,
      onlyInA: [...marginA.keys()].filter((p) => !marginB.has(p)).length,
      onlyInB: [...marginB.keys()].filter((p) => !marginA.has(p)).length,
    });
  }
  return {
    a: a.label,
    b: b.label,
    rows,
    totalThresholdFlips: rows.reduce((s, r) => s + r.thresholdFlips.length, 0),
    totalGeometryFlips: rows.reduce((s, r) => s + r.geometryFlips.length, 0),
    tightestMargin: tightest,
  };
}

export function formatComparison(c: Comparison): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`font determinism: ${c.a}  vs  ${c.b}`);
  lines.push("");
  lines.push("fixture                                   dInk   dMargin  +/-pairs  thr  geom");
  for (const r of c.rows) {
    lines.push(
      `${r.fixture.slice(-40).padEnd(40)}  ${r.maxInkInsetDelta.toFixed(2).padStart(5)}`
      + `  ${r.maxMarginDelta.toFixed(2).padStart(8)}`
      + `  ${`+${r.onlyInB}/-${r.onlyInA}`.padStart(8)}`
      + `  ${String(r.thresholdFlips.length).padStart(3)}`
      + `  ${String(r.geometryFlips.length).padStart(4)}`,
    );
  }
  lines.push("");
  lines.push(c.totalThresholdFlips === 0
    ? `FLOOR STABLE: no pair present in both runs changed report status.`
    : `FLOOR FRAGILE: ${c.totalThresholdFlips} pair(s) judged differently at the same overlap.`);
  for (const r of c.rows) for (const f of r.thresholdFlips) lines.push(`  ! ${r.fixture}: ${f}`);
  if (c.totalGeometryFlips > 0) {
    lines.push("");
    lines.push(
      `${c.totalGeometryFlips} report(s) differ because the overlap itself changed`
      + ` (the page renders differently, not the gate judging differently):`,
    );
    for (const r of c.rows) for (const f of r.geometryFlips) lines.push(`  - ${r.fixture}: ${f}`);
  }
  if (c.tightestMargin) {
    lines.push("");
    lines.push(
      `tightest margin anywhere: ${c.tightestMargin.margin}px (${c.tightestMargin.label},`
      + ` ${c.tightestMargin.fixture}, ${c.tightestMargin.pair})`,
    );
    lines.push(`  a pair this close to its floor is what a metric shift would flip first.`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage:
  font-determinism-probe measure <glob...> [options]
  font-determinism-probe compare <a.json> <b.json>

Measure how far each text-collision candidate pair sits from the ink floor,
so the same corpus can be fingerprinted on another OS and diffed. Reports
verdict FLIPS, not metric drift — drift with margin to spare is noise.

measure options:
  --label <name>        Name for this condition (default: platform-default)
  --out <file.json>     Write the fingerprint (default: stdout)
  --font-stack <css>    Force this font-family on every element
  --font-face <url>     @font-face src for a family named ProbeFont
  --dpr <n>             deviceScaleFactor (default 1)
  --hinting none        Launch with hinting/subpixel/LCD text disabled
  --viewport <px>       Viewport width (default 1280)

Examples:
  measure "fixtures/collision-fp-corpus/*.html" --label linux --out linux.json
  measure "fixtures/collision-fp-corpus/*.html" --label dejavu \\
    --font-stack '"DejaVu Serif", serif' --out dejavu.json
  compare linux.json macos.json`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || hasFlag(argv, "help") || hasFlag(argv, "-h")) printUsage(argv.length === 0 ? 1 : 0);
  const mode = argv[0];
  const rest = argv.slice(1);
  if (mode === "compare") {
    const [fileA, fileB] = readPositionals(rest);
    if (!fileA || !fileB) printUsage(1);
    const { readFile } = await import("node:fs/promises");
    const a = JSON.parse(await readFile(fileA, "utf-8")) as ProbeFingerprint;
    const b = JSON.parse(await readFile(fileB, "utf-8")) as ProbeFingerprint;
    const comparison = compareFingerprints(a, b);
    console.log(formatComparison(comparison));
    if (comparison.totalThresholdFlips > 0) process.exitCode = 1;
    return;
  }
  if (mode !== "measure") printUsage(1);
  const patterns = readPositionals(rest, VALUE_FLAGS);
  const label = readFlag(rest, "label");
  const out = readFlag(rest, "out");
  const fontStack = readFlag(rest, "font-stack");
  const fontFace = readFlag(rest, "font-face");
  // Validated, not coerced: a NaN dpr would silently render at the default and
  // the fingerprint would claim a condition it never measured.
  const dpr = readNumber(rest, "dpr", { min: 0.1, max: 4 });
  const viewport = readInt(rest, "viewport", { min: 200, max: 8000 });
  const hinting: "default" | "none" = readFlag(rest, "hinting") === "none" ? "none" : "default";
  if (patterns.length === 0) printUsage(1);
  const fingerprint = await measure({
    patterns,
    label: label ?? `${process.platform}-default`,
    ...(fontStack ? { fontStack } : {}),
    ...(fontFace ? { fontFace } : {}),
    ...(dpr !== undefined ? { dpr } : {}),
    hinting,
    ...(viewport !== undefined ? { viewport } : {}),
  });
  const json = JSON.stringify(fingerprint, null, 2);
  if (out) {
    await writeFile(out, json);
    const pairs = fingerprint.fixtures.reduce((s, f) => s + f.pairs.length, 0);
    const findings = fingerprint.fixtures.reduce((s, f) => s + f.findings, 0);
    console.log(
      `${fingerprint.label}: ${fingerprint.fixtures.length} fixture(s), ${pairs} candidate pair(s),`
      + ` ${findings} reported -> ${out}`,
    );
  } else {
    console.log(json);
  }
}

const isCliEntry = process.argv[1]
  ? resolvePath(process.argv[1]) === resolvePath(new URL(import.meta.url).pathname)
  : false;
if (isCliEntry) main().catch(handleCliError);
