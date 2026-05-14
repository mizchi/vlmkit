#!/usr/bin/env node
/**
 * Component-from-screenshot mode.
 *
 * Workflow:
 *   1. Designer / user provides a target PNG (e.g., from Figma export).
 *   2. Agent provides an HTML file (possibly empty scaffold).
 *   3. Tool renders the HTML at the target's viewport dimensions,
 *      pixel-diffs the rendered output against the target, and
 *      surfaces all image-only signals (bbox, palette, heatmap,
 *      text-row) plus an optional multi-state pass.
 *   4. Agent iterates the HTML until the diff converges.
 *
 * Unlike `vrt compare` (migration mode), this scenario:
 *   - has no DOM correspondence — the target is a static PNG.
 *   - runs at a single viewport sized to the target image.
 *   - skips paint-tree, DOM-equivalence, breakpoint-discovery, etc.
 *     — none of them apply when the baseline isn't HTML.
 *   - emits a slim markdown report directly (no separate
 *     diff-for-agent pass needed).
 *
 * Usage:
 *   vrt component-from-image <target.png> <current.html>
 *   vrt component-from-image <target.png> <current.html> --output report.md
 *   vrt component-from-image <target.png> <current.html> --states hover focus-visible
 */
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { chromium } from "playwright";
import { compareScreenshots } from "./heatmap.ts";
import {
  extractComponentsFromFile,
  matchComponents,
  type MatchedBbox,
} from "./component-bbox.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "./heatmap-regions.ts";
import { extractTextRowsFromFile, matchTextRows, computeRowGapDeltas, compareRowTypography, type MatchedTextRow, type RowGapDelta, type TypographyMismatch } from "./text-rows.ts";
import { extractPaletteFromFile, findDominantBackgroundsFromFile, type PaletteColor, type DominantBackgrounds } from "./palette-extract.ts";
import { diffPalettes, type PaletteDiff } from "./palette-diff.ts";
import {
  applyForcedPseudoState,
  clearStateMarkers,
  type ForcedPseudoState,
} from "./multi-state.ts";
import type { VrtSnapshot } from "./types.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "./terminal-colors.ts";

export interface ComponentFromImageOptions {
  targetImagePath: string;
  currentHtmlPath: string;
  outputDir: string;
  /** Markdown report path. Default: `${outputDir}/report.md`. */
  reportPath?: string;
  /** Pseudo-states to additionally capture. Empty = none. */
  states?: ForcedPseudoState[];
  /** Pixel-diff threshold (0..1). Default 0.03 (stricter than VRT default). */
  threshold?: number;
}

export interface ComponentFromImageReport {
  targetImage: string;
  currentHtml: string;
  viewport: { width: number; height: number };
  diff: {
    diffPixels: number;
    totalPixels: number;
    diffRatio: number;
  };
  bboxMatches: MatchedBbox[];
  heatmapRegions: HeatmapRegion[];
  textRowMatches: MatchedTextRow[];
  rowGapDeltas: RowGapDelta[];
  typographyMismatches: TypographyMismatch[];
  baselineRowCount: number;
  variantRowCount: number;
  paletteDiff: PaletteDiff & { baseline: PaletteColor[]; variant: PaletteColor[] };
  states?: Array<{
    state: ForcedPseudoState;
    forcedCount: number;
    inducedDiffRatio: number;
    /** Pixels with any RGB channel delta ≥ 4 (no perceptual filter). */
    rawInducedDiffRatio: number;
    /** Fraction of diff pixels within 4px of any forced-element bbox perimeter. */
    edgeFraction: number;
    /** Count of diff pixels well inside (not on perimeter of) any forced bbox. */
    interiorPixels: number;
    /** Mean luma at state minus mean luma at default, averaged over forced bbox interiors. Null if no bboxes. Negative = darker on state. */
    lumaDelta: number | null;
  }>;
  reportPath: string;
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const states: ForcedPseudoState[] = [];
  let outputDir = "";
  let report = "";
  let threshold = 0.03;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--states") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        const v = argv[++i];
        if (v === "hover" || v === "focus" || v === "active" || v === "focus-visible") {
          states.push(v);
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, outputDir, report, threshold, states };
}

