import { mkdir, readFile } from "node:fs/promises";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { basename, join } from "node:path";
import { compareScreenshots, parseIgnoreRegionSpec } from "@mizchi/vlmkit-core/heatmap.ts";
import { readPngDimensions } from "@mizchi/vlmkit-core/image-resize.ts";
import { classifyVisualDiff } from "./visual-semantic.ts";
import {
  captureRegionElementsFromHtml,
  matchRegionBboxToElements,
  parseRegionElementsJson,
  parseRegionElementsViewport,
  type RegionElementRect,
  type RegionElementsViewport,
} from "./region-selector-match.ts";
import type { DiffIgnoreRegion, DiffRegion, VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";

export interface PngDiffCliOptions {
  baselinePath: string;
  currentPath: string;
  outputDir: string;
  threshold: number;
  skipHeatmap: boolean;
  json: boolean;
  /** Path to a DOM bbox JSON; attach selector candidates to regions. */
  elementsJson?: string;
  /** URL or HTML file; capture DOM bboxes live (requires Playwright). */
  elementsHtml?: string;
  /** Viewport for --elements-html (defaults to the current PNG size). */
  elementsViewport?: RegionElementsViewport;
  /** Directory to write one baseline/current/diff crop triple per region. */
  cropRegions?: string;
  /**
   * Region-detection grid in pixels. Omitted means adaptive — see
   * `adaptiveRegionCellSize`. Set it when the default bucket is wrong for your frames.
   */
  regionGrid?: number;
  /**
   * How many attribution candidates to report per region (default 1).
   *
   * Worth raising when a report blames something implausible: the runners-up are already
   * computed, and one wrong winner otherwise hides every alternative.
   */
  elementsTop?: number;
  /**
   * Rectangles that change every frame by construction — particles, noise, a
   * timer readout (vlmkit#118, a canvas/WebGPU engine).
   *
   * Deliberately not `baseline approve --region`: approval records a decision
   * with a reason, an approver and an expiry, and shows up in the
   * `gates suppressions` stocktake. A permanently non-deterministic area routed
   * through approval re-pollutes that history on every run and turns the
   * stocktake into noise. These rects are *never measured* instead: nothing is
   * recorded, nothing expires, and nothing is forgiven — there is no finding to
   * forgive.
   */
  ignoreRegions?: DiffIgnoreRegion[];
}

export interface PngDiffRegionCrop {
  index: number;
  bbox: { x: number; y: number; width: number; height: number };
  baseline: string;
  current: string;
  diff: string;
}

class PngDiffCliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

export function formatPngDiffUsage(): string {
  return `vlmkit diff png <baseline.png> <current.png>

Compare two existing PNG screenshots without launching Playwright.

Options:
  --output-dir <path>   Directory for generated heatmaps (default: test-results/png-diff)
  --threshold <0-1>     pixelmatch threshold (default: 0.1)
  --no-heatmap          Skip heatmap generation
  --json                Print JSON instead of a human-readable summary
  --elements-html <path-or-url>
                        Capture DOM bboxes from the live page and attach a
                        deterministic selector candidate to each diff region
                        (no VLM, no API key)
  --elements-json <path>
                        Same, from a pre-captured DOM bbox JSON
  --elements-viewport <WxH>
                        Viewport for --elements-html (default: current PNG size)
  --crop-regions <dir>  Write a baseline/current/diff crop triple per region
                        into <dir> for direct inspection (no VLM)
  --region-grid <px>    Region-detection cell size. Default adapts to the image
                        (32 at >=720px short side, 16 at >=480, else 8) because a
                        region coarser than the element that changed misattributes
                        the cause. Lower it for small frames with fine detail.
  --elements-top <N>    Report the top N attribution candidates per region
                        (default 1) instead of only the winner
  --ignore-region "<x>,<y>,<w>x<h>"
                        Never measure this rectangle. Repeatable. For areas that
                        are non-deterministic by construction (particles, noise,
                        a timer readout) — unlike "baseline approve --region"
                        nothing is recorded or forgiven, and it does not appear
                        in the suppression stocktake. Ignored pixels leave BOTH
                        the diff count and the diffRatio denominator, so the
                        ratio stays "fraction of what was measured". The masked
                        area and the diff pixels it swallowed are always printed`;
}

export function parsePngDiffArgs(args: string[]): PngDiffCliOptions {
  const positional: string[] = [];
  let outputDir = join(process.cwd(), "test-results", "png-diff");
  let threshold = 0.1;
  let skipHeatmap = false;
  let json = false;
  let elementsJson: string | undefined;
  let regionGrid: number | undefined;
  let elementsTop: number | undefined;
  let elementsHtml: string | undefined;
  let elementsViewport: RegionElementsViewport | undefined;
  let cropRegions: string | undefined;
  const ignoreRegions: DiffIgnoreRegion[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case "--ignore-region": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 2);
        try {
          ignoreRegions.push(parseIgnoreRegionSpec(value));
        } catch (error) {
          // Exit 2 like --region-grid / --elements-top: a malformed rect is a
          // usage error, and it must never degrade to "no mask applied" — that
          // would report a diff the caller believes they excluded.
          throw new PngDiffCliError(`--ignore-region: ${(error as Error).message}`, 2);
        }
        break;
      }
      case "--crop-regions": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        cropRegions = value;
        break;
      }
      case "--elements-json": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        elementsJson = value;
        break;
      }
      case "--elements-html": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        elementsHtml = value;
        break;
      }
      case "--region-grid": {
        const value = args[++i];
        const parsed = Number(value);
        if (!value || !Number.isInteger(parsed) || parsed < 1) {
          throw new PngDiffCliError(`--region-grid requires a positive integer, got: ${value ?? "(missing)"}`, 2);
        }
        regionGrid = parsed;
        break;
      }
      case "--elements-top": {
        const value = args[++i];
        const parsed = Number(value);
        if (!value || !Number.isInteger(parsed) || parsed < 1) {
          throw new PngDiffCliError(`--elements-top requires a positive integer, got: ${value ?? "(missing)"}`, 2);
        }
        elementsTop = parsed;
        break;
      }
      case "--elements-viewport": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        elementsViewport = parseRegionElementsViewport(value);
        break;
      }
      case "--help":
      case "-h":
        throw new PngDiffCliError(formatPngDiffUsage(), 0);
      case "--output":
      case "--output-dir": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        outputDir = value;
        break;
      }
      case "--threshold": {
        const value = args[++i];
        const parsed = value ? Number(value) : Number.NaN;
        if (!value || !Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          throw new PngDiffCliError(`Invalid --threshold value: ${value ?? ""}\n\n${formatPngDiffUsage()}`, 1);
        }
        threshold = parsed;
        break;
      }
      case "--no-heatmap":
        skipHeatmap = true;
        break;
      case "--json":
        json = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new PngDiffCliError(`Unknown option: ${arg}\n\n${formatPngDiffUsage()}`, 1);
        }
        positional.push(arg);
        break;
    }
  }

  if (positional.length !== 2) {
    throw new PngDiffCliError(formatPngDiffUsage(), 1);
  }

  const [baselinePath, currentPath] = positional;
  return {
    baselinePath,
    currentPath,
    outputDir,
    threshold,
    skipHeatmap,
    json,
    ...(elementsJson ? { elementsJson } : {}),
    ...(elementsHtml ? { elementsHtml } : {}),
    ...(elementsViewport ? { elementsViewport } : {}),
    ...(cropRegions ? { cropRegions } : {}),
    ...(regionGrid !== undefined ? { regionGrid } : {}),
    ...(elementsTop !== undefined ? { elementsTop } : {}),
    ...(ignoreRegions.length > 0 ? { ignoreRegions } : {}),
  };
}

