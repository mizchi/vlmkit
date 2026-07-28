#!/usr/bin/env node
/**
 * One-shot done-condition verdict for markup agent runs.
 *
 * The S5/S6 proofs showed agents self-declare "done" early in 6/6 runs and
 * the driver had to re-run every measurement by hand to write a kickback.
 * This command runs the whole verifier protocol at once:
 *
 *   1. `build page` composition per target viewport (missing / extra /
 *      ordering / gap deltas)
 *   2. optional calibration: the reference HTML measured against the same
 *      targets, proving what floor is reachable (kills "tool noise" claims)
 *   3. the dynamic gates: check breakpoints / scan scroll / check animation /
 *      check motion (suspects fail the verdict; warns are listed for review)
 *   4. a rest-pose full-page pixel diff per target
 *
 * and emits a machine-readable verdict plus a paste-ready kickback section
 * that names EVERY residual (a residual omitted from a kickback stays
 * unfixed — S5-r4). Deterministic: pixels + Playwright only, no VLM.
 *
 * CLI:
 *   vlmkit verify markup <attempt.html> --target <t1.png> [--target <t2.png> ...]
 *     [--reference <reference.html>] [--json]
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  composePageDiff,
  loadPng,
  renderHtmlToPng,
  type PageComposition,
  type PageComponent,
} from "../component/page-compose.ts";
import { runBreakpointCheck } from "../stress/breakpoint-check.ts";
import { runScrollScan } from "../inspect/scroll-scan.ts";
import { runAnimationEval } from "../style/animation-eval.ts";
import { runMotionDetection } from "../style/motion-detect.ts";

export interface TargetVerdict {
  target: string;
  width: number;
  height: number;
  matched: number;
  missing: number;
  extra: number;
  orderViolations: number;
  gapDeltas: number;
  /** Pixel diff over the union canvas (white-padded), 0..1. */
  pixelDiffRatio: number;
  renderedHeight: number;
  pass: boolean;
  composition: PageComposition;
  calibration?: { matched: number; missing: number; extra: number };
}

export interface GateVerdict {
  gate: "breakpoints" | "scroll" | "animation" | "motion";
  suspects: number;
  warns: number;
  summary: string;
}

export interface VerifyTrendPoint {
  targetsPassed: number;
  /** Total missing + extra + ordering violations across targets. */
  residuals: number;
}

export interface VerifyTrend {
  previous: VerifyTrendPoint;
  current: VerifyTrendPoint;
  direction: "improved" | "regressed" | "flat";
}

/**
 * Round-over-round trend. The S5-r5 audit showed an agent reach 1/2
 * targets passing, silently regress to 0/2, and thrash for five more
 * rounds — the kickback list alone can't say "your last change made it
 * worse". Comparing against the previous verify run (from the run
 * ledger) turns "revert first" from prompt discipline into a printed
 * signal.
 */
export function computeTrend(previous: VerifyTrendPoint, current: VerifyTrendPoint): VerifyTrend {
  const direction = current.targetsPassed < previous.targetsPassed
      || (current.targetsPassed === previous.targetsPassed && current.residuals > previous.residuals)
    ? "regressed"
    : current.targetsPassed > previous.targetsPassed
        || (current.targetsPassed === previous.targetsPassed && current.residuals < previous.residuals)
      ? "improved"
      : "flat";
  return { previous, current, direction };
}

export interface MarkupVerifyReport {
  attempt: string;
  targets: TargetVerdict[];
  gates: GateVerdict[];
  done: boolean;
  /** Present when a previous verify run for the same attempt exists in the run ledger. */
  trend?: VerifyTrend;
  /** Human/agent-readable residual list; empty when done. */
  kickback: string[];
}

function fillDistanceHex(a: string, b: string): number {
  const p = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ] as const;
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

/**
 * Kickback lines for one target's composition: every missing / extra /
 * ordering / gap residual, with the displacement interpretation applied
 * (a missing paired with a same-fill extra is one element in the wrong
 * place — the agent must move it, not add/remove it).
 */
