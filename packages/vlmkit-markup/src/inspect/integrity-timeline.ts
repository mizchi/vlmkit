/**
 * `check integrity --timeline`: the layout judges across the page's motion, not only at rest.
 *
 * The ordinary run judges the page once it has settled, so a defect that exists only while
 * something moves — a slide-in card crossing its neighbour's label, a panel covering text for
 * the half second of its entrance, a heading clipped mid-transition — is never seen. Here the
 * page is loaded with its clock held (`VIRTUAL_CLOCK_SCRIPT`) and every animation held from the
 * instant it begins (`HOLD_TIMELINE_SCRIPT`); at each instant the clock is advanced and every
 * animation is seeked to that page time, and the same judges `runIntegrityCheck` uses run on
 * what is there.
 *
 * Judging every instant at full weight would be unusable — a card crossing a label for one
 * frame is not what a user sees — so severity comes from persistence (`tierByPersistence` in
 * `@mizchi/vlmkit-judge/persistence.ts`): held across consecutive instants keeps its rule's
 * severity, a single glimpse is reported without weight. Both ideas are HyperFrames'
 * (`hyperframes check`: seek a time grid, judge each sample, `applyPersistenceTier`).
 *
 * Judged per instant: text collision, clipped text, collapsed containers, protrusion,
 * invisible / low-contrast text, occluded text, page overflow and clipped content. Not judged:
 * resources, runtime errors, the unstyled-page fingerprint and the empty-render pixels, which
 * are about the page rather than a moment of it, and near-misalignment, which a moving
 * element trips by definition.
 */
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import {
  captureStable,
  defaultTimelineInstants,
  frameSourceFacts,
  frameWriter,
  openHeldTimeline,
  type FramesWritten,
} from "@mizchi/vlmkit-animation-eval/frames-capture.ts";
import {
  findOccludedText,
  findTextCollisions,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeProtrusions,
  judgeTextContrast,
  textContrastCandidates,
  type ClipCandidate,
  type CollapseCandidate,
  type IntegrityFinding,
  type IntegrityTextBlock,
  type OcclusionCandidate,
  type ProtrusionCandidate,
  type TextContrastSample,
} from "@mizchi/vlmkit-judge/integrity.ts";
import { analyzeScrollSamples, COLLECT_SCROLL_SCRIPT, type ScrollScanInput } from "./scroll-scan.ts";

export interface TimelineSample {
  atMs: number;
  findings: IntegrityFinding[];
}

export interface TimelineSweep {
  samples: TimelineSample[];
  /**
   * The page after its motion, on the same held clock: past the last instant, the end of every
   * finite animation, and 2s. "Absent once it stops" is judged against this, never against the
   * last instant asked for — `--timeline-at 0,250,500` ends mid-motion on purpose.
   */
  rest: TimelineSample;
  /** With `frames`: the page at each instant and at rest, as a `vlmkit-frames/1` sequence. */
  frames?: FramesWritten;
}

/**
 * The per-instant half of `runIntegrityCheck`: the same collectors and judges, in the same
 * order, on whatever the page shows right now. The collectors are passed in so this module
 * does not import the runner (which imports this one).
 */
