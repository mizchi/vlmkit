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

export function matchRegionBboxToElement(
  region: RectBox,
  elements: RegionElementRect[],
): RegionSelectorMatch | null {
  const regionArea = areaOfBbox(region);
  if (regionArea <= 0) return null;

  let best: (RegionSelectorMatch & { sortTop: number; sortLeft: number }) | null = null;
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
    if (!best || compareSelectorMatches(match, best) < 0) {
      best = match;
    }
  }
  if (!best || best.evidence.regionCoverage < 0.15) return null;
  const { sortTop: _sortTop, sortLeft: _sortLeft, ...out } = best;
  return out;
}

function compareSelectorMatches(
  left: RegionSelectorMatch & { sortTop: number; sortLeft: number },
  right: RegionSelectorMatch & { sortTop: number; sortLeft: number },
): number {
  if (left.evidence.score !== right.evidence.score) return right.evidence.score - left.evidence.score;
  if (left.evidence.regionCoverage !== right.evidence.regionCoverage) {
    return right.evidence.regionCoverage - left.evidence.regionCoverage;
  }
  const leftArea = areaOfBbox(left.evidence.bbox);
  const rightArea = areaOfBbox(right.evidence.bbox);
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