export function kickbackForComposition(label: string, c: PageComposition): string[] {
  const lines: string[] = [];
  // Catastrophically mis-sized matched components go FIRST: in S5-r5 a
  // collapsed hero (IoU 0.04, dSize -280px) was the root cause of most of
  // the missing/extra list, but it was buried below them — the agent fixed
  // debris for rounds while the cause stood. Order = priority.
  for (const m of c.matches) {
    if (m.iou < 0.5 && Math.min(m.target.height, m.current.height) > 4) {
      lines.push(
        `${label}: ROOT-CAUSE CANDIDATE — matched #${m.target.index} has collapsed geometry (IoU ${m.iou}, dPos (${m.deltaLeft},${m.deltaTop}), dSize (${m.deltaWidth},${m.deltaHeight})). Target box: (${m.target.left},${m.target.top}) ${m.target.width}x${m.target.height}. Restore this FIRST — the missing/extra items below are often its debris.`,
      );
    }
  }
  const claimedExtra = new Set<number>();
  for (const m of c.missing) {
    const twin = c.extra.find((e) =>
      !claimedExtra.has(e.index)
      && fillDistanceHex(m.hex, e.hex) < 40
      && Math.max(m.area, e.area) / Math.max(1, Math.min(m.area, e.area)) < 3
    );
    if (twin) {
      claimedExtra.add(twin.index);
      lines.push(
        `${label}: missing #${m.index} (${m.left},${m.top}) ${m.width}x${m.height} ${m.hex} is likely your own element DISPLACED to (${twin.left},${twin.top}) ${twin.width}x${twin.height} — move/resize it (fix the space above it), do not add a new element.`,
      );
    } else {
      lines.push(
        `${label}: missing #${m.index} (${m.left},${m.top}) ${m.width}x${m.height} fill ${m.hex} — genuinely absent; build it.`,
      );
    }
  }
  for (const e of c.extra) {
    if (claimedExtra.has(e.index)) continue;
    lines.push(
      `${label}: extra (${e.left},${e.top}) ${e.width}x${e.height} fill ${e.hex} — not in target; remove, merge, or restyle (a too-dark fill can make an interior crest as a component).`,
    );
  }
  for (const v of c.orderViolations) {
    lines.push(
      `${label}: ordering violation — target #${v.first} (y=${v.targetTops[0]}) should be above #${v.second} (y=${v.targetTops[1]}) but current renders them at y=${v.currentTops[0]} / y=${v.currentTops[1]}.`,
    );
  }
  for (const g of c.gapDeltas) {
    const dir = g.delta > 0 ? `reduce ${g.delta}px` : `add ${-g.delta}px`;
    lines.push(
      `${label}: gap #${g.above} -> #${g.below} is ${g.currentGap}px vs target ${g.targetGap}px — ${dir} of vertical space between them.`,
    );
  }
  for (const m of c.matches) {
    // < 0.5 already reported up top as a root-cause candidate.
    if (m.iou >= 0.5 && m.iou < 0.9 && Math.min(m.target.height, m.current.height) > 4) {
      lines.push(
        `${label}: matched #${m.target.index} IoU ${m.iou} — dPos (${m.deltaLeft},${m.deltaTop}), dSize (${m.deltaWidth},${m.deltaHeight}); converge size/position.`,
      );
    }
  }
  return lines;
}

/** Last verify-markup ledger entry for this attempt, if any. */
function previousTrendPoint(attempt: string, cwd = process.cwd()): VerifyTrendPoint | undefined {
  try {
    const raw = readFileSync(join(cwd, ".vlmkit", "run-ledger.jsonl"), "utf8");
    for (const line of raw.trim().split("\n").reverse()) {
      const entry = JSON.parse(line) as {
        tool?: string;
        source?: string;
        headline?: { targetsPassed?: number; residuals?: number };
      };
      if (entry.tool === "verify-markup" && entry.source === attempt
        && typeof entry.headline?.targetsPassed === "number"
        && typeof entry.headline?.residuals === "number") {
        return { targetsPassed: entry.headline.targetsPassed, residuals: entry.headline.residuals };
      }
    }
  } catch {
    // No ledger / unreadable — trend is simply absent.
  }
  return undefined;
}

async function fullPageRestShot(
  htmlPath: string,
  width: number,
  nominalViewportHeight: number,
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: nominalViewportHeight } });
    await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: "networkidle", timeout: 30000 });
    const buffer = await page.screenshot({ fullPage: true, animations: "disabled" });
    const png = PNG.sync.read(buffer);
    return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength), width: png.width, height: png.height };
  } finally {
    await browser.close();
  }
}

function paddedDiff(
  a: { data: Uint8Array; width: number; height: number },
  b: { data: Uint8Array; width: number; height: number },
): number {
  const W = Math.max(a.width, b.width);
  const H = Math.max(a.height, b.height);
  const pad = (src: typeof a): Uint8Array => {
    const out = new Uint8Array(W * H * 4).fill(255);
    for (let y = 0; y < src.height; y++) {
      out.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), y * W * 4);
    }
    return out;
  };
  const diff = pixelmatch(pad(a), pad(b), undefined, W, H, { threshold: 0.1 });
  return diff / (W * H);
}

