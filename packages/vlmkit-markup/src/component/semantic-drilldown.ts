import type { Page } from "playwright";
import type { LandscapeCellDiff } from "@mizchi/vlmkit-core/landscape-diff.ts";
import type { HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";

export const LANDMARK_ROLE_VALUES = [
  "banner",
  "complementary",
  "contentinfo",
  "form",
  "main",
  "navigation",
  "region",
  "search",
] as const;

export type LandmarkRole = typeof LANDMARK_ROLE_VALUES[number];

const LANDMARK_ROLES = new Set<string>(LANDMARK_ROLE_VALUES);

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LandmarkRegion {
  role: LandmarkRole;
  name: string;
  path: string;
  bbox: Rect;
  order: number;
  layout?: LandmarkLayoutContract;
}

export interface LandmarkLayoutContract {
  display: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  overflowX: string;
  overflowY: string;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

export interface LandmarkLayoutSummary {
  width: string;
  height: string;
  scroll: "none" | "x" | "y" | "xy";
  grid: string;
}

export interface ScrollportRegion {
  name: string;
  path: string;
  bbox: Rect;
  order: number;
  explicit: boolean;
  overflowX: string;
  overflowY: string;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

export interface ScrollportStatus {
  status: "ok" | "broken" | "empty";
  scroll: "none" | "x" | "y" | "xy";
  reason: string;
}

export interface SemanticDrilldownInput {
  landmarks: LandmarkRegion[];
  landscapeCells: LandscapeCellDiff[];
  heatmapRegions: HeatmapRegion[];
}

export interface SemanticDrilldownEntry {
  landmark: LandmarkRegion;
  flow: "layout" | "decoration";
  priorityScore: number;
  layoutScore: number;
  decorationScore: number;
  landscapeCells: LandscapeCellDiff[];
  heatmapRegions: HeatmapRegion[];
  reason: string;
}

const SEMANTIC_TAG_TO_ROLE: Record<string, LandmarkRole | undefined> = {
  header: "banner",
  aside: "complementary",
  footer: "contentinfo",
  main: "main",
  nav: "navigation",
  search: "search",
};

export function normalizeLandmarkRole(input: {
  tagName: string;
  role?: string | null;
  name?: string | null;
}): LandmarkRole | undefined {
  const tagName = input.tagName.toLowerCase();
  const role = input.role?.trim().toLowerCase();
  const name = input.name?.trim() ?? "";

  if (role && LANDMARK_ROLES.has(role)) {
    if ((role === "region" || role === "form") && name.length === 0) return undefined;
    return role as LandmarkRole;
  }

  if (role === "landmark") return undefined;

  if (tagName === "section") return name.length > 0 ? "region" : undefined;
  if (tagName === "form") return name.length > 0 ? "form" : undefined;
  return SEMANTIC_TAG_TO_ROLE[tagName];
}

function area(rect: Rect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function overlapArea(a: Rect, b: Rect): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function cellRect(cell: LandscapeCellDiff): Rect {
  return { left: cell.x, top: cell.y, width: cell.width, height: cell.height };
}

function heatmapRect(region: HeatmapRegion): Rect {
  return { left: region.left, top: region.top, width: region.width, height: region.height };
}

function dominantKinds(regions: HeatmapRegion[]): string[] {
  const kinds = new Set<string>();
  for (const region of regions) {
    if (region.kind && region.kind !== "unknown") kinds.add(region.kind);
  }
  return [...kinds];
}

function isNone(value: string): boolean {
  return value === "" || value === "none" || value === "auto";
}

function hasBound(value: string): boolean {
  return !isNone(value) && value !== "0px";
}

function isScrollableOverflow(value: string): boolean {
  return value === "auto" || value === "scroll";
}

export function describeLandmarkLayoutContract(
  contract: LandmarkLayoutContract,
): LandmarkLayoutSummary {
  const minW = hasBound(contract.minWidth) ? contract.minWidth : "";
  const maxW = hasBound(contract.maxWidth) ? contract.maxWidth : "";
  const width = minW && maxW
    ? `bounded ${minW}..${maxW}`
    : maxW
      ? `bounded max ${maxW}`
      : minW
        ? `bounded min ${minW}`
        : contract.clientWidth > 0
          ? `fluid measured ${Math.round(contract.clientWidth)}px`
          : "fluid-unbounded";

  const canScrollX = isScrollableOverflow(contract.overflowX)
    && contract.scrollWidth > contract.clientWidth + 1;
  const canScrollY = isScrollableOverflow(contract.overflowY)
    && contract.scrollHeight > contract.clientHeight + 1;
  const scroll: LandmarkLayoutSummary["scroll"] = canScrollX && canScrollY
    ? "xy"
    : canScrollX
      ? "x"
      : canScrollY
        ? "y"
        : "none";

  const minH = hasBound(contract.minHeight) ? contract.minHeight : "";
  const maxH = hasBound(contract.maxHeight) ? contract.maxHeight : "";
  const height = scroll === "y" || scroll === "xy"
    ? "scrollport-y"
    : maxH
      ? `bounded max ${maxH}`
      : minH
        ? `bounded min ${minH}`
        : "content";

  const display = contract.display;
  const usesGrid = display.includes("grid");
  const gridParts: string[] = [];
  if (usesGrid) {
    gridParts.push(display);
    if (contract.gridTemplateColumns.includes("subgrid")) gridParts.push("subgrid-columns");
    if (contract.gridTemplateRows.includes("subgrid")) gridParts.push("subgrid-rows");
  }
  const grid = usesGrid ? gridParts.join(" ") : display;

  return { width, height, scroll, grid };
}

export function describeScrollportStatus(region: ScrollportRegion): ScrollportStatus {
  const contentOverflowsX = region.scrollWidth > region.clientWidth + 1;
  const contentOverflowsY = region.scrollHeight > region.clientHeight + 1;
  const scrollableX = isScrollableOverflow(region.overflowX) && contentOverflowsX;
  const scrollableY = isScrollableOverflow(region.overflowY) && contentOverflowsY;
  const scroll: ScrollportStatus["scroll"] = scrollableX && scrollableY
    ? "xy"
    : scrollableX
      ? "x"
      : scrollableY
        ? "y"
        : "none";

  if (scroll !== "none") {
    return { status: "ok", scroll, reason: "independent scrollport" };
  }
  if (contentOverflowsX || contentOverflowsY) {
    return {
      status: "broken",
      scroll,
      reason: "content overflows but overflow is not scrollable",
    };
  }
  return {
    status: "empty",
    scroll,
    reason: "marked as scrollport but content does not overflow",
  };
}

export function buildSemanticDrilldown(input: SemanticDrilldownInput): SemanticDrilldownEntry[] {
  const rows: SemanticDrilldownEntry[] = [];

  for (const landmark of input.landmarks) {
    const landmarkArea = Math.max(1, area(landmark.bbox));
    const overlappingCells = input.landscapeCells.filter((cell) =>
      overlapArea(landmark.bbox, cellRect(cell)) > 0,
    );
    const overlappingHeatmap = input.heatmapRegions.filter((region) =>
      overlapArea(landmark.bbox, heatmapRect(region)) > 0,
    );
    if (overlappingCells.length === 0 && overlappingHeatmap.length === 0) continue;

    let layoutWeighted = 0;
    let layoutWeight = 0;
    for (const cell of overlappingCells) {
      const weight = overlapArea(landmark.bbox, cellRect(cell)) / Math.max(1, area(cellRect(cell)));
      layoutWeighted += cell.score * weight;
      layoutWeight += weight;
    }
    const layoutScore = layoutWeight > 0 ? layoutWeighted / layoutWeight : 0;

    let heatmapArea = 0;
    for (const region of overlappingHeatmap) {
      heatmapArea += overlapArea(landmark.bbox, heatmapRect(region));
    }
    const decorationScore = Math.min(1, heatmapArea / landmarkArea);
    const flow = layoutScore >= 0.08 ? "layout" : "decoration";
    const priorityScore = flow === "layout"
      ? layoutScore + decorationScore * 0.25
      : decorationScore + layoutScore * 0.25;
    const kinds = dominantKinds(overlappingHeatmap);
    const reason = flow === "layout"
      ? "coarse landscape cells changed inside this landmark; fix geometry, spacing, and section placement first"
      : kinds.length > 0
        ? `local ${kinds.join("/")} diff inside a stable landmark; fix paint, media, or copy after layout`
        : "local pixel diff inside a stable landmark; inspect decorative details";

    rows.push({
      landmark,
      flow,
      priorityScore,
      layoutScore,
      decorationScore,
      landscapeCells: overlappingCells,
      heatmapRegions: overlappingHeatmap,
      reason,
    });
  }

  return rows.sort((a, b) =>
    b.priorityScore - a.priorityScore || a.landmark.order - b.landmark.order,
  );
}

export function selectNextSemanticDrilldown(
  entries: SemanticDrilldownEntry[],
): SemanticDrilldownEntry | undefined {
  return entries
    .filter((entry) => entry.flow === "layout")
    .sort((a, b) => b.priorityScore - a.priorityScore || a.landmark.order - b.landmark.order)[0]
    ?? entries[0];
}

export async function captureLandmarkRegions(
  page: Page,
  options: { deviceScaleFactor?: number } = {},
): Promise<LandmarkRegion[]> {
  const dpr = options.deviceScaleFactor ?? 1;
  return await page.evaluate(({ roles, dpr }) => {
    const roleSet = new Set(roles);
    const semantic: Record<string, string | undefined> = {
      header: "banner",
      aside: "complementary",
      footer: "contentinfo",
      main: "main",
      nav: "navigation",
      search: "search",
    };
    const selector = [
      "header",
      "nav",
      "main",
      "aside",
      "footer",
      "section",
      "form",
      "search",
      ...roles.map((role) => `[role="${role}"]`),
      "[role=\"landmark\"]",
    ].join(",");

    function textOf(id: string): string {
      const el = document.getElementById(id);
      return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    function accessibleName(el: Element): string {
      const ariaLabel = el.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledby = el.getAttribute("aria-labelledby")?.trim();
      if (labelledby) {
        const label = labelledby.split(/\s+/).map(textOf).filter(Boolean).join(" ").trim();
        if (label) return label;
      }
      const heading = el.querySelector("h1,h2,h3,h4,h5,h6");
      return (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    function normalizedRole(el: Element, name: string): string | undefined {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role")?.trim().toLowerCase();
      if (role && roleSet.has(role)) {
        if ((role === "region" || role === "form") && name.length === 0) return undefined;
        return role;
      }
      if (role === "landmark") return undefined;
      if (tag === "section") return name.length > 0 ? "region" : undefined;
      if (tag === "form") return name.length > 0 ? "form" : undefined;
      return semantic[tag];
    }

    function domPath(el: Element): string {
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.documentElement) {
        const tag = cur.tagName.toLowerCase();
        const parent = cur.parentElement;
        if (!parent) {
          parts.push(`${tag}[0]`);
          break;
        }
        const siblings = Array.from(parent.children).filter((s) =>
          s.tagName.toLowerCase() === tag,
        );
        const index = Math.max(0, siblings.indexOf(cur));
        parts.push(`${tag}[${index}]`);
        cur = parent;
      }
      return parts.reverse().join(">");
    }

    const out: LandmarkRegion[] = [];
    let order = 0;
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const name = accessibleName(el);
      const role = normalizedRole(el, name);
      if (!role) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      out.push({
        role: role as LandmarkRole,
        name,
        path: domPath(el),
        bbox: {
          left: Math.round(rect.left * dpr),
          top: Math.round(rect.top * dpr),
          width: Math.round(rect.width * dpr),
          height: Math.round(rect.height * dpr),
        },
        layout: {
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
          gridTemplateRows: style.gridTemplateRows,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          clientWidth: Math.round((el as HTMLElement).clientWidth * dpr),
          clientHeight: Math.round((el as HTMLElement).clientHeight * dpr),
          scrollWidth: Math.round((el as HTMLElement).scrollWidth * dpr),
          scrollHeight: Math.round((el as HTMLElement).scrollHeight * dpr),
        },
        order: order++,
      });
    }
    return out;
  }, { roles: LANDMARK_ROLE_VALUES, dpr });
}

export async function captureScrollportRegions(
  page: Page,
  options: { deviceScaleFactor?: number } = {},
): Promise<ScrollportRegion[]> {
  const dpr = options.deviceScaleFactor ?? 1;
  return await page.evaluate(({ dpr }) => {
    const selector = [
      "[data-scrollport]",
      "[data-vlmkit-scrollport]",
      "[data-ui-scrollport]",
      "[data-scroll-region]",
    ].join(",");

    function domPath(el: Element): string {
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.documentElement) {
        const tag = cur.tagName.toLowerCase();
        const parent = cur.parentElement;
        if (!parent) {
          parts.push(`${tag}[0]`);
          break;
        }
        const siblings = Array.from(parent.children).filter((s) =>
          s.tagName.toLowerCase() === tag,
        );
        const index = Math.max(0, siblings.indexOf(cur));
        parts.push(`${tag}[${index}]`);
        cur = parent;
      }
      return parts.reverse().join(">");
    }

    function scrollportName(el: Element): string {
      return el.getAttribute("data-scrollport")?.trim()
        || el.getAttribute("data-vlmkit-scrollport")?.trim()
        || el.getAttribute("data-ui-scrollport")?.trim()
        || el.getAttribute("data-scroll-region")?.trim()
        || el.getAttribute("aria-label")?.trim()
        || el.id
        || domPath(el);
    }

    const out: ScrollportRegion[] = [];
    let order = 0;
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const element = el as HTMLElement;
      out.push({
        name: scrollportName(el),
        path: domPath(el),
        bbox: {
          left: Math.round(rect.left * dpr),
          top: Math.round(rect.top * dpr),
          width: Math.round(rect.width * dpr),
          height: Math.round(rect.height * dpr),
        },
        order: order++,
        explicit: true,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        clientWidth: Math.round(element.clientWidth * dpr),
        clientHeight: Math.round(element.clientHeight * dpr),
        scrollWidth: Math.round(element.scrollWidth * dpr),
        scrollHeight: Math.round(element.scrollHeight * dpr),
      });
    }
    return out;
  }, { dpr });
}
