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
  type PageMatch,
} from "../component/page-compose.ts";
import { kindLabel } from "../component/component-classify.ts";
import { detectBackground } from "../component/component-bbox.ts";
import {
  captureRegionElementsFromHtml,
  matchRegionBboxToElement,
  type RegionElementRect,
} from "../region-selector-match.ts";
// The kickback text and the terminal report live in `markup-verify-report.ts`:
// pure string building, and previously stuck behind this module's 627ms of
// orchestrator imports. Re-exported because callers and tests resolve them here.
import { kickbackForComposition } from "./markup-verify-report.ts";
export { formatMarkupVerifyReport, kickbackForComposition } from "./markup-verify-report.ts";
export type { KickbackContext } from "./markup-verify-report.ts";

import type { AnyGateDefinition } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { gateCommandString } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { RuleSettings } from "@mizchi/vlmkit-core/plugin/rules.ts";
import { runGate } from "@mizchi/vlmkit-core/plugin/runner.ts";
import { animationGate } from "../gates/animation.gate.ts";
import { breakpointsGate } from "../gates/breakpoints.gate.ts";
import { motionGate } from "../gates/motion.gate.ts";
import { scrollScanGate } from "../gates/scroll-scan.gate.ts";

/**
 * The gates this verdict folds in, as gate definitions rather than as four
 * hand-written calls.
 *
 * Before the plugin contract this was four `runX(...)` calls, four bespoke
 * `push(...)` adapters that recounted suspects by string-matching severity, a
 * `gate: "breakpoints" | "scroll" | "animation" | "motion"` union, and a
 * `gate === "scroll" ? "scan scroll" : \`check ${gate}\`` special case to
 * name the command in the kickback. All four facts were the same fact, stated
 * four times and able to disagree.
 *
 * Importing the definitions creates no cycle: a `*.gate.ts` imports its
 * measurement module, never this one. (`gates/index.ts` imports
 * `verify.gate.ts` which imports this file — but nothing here imports
 * `gates/index.ts`.)
 */
export const DEFAULT_VERIFY_GATES: readonly AnyGateDefinition[] = [
  breakpointsGate,
  scrollScanGate,
  animationGate,
  motionGate,
];

export interface TargetVerdict {
  target: string;
  width: number;
  height: number;
  matched: number;
  missing: number;
  extra: number;
  /** Sidecar-declared real capture; relaxed tolerances were applied. */
  degraded?: boolean;
  /** Missing components whose pixels are NOT present at their bbox in the render. */
  missingBlocking: number;
  /** Extra components whose pixels are NOT present at their bbox in the target. */
  extraBlocking: number;
  orderViolations: number;
  gapDeltas: number;
  /** Pixel diff over the union canvas (white-padded), 0..1. */
  pixelDiffRatio: number;
  renderedHeight: number;
  pass: boolean;
  composition: PageComposition;
  calibration?: { matched: number; missing: number; extra: number };
}

/**
 * Pixel-presence check for a composition residual — the two-sided
 * analogue of the `diff region` refutation gate (2026-06-08). The
 * component extractor segments by connectivity, so a 1px card border
 * that IS rendered at exactly the right place can still read as
 * "missing" when a shadow or unrounded corner fuses it into the card
 * ring on one side (S7 endgame: three legs chased two "missing"
 * dividers whose pixels were correct all along). Before a missing or
 * extra blocks the verdict, sample the OTHER side's pixels at the
 * residual's own bbox. The fill tolerance is clamped against the page
 * background (see pixelPresence — a bare 25 let white pass for a
 * light-gray fill): if the fill is present there, the element
 * exists and only the segmentation disagrees — report it, don't block
 * on it. Position still matters: the same line 30px away stays
 * blocking, because the bbox sample misses it.
 */
/**
 * Share of the component's bbox whose pixels match its fill.
 *
 * `fillTolerance` absorbs JPEG ringing and antialiasing around a flat
 * fill, but it must never be loose enough to swallow the page background:
 * the 2026-08-01 hard-target audit found a `#f1f1f1` card "pixel-confirmed
 * present" in a render where that area was plain white, because white sits
 * only 14 units from the fill and the tolerance was 25. A presence test
 * that cannot tell the fill from the background is vacuous, so pass
 * `background` and the tolerance is clamped to stay strictly between them.
 */
export function pixelPresence(
  image: { data: Uint8Array; width: number; height: number },
  component: Pick<PageComponent, "left" | "top" | "width" | "height" | "hex">,
  fillTolerance = 25,
  background?: [number, number, number],
): number {
  const r0 = parseInt(component.hex.slice(1, 3), 16);
  const g0 = parseInt(component.hex.slice(3, 5), 16);
  const b0 = parseInt(component.hex.slice(5, 7), 16);
  let tolerance = fillTolerance;
  if (background) {
    // Halve the fill-to-background distance and step inside it, so a
    // background pixel can never be counted as the fill present.
    const bgDist = Math.sqrt(
      (background[0] - r0) ** 2 + (background[1] - g0) ** 2 + (background[2] - b0) ** 2,
    );
    if (bgDist > 0) tolerance = Math.max(1, Math.min(tolerance, Math.floor(bgDist / 2) - 1));
  }
  let inside = 0;
  let matchingPixels = 0;
  for (let y = component.top; y < component.top + component.height; y++) {
    if (y < 0 || y >= image.height) continue;
    for (let x = component.left; x < component.left + component.width; x++) {
      if (x < 0 || x >= image.width) continue;
      inside++;
      const i = (y * image.width + x) * 4;
      const dist = Math.sqrt(
        (image.data[i]! - r0) ** 2 + (image.data[i + 1]! - g0) ** 2 + (image.data[i + 2]! - b0) ** 2,
      );
      if (dist <= tolerance) matchingPixels++;
    }
  }
  return inside === 0 ? 0 : matchingPixels / inside;
}

