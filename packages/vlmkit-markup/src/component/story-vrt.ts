/**
 * Story-scoped VRT: mount one component, screenshot only that component,
 * diff it against an approved baseline.
 *
 * ## Why a story rather than a page
 *
 * A full-page diff is the wrong instrument for fixing one component. It is
 * large (a 1280x3000 page is ~40x the pixels of a 200x40 button), it cascades —
 * nudge a header and every row below it reports as changed — and the signal a
 * reader or an agent needs is buried in the part that did not change. Mounting
 * one story and screenshotting its root gives a diff whose every pixel is about
 * the component under repair, at a size that is cheap to produce, cheap to look
 * at, and cheap to hand to a model.
 *
 * ## What this drives, and what it deliberately does not depend on
 *
 * Playwright's component testing has two halves. The `mount` fixture is one, it
 * lives in `@playwright/test`, and it landed in **1.62** — this repo pins 1.61
 * and Playwright is a peer dependency, so depending on the fixture would force a
 * version bump on every consumer.
 *
 * The other half is a page-side contract, and it is versionless. Quoting
 * Playwright's own gallery spec: the gallery is "a single page, served by your
 * dev server at the URL you set as `baseURL`" exposing
 *
 *   window.mount({ story, props })   // renders into #root, rejects on failure
 *   window.unmount()
 *
 * and "the built-in `mount` fixture navigates to the gallery, then calls
 * `window.mount` via `page.evaluate()`". So that is what this module does. It
 * needs no fixture, no config dialect, no spec files, and no particular
 * Playwright version. What it does require is those two functions on `window`:
 * a page that merely renders one component per URL is not enough. Storybook, for
 * instance, drives its iframe from a query param and exposes no `window.mount`,
 * so it needs a shim in `.storybook/preview.js` rather than working as-is.
 *
 * ## Baselines
 *
 * `.vlmkit/stories/<story>/<viewport>.png`, approved with `--update-baseline`.
 * A first run has nothing to compare against and reports `new-baseline` rather
 * than a pass, because a gate that silently accepts whatever it first sees
 * cannot fail on the run that matters.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { decodePng, measureChangeMagnitude, type ChangeMagnitude } from "@mizchi/vlmkit-core/png-utils.ts";
import { STATE_DIR } from "@mizchi/vlmkit-core/project-config.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { DiffRegion } from "@mizchi/vlmkit-core/types.ts";

export interface StoryVrtOptions {
  /** Gallery URL — the `baseURL` from the Playwright config. */
  gallery: string;
  /** Story ids to mount, in order. One browser, one navigation per story. */
  stories: string[];
  /** Plain serializable props, applied to every story listed. */
  props?: Record<string, unknown>;
  viewport: { width: number; height: number };
  /** Diff ratio at or below which a story counts as unchanged. */
  threshold: number;
  /** Write the current render as the new baseline instead of comparing. */
  updateBaseline: boolean;
  /** Root for baselines and artifacts. Defaults to `.vlmkit/stories`. */
  outputDir?: string;
  /** CSS selector the gallery renders into. The contract says `#root`. */
  root: string;
  /** Extra settle time after mount resolves, for entry transitions. */
  settleMs: number;
}

export type StoryOutcome = "unchanged" | "changed" | "new-baseline" | "updated" | "mount-failed";

export interface StoryResult {
  story: string;
  outcome: StoryOutcome;
  /** Rendered size of the component itself — the point of the exercise. */
  width?: number;
  height?: number;
  screenshotPath?: string;
  baselinePath?: string;
  diffRatio?: number;
  diffPixels?: number;
  totalPixels?: number;
  /**
   * How far the pixels moved, independent of the comparator's threshold.
   *
   * Present whenever a baseline was compared against. `diffRatio` can be 0 while
   * every pixel in the component has shifted by a few levels — measured on a
   * hero whose gradient changed tint: 96% of pixels differed, none by more than
   * 8/255, ratio 0.0%. Without this the two cases are indistinguishable in the
   * report.
   */
  magnitude?: ChangeMagnitude;
  heatmapPath?: string;
  regions?: DiffRegion[];
  /** Rejection message from `window.mount`, verbatim. */
  error?: string;
}

export interface StoryVrtReport {
  gallery: string;
  viewport: { width: number; height: number };
  threshold: number;
  results: StoryResult[];
  /** Pixels the equivalent full-page screenshots would have cost, for contrast. */
  pagePixels: number;
  /** Pixels actually captured across every story. */
  storyPixels: number;
}

/**
 * Fraction of pixels that must have moved for a below-threshold diff to be
 * called drift rather than noise.
 *
 * The discriminator is *coverage*, not magnitude. Antialiasing and font hinting
 * differ on glyph and border edges — a small minority of a component's pixels.
 * A palette, gradient, opacity or filter change moves nearly all of them. Half
 * is comfortably above what edges can account for on any real component.
 */
const SUB_PERCEPTUAL_COVERAGE = 0.5;

/**
 * Ignore a one-level delta. A single level can come from PNG rounding, and
 * treating it as drift would make the check fire on re-encoding alone.
 */