async function resolveElements(
  options: PngDiffCliOptions,
  currentSize: { width: number; height: number },
): Promise<RegionElementRect[] | null> {
  if (options.elementsJson) {
    return parseRegionElementsJson(await readFile(options.elementsJson, "utf-8"));
  }
  if (options.elementsHtml) {
    return captureRegionElementsFromHtml(
      options.elementsHtml,
      options.elementsViewport ?? currentSize,
    );
  }
  return null;
}

function attachSelectorCandidates(
  regions: DiffRegion[],
  elements: RegionElementRect[],
  limit = 1,
): void {
  for (const region of regions) {
    const matches = matchRegionBboxToElements(
      { left: region.x, top: region.y, width: region.width, height: region.height },
      elements,
      limit,
    );
    const [match, ...runnersUp] = matches;
    if (!match) continue;
    region.selectorCandidate = {
      selector: match.selector,
      confidence: match.confidence,
      path: match.evidence.path,
      tag: match.evidence.tag,
      regionCoverage: match.evidence.regionCoverage,
      elementCoverage: match.evidence.elementCoverage,
      // Only when asked for: the field is absent at the default limit of 1, so existing
      // JSON consumers see exactly the shape they saw before.
      ...(runnersUp.length > 0
        ? {
          alternates: runnersUp.map((alternate) => ({
            selector: alternate.selector,
            confidence: alternate.confidence,
            path: alternate.evidence.path,
            tag: alternate.evidence.tag,
            regionCoverage: alternate.evidence.regionCoverage,
            elementCoverage: alternate.evidence.elementCoverage,
          })),
        }
        : {}),
    };
  }
}

