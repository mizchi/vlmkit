#!/usr/bin/env node
/**
 * Inline → componentized refactor verifier.
 *
 * Use case: agent extracts an inline `<div class="card">…</div>`
 * into a shared `<Card />` component (React / Vue / Svelte / a
 * partial). On a page with N call sites, the agent intends every
 * `.card` to render identically. Bug class: they converted 4 of 5
 * instances; the 5th is still inline and has drifted (different
 * padding, missing border, etc.). A single-page VRT misses this
 * because the page diff is zero before vs after the refactor.
 *
 * Approach: capture every `--selector` match on the page via
 * Playwright `locator.screenshot()`, compare each instance against
 * the first one (the reference). Drift surfaces as pixel diff %.
 *
 * This is the single-page-multi-instance sibling of
 * `multi-page-consistency.ts` (which is one-match-per-page across
 * multiple pages).
 *
 * Usage:
 *   vlmkit check drift component <html> --selector .card
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { resolveSource, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { TRACKED_PROPERTIES } from "@mizchi/vlmkit-core/computed-style-capture.ts";
import { extractPaletteFromFile } from "../style/palette-extract.ts";
import { diffPalettes } from "../style/palette-diff.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";


/**
 * The properties that say "this is the same component", with `width` and `height`
 * deliberately left out.
 *
 * Two instances of one component holding different copy have different computed
 * heights — the text wraps — and that is not drift. The size difference is already
 * reported as `bboxDeltas`, where a reader can see it and judge; folding it into the
 * style comparison would put the content difference straight back into the verdict
 * this exists to keep it out of.
 */
const STYLE_PROPERTIES = TRACKED_PROPERTIES.filter((prop) => prop !== "width" && prop !== "height");
export interface ComponentConsistencyOptions {
  htmlPath: string;
  selector: string;
  outputDir: string;
  reportPath?: string;
  /**
   * Pass line on the measured diff ratio. **Not** the comparator's per-pixel colour
   * tolerance — that is `pixelTolerance`.
   *
   * The two were one flag until a dogfood agent found that raising it moved the
   * measurement as well as the bar: "instance #1 reports 95.5% at 0.05 and 9.65% at
   * 0.06. I first read the drop as my fix working." A pass line that changes what it
   * is compared against is not a pass line.
   */
  threshold?: number;
  /** Comparator per-pixel colour tolerance, 0-1. Default 0.1, as everywhere else. */
  pixelTolerance?: number;
  viewport?: { width: number; height: number };
  /** Which instance to use as the reference. Default 0 (first match). */
  referenceIndex?: number;
}

/** Computed style of one instance, over the properties that describe its styling. */
export type InstanceStyle = Record<string, string>;