/**
 * Rendered-height tolerance. Height is part of the per-target verdict
 * (Codex #86): a page with 0/0 components but hundreds of px of blank
 * space below the target must not print DONE. The tolerance absorbs
 * rounding/antialias-level drift — r5 shipped DONE at +8px on a 1335px
 * target, which is fine; +500px of dead space is not.
 */
export function heightToleranceFor(targetHeight: number): number {
  return Math.max(8, Math.round(targetHeight * 0.01));
}

export interface MarkupVerifyOptions {
  attempt: string;
  targets: string[];
  reference?: string;
}

export async function runMarkupVerify(options: MarkupVerifyOptions): Promise<MarkupVerifyReport> {
  const targets: TargetVerdict[] = [];
  const kickback: string[] = [];

  let widest = 1280;
  for (const targetPath of options.targets) {
    const target = await loadPng(targetPath);
    widest = Math.max(widest, target.width);
    const label = `${basename(targetPath)} (${target.width}px)`;
    const current = await renderHtmlToPng(options.attempt, target.width, target.height);
    const composition = composePageDiff(target, current);
    const shot = await fullPageRestShot(options.attempt, target.width, Math.min(target.height, 800));
    const pixelDiffRatio = paddedDiff(target, shot);

    let calibration: TargetVerdict["calibration"];
    if (options.reference) {
      const ref = await renderHtmlToPng(options.reference, target.width, target.height);
      const refComp = composePageDiff(target, ref);
      calibration = { matched: refComp.matches.length, missing: refComp.missing.length, extra: refComp.extra.length };
    }

    const heightTolerance = heightToleranceFor(target.height);
    const heightDelta = shot.height - target.height;
    const heightOk = Math.abs(heightDelta) <= heightTolerance;
    const pass = composition.missing.length === 0
      && composition.extra.length === 0
      && composition.orderViolations.length === 0
      && heightOk;
    if (!pass) kickback.push(...kickbackForComposition(label, composition));
    if (!heightOk) {
      kickback.push(
        `${label}: rendered page height ${shot.height}px vs target ${target.height}px (${heightDelta > 0 ? "+" : ""}${heightDelta}px, tolerance ±${heightTolerance}px) — total vertical size is off.`,
      );
    }

    targets.push({
      target: targetPath,
      width: target.width,
      height: target.height,
      matched: composition.matches.length,
      missing: composition.missing.length,
      extra: composition.extra.length,
      orderViolations: composition.orderViolations.length,
      gapDeltas: composition.gapDeltas.length,
      pixelDiffRatio: Number(pixelDiffRatio.toFixed(4)),
      renderedHeight: shot.height,
      pass,
      composition,
      ...(calibration ? { calibration } : {}),
    });
  }

  const gates: GateVerdict[] = [];
  const push = (gate: GateVerdict["gate"], issues: { severity: string; kind: string }[], summary: string) => {
    gates.push({
      gate,
      suspects: issues.filter((i) => i.severity === "suspect").length,
      warns: issues.filter((i) => i.severity === "warn").length,
      summary,
    });
  };
  const bp = await runBreakpointCheck({ source: options.attempt });
  push("breakpoints", bp.issues, `checked ${bp.checkedValues.join(", ") || "none"}px`);
  const scroll = await runScrollScan({ source: options.attempt });
  push("scroll", scroll.issues, `${scroll.containers.length} container(s), page overflow-x ${scroll.page.horizontalOverflow}px`);
  const anim = await runAnimationEval({ source: options.attempt, viewport: { width: widest, height: 720 } });
  push("animation", anim.issues, `${anim.animationCount} animation(s), settle ${anim.settleMs === null ? "never" : Math.round(anim.settleMs) + "ms"}, reduced-motion ${anim.reducedMotion ? (anim.reducedMotion.remainingCount === 0 ? "honored" : "IGNORED") : "n/a"}`);
  const motion = await runMotionDetection({ source: options.attempt });
  push("motion", motion.issues, `running ${motion.runningAnimationCount}, reduced-motion rule ${motion.hasReducedMotionRule ? "yes" : "no"}`);

  for (const g of gates) {
    if (g.suspects > 0) kickback.push(`gate ${g.gate}: ${g.suspects} suspect issue(s) — run \`vlmkit ${g.gate === "scroll" ? "scan scroll" : `check ${g.gate}`}\` for detail and fix them.`);
  }

  // Passing targets are an asset to protect: when only some targets fail,
  // the classic thrash is fixing the failing one with a base-style change
  // that silently breaks the passing one.
  const passing = targets.filter((t) => t.pass);
  if (passing.length > 0 && passing.length < targets.length) {
    kickback.unshift(
      `${passing.map((t) => basename(t.target)).join(", ")} PASSES — protect it: scope fixes to the failing target's media regime where possible, and re-check the passing target after every change.`,
    );
  }

  const done = targets.every((t) => t.pass) && gates.every((g) => g.suspects === 0);
  const currentPoint: VerifyTrendPoint = {
    targetsPassed: passing.length,
    residuals: targets.reduce((n, t) => n + t.missing + t.extra + t.orderViolations, 0),
  };
  const previous = previousTrendPoint(options.attempt);
  const trend = previous ? computeTrend(previous, currentPoint) : undefined;
  if (trend?.direction === "regressed") {
    kickback.unshift(
      `REGRESSION — this attempt measures WORSE than your previous verify run (targets passed ${trend.previous.targetsPassed} -> ${trend.current.targetsPassed}, residuals ${trend.previous.residuals} -> ${trend.current.residuals}). REVERT your last change before trying anything else.`,
    );
  }

  appendRunLedger({
    tool: "verify-markup",
    source: options.attempt,
    target: options.targets.join(","),
    headline: {
      done,
      targetsPassed: currentPoint.targetsPassed,
      targetsTotal: targets.length,
      residuals: currentPoint.residuals,
      gateSuspects: gates.reduce((n, g) => n + g.suspects, 0),
    },
  });
  return { attempt: options.attempt, targets, gates, done, ...(trend ? { trend } : {}), kickback };
}