export async function runPngDiff(options: PngDiffCliOptions) {
  if (!options.skipHeatmap) {
    await mkdir(options.outputDir, { recursive: true });
  }

  const snapshot: VrtSnapshot = {
    testId: basename(options.currentPath, ".png") || "png-diff",
    testTitle: basename(options.currentPath),
    projectName: "vrt",
    screenshotPath: options.currentPath,
    baselinePath: options.baselinePath,
    status: "changed",
  };

  const diff = await compareScreenshots(snapshot, {
    outputDir: options.skipHeatmap ? undefined : options.outputDir,
    skipHeatmap: options.skipHeatmap,
    threshold: options.threshold,
    ...(options.regionGrid !== undefined ? { regionCellSize: options.regionGrid } : {}),
    ...(options.ignoreRegions ? { ignoreRegions: options.ignoreRegions } : {}),
  });
  if (!diff) {
    throw new Error("PNG diff requires both baseline and current screenshot paths");
  }

  const [baselineBuf, currentBuf] = await Promise.all([
    readFile(options.baselinePath),
    readFile(options.currentPath),
  ]);
  const baselineSize = readPngDimensions(baselineBuf);
  const currentSize = readPngDimensions(currentBuf);
  const sizeDelta = {
    width: currentSize.width - baselineSize.width,
    height: currentSize.height - baselineSize.height,
  };

  const elements = await resolveElements(options, currentSize);
  if (elements && elements.length > 0) {
    attachSelectorCandidates(diff.regions, elements, options.elementsTop ?? 1);
  }

  const semantic = classifyVisualDiff(diff);

  let crops: PngDiffRegionCrop[] | undefined;
  if (options.cropRegions) {
    crops = await writeRegionCrops(options, diff.regions, diff.heatmapPath);
  }

  return { diff, semantic, baselineSize, currentSize, sizeDelta, crops };
}

/**
 * Write a baseline/current/diff crop triple per region so an agent can
 * inspect each region on a tall capture without hand-rolling a pngjs
 * cropper (A/B v1 draft 05). A small margin is added around each bbox for
 * context; the diff crop is taken from the heatmap when one was generated.
 */
async function writeRegionCrops(
  options: PngDiffCliOptions,
  regions: DiffRegion[],
  heatmapPath: string | undefined,
): Promise<PngDiffRegionCrop[]> {
  const dir = options.cropRegions!;
  await mkdir(dir, { recursive: true });

  const { decodePng, encodePng, cropRegion } = await import("@mizchi/vlmkit-core/png-utils.ts");
  const [baseline, current, heatmap] = await Promise.all([
    decodePng(options.baselinePath),
    decodePng(options.currentPath),
    heatmapPath ? decodePng(heatmapPath) : Promise.resolve(undefined),
  ]);

  const MARGIN = 8;
  const crops: PngDiffRegionCrop[] = [];
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i]!;
    const x = r.x - MARGIN;
    const y = r.y - MARGIN;
    const w = r.width + MARGIN * 2;
    const h = r.height + MARGIN * 2;
    const tag = `region-${String(i).padStart(2, "0")}`;
    const baselineFile = join(dir, `${tag}-baseline.png`);
    const currentFile = join(dir, `${tag}-current.png`);
    const diffFile = join(dir, `${tag}-diff.png`);
    await encodePng(baselineFile, cropRegion(baseline, x, y, w, h));
    await encodePng(currentFile, cropRegion(current, x, y, w, h));
    // Fall back to the current crop when no heatmap was generated, so the
    // triple is always complete and the manifest paths always resolve.
    await encodePng(diffFile, cropRegion(heatmap ?? current, x, y, w, h));
    crops.push({
      index: i,
      bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
      baseline: baselineFile,
      current: currentFile,
      diff: diffFile,
    });
  }
  return crops;
}