export interface GateVerdict {
  /**
   * The gate's CLI command, e.g. `check breakpoints` / `scan scroll` — so the
   * kickback can name a command the reader can paste without a special case
   * per gate. Was a four-value union of bare leaf names.
   */
  gate: string;
  /** Stable machine id, for a client that wants to look the gate up. */
  gateId: string;
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
  /**
   * Attach deterministic selector attributions to kickback residuals
   * (attempt DOM rects hit-tested per residual bbox). Default true;
   * costs one extra page load per distinct target width.
   */
  fixContext?: boolean;
  /**
   * Gates to fold into the verdict. Defaults to `DEFAULT_VERIFY_GATES`.
   * Overridable because "which gates does done mean" is a project decision,
   * and it stopped being a hardcoded four the moment they became definitions.
   */
  gates?: readonly AnyGateDefinition[];
  /** Rule settings handed to each folded-in gate, as the CLI would. */
  rules?: RuleSettings;
}

export async function runMarkupVerify(options: MarkupVerifyOptions): Promise<MarkupVerifyReport> {
  const targets: TargetVerdict[] = [];
  const kickback: string[] = [];
  const fixContext = options.fixContext ?? true;
  const elementsByWidth = new Map<number, RegionElementRect[]>();
  const attemptElements = async (width: number, height: number): Promise<RegionElementRect[]> => {
    let cached = elementsByWidth.get(width);
    if (!cached) {
      try {
        cached = await captureRegionElementsFromHtml(options.attempt, { width, height: Math.min(height, 4000) });
      } catch {
        cached = []; // attribution is garnish — never fail the verdict over it
      }
      elementsByWidth.set(width, cached);
    }
    return cached;
  };

  let widest = 1280;
  for (const targetPath of options.targets) {
    const target = await loadPng(targetPath);
    widest = Math.max(widest, target.width);
    const label = `${basename(targetPath)} (${target.width}px)`;
    // A `scan mock --capture real` sidecar marks the target as a real
    // capture (JPEG history / resampling). Compression smears small text
    // so sub-~1400px2 fragments crest asymmetrically between the target
    // and a clean render (S10 calibration: a pixel-perfect reference
    // failed 0/0 against its own degraded screenshot). Degraded mode
    // raises the composition floor above that fragment class and lets
    // pixel-presence match through the noise.
    let degraded = false;
    try {
      degraded = (JSON.parse(readFileSync(`${targetPath}.meta.json`, "utf8")) as { degraded?: boolean }).degraded === true;
    } catch {
      // No sidecar — clean-capture semantics.
    }
    const composeOptions = degraded ? { minArea: 1400 } : {};
    const presenceRatio = degraded ? 0.45 : 0.6;
    const presenceFillTolerance = degraded ? 35 : 25;
    // Clamp the presence tolerance against the page background so a bare
    // background pixel can never be read as "the fill is present here".
    const presenceBg = detectBackground(target.data, target.width, target.height);
    const current = await renderHtmlToPng(options.attempt, target.width, target.height);
    const composition = composePageDiff(target, current, composeOptions);
    const shot = await fullPageRestShot(options.attempt, target.width, Math.min(target.height, 800));
    const pixelDiffRatio = paddedDiff(target, shot);

    let calibration: TargetVerdict["calibration"];
    if (options.reference) {
      const ref = await renderHtmlToPng(options.reference, target.width, target.height);
      const refComp = composePageDiff(target, ref, composeOptions);
      calibration = { matched: refComp.matches.length, missing: refComp.missing.length, extra: refComp.extra.length };
    }

    const heightTolerance = heightToleranceFor(target.height);
    const heightDelta = shot.height - target.height;
    const heightOk = Math.abs(heightDelta) <= heightTolerance;

    // Pixel-presence demotion: a missing whose fill is present at its own
    // bbox in the render (resp. an extra whose fill is present in the
    // target) is a segmentation disagreement, not absent work. The floor
    // is self-calibrating: a solid hairline covers ~100% of its bbox in
    // its own image, but a text blob's strokes cover ~40%, so we demand
    // the OTHER side reach 60% of whatever the residual covers in the
    // image it was extracted from.
    const isSegmentationOnly = (
      component: PageComponent,
      ownImage: { data: Uint8Array; width: number; height: number },
      otherImage: { data: Uint8Array; width: number; height: number },
    ): boolean => {
      const self = pixelPresence(ownImage, component, presenceFillTolerance, presenceBg);
      if (self <= 0) return false;
      return pixelPresence(otherImage, component, presenceFillTolerance, presenceBg) >= presenceRatio * self;
    };
    const missingBlocking = composition.missing.filter((m) => !isSegmentationOnly(m, target, shot));
    const missingConfirmed = composition.missing.filter((m) => isSegmentationOnly(m, target, shot));
    const extraBlocking = composition.extra.filter((e) => !isSegmentationOnly(e, shot, target));
    const extraConfirmed = composition.extra.filter((e) => isSegmentationOnly(e, shot, target));

    const pass = missingBlocking.length === 0
      && extraBlocking.length === 0
      && composition.orderViolations.length === 0
      && heightOk;
    const targetKickback: string[] = [];
    if (!pass) {
      const elements = fixContext ? await attemptElements(target.width, target.height) : undefined;
      const presence = (
        side: "target" | "current",
        box: { left: number; top: number; width: number; height: number },
        hex: string,
      ): number => pixelPresence(side === "target" ? target : shot, { ...box, hex }, presenceFillTolerance, presenceBg);
      targetKickback.push(...kickbackForComposition(label, {
        ...composition,
        missing: missingBlocking,
        extra: extraBlocking,
      }, { ...(elements ? { elements } : {}), presence }));
    }
    for (const m of missingConfirmed) {
      targetKickback.push(
        `${label}: [pixel-confirmed, not blocking] missing #${m.index} (${m.left},${m.top}) ${m.width}x${m.height} ${m.hex} — the pixels ARE at that bbox in your render; the extractor merged the element into a neighbor (shadow / connected border). No action needed unless you also see it visually.`,
      );
    }
    for (const e of extraConfirmed) {
      targetKickback.push(
        `${label}: [pixel-confirmed, not blocking] extra (${e.left},${e.top}) ${e.width}x${e.height} ${e.hex} — the target has the same fill at that bbox; segmentation differs, the element is fine.`,
      );
    }
    if (!heightOk) {
      const heightBody = `rendered page height ${shot.height}px vs target ${target.height}px (${heightDelta > 0 ? "+" : ""}${heightDelta}px, tolerance ±${heightTolerance}px) — total vertical size is off.`;
      // A large height error displaces everything below the first wrong
      // gap, so downstream missing/extra/gap items are mostly its debris
      // (S7: +325px buried at the bottom while the agent chased 1px
      // separators for 8 rounds). Promote it to the top of this target's
      // list; small drifts stay a footnote.
      if (Math.abs(heightDelta) > heightTolerance * 5) {
        targetKickback.unshift(
          `${label}: ROOT-CAUSE CANDIDATE — ${heightBody} Fix the section spacing/gap items to close this FIRST; components below the first wrong gap cannot match until the total height is right.`,
        );
      } else {
        targetKickback.push(`${label}: ${heightBody}`);
      }
    }
    kickback.push(...targetKickback);

    targets.push({
      target: targetPath,
      width: target.width,
      height: target.height,
      ...(degraded ? { degraded } : {}),
      matched: composition.matches.length,
      missing: composition.missing.length,
      extra: composition.extra.length,
      missingBlocking: missingBlocking.length,
      extraBlocking: extraBlocking.length,
      orderViolations: composition.orderViolations.length,
      gapDeltas: composition.gapDeltas.length,
      pixelDiffRatio: Number(pixelDiffRatio.toFixed(4)),
      renderedHeight: shot.height,
      pass,
      composition,
      ...(calibration ? { calibration } : {}),
    });
  }

  // Each folded-in gate runs through the same core runner the CLI uses, so its
  // suspect/warn counts come from the shared rule table rather than from a
  // severity string compared by hand here — and a project's rule settings
  // apply, which they previously did not.
  //
  // `--advisory` is not passed on: this is not those gates' exit code, it is
  // one input to this gate's verdict. The runner returns the verdict
  // regardless, so nothing is lost.
  const gates: GateVerdict[] = [];
  for (const gate of options.gates ?? DEFAULT_VERIFY_GATES) {
    const argv = [options.attempt, ...(gate.id === "check.animation" ? ["--viewport", `${widest}x720`] : [])];
    const outcome = await runGate(gate, argv, { ...(options.rules ? { rules: options.rules } : {}), ledger: false });
    gates.push({
      gate: gateCommandString(gate),
      gateId: gate.id,
      suspects: outcome.counts.suspect,
      warns: outcome.counts.warn,
      summary: gate.headline?.(outcome.report)
        ?? `${outcome.counts.suspect} suspect, ${outcome.counts.warn} warn`,
    });
  }

  for (const g of gates) {
    if (g.suspects > 0) {
      kickback.push(
        `gate ${g.gate}: ${g.suspects} suspect issue(s) —`
        + ` run \`vlmkit ${g.gate}\` for detail and fix them.`,
      );
    }
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
    residuals: targets.reduce((n, t) => n + t.missingBlocking + t.extraBlocking + t.orderViolations, 0),
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


/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `verify markup` is declared in `../gates/verify.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