export async function runComponentFromImage(
  options: ComponentFromImageOptions,
): Promise<ComponentFromImageReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const targetPath = resolve(options.targetImagePath);
  const targetPng = PNG.sync.read(await readFile(targetPath));
  const viewport = { width: targetPng.width, height: targetPng.height };

  // Copy the target PNG into outputDir so the report's relative-path
  // references all resolve from one place.
  const targetCopyPath = join(outputDir, `target${extname(targetPath)}`);
  await copyFile(targetPath, targetCopyPath);

  const htmlPath = resolve(options.currentHtmlPath);
  const html = await readFile(htmlPath, "utf-8");

  console.log(`  ${BOLD}${CYAN}vrt component-from-image${RESET}`);
  console.log(`  ${DIM}target:  ${targetPath} (${viewport.width}×${viewport.height})${RESET}`);
  console.log(`  ${DIM}current: ${htmlPath}${RESET}`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    await page.setContent(html, { waitUntil: "networkidle" });
    const currentPath = join(outputDir, "current.png");
    await page.screenshot({ path: currentPath, fullPage: false });
    await page.close();

    // Pixel diff against the target.
    const snap: VrtSnapshot = {
      testId: "component",
      testTitle: "component-from-image",
      projectName: "component-from-image",
      screenshotPath: currentPath,
      baselinePath: targetCopyPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, {
      outputDir,
      threshold: options.threshold ?? 0.03,
    });
    const diffRatio = diff?.diffRatio ?? 0;
    const diffPixels = diff?.diffPixels ?? 0;
    const totalPixels = diff?.totalPixels ?? (viewport.width * viewport.height);
    const heatmapPath = join(outputDir, "component_heatmap.png");

    // All image-only signals run identically on both files.
    const [bboxBaseline, bboxVariant] = await Promise.all([
      extractComponentsFromFile(targetCopyPath).catch(() => []),
      extractComponentsFromFile(currentPath).catch(() => []),
    ]);
    const bboxMatches = matchComponents(bboxBaseline, bboxVariant);

    let heatmapRegions: HeatmapRegion[] = [];
    try {
      // Pass the target image so each region gets its dominant color
      // annotated — closes the loop between "this region differs" and
      // "fill it with this color".
      heatmapRegions = await findHeatmapRegionsFromFile(heatmapPath, {}, targetCopyPath);
    } catch {
      // Heatmap may be absent when diff is zero.
    }

    const [targetRows, currentRows] = await Promise.all([
      extractTextRowsFromFile(targetCopyPath).catch(() => []),
      extractTextRowsFromFile(currentPath).catch(() => []),
    ]);
    const textRowMatches = matchTextRows(targetRows, currentRows);
    const rowGapDeltas = computeRowGapDeltas(targetRows, currentRows);
    const typographyMismatches = compareRowTypography(targetRows, currentRows);

    const [targetPalette, currentPalette] = await Promise.all([
      extractPaletteFromFile(targetCopyPath).catch(() => []),
      extractPaletteFromFile(currentPath).catch(() => []),
    ]);
    const paletteDiff = diffPalettes(targetPalette, currentPalette);

    // Explicit outer/inner background pair — subagent dogfood noted
    // this was buried in the "missing palette" list.
    const [targetBg, currentBg] = await Promise.all([
      findDominantBackgroundsFromFile(targetCopyPath).catch(() => undefined),
      findDominantBackgroundsFromFile(currentPath).catch(() => undefined),
    ]);

    // Optional multi-state pass (current side only — we have no
    // baseline HTML to force states on).
    // Raw RGB diff helper — counts any pixel where any channel differs
    // by ≥ minChannelDelta. Bypasses pixelmatch's perceptual/AA filter
    // so we surface the "did anything at all change?" signal that the
    // 0.03 threshold can swallow on subtle hovers. From subagent H
    // dogfood: even with transitions disabled, a clear `:hover` rule
    // can register low under the perceptual threshold; raw diff shows
    // unambiguously when something changed.
    async function countRawDiff(pathA: string, pathB: string, minChannelDelta = 4): Promise<{ ratio: number; pixels: number; total: number }> {
      const [bufA, bufB] = await Promise.all([readFile(pathA), readFile(pathB)]);
      const pA = PNG.sync.read(bufA);
      const pB = PNG.sync.read(bufB);
      const total = (pA.width * pA.height);
      if (pA.data.length !== pB.data.length) return { ratio: 0, pixels: 0, total };
      let count = 0;
      for (let i = 0; i < pA.data.length; i += 4) {
        const dr = Math.abs(pA.data[i]! - pB.data[i]!);
        const dg = Math.abs(pA.data[i + 1]! - pB.data[i + 1]!);
        const db = Math.abs(pA.data[i + 2]! - pB.data[i + 2]!);
        if (dr >= minChannelDelta || dg >= minChannelDelta || db >= minChannelDelta) count++;
      }
      return { ratio: count / total, pixels: count, total };
    }

    /**
     * Classify the state-induced diff pixels by their position
     * relative to the forced-element bboxes. Returns the fraction of
     * diff pixels that lie within `edgeWidth` (px) of any bbox
     * perimeter (= "edge", typically the UA default outline) vs
     * inside the bboxes away from the perimeter (= "interior",
     * typically author background/text/border changes).
     *
     * Subagent H concern: UA-default `:focus-visible` outline alone
     * clears the suspect flag, masking missing author CSS. When
     * edge >> interior, the state is likely UA-only — flag as such.
     */
    /**
     * Mean interior luminance over all forced bboxes, sampled from a
     * given image. Used to detect "wrong-direction" hover: if the
     * variant's hover *lightens* a vibrant button instead of darkening
     * it, the shift goes in a typically-incorrect direction. Subagent
     * H concern: "hover that shifts the wrong way (lighter on light bg)
     * reads as fine because we have no reference for hover state."
     * Surface the direction so the agent can verify visually.
     */
    async function meanInteriorLuma(
      path: string,
      bboxes: Array<{ x: number; y: number; width: number; height: number }>,
    ): Promise<number | null> {
      const buf = await readFile(path);
      const png = PNG.sync.read(buf);
      const w = png.width, h = png.height;
      let sum = 0, n = 0;
      const inset = 4;
      for (const b of bboxes) {
        const x0 = Math.max(0, Math.floor(b.x + inset));
        const x1 = Math.min(w, Math.floor(b.x + b.width - inset));
        const y0 = Math.max(0, Math.floor(b.y + inset));
        const y1 = Math.min(h, Math.floor(b.y + b.height - inset));
        if (x1 <= x0 || y1 <= y0) continue;
        const stepX = Math.max(1, Math.floor((x1 - x0) / 6));
        const stepY = Math.max(1, Math.floor((y1 - y0) / 6));
        for (let y = y0; y < y1; y += stepY) {
          for (let x = x0; x < x1; x += stepX) {
            const i = (y * w + x) * 4;
            if (png.data[i + 3]! === 0) continue;
            sum += 0.299 * png.data[i]! + 0.587 * png.data[i + 1]! + 0.114 * png.data[i + 2]!;
            n++;
          }
        }
      }
      return n > 0 ? sum / n : null;
    }

    async function classifyEdgeVsInterior(
      pathA: string,
      pathB: string,
      bboxes: Array<{ x: number; y: number; width: number; height: number }>,
      edgeWidth = 4,
    ): Promise<{ edgePixels: number; interiorPixels: number; outsidePixels: number; edgeFraction: number }> {
      const [bufA, bufB] = await Promise.all([readFile(pathA), readFile(pathB)]);
      const pA = PNG.sync.read(bufA);
      const pB = PNG.sync.read(bufB);
      if (pA.data.length !== pB.data.length) {
        return { edgePixels: 0, interiorPixels: 0, outsidePixels: 0, edgeFraction: 0 };
      }
      // For each forced bbox, classify a pixel (x,y) as edge if it
      // falls in the band of width `edgeWidth` around the perimeter,
      // interior if it falls deeper inside, outside otherwise.
      // A pixel that is "edge" for one bbox and "interior" for
      // another counts as interior (the stronger signal wins).
      const w = pA.width;
      let edge = 0, interior = 0, outside = 0;
      const dpr = 1;  // assume CSS-px = device-px for screenshots
      for (let i = 0; i < pA.data.length; i += 4) {
        const dr = Math.abs(pA.data[i]! - pB.data[i]!);
        const dg = Math.abs(pA.data[i + 1]! - pB.data[i + 1]!);
        const db = Math.abs(pA.data[i + 2]! - pB.data[i + 2]!);
        if (dr < 4 && dg < 4 && db < 4) continue;
        const px = (i / 4) | 0;
        const x = px % w, y = (px / w) | 0;
        let isInterior = false, isEdge = false;
        for (const b of bboxes) {
          const bx = b.x * dpr, by = b.y * dpr, bw = b.width * dpr, bh = b.height * dpr;
          const insideOuter = x >= bx - edgeWidth && x <= bx + bw + edgeWidth
            && y >= by - edgeWidth && y <= by + bh + edgeWidth;
          if (!insideOuter) continue;
          const insideInner = x >= bx + edgeWidth && x <= bx + bw - edgeWidth
            && y >= by + edgeWidth && y <= by + bh - edgeWidth;
          if (insideInner) { isInterior = true; break; }
          isEdge = true;
        }
        if (isInterior) interior++;
        else if (isEdge) edge++;
        else outside++;
      }
      const total = edge + interior;
      return {
        edgePixels: edge,
        interiorPixels: interior,
        outsidePixels: outside,
        edgeFraction: total > 0 ? edge / total : 0,
      };
    }

    const stateResults: ComponentFromImageReport["states"] = [];
    if (options.states && options.states.length > 0) {
      // Baseline screenshot is the target PNG (already captured). For
      // each state, render the current HTML with the state forced and
      // diff against the *default* current screenshot — surfaces "what
      // the state does to the variant" alongside the default delta.
      for (const state of options.states) {
        const statePage = await browser.newPage({ viewport });
        await statePage.setContent(html, { waitUntil: "networkidle" });
        const applied = await applyForcedPseudoState(statePage, { state });
        const stateShotPath = join(outputDir, `current-${state}.png`);
        await statePage.screenshot({ path: stateShotPath, fullPage: false });
        await clearStateMarkers(statePage).catch(() => {});
        await statePage.close();

        const stateSnap: VrtSnapshot = {
          testId: `component-${state}`,
          testTitle: `component :${state}`,
          projectName: "component-from-image",
          screenshotPath: stateShotPath,
          baselinePath: currentPath,
          status: "changed",
        };
        const stateDiff = await compareScreenshots(stateSnap, {
          outputDir,
          threshold: options.threshold ?? 0.03,
          skipHeatmap: true,
        });
        const raw = await countRawDiff(currentPath, stateShotPath).catch(() => ({ ratio: 0, pixels: 0, total: 0 }));
        const edgeClass = applied.bboxes.length > 0
          ? await classifyEdgeVsInterior(currentPath, stateShotPath, applied.bboxes).catch(() => ({ edgePixels: 0, interiorPixels: 0, outsidePixels: 0, edgeFraction: 0 }))
          : { edgePixels: 0, interiorPixels: 0, outsidePixels: 0, edgeFraction: 0 };
        const [defaultLuma, stateLuma] = applied.bboxes.length > 0
          ? await Promise.all([
            meanInteriorLuma(currentPath, applied.bboxes),
            meanInteriorLuma(stateShotPath, applied.bboxes),
          ])
          : [null, null];
        const lumaDelta = (defaultLuma !== null && stateLuma !== null) ? stateLuma - defaultLuma : null;
        stateResults.push({
          state,
          forcedCount: applied.forcedCount,
          inducedDiffRatio: stateDiff?.diffRatio ?? 0,
          rawInducedDiffRatio: raw.ratio,
          edgeFraction: edgeClass.edgeFraction,
          interiorPixels: edgeClass.interiorPixels,
          lumaDelta,
        });
      }
    }

    const reportPath = options.reportPath ?? join(outputDir, "report.md");
    const markdown = renderReportMarkdown({
      targetImage: targetPath,
      currentHtml: htmlPath,
      viewport,
      diffPixels,
      totalPixels,
      diffRatio,
      heatmapPath: diffPixels > 0 ? heatmapPath : undefined,
      currentPath,
      bboxMatches,
      heatmapRegions,
      textRowMatches,
      rowGapDeltas,
      typographyMismatches,
      baselineRowCount: targetRows.length,
      variantRowCount: currentRows.length,
      paletteDiff,
      targetBg,
      currentBg,
      stateResults,
    });
    await writeFile(reportPath, markdown);

    const pct = (diffRatio * 100).toFixed(2);
    const icon = diffRatio === 0 ? `${GREEN}✓${RESET}` : diffRatio < 0.01 ? `${YELLOW}~${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} diff: ${pct}% (${diffPixels} px)`);
    console.log(`  ${DIM}bbox: ${bboxMatches.length}, heatmap: ${heatmapRegions.length}, text-rows ${targetRows.length}/${currentRows.length}, palette missing: ${paletteDiff.onlyInBaseline.length}${RESET}`);
    if (stateResults.length > 0) {
      for (const s of stateResults) {
        console.log(`  ${DIM}:${s.state} induced ${(s.inducedDiffRatio * 100).toFixed(2)}% (${s.forcedCount} forced)${RESET}`);
      }
    }
    console.log(`  ${DIM}report: ${reportPath}${RESET}`);

    return {
      targetImage: targetPath,
      currentHtml: htmlPath,
      viewport,
      diff: { diffPixels, totalPixels, diffRatio },
      bboxMatches,
      heatmapRegions,
      textRowMatches,
      rowGapDeltas,
      typographyMismatches,
      baselineRowCount: targetRows.length,
      variantRowCount: currentRows.length,
      paletteDiff: { ...paletteDiff, baseline: targetPalette, variant: currentPalette },
      states: stateResults,
      reportPath,
    };
  } finally {
    await browser.close();
  }
}