export async function runPngDiffCli(cliArgs = process.argv.slice(2)) {
  try {
    const options = parsePngDiffArgs(cliArgs);
    const result = await runPngDiff(options);
    const output = {
      status: result.diff.diffPixels === 0 ? "pass" : "changed",
      baselinePath: options.baselinePath,
      currentPath: options.currentPath,
      baselineSize: result.baselineSize,
      currentSize: result.currentSize,
      sizeDelta: result.sizeDelta,
      diffPixels: result.diff.diffPixels,
      totalPixels: result.diff.totalPixels,
      diffRatio: result.diff.diffRatio,
      ...(result.diff.mask ? { mask: result.diff.mask } : {}),
      regions: result.diff.regions,
      heatmapPath: result.diff.heatmapPath,
      summary: result.semantic.summary,
      changes: result.semantic.changes,
      ...(result.crops ? { crops: result.crops } : {}),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log("PNG Diff");
    console.log(`  baseline: ${output.baselinePath}`);
    console.log(`  current:  ${output.currentPath}`);
    console.log(
      `  size:     baseline ${output.baselineSize.width}x${output.baselineSize.height}` +
      ` / current ${output.currentSize.width}x${output.currentSize.height}` +
      (output.sizeDelta.width !== 0 || output.sizeDelta.height !== 0
        ? ` (Δ ${formatSizeDelta(output.sizeDelta.width)}w ${formatSizeDelta(output.sizeDelta.height)}h)`
        : ""),
    );
    if (output.sizeDelta.height !== 0) {
      console.log(
        `  note:     height differs by ${formatSizeDelta(output.sizeDelta.height)}px — content reflow likely (an element gained or lost vertical space)`,
      );
    }
    console.log(
      `  diff:     ${(output.diffRatio * 100).toFixed(2)}% (${output.diffPixels} / ${output.totalPixels} px`
      + `${output.mask ? " measured" : ""})`,
    );
    // Printed immediately under the ratio, not in a footer and not only in
    // --json, following `formatIntegrityReport`'s coverage block: the dangerous
    // failure mode of this flag is a mask over half the frame and a verdict of
    // "0.10%". A clean result has to be auditable from the same three lines a
    // reader already looks at.
    if (output.mask) {
      const m = output.mask;
      const share = m.imagePixels > 0 ? (m.ignoredPixels / m.imagePixels) * 100 : 0;
      console.log(
        `  ignored:  ${m.regions.length} region(s), ${m.ignoredPixels} px`
        + ` (${share.toFixed(1)}% of the ${m.imagePixels} px compared area) — never measured`,
      );
      for (const region of m.regions) {
        const covered = region.pixels === 0
          ? "0 px — outside the compared area, masks nothing"
          : `${region.pixels} px, ${region.diffPixels} of them differed`;
        console.log(`    (${region.x},${region.y}) ${region.width}x${region.height} — ${covered}`);
      }
      // Spell out the denominator. `totalPixels` also carries size-mismatch
      // overflow, which no rect inside the compared area can mask, so show that
      // term rather than print arithmetic that does not add up.
      const overflow = output.totalPixels - (m.imagePixels - m.ignoredPixels);
      console.log(
        `    ${m.ignoredDiffPixels} diff px discarded; denominator`
        + ` ${m.imagePixels} - ${m.ignoredPixels}`
        + (overflow !== 0 ? ` + ${overflow} unmaskable size-mismatch px` : "")
        + ` = ${output.totalPixels}`,
      );
    }
    console.log(`  regions:  ${output.regions.length}`);
    if (output.regions.length > 0) {
      for (const region of output.regions.slice(0, 15)) {
        const type = region.regionType ? ` [${region.regionType}]` : "";
        const color = region.colorSample && region.colorSample.baseline.hex !== region.colorSample.current.hex
          ? ` ${region.colorSample.baseline.hex} -> ${region.colorSample.current.hex}`
          : "";
        const shift = region.shift && (region.shift.dx !== 0 || region.shift.dy !== 0)
          ? ` shift(${region.shift.dx >= 0 ? "+" : ""}${region.shift.dx},${region.shift.dy >= 0 ? "+" : ""}${region.shift.dy})`
          : "";
        console.log(`    (${region.x},${region.y}) ${region.width}x${region.height}${type}${color}${shift}`);
      }
      if (output.regions.length > 15) {
        console.log(`    … ${output.regions.length - 15} more (use --json for all)`);
      }
    }
    const withSelectors = output.regions.filter((r) => r.selectorCandidate);
    if (withSelectors.length > 0) {
      console.log("  selectors:");
      for (const region of withSelectors.slice(0, 10)) {
        const c = region.selectorCandidate!;
        console.log(
          `    (${region.x},${region.y}) ${region.width}x${region.height} -> ${c.selector} (${c.confidence}, coverage ${c.regionCoverage})`,
        );
      }
    }
    console.log(`  summary:  ${output.summary}`);
    if (output.heatmapPath) {
      console.log(`  heatmap:  ${output.heatmapPath}`);
    }
    if (result.crops && result.crops.length > 0) {
      console.log(`  crops:    ${result.crops.length} region triple(s) in ${options.cropRegions}`);
    }
  } catch (error) {
    if (error instanceof PngDiffCliError) {
      if (error.exitCode === 0) {
        console.log(error.message);
      } else {
        console.error(error.message);
      }
      process.exit(error.exitCode);
    }
    throw error;
  }
}

function formatSizeDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

if (isCliEntry(import.meta.url, "png-diff")) {
  runPngDiffCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
