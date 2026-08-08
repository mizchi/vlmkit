/**
 * Deterministic region-bbox → DOM-element matching.
 *
 * Extracted from vlm-region-diff so the pixel-diff path can use it
 * without a VLM: hit-test a diff region's bbox against DOM element
 * rects captured from the live page and attach a selector candidate
 * with coverage evidence. Both A/B validation agents (2026-06-06)
 * asked for exactly this — "map a pixel coordinate → DOM element"
 * without the unreliable VLM attribution.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { DOM_BBOX_BROWSER_SCRIPT } from "./shift-origin.ts";

export interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RegionElementRect {
  path: string;
  tag: string;
  id?: string;
  classes?: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface RegionSelectorMatchEvidence {
  path: string;
  tag: string;
  id?: string;
  classes: string;
  bbox: RectBox;
  regionCoverage: number;
  elementCoverage: number;
  iou: number;
  score: number;
}

export interface RegionSelectorMatch {
  selector: string;
  confidence: "high" | "medium" | "low";
  evidence: RegionSelectorMatchEvidence;
}

export interface RegionElementsViewport {
  width: number;
  height: number;
}

/**
 * How close two scores must be before box size decides between them.
 *
 * The weights above (0.7 / 0.3) and the 0.55 ancestor penalty are heuristics tuned to one
 * decimal place, so a gap of a few thousandths is not signal — but the exact-equality
 * tie-break in `compareSelectorMatches` only fires at 0. On the vlmkit#117 HUD the
 * full-frame ancestor scored 0.391 against the real cause at 0.385 and won by 0.006.
 *
 * When the scores are that close, the smaller box is the more useful answer: an ancestor
 * that merely *contains* the diff region repeats what the region already said, while a
 * leaf that overlaps most of it names something to go and change.
 */
const SCORE_TIE_MARGIN = 0.02;

/**
 * How much smaller a box must be for the near-tie rule to prefer it.
 *
 * Deliberately not "any smaller": among same-scale siblings a few thousandths of score
 * really is the only thing distinguishing them, and reordering those would be arbitrary
 * churn. This targets the ancestor-versus-leaf case the rule exists for.
 */
const TIE_AREA_RATIO = 0.5;

export function matchRegionBboxToElement(
  region: RectBox,
  elements: RegionElementRect[],
): RegionSelectorMatch | null {
  return matchRegionBboxToElements(region, elements, 1)[0] ?? null;
}

/**
 * Ranked attribution candidates, best first.
 *
 * `matchRegionBboxToElement` returns only the winner, and when the winner is wrong the
 * evidence for every alternative is gone — the report says `.hud-root` and the reader has
 * no way to see that `.hp-bar` was 0.006 behind. Returning the runners-up costs nothing
 * (they are already computed) and turns a wrong answer into a short list.
 */
export function matchRegionBboxToElements(
  region: RectBox,
  elements: RegionElementRect[],
  limit = 3,
): RegionSelectorMatch[] {
  const regionArea = areaOfBbox(region);
  if (regionArea <= 0 || limit <= 0) return [];

  const ranked: (RegionSelectorMatch & { sortTop: number; sortLeft: number })[] = [];
  for (const element of elements) {
    const selector = selectorForElement(element);
    if (!selector || element.width <= 0 || element.height <= 0) continue;
    const elementBbox = {
      left: element.left,
      top: element.top,
      width: element.width,
      height: element.height,
    };
    const elementArea = areaOfBbox(elementBbox);
    if (elementArea <= 0) continue;
    const intersection = intersectionArea(region, elementBbox);
    if (intersection <= 0) continue;

    const union = regionArea + elementArea - intersection;
    const regionCoverage = intersection / regionArea;
    const elementCoverage = intersection / elementArea;
    const iou = union > 0 ? intersection / union : 0;
    let score = regionCoverage * 0.7 + elementCoverage * 0.3;
    // VLM bboxes often include a little surrounding whitespace; avoid
    // letting huge ancestor containers beat the partially overlapped control.
    if (elementArea > regionArea * 4 && elementCoverage < 0.15) {
      score *= 0.55;
    }
    const roundedScore = roundMetric(score);
    const match: RegionSelectorMatch & { sortTop: number; sortLeft: number } = {
      selector,
      confidence: selectorConfidenceFromScore(score, regionCoverage),
      evidence: {
        path: element.path,
        tag: element.tag,
        ...(element.id ? { id: element.id } : {}),
        classes: element.classes ?? "",
        bbox: elementBbox,
        regionCoverage: roundMetric(regionCoverage),
        elementCoverage: roundMetric(elementCoverage),
        iou: roundMetric(iou),
        score: roundedScore,
      },
      sortTop: element.top,
      sortLeft: element.left,
    };
    ranked.push(match);
  }
  ranked.sort(compareSelectorMatches);
  return ranked
    // Same floor as before: a candidate covering under 15% of the region is not an
    // explanation for it, and was never returned.
    .filter((match) => match.evidence.regionCoverage >= 0.15)
    .slice(0, limit)
    .map(({ sortTop: _sortTop, sortLeft: _sortLeft, ...out }) => out);
}