const SUB_PERCEPTUAL_MIN_DELTA = 2;

/**
 * Did the whole component shift by an amount the comparator ignored?
 *
 * This is the blind spot the component-vs-page measurement found: `check story`
 * is a pixel instrument, and a comparator with a perceptual threshold reports
 * 0.0% for a uniform low-amplitude recolour. `diff html` catches the same change
 * from its computed-style diff; a story diff has no equivalent, so the only
 * honest fix is to say what the pixels did.
 *
 * Deliberately not a verdict change. The comparator's threshold is still what
 * decides pass/fail — this reports, and a project that wants it to fail promotes
 * the rule in `vlmkit.gates.json`.
 */
export function isSubPerceptualDrift(result: StoryResult): boolean {
  if (result.outcome !== "unchanged" || !result.magnitude) return false;
  const { changedFraction, maxChannelDelta } = result.magnitude;
  return changedFraction >= SUB_PERCEPTUAL_COVERAGE && maxChannelDelta >= SUB_PERCEPTUAL_MIN_DELTA;
}

/** Filesystem-safe, and still readable: `components/Button/Primary` → `components-Button-Primary`. */
export function storySlug(story: string): string {
  return story.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "story";
}

/**
 * Runs in the page: calls the gallery's `window.mount` and reports how it went.
 *
 * A real function rather than a source string, because this one takes an
 * argument. `page.evaluate` treats a string as an *expression* and ignores the
 * argument entirely, so the string form returned the un-called function and the
 * first version of this file read `.ok` off `undefined`. The string-script
 * pattern used elsewhere in the repo is fine only because those scripts take no
 * arguments.
 *
 * `window.mount` "rejects on failure (unknown story, render throw)", and that
 * rejection is the single most useful diagnostic here — a typo'd story id is
 * otherwise just a blank screenshot. So it is caught and returned as data rather
 * than surfacing as an opaque `page.evaluate` failure.
 */