export async function judgeIntegrityInstant(
  page: Page,
  width: number,
  collectors: {
    text: string;
    clip: string;
    collapse: string;
    protrusions: string;
    contrast: string;
    occlusions: string;
  },
  maxFindings = 12,
): Promise<IntegrityFinding[]> {
  const out: IntegrityFinding[] = [];
  out.push(
    ...findTextCollisions((await page.evaluate(collectors.text)) as IntegrityTextBlock[], width, { maxFindings })
      .findings,
  );
  const clipped = judgeClippedText((await page.evaluate(collectors.clip)) as ClipCandidate[], width, maxFindings);
  out.push(...clipped.findings);
  out.push(
    ...judgeCollapsedContainers((await page.evaluate(collectors.collapse)) as CollapseCandidate[], width).findings,
  );
  out.push(
    ...judgeProtrusions((await page.evaluate(collectors.protrusions)) as ProtrusionCandidate[], width, maxFindings)
      .findings,
  );
  // Contrast only for text at full opacity. Mid-motion, text below that is mid-FADE — a
  // fade-in at 40% is the animation, not a defect, and judging it was the one false-positive
  // class on the repo's animated pages (six of eight dogfood pages flipped to `defects` on
  // entrance fades alone). Contrast that is low because the colours are, or because what is
  // behind the text moved, is still judged. The settled run judges every opacity.
  const { samples: all } = (await page.evaluate(collectors.contrast)) as { samples: TextContrastSample[] };
  const samples = all.filter((s) => (s.opacity ?? 1) >= 0.999 && (s.color?.[3] ?? 1) >= 0.999);
  const measured = textContrastCandidates(samples);
  out.push(...judgeTextContrast(measured.candidates, measured.skippedComposite, width, maxFindings).findings);
  out.push(...findOccludedText((await page.evaluate(collectors.occlusions)) as OcclusionCandidate[], width).findings);
  const scroll = (await page.evaluate(COLLECT_SCROLL_SCRIPT)) as Omit<ScrollScanInput, "source">;
  const clippedSelectors = new Set([
    ...clipped.findings.map((f) => f.selector),
    ...clipped.exempted.map((e) => e.selector),
  ]);
  for (const issue of analyzeScrollSamples({ source: "", ...scroll }).issues) {
    if (issue.kind !== "page-overflow-x" && issue.kind !== "clipped-content") continue;
    if (issue.kind === "clipped-content" && issue.selector && clippedSelectors.has(issue.selector)) continue;
    out.push({
      kind: issue.kind,
      severity: issue.kind === "page-overflow-x" ? "fail" : "warn",
      viewport: width,
      ...(issue.selector ? { selector: issue.selector } : {}),
      message: issue.message,
    });
  }
  return out;
}

/**
 * Load the page with its clock and animations held, pick the instants (the caller's, or each
 * finite animation's start / middle / end plus a coarse grid), and judge each one. With
 * `frames`, each instant is also captured into `<frames>/<width>/`, the frame showing what was
 * judged.
 */
export async function sampleIntegrityTimeline(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
  options: {
    at?: readonly number[];
    storageState?: string;
    har?: string;
    timeout?: number;
    waitUntil?: "domcontentloaded" | "load" | "networkidle";
    maxFindings?: number;
    frames?: string;
  },
  collectors: Parameters<typeof judgeIntegrityInstant>[2],
): Promise<TimelineSweep> {
  const page = await browser.newPage(withAuthState({ viewport }, options.storageState));
  try {
    const timeline = await openHeldTimeline(page, url, options);
    const held = await timeline.animations();
    const instants =
      options.at && options.at.length > 0
        ? [...new Set(options.at)].sort((a, b) => a - b)
        : defaultTimelineInstants(held);
    const writer = options.frames
      ? await frameWriter(join(options.frames, String(viewport.width)), {
          tool: "check integrity --timeline",
          url,
          viewport,
          ...(await frameSourceFacts(page)),
          clock: "held",
        })
      : undefined;
    const judgeAt = async (atMs: number, label?: string): Promise<TimelineSample> => {
      await timeline.at(atMs);
      if (writer) {
        const { png, stable } = await captureStable(page);
        await writer.add(png, { atMs, stable, ...(label ? { label } : {}) });
      }
      return {
        atMs,
        findings: await judgeIntegrityInstant(page, viewport.width, collectors, options.maxFindings ?? 12),
      };
    };
    const samples: TimelineSample[] = [];
    for (const atMs of instants) samples.push(await judgeAt(atMs));
    // Rest is past the end of every finite animation that moved the page the instants sampled.
    // One that has not begun by the last instant did not: a toast dismissed at 10s would put rest
    // past its exit, and a label it covered, still, for 10s would read as gone once the page stops.
    const lastInstant = Math.max(0, ...instants);
    const finiteEnds = held
      .filter((a) => a.iterations !== null && a.startMs <= lastInstant)
      .map((a) => a.startMs + a.durationMs * (a.iterations ?? 1));
    const restMs = Math.max(2000, ...instants, ...finiteEnds) + 1;
    const rest = await judgeAt(restMs, "rest");
    return { samples, rest, ...(writer ? { frames: await writer.finish() } : {}) };
  } finally {
    await page.close();
  }
}