interface RenderInput {
  targetImage: string;
  currentHtml: string;
  viewport: { width: number; height: number };
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  heatmapPath?: string;
  currentPath: string;
  bboxMatches: MatchedBbox[];
  heatmapRegions: HeatmapRegion[];
  textRowMatches: MatchedTextRow[];
  rowGapDeltas: RowGapDelta[];
  typographyMismatches: TypographyMismatch[];
  baselineRowCount: number;
  variantRowCount: number;
  paletteDiff: PaletteDiff;
  targetBg?: DominantBackgrounds;
  currentBg?: DominantBackgrounds;
  stateResults: NonNullable<ComponentFromImageReport["states"]>;
}

export function renderReportMarkdown(r: RenderInput): string {
  const lines: string[] = [];
  lines.push("# Component-from-image report");
  lines.push("");
  lines.push(`Target:  \`${r.targetImage}\` (${r.viewport.width}×${r.viewport.height})`);
  lines.push(`Current: \`${r.currentHtml}\``);
  lines.push("");
  const pct = (r.diffRatio * 100).toFixed(2);
  lines.push(`**Pixel diff**: ${pct}% (${r.diffPixels} of ${r.totalPixels} pixels)`);
  lines.push("");
  if (r.heatmapPath) {
    lines.push("- Target:   `" + r.targetImage + "`");
    lines.push("- Current:  `" + r.currentPath + "`");
    lines.push("- Heatmap:  `" + r.heatmapPath + "`");
    lines.push("");
  }

  const meaningfulBboxes = r.bboxMatches.filter((m) =>
    Math.abs(m.deltaTop) > 1 || Math.abs(m.deltaLeft) > 1
    || Math.abs(m.deltaWidth) > 1 || Math.abs(m.deltaHeight) > 1,
  );
  if (meaningfulBboxes.length > 0) {
    lines.push("## Component bbox diff");
    lines.push("");
    lines.push("Largest non-background regions, matched by area-rank between " +
      "target and current. Δ shows position / size differences.");
    lines.push("");
    lines.push("| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |");
    lines.push("|---|---|---|---|---|");
    for (const m of meaningfulBboxes.slice(0, 8)) {
      const t = `${m.baseline.left},${m.baseline.top} ${m.baseline.width}×${m.baseline.height}`;
      const c = `${m.variant.left},${m.variant.top} ${m.variant.width}×${m.variant.height}`;
      const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
      lines.push(`| #${m.rank} | ${t} | ${c} | ${sign(m.deltaTop)} / ${sign(m.deltaLeft)} / ${sign(m.deltaWidth)} / ${sign(m.deltaHeight)} | ${m.iou} |`);
    }
    lines.push("");
  }

  if (r.heatmapRegions.length > 0) {
    lines.push("## Heatmap region clusters");
    lines.push("");
    lines.push("Each cluster is a contiguous run of differing pixels. `Fill` is " +
      "the dominant color *inside the region* sampled from the target — i.e. " +
      "the color you need to paint in.");
    lines.push("");
    lines.push("| Top-Left | Size | Hot pixels | Fill |");
    lines.push("|---|---|---|---|");
    for (const reg of r.heatmapRegions.slice(0, 8)) {
      const fill = reg.dominantColor ? `\`${reg.dominantColor.hex}\`` : "—";
      lines.push(`| ${reg.left},${reg.top} | ${reg.width}×${reg.height} | ${reg.area} | ${fill} |`);
    }
    lines.push("");
  }

  if (r.baselineRowCount !== r.variantRowCount || r.textRowMatches.length > 0) {
    lines.push("## Text-row Δy");
    lines.push("");
    lines.push(`Target has ${r.baselineRowCount} text rows; current has ${r.variantRowCount}.`);
    if (r.baselineRowCount !== r.variantRowCount) {
      lines.push("");
      lines.push("**Count mismatch** — current is missing rows of content " +
        "(or has spurious extras). Add the missing elements before tweaking CSS.");
    }
    if (r.textRowMatches.length > 0) {
      lines.push("");
      lines.push("| Rank | Target y | Current y | Δy |");
      lines.push("|---|---|---|---|");
      for (const m of r.textRowMatches.slice(0, 12)) {
        const signed = m.deltaY > 0 ? `+${m.deltaY}` : `${m.deltaY}`;
        lines.push(`| #${m.rank} | ${m.baseline.yCenter} | ${m.variant.yCenter} | ${signed}px |`);
      }
    }
    if (r.typographyMismatches.length > 0) {
      lines.push("");
      lines.push("**Typography mismatches** — per-row font-size / weight " +
        "estimated from band height and ink density. Estimates are " +
        "heuristic (snapped to nearest UI bucket); large jumps " +
        "(e.g. 16px → 24px, regular → bold) are reliable.");
      lines.push("");
      lines.push("| Rank | Target | Current | Kind |");
      lines.push("|---|---|---|---|");
      for (const m of r.typographyMismatches.slice(0, 12)) {
        const tgt = `${m.baselineFontSize ?? "?"}px ${m.baselineWeight ?? "?"}`;
        const cur = `${m.variantFontSize ?? "?"}px ${m.variantWeight ?? "?"}`;
        lines.push(`| #${m.rank} | ${tgt} | ${cur} | ${m.kind} |`);
      }
    }
    if (r.rowGapDeltas.length > 0) {
      lines.push("");
      lines.push("**Spacing fixes** — per-gap delta between consecutive text rows. " +
        "The fix is on the *preceding* element: if the gap above row #N is +6px, " +
        "reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.");
      lines.push("");
      lines.push("| Above → Below | Target gap | Current gap | Δgap | Suggested fix |");
      lines.push("|---|---|---|---|---|");
      for (const g of r.rowGapDeltas.slice(0, 12)) {
        const signed = g.delta > 0 ? `+${g.delta}` : `${g.delta}`;
        const fix = g.delta > 0
          ? `reduce preceding element's bottom space by ${g.delta}px`
          : `add ${Math.abs(g.delta)}px to preceding element's bottom space`;
        lines.push(`| #${g.aboveRank} → #${g.belowRank} | ${g.baselineGap}px | ${g.variantGap}px | ${signed}px | ${fix} |`);
      }
    }
    lines.push("");
  }

  if (r.targetBg) {
    lines.push("## Backgrounds");
    lines.push("");
    lines.push("Direct samples of the page bg (image perimeter) and inner bg " +
      "(central rectangle) — start here when setting `body` and content " +
      "container background colors.");
    lines.push("");
    lines.push("| Layer | Target | Current |");
    lines.push("|---|---|---|");
    const currOuter = r.currentBg ? `\`${r.currentBg.outer.hex}\`` : "—";
    const currInner = r.currentBg ? `\`${r.currentBg.inner.hex}\`` : "—";
    lines.push(`| outer (page) | \`${r.targetBg.outer.hex}\` | ${currOuter} |`);
    if (!r.targetBg.same) {
      lines.push(`| inner (content) | \`${r.targetBg.inner.hex}\` | ${currInner} |`);
    } else {
      lines.push("");
      lines.push("_(target outer and inner are the same; page is a single solid background.)_");
    }
    lines.push("");
  }

  if (r.paletteDiff.onlyInBaseline.length > 0 || r.paletteDiff.onlyInVariant.length > 0) {
    lines.push("## Palette diff");
    lines.push("");
    lines.push("`Nearest` column: Euclidean RGB distance to the closest color on " +
      "the other side. ≤ 30 = likely AA / quantization noise; > 60 = real palette gap.");
    lines.push("");
    lines.push("| Side | Color | Share | Nearest |");
    lines.push("|---|---|---|---|");
    const fmtNear = (d: number) => {
      if (!Number.isFinite(d)) return "—";
      const v = d.toFixed(0);
      if (d <= 30) return `${v} (near, likely AA)`;
      if (d <= 60) return `${v} (close)`;
      return v;
    };
    for (const c of r.paletteDiff.onlyInBaseline.slice(0, 8)) {
      lines.push(`| missing | \`${c.hex}\` | ${(c.share * 100).toFixed(1)}% | ${fmtNear(c.nearestNeighborDistance)} |`);
    }
    for (const c of r.paletteDiff.onlyInVariant.slice(0, 8)) {
      lines.push(`| extra | \`${c.hex}\` | ${(c.share * 100).toFixed(1)}% | ${fmtNear(c.nearestNeighborDistance)} |`);
    }
    lines.push("");
  }

  if (r.stateResults.length > 0) {
    lines.push("## Forced-state diff");
    lines.push("");
    lines.push("Each row: current HTML rendered with the named pseudo-class " +
      "forced on all interactive elements, diffed against the default render.");
    lines.push("");
    lines.push("- **Perceptual %**: pixelmatch at threshold 0.03 — what the eye " +
      "would notice. Filters anti-aliasing and subpixel jitter.");
    lines.push("- **Raw %**: any pixel where any RGB channel changed by ≥ 4. " +
      "Catches subtle hover effects (Δ10/channel shifts) that the perceptual " +
      "filter swallows.");
    lines.push("- **Edge %**: of all diff pixels, fraction within 4px of any " +
      "forced bbox perimeter. High = outline-only change (likely UA default focus " +
      "ring); low = interior fill/text changed (author CSS).");
    lines.push("- **ΔLuma**: change in mean interior luminance of the forced " +
      "elements (state minus default). Negative = elements got darker; positive = " +
      "lighter. Typical `:hover` darkens (−5 to −30); a *large positive ΔLuma* on " +
      "an already-light state is a wrong-direction-shift suspect.");
    lines.push("- **Note**: `suspect` when both diff metrics are essentially zero. " +
      "`ua-likely` when only the outline changed and the interior is untouched " +
      "(catches missing author `:focus-visible` rules that the UA default hides). " +
      "`direction?` when ΔLuma > +15 on a state that conventionally darkens.");
    lines.push("");
    lines.push("| State | Perceptual % | Raw % | Edge % | ΔLuma | Forced | Note |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const s of r.stateResults) {
      const perceptZero = s.inducedDiffRatio < 0.0005;
      const rawZero = s.rawInducedDiffRatio < 0.0005;
      const uaLikely = s.forcedCount > 0 && !rawZero
        && s.edgeFraction > 0.85 && s.interiorPixels < 50;
      // Wrong-direction heuristic: hover/active are conventionally
      // darkening states. If they lighten by > 15 luma units on a
      // styled state (rawZero false), flag for verification. focus
      // and focus-visible may legitimately lighten via outline, so
      // skip them.
      const wrongDir = !rawZero
        && !uaLikely
        && (s.state === "hover" || s.state === "active")
        && s.lumaDelta !== null && s.lumaDelta > 15;
      const note = s.forcedCount > 0 && perceptZero && rawZero
        ? "**suspect** — state did not change rendering"
        : s.forcedCount > 0 && perceptZero && !rawZero
          ? "_subtle_ — only raw-pixel diff registers (check below the perceptual threshold)"
          : uaLikely
            ? "**ua-likely** — only the perimeter changed; author rule likely missing"
            : wrongDir
              ? `**direction?** — \`:${s.state}\` lightened by ${s.lumaDelta!.toFixed(0)} luma; verify this matches the intended hover direction`
              : "";
      const edgePct = s.edgeFraction > 0 ? (s.edgeFraction * 100).toFixed(0) + "%" : "—";
      const luma = s.lumaDelta === null
        ? "—"
        : (s.lumaDelta > 0 ? `+${s.lumaDelta.toFixed(1)}` : s.lumaDelta.toFixed(1));
      lines.push(`| \`:${s.state}\` | ${(s.inducedDiffRatio * 100).toFixed(2)}% | ${(s.rawInducedDiffRatio * 100).toFixed(2)}% | ${edgePct} | ${luma} | ${s.forcedCount} | ${note} |`);
    }
    lines.push("");
  }

  lines.push("## Suggested next step");
  lines.push("");
  if (r.baselineRowCount > r.variantRowCount) {
    lines.push("1. The current rendering is missing text rows — add the missing " +
      "HTML elements first. Bbox / palette tables tell you what styling they need.");
  } else {
    lines.push("1. Open the target and current PNGs side-by-side. Use the heatmap " +
      "region table to localize diff areas.");
  }
  lines.push("2. Cross-check the palette table — missing colors are the design tokens " +
    "the current rendering doesn't have (paste the hex values into your CSS).");
  lines.push("3. If bbox deltas are large, the current element's dimensions don't " +
    "match the target — adjust `width` / `padding` / `font-size` until they converge.");
  lines.push("4. Re-run `vrt component-from-image` and check that diff %, bbox " +
    "deltas, heatmap regions, palette deltas all shrink toward zero.");
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const { positional, outputDir, report, threshold, states } = parseArgs(argv);
  if (positional.length < 2) {
    console.log("Usage: vrt component-from-image <target.png> <current.html> [options]");
    console.log("Options:");
    console.log("  --output-dir <dir>              Output directory (default: ./test-results/component)");
    console.log("  --report <path>                 Markdown report path (default: <output-dir>/report.md)");
    console.log("  --threshold <0..1>              Pixel diff threshold (default: 0.03)");
    console.log("  --states hover focus-visible …  Capture additional pseudo-state diffs");
    process.exit(1);
  }
  await runComponentFromImage({
    targetImagePath: positional[0]!,
    currentHtmlPath: positional[1]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "component"),
    reportPath: report || undefined,
    threshold,
    states: states.length > 0 ? states : undefined,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