export function formatMarkupVerifyReport(report: MarkupVerifyReport): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit verify markup${RESET}`);
  lines.push(`${DIM}attempt: ${report.attempt}${RESET}`);
  lines.push("");
  lines.push(`verdict: ${report.done ? `${GREEN}DONE${RESET}` : `${RED}NOT DONE${RESET}`}`);
  if (report.trend) {
    const t = report.trend;
    const label = t.direction === "regressed"
      ? `${RED}REGRESSED${RESET}`
      : t.direction === "improved" ? `${GREEN}improved${RESET}` : `${DIM}flat${RESET}`;
    lines.push(
      `trend vs previous run: ${label} (targets passed ${t.previous.targetsPassed} -> ${t.current.targetsPassed}, residuals ${t.previous.residuals} -> ${t.current.residuals})`,
    );
  }
  lines.push("");
  lines.push("Targets:");
  for (const t of report.targets) {
    const mark = t.pass ? `${GREEN}pass${RESET}` : `${RED}fail${RESET}`;
    const cal = t.calibration
      ? ` ${DIM}(calibration floor: ${t.calibration.matched} matched, ${t.calibration.missing}/${t.calibration.extra} missing/extra)${RESET}`
      : "";
    lines.push(
      `  - ${basename(t.target)} ${t.width}x${t.height}: ${mark} — matched ${t.matched}, missing ${t.missing}, extra ${t.extra}, ordering ${t.orderViolations}, pixel diff ${(t.pixelDiffRatio * 100).toFixed(2)}%, rendered height ${t.renderedHeight}px${cal}`,
    );
  }
  lines.push("");
  lines.push("Gates:");
  for (const g of report.gates) {
    const mark = g.suspects > 0 ? `${RED}suspect x${g.suspects}${RESET}` : g.warns > 0 ? `${YELLOW}warn x${g.warns}${RESET}` : `${GREEN}clean${RESET}`;
    lines.push(`  - ${g.gate}: ${mark} — ${g.summary}`);
  }
  if (report.kickback.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Kickback (every residual — paste into the agent's next round):${RESET}`);
    for (const k of report.kickback) lines.push(`  * ${k}`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit verify markup <attempt.html> --target <png> [--target <png> ...] [options]

One-shot done-condition verdict: composition per target viewport +
dynamic gates + rest-pose pixel diff, with a paste-ready kickback
listing every residual. Add --reference to print the calibration floor.

Options:
  --target <png>       Target screenshot (repeatable; width/height define the render viewport)
  --reference <html>   Reference page measured against the same targets (calibration floor)
  --json               Print JSON report`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  const targets: string[] = [];
  let reference: string | undefined;
  let json = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--target") targets.push(argv[++i]!);
    else if (arg === "--reference") reference = argv[++i]!;
    else if (arg === "--json") json = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  const attempt = positional[0];
  if (!attempt || targets.length === 0) printUsage(1);
  if (!existsSync(attempt)) throw new Error(`Attempt not found: ${attempt}`);
  for (const t of targets) if (!existsSync(t)) throw new Error(`Target not found: ${t}`);
  if (reference && !existsSync(reference)) throw new Error(`Reference not found: ${reference}`);

  const report = await runMarkupVerify({ attempt, targets, ...(reference ? { reference } : {}) });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatMarkupVerifyReport(report));
  }
  if (!report.done) process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "markup-verify" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
