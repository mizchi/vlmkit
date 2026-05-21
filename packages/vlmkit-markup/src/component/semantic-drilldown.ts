import type { Page } from "playwright";
import type { LandscapeCellDiff } from "@mizchi/vlmkit-core/landscape-diff.ts";
import type { HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import {
  computeSemanticDrilldownPolicy,
  selectMarkupCoreSemanticDrilldownIndex,
  type MarkupCoreSemanticDrilldownReasonId,
} from "../markup-core-runtime.ts";

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
  slots?: LandmarkSlotSummary[];
  repeat?: LandmarkRepeatSummary;
  content?: LandmarkContentSummary;
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

export type LandmarkSlotKind =
  | "content"
  | "media"
  | "control"
  | "list"
  | "canvas"
  | "adornment";

export type LandmarkSlotMarker =
  | "primary-cta"
  | "next-section"
  | "media-slot"
  | "hero-title"
  | "scrollport"
  | "selected"
  | "unread"
  | "game-state"
  | "custom";

export interface LandmarkSlotSummary {
  id: string;
  kind: LandmarkSlotKind;
  name?: string;
  marker?: LandmarkSlotMarker;
  gridArea?: string;
  required?: boolean;
}

export interface LandmarkRepeatSummary {
  kind: "list" | "grid" | "table" | "feed";
  itemName?: string;
  itemCount: number;
}

export interface LandmarkContentSummary {
  kind: "static" | "list" | "table" | "chart" | "form" | "canvas" | "generated";
  density?: "sparse" | "normal" | "dense";
  itemCount?: number;
  textLength?: number;
  textRowCount?: number;
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

function formatSemanticDrilldownReason(
  reasonId: MarkupCoreSemanticDrilldownReasonId,
  kinds: string[],
): string {
  if (reasonId === "coarse-landscape") {
    return "coarse landscape cells changed inside this landmark; fix geometry, spacing, and section placement first";
  }
  if (reasonId === "local-kinds" && kinds.length > 0) {
    return `local ${kinds.join("/")} diff inside a stable landmark; fix paint, media, or copy after layout`;
  }
  return "local pixel diff inside a stable landmark; inspect decorative details";
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
    const kinds = dominantKinds(overlappingHeatmap);
    const policy = computeSemanticDrilldownPolicy(
      layoutScore,
      decorationScore,
      kinds.length,
    );

    rows.push({
      landmark,
      flow: policy.flow,
      priorityScore: policy.priorityScore,
      layoutScore,
      decorationScore,
      landscapeCells: overlappingCells,
      heatmapRegions: overlappingHeatmap,
      reason: formatSemanticDrilldownReason(policy.reasonId, kinds),
    });
  }

  return rows.sort((a, b) =>
    b.priorityScore - a.priorityScore || a.landmark.order - b.landmark.order,
  );
}

export function selectNextSemanticDrilldown(
  entries: SemanticDrilldownEntry[],
): SemanticDrilldownEntry | undefined {
  const index = selectMarkupCoreSemanticDrilldownIndex(entries.map((entry) => ({
    flow: entry.flow,
    priorityScore: entry.priorityScore,
    order: entry.landmark.order,
  })));
  return index === undefined ? undefined : entries[index];
}

export async function captureLandmarkRegions(
  page: Page,
  options: { deviceScaleFactor?: number } = {},
): Promise<LandmarkRegion[]> {
  const dpr = options.deviceScaleFactor ?? 1;
  return await page.evaluate(({ roles, dpr }) => {
    const roleSet = new Set<string>(roles);
    const semantic: Record<string, LandmarkRole | undefined> = {
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

    function normalizedRole(el: Element, name: string): LandmarkRole | undefined {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role")?.trim().toLowerCase();
      if (role && roleSet.has(role)) {
        if ((role === "region" || role === "form") && name.length === 0) return undefined;
        return role as LandmarkRole;
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
        const parent: Element | null = cur.parentElement;
        if (!parent) {
          parts.push(`${tag}[0]`);
          break;
        }
        const siblings = Array.from(parent.children as HTMLCollectionOf<Element>).filter((s: Element) =>
          s.tagName.toLowerCase() === tag,
        );
        const index = Math.max(0, siblings.indexOf(cur));
        parts.push(`${tag}[${index}]`);
        cur = parent;
      }
      return parts.reverse().join(">");
    }

    function visibleDescendants(el: Element, selector: string): Element[] {
      return Array.from(el.querySelectorAll(selector)).filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return false;
        const style = getComputedStyle(candidate);
        return style.display !== "none" && style.visibility !== "hidden";
      });
    }

    function directContentChildren(el: Element): Element[] {
      return Array.from(el.children).filter((child) => {
        const rect = child.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return false;
        const text = (child.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!text) return false;
        const style = getComputedStyle(child);
        return style.display !== "none" && style.visibility !== "hidden";
      });
    }

    function textRowCount(el: Element): number {
      const rows = visibleDescendants(el, [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "li",
        "button",
        "[data-menu-item]",
        "[data-repeat-item]",
        "td",
        "th",
        "figcaption",
      ].join(",")).filter((candidate) =>
        (candidate.textContent ?? "").replace(/\s+/g, " ").trim().length > 0,
      );
      return rows.length;
    }

    function captureLandmarkDetails(
      el: Element,
      role: LandmarkRole,
      style: CSSStyleDeclaration,
      rect: DOMRect,
    ): Pick<LandmarkRegion, "slots" | "repeat" | "content"> {
      const controls = visibleDescendants(el, [
        "button",
        "a[href]",
        "input",
        "select",
        "textarea",
        "[role=\"button\"]",
        "[role=\"menuitem\"]",
        "[data-menu-item]",
      ].join(","));
      const headings = visibleDescendants(el, "h1,h2,h3,h4,h5,h6,[data-hero-title]");
      const media = visibleDescendants(el, "img,picture,video,[data-media-slot]");
      const canvases = visibleDescendants(el, "canvas");
      const adornments = visibleDescendants(el, "[data-shape]");
      const explicitItems = visibleDescendants(el, "[data-repeat-item],[data-menu-item],li,article,tr");
      const directChildren = directContentChildren(el);
      const repeatItems = explicitItems.length >= 2
        ? explicitItems
        : role === "navigation" && controls.length >= 2
          ? controls
          : (style.display.includes("grid") || style.display.includes("flex")) && directChildren.length >= 3
            ? directChildren
            : [];

      const slots: LandmarkSlotSummary[] = [];
      if (headings.length > 0) {
        slots.push({ id: "title", kind: "content", required: true });
      }
      if (controls.length > 0) {
        slots.push({
          id: "controls",
          kind: "control",
          ...(hasSelected(controls) ? { marker: "selected" } : {}),
          required: true,
        });
      }
      if (media.length > 0) {
        slots.push({ id: "media", kind: "media", marker: "media-slot", required: true });
      }
      if (canvases.length > 0) {
        slots.push({ id: "canvas", kind: "canvas", required: true });
      }
      if (adornments.length > 0) {
        slots.push({ id: "adornment", kind: "adornment" });
      }

      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      const rows = textRowCount(el);
      const itemCount = repeatItems.length >= 2 ? repeatItems.length : undefined;
      const content: LandmarkContentSummary = {
        kind: inferContentKind(el, role, canvases.length, itemCount),
        density: inferDensity(text.length, rect),
        ...(itemCount !== undefined ? { itemCount } : {}),
        ...(text.length > 0 ? { textLength: text.length } : {}),
        ...(rows > 0 ? { textRowCount: rows } : {}),
      };
      const repeat = itemCount !== undefined
        ? {
            kind: inferRepeatKind(style, repeatItems),
            itemName: inferItemName(repeatItems[0]!),
            itemCount,
          }
        : undefined;

      return {
        ...(slots.length > 0 ? { slots } : {}),
        ...(repeat ? { repeat } : {}),
        content,
      };
    }

    function hasSelected(elements: Element[]): boolean {
      return elements.some((el) =>
        el.matches("[data-selected=\"true\"], [aria-current=\"page\"]")
        || el.querySelector("[data-selected=\"true\"], [aria-current=\"page\"]") !== null,
      );
    }

    function inferContentKind(
      el: Element,
      role: LandmarkRole,
      canvasCount: number,
      itemCount: number | undefined,
    ): LandmarkContentSummary["kind"] {
      if (canvasCount > 0) return "canvas";
      if (el.tagName.toLowerCase() === "form" || role === "form") return "form";
      if (el.querySelector("table")) return "table";
      if (itemCount !== undefined) return "list";
      return "static";
    }

    function inferDensity(textLength: number, rect: DOMRect): LandmarkContentSummary["density"] {
      const area = Math.max(1, rect.width * rect.height);
      const perKpx = textLength / (area / 1000);
      if (perKpx >= 2.5) return "dense";
      if (perKpx >= 0.7) return "normal";
      return "sparse";
    }

    function inferRepeatKind(
      style: CSSStyleDeclaration,
      items: Element[],
    ): LandmarkRepeatSummary["kind"] {
      if (items[0]?.tagName.toLowerCase() === "tr") return "table";
      const columns = style.gridTemplateColumns.split(/\s+/).filter(Boolean);
      if (style.display.includes("grid") && columns.length > 1) return "grid";
      return "list";
    }

    function inferItemName(item: Element): string {
      const explicit = item.getAttribute("data-repeat-item") || item.getAttribute("data-menu-item");
      if (explicit) return explicit.trim() || "item";
      const tag = item.tagName.toLowerCase();
      if (tag === "article") return "article";
      if (tag === "tr") return "row";
      if (tag === "button") return "control";
      return "item";
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
      const details = captureLandmarkDetails(el, role, style, rect);
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
        ...details,
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
        const parent: Element | null = cur.parentElement;
        if (!parent) {
          parts.push(`${tag}[0]`);
          break;
        }
        const siblings = Array.from(parent.children as HTMLCollectionOf<Element>).filter((s: Element) =>
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