function compareSelectorMatches(
  left: RegionSelectorMatch & { sortTop: number; sortLeft: number },
  right: RegionSelectorMatch & { sortTop: number; sortLeft: number },
): number {
  const leftArea = areaOfBbox(left.evidence.bbox);
  const rightArea = areaOfBbox(right.evidence.bbox);
  // Near-tie: prefer the substantially smaller box. Before the exact-score comparison,
  // because the whole point is that these scores are not meaningfully different.
  if (Math.abs(left.evidence.score - right.evidence.score) <= SCORE_TIE_MARGIN) {
    if (leftArea <= rightArea * TIE_AREA_RATIO) return -1;
    if (rightArea <= leftArea * TIE_AREA_RATIO) return 1;
  }
  if (left.evidence.score !== right.evidence.score) return right.evidence.score - left.evidence.score;
  if (left.evidence.regionCoverage !== right.evidence.regionCoverage) {
    return right.evidence.regionCoverage - left.evidence.regionCoverage;
  }
  if (leftArea !== rightArea) return leftArea - rightArea;
  if (left.sortTop !== right.sortTop) return left.sortTop - right.sortTop;
  if (left.sortLeft !== right.sortLeft) return left.sortLeft - right.sortLeft;
  return left.selector.localeCompare(right.selector);
}

export function selectorForElement(element: RegionElementRect): string | null {
  const className = firstCssIdentifier(element.classes ?? "");
  if (className) return `.${className}`;
  const id = cssIdentifier(element.id ?? "");
  if (id) return `#${id}`;
  return cssIdentifier(element.tag.toLowerCase());
}

function firstCssIdentifier(classes: string): string | null {
  for (const token of classes.split(/\s+/)) {
    const value = cssIdentifier(token);
    if (value) return value;
  }
  return null;
}

function cssIdentifier(value: string): string | null {
  const trimmed = value.trim();
  return /^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(trimmed) ? trimmed : null;
}

function selectorConfidenceFromScore(
  score: number,
  regionCoverage: number,
): RegionSelectorMatch["confidence"] {
  if (regionCoverage >= 0.85 && score >= 0.75) return "high";
  if (regionCoverage >= 0.35 && score >= 0.35) return "medium";
  return "low";
}

function areaOfBbox(bbox: RectBox): number {
  return Math.max(0, bbox.width) * Math.max(0, bbox.height);
}

function intersectionArea(a: RectBox, b: RectBox): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

// ---- element rect acquisition ----

export function parseRegionElementsJson(content: string): RegionElementRect[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { elements?: unknown }).elements)
      ? (parsed as { elements: unknown[] }).elements
      : [];
  return rows
    .map((row) => parseRegionElementRect(row))
    .filter((row): row is RegionElementRect => row !== null);
}

function parseRegionElementRect(value: unknown): RegionElementRect | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const path = typeof obj.path === "string" ? obj.path : null;
  const tag = typeof obj.tag === "string" ? obj.tag : null;
  const top = numberFromUnknown(obj.top);
  const left = numberFromUnknown(obj.left);
  const width = numberFromUnknown(obj.width);
  const height = numberFromUnknown(obj.height);
  if (!path || !tag || top === null || left === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;
  return {
    path,
    tag,
    ...(typeof obj.id === "string" && obj.id.trim() ? { id: obj.id.trim() } : {}),
    classes: typeof obj.classes === "string" ? obj.classes : "",
    top,
    left,
    width,
    height,
  };
}

function numberFromUnknown(value: unknown): number | null {
  const n = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseFloat(value)
      : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseRegionElementsViewport(value: string): RegionElementsViewport {
  const match = value.trim().match(/^([1-9]\d*)x([1-9]\d*)$/i);
  if (!match) {
    throw new Error(`--elements-viewport must be WIDTHxHEIGHT, got ${value}`);
  }
  return {
    width: Number.parseInt(match[1]!, 10),
    height: Number.parseInt(match[2]!, 10),
  };
}

export function resolveRegionElementsTargetUrl(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) throw new Error("--elements-html requires <path-or-url>");
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) return trimmed;
  return pathToFileURL(resolve(trimmed)).href;
}

export async function captureRegionElementsFromHtml(
  target: string,
  viewport: RegionElementsViewport,
): Promise<RegionElementRect[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
    });
    await page.goto(resolveRegionElementsTargetUrl(target), { waitUntil: "load" });
    // Was a bare `fonts.ready` — the two thirds of settling it was missing
    // (network idle, one frame) are what a client-rendered page needs before
    // its element rects mean anything.
    await settlePage(page);
    const raw = await page.evaluate(DOM_BBOX_BROWSER_SCRIPT);
    return parseRegionElementsJson(raw as string);
  } finally {
    await browser.close();
  }
}