export interface InstanceEntry {
  index: number;
  screenshotPath: string;
  /** Computed styling, for telling drift apart from different copy. */
  style?: InstanceStyle;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface InstanceDelta {
  candidateIndex: number;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  bboxDeltas: { width: number; height: number };
  paletteOnlyInRef: number;
  paletteOnlyInCand: number;
  /**
   * Computed-style properties that differ from the reference. Empty means the two
   * instances are styled identically and the pixel difference is their content.
   */
  styleDeltas: { property: string; reference: string; candidate: string }[];
}

export interface ComponentConsistencyReport {
  html: string;
  selector: string;
  instanceCount: number;
  referenceIndex: number;
  instances: InstanceEntry[];
  deltas: InstanceDelta[];
  reportPath: string;
}

export async function runComponentConsistency(
  options: ComponentConsistencyOptions,
): Promise<ComponentConsistencyReport> {
  if (!options.selector) throw new UsageError("--selector is required");
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  // `resolveSource`, not `resolve`: the latter turns "http://x/p.html" into
  // "<cwd>/http:/x/p.html", which then fails as "file not found" and tells the caller
  // nothing. The gate's input has always been spelled `<html-or-url>`.
  const htmlPath = resolveSource(options.htmlPath);
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const referenceIndex = options.referenceIndex ?? 0;
  const threshold = options.threshold ?? 0.03;
  const pixelTolerance = options.pixelTolerance ?? 0.1;

  const instances: InstanceEntry[] = [];
  // `withBrowser`: the zero-match `UsageError` below is thrown from inside this
  // scope, and on the straight-line form that throw skipped the close entirely.
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    // Navigate; do not `setContent` bytes read off disk.
    //
    // This gate screenshots each instance and compares pixels, so a document with no
    // base URL does not merely lose styling — it makes the numbers describe a page that
    // does not exist. Measured on a fixture whose `.card--wrong` modifier lives only in
    // `card.css` (padding 28px vs 12px): `setContent` reported instance deltas of 1.06%
    // and 1.32% with `Δ 0 / 0`, i.e. it saw three same-sized unstyled boxes and
    // attributed the difference to the glyphs "Alpha" / "Beta" / "Gamma". The modifier
    // that actually makes one instance inconsistent was invisible.
    //
    // Same mechanism `page-open.ts` documents for `check a11y contrast`; converting this
    // also makes the `<html-or-url>` spelling true for the first time.
    await page.goto(sourceToUrl(htmlPath), { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const locator = page.locator(options.selector);
    const count = await locator.count();
    if (count === 0) {
      throw new UsageError(`Selector \`${options.selector}\` matched zero elements on ${htmlPath}`);
    }
    for (let i = 0; i < count; i++) {
      const inst = locator.nth(i);
      const bbox = await inst.boundingBox();
      if (!bbox) continue;
      const screenshotPath = join(outputDir, `instance-${i}.png`);
      await inst.screenshot({ path: screenshotPath });
      const style = await inst.evaluate((el, props) => {
        const computed = getComputedStyle(el as Element);
        const out: Record<string, string> = {};
        for (const prop of props as string[]) out[prop] = computed.getPropertyValue(prop);
        return out;
      }, STYLE_PROPERTIES);
      instances.push({ index: i, screenshotPath, bbox, style });
    }
    await page.close();
  });

  if (instances.length < 2) {
    throw new UsageError(`Selector matched ${instances.length} element(s); need at least 2 to check consistency.`);
  }

  const reference = instances[referenceIndex] ?? instances[0]!;
  const deltas: InstanceDelta[] = [];
  for (const cand of instances) {
    if (cand.index === reference.index) continue;
    const snap: VrtSnapshot = {
      testId: `consistency-${cand.index}`,
      testTitle: `${cand.index} vs ${reference.index}`,
      projectName: "component-consistency",
      screenshotPath: cand.screenshotPath,
      baselinePath: reference.screenshotPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, { outputDir, threshold: pixelTolerance });
    const [refPalette, candPalette] = await Promise.all([
      extractPaletteFromFile(reference.screenshotPath).catch(() => []),
      extractPaletteFromFile(cand.screenshotPath).catch(() => []),
    ]);
    const paletteDiff = diffPalettes(refPalette, candPalette);
    deltas.push({
      candidateIndex: cand.index,
      diffRatio: diff?.diffRatio ?? 0,
      diffPixels: diff?.diffPixels ?? 0,
      totalPixels: diff?.totalPixels ?? 0,
      bboxDeltas: {
        width: Math.round(cand.bbox.width - reference.bbox.width),
        height: Math.round(cand.bbox.height - reference.bbox.height),
      },
      paletteOnlyInRef: paletteDiff.onlyInBaseline.length,
      paletteOnlyInCand: paletteDiff.onlyInVariant.length,
      styleDeltas: STYLE_PROPERTIES.flatMap((property) => {
        const ref = reference.style?.[property];
        const value = cand.style?.[property];
        return ref !== undefined && value !== undefined && ref !== value
          ? [{ property, reference: ref, candidate: value }]
          : [];
      }),
    });
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport(htmlPath, options.selector, instances, reference.index, deltas);
  await writeFile(reportPath, md);


  return {
    html: htmlPath,
    selector: options.selector,
    instanceCount: instances.length,
    referenceIndex: reference.index,
    instances,
    deltas,
    reportPath,
  };
}

/**
 * Terminal summary, extracted from the measurement function. A gate's `run`
 * must not print — the core runner owns output and decides between prose and
 * `--json`.
 */
export function formatComponentConsistencyReport(report: ComponentConsistencyReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check drift component${RESET}`);
  lines.push(`  ${DIM}html: ${report.html}  selector: ${report.selector}${RESET}`);
  lines.push(`  ${DIM}${report.instanceCount} instance(s), reference = #${report.referenceIndex}${RESET}`);
  for (const d of report.deltas) {
    const pct = (d.diffRatio * 100).toFixed(2);
    // The icon follows the computed style, not the pixel count. A pixel ratio cannot
    // tell "this instance is styled differently" from "this instance holds different
    // copy", and marking the second one ✗ is what made this gate unpassable on a page
    // with real content.
    const icon = d.styleDeltas.length > 0
      ? `${RED}✗${RESET}`
      : d.diffRatio === 0
        ? `${GREEN}✓${RESET}`
        : `${YELLOW}~${RESET}`;
    const whDelta = `Δ ${d.bboxDeltas.width > 0 ? "+" : ""}${d.bboxDeltas.width} / ${d.bboxDeltas.height > 0 ? "+" : ""}${d.bboxDeltas.height}`;
    lines.push(`  ${icon} instance #${d.candidateIndex}  ${pct.padStart(6)}%  ${DIM}${whDelta}${RESET}`);
    if (d.styleDeltas.length > 0) {
      // The properties are the actionable part: an agent told to "replace the inline
      // markup with the shared component invocation" on markup that was already
      // identical had nothing to act on.
      for (const s of d.styleDeltas.slice(0, 6)) {
        lines.push(`      ${DIM}${s.property}: ${s.reference} → ${s.candidate}${RESET}`);
      }
      if (d.styleDeltas.length > 6) {
        lines.push(`      ${DIM}and ${d.styleDeltas.length - 6} more propert${d.styleDeltas.length - 6 === 1 ? "y" : "ies"}${RESET}`);
      }
    } else if (d.diffRatio > 0) {
      lines.push(`      ${DIM}every tracked computed style matches — different content, not drift${RESET}`);
    }
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(
  html: string,
  selector: string,
  instances: InstanceEntry[],
  refIdx: number,
  deltas: InstanceDelta[],
): string {
  const lines: string[] = [];
  lines.push("# Component consistency report");
  lines.push("");
  lines.push(`HTML: \`${html}\``);
  lines.push(`Selector: \`${selector}\`  —  **${instances.length}** instance(s) detected.`);
  lines.push(`Reference: instance **#${refIdx}**.`);
  lines.push("");
  lines.push("After an inline → componentized refactor, every call site should " +
    "render identically. Per-instance pixel diff against the reference reveals " +
    "which instances drifted — typically because one call site was missed during " +
    "the refactor and is still inline with stale styles.");
  lines.push("");
  lines.push("## Drift summary");
  lines.push("");
  lines.push("| Instance | Pixel diff | Δ W / H | Missing palette | Extra palette |");
  lines.push("|---|---|---|---|---|");
  for (const d of deltas) {
    const pct = (d.diffRatio * 100).toFixed(2) + "%";
    const wh = `${d.bboxDeltas.width > 0 ? "+" : ""}${d.bboxDeltas.width} / ${d.bboxDeltas.height > 0 ? "+" : ""}${d.bboxDeltas.height}`;
    lines.push(`| #${d.candidateIndex} | ${pct} | ${wh} | ${d.paletteOnlyInRef} | ${d.paletteOnlyInCand} |`);
  }
  lines.push("");
  lines.push("## Captured screenshots");
  lines.push("");
  for (const inst of instances) {
    const ref = inst.index === refIdx ? "  **(reference)**" : "";
    lines.push(`- instance #${inst.index}${ref} — ${inst.bbox.width}×${inst.bbox.height} at ${inst.bbox.x},${inst.bbox.y} — \`${inst.screenshotPath}\``);
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  const drifters = deltas.filter((d) => d.diffRatio > 0.005);
  if (drifters.length === 0) {
    lines.push("All instances render identically to the reference — refactor is consistent.");
  } else {
    lines.push(`${drifters.length} instance(s) differ from the reference. For each:`);
    lines.push("1. Open the candidate screenshot next to the reference; identify the visible delta.");
    lines.push("2. Locate the call site in the source. If the page contains a mix of inline " +
      "markup and component invocations (`<Card>`), the drifting instance is likely the " +
      "still-inline one.");
    lines.push("3. Replace the inline markup with the shared component invocation.");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check drift component` is declared in `../gates/drift.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