async function mountInPage(
  { story, props }: { story: string; props: Record<string, unknown> },
): Promise<{ ok: boolean; error?: string }> {
  const mount = (globalThis as { mount?: (params: unknown) => Promise<void> }).mount;
  if (typeof mount !== "function") {
    return {
      ok: false,
      error: "the gallery page does not define window.mount() — see Playwright's gallery contract",
    };
  }
  try {
    await mount({ story, props });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runStoryVrt(options: StoryVrtOptions): Promise<StoryVrtReport> {
  const outputDir = resolve(options.outputDir ?? join(process.cwd(), STATE_DIR, "stories"));
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const results: StoryResult[] = [];

  try {
    // One context and one page for every story: the gallery is a single page and
    // the browser launch is ~all of the cost, so N stories should not mean N
    // launches. Playwright's own config sets `reuseContext: true` for the same
    // reason.
    const page = await browser.newPage({ viewport: options.viewport });
    for (const story of options.stories) {
      results.push(await captureStory(page, story, options, outputDir));
    }
  } finally {
    await browser.close();
  }

  const storyPixels = results.reduce((n, r) => n + (r.width ?? 0) * (r.height ?? 0), 0);
  return {
    gallery: options.gallery,
    viewport: options.viewport,
    threshold: options.threshold,
    results,
    pagePixels: results.filter((r) => r.width !== undefined).length
      * options.viewport.width * options.viewport.height,
    storyPixels,
  };
}

async function captureStory(
  page: import("playwright").Page,
  story: string,
  options: StoryVrtOptions,
  outputDir: string,
): Promise<StoryResult> {
  const slug = storySlug(story);
  const viewportTag = `${options.viewport.width}x${options.viewport.height}`;
  const baselinePath = join(outputDir, slug, `${viewportTag}.png`);
  const currentPath = join(outputDir, slug, `${viewportTag}.current.png`);

  // Navigate per story. The contract notes each mount "navigates fresh, so tests
  // are already isolated" — carrying one story's DOM into the next would make a
  // stale render look like a match.
  await page.goto(options.gallery, { waitUntil: "networkidle", timeout: 30_000 });
  const mounted = await page.evaluate(mountInPage, { story, props: options.props ?? {} });
  if (!mounted.ok) {
    return { story, outcome: "mount-failed", error: mounted.error };
  }

  const root = page.locator(options.root).first();
  if (await root.count() === 0) {
    return {
      story,
      outcome: "mount-failed",
      error: `window.mount resolved but ${options.root} is not in the page`
        + " — the gallery must render the story into it",
    };
  }
  if (options.settleMs > 0) await page.waitForTimeout(options.settleMs);

  const box = await root.boundingBox();
  if (!box || box.width === 0 || box.height === 0) {
    return {
      story,
      outcome: "mount-failed",
      error: `${options.root} rendered with a zero-sized box (${box?.width ?? 0}x${box?.height ?? 0})`
        + " — the story mounted but produced nothing visible",
    };
  }

  await mkdir(dirname(currentPath), { recursive: true });
  // The root locator, not the page: this is the whole reason the diff is small.
  await root.screenshot({ path: currentPath });
  const size = { width: Math.round(box.width), height: Math.round(box.height) };

  if (options.updateBaseline) {
    await mkdir(dirname(baselinePath), { recursive: true });
    await writeFile(baselinePath, await readFile(currentPath));
    return { story, outcome: "updated", ...size, screenshotPath: currentPath, baselinePath };
  }

  if (!existsSync(baselinePath)) {
    await mkdir(dirname(baselinePath), { recursive: true });
    await writeFile(baselinePath, await readFile(currentPath));
    return { story, outcome: "new-baseline", ...size, screenshotPath: currentPath, baselinePath };
  }

  const diff = await compareScreenshots(
    {
      testId: `${slug}-${viewportTag}`,
      testTitle: `story: ${story}`,
      projectName: "story",
      screenshotPath: currentPath,
      baselinePath,
      status: "changed",
    },
    { outputDir: join(outputDir, slug) },
  );
  if (!diff) {
    return { story, outcome: "mount-failed", error: "pixel comparison produced no result", ...size };
  }
  // A second decode of two component-sized PNGs, so the report can say how far
  // the pixels moved and not only how many of them the comparator counted.
  const magnitude = measureChangeMagnitude(
    await decodePng(baselinePath),
    await decodePng(currentPath),
  );
  return {
    story,
    outcome: diff.diffRatio <= options.threshold ? "unchanged" : "changed",
    ...size,
    screenshotPath: currentPath,
    baselinePath,
    diffRatio: diff.diffRatio,
    diffPixels: diff.diffPixels,
    totalPixels: diff.totalPixels,
    magnitude,
    ...(diff.heatmapPath ? { heatmapPath: diff.heatmapPath } : {}),
    regions: diff.regions,
  };
}

const ICON: Record<StoryOutcome, string> = {
  unchanged: `${GREEN}✓${RESET}`,
  changed: `${RED}✗${RESET}`,
  "new-baseline": `${YELLOW}+${RESET}`,
  updated: `${CYAN}↑${RESET}`,
  "mount-failed": `${RED}!${RESET}`,
};

export function formatStoryVrtReport(report: StoryVrtReport): string {
  const lines = [
    `${BOLD}${CYAN}vlmkit check story${RESET}`,
    `${DIM}gallery: ${report.gallery}  viewport: ${report.viewport.width}x${report.viewport.height}${RESET}`,
    "",
  ];
  for (const r of report.results) {
    const size = r.width !== undefined ? `${r.width}x${r.height}` : "—";
    const detail = r.outcome === "changed"
      ? `${RED}${(r.diffRatio! * 100).toFixed(2)}% diff${RESET} ${DIM}(${r.diffPixels}/${r.totalPixels}px)${RESET}`
      : r.outcome === "unchanged"
      ? isSubPerceptualDrift(r)
        // Loud on an "unchanged" row, because that is the point: the comparator
        // passed it and the pixels say otherwise.
        ? `${YELLOW}${(r.magnitude!.changedFraction * 100).toFixed(0)}% of pixels moved`
          + ` (max ${r.magnitude!.maxChannelDelta}/255)${RESET}`
          + ` ${DIM}but diff is ${(r.diffRatio! * 100).toFixed(2)}% <= ${(report.threshold * 100).toFixed(2)}%${RESET}`
        : `${DIM}${(r.diffRatio! * 100).toFixed(2)}% <= ${(report.threshold * 100).toFixed(2)}%${RESET}`
      : r.outcome === "mount-failed"
      ? `${RED}${r.error}${RESET}`
      : r.outcome === "new-baseline"
      ? `${DIM}baseline written — re-run to compare${RESET}`
      : `${DIM}baseline updated${RESET}`;
    lines.push(`  ${ICON[r.outcome]} ${r.story.padEnd(38)} ${size.padStart(9)}  ${detail}`);
    if (r.heatmapPath && r.outcome === "changed") {
      lines.push(`      ${DIM}heatmap: ${r.heatmapPath}${RESET}`);
    }
    // Regions are what turn "3% changed" into something to go and edit.
    for (const region of (r.regions ?? []).slice(0, 3)) {
      const kind = region.regionType ? ` ${region.regionType}` : "";
      const shift = region.shift ? ` shifted ~${region.shift.dx},${region.shift.dy}px` : "";
      lines.push(
        `      ${DIM}region ${region.x},${region.y} ${region.width}x${region.height}${kind}${shift}${RESET}`,
      );
    }
  }

  if (report.storyPixels > 0 && report.pagePixels > 0) {
    // The claim this whole command rests on, stated as a measurement rather than
    // as a promise.
    const factor = report.pagePixels / report.storyPixels;
    lines.push("");
    lines.push(
      `${DIM}${report.storyPixels.toLocaleString()}px captured vs`
      + ` ${report.pagePixels.toLocaleString()}px for the same count of full-viewport shots`
      + ` — ${factor.toFixed(1)}x smaller.${RESET}`,
    );
  }
  return lines.join("\n");
}
