import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  captureLandmarkRegions,
  type LandmarkLayoutContract,
  type LandmarkRegion,
} from "../component/semantic-drilldown.ts";
import {
  summarizeUiContractScreen,
  summarizeUiContractLandmark,
  validateUiContract,
  type UiContract,
  type UiAssetContract,
  type UiContractLandmark,
  type UiContractGoal,
  type UiContractPattern,
  type UiCanvasContract,
  type UiContractViewport,
  type UiDisplayPolicy,
  type UiHeightPolicy,
  type UiLayoutContract,
  type UiMarkerContract,
  type UiScrollPolicy,
  type UiStateContract,
  type UiWidthPolicy,
} from "./ui-contract.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface LandmarkCapture {
  viewport: string;
  landmarks: LandmarkRegion[];
}

export interface LandmarkRegionsToUiContractInput {
  screenId: string;
  pattern?: UiContractPattern;
  goal?: UiContractGoal;
  viewports: UiContractViewport[];
  captures: LandmarkCapture[];
  hints?: UiContractDomHints;
}

export interface IntrospectUiContractOptions {
  input: string;
  screenId?: string;
  pattern?: UiContractPattern;
  goal?: UiContractGoal;
  viewports?: UiContractViewport[];
  outputPath?: string;
}

export interface UiContractDomHints {
  markers?: UiMarkerContract[];
  states?: UiStateContract[];
  assets?: UiAssetContract[];
  canvas?: UiCanvasContract;
}

const DEFAULT_VIEWPORTS: UiContractViewport[] = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

function parsePx(value: string | undefined): number | undefined {
  if (!value || value === "none" || value === "auto") return undefined;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function splitTrackList(value: string): string[] {
  if (!value || value === "none") return [];
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (/\s/u.test(ch) && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function layoutContractToUiLayout(layout: LandmarkLayoutContract): UiLayoutContract {
  const minWidth = parsePx(layout.minWidth);
  const maxWidth = parsePx(layout.maxWidth);
  const width: UiWidthPolicy = maxWidth !== undefined || minWidth !== undefined
    ? { kind: "fluid", ...(minWidth !== undefined ? { min: minWidth } : {}), ...(maxWidth !== undefined ? { max: maxWidth } : {}) }
    : { kind: "fluid" };

  const maxHeight = parsePx(layout.maxHeight);
  const minHeight = parsePx(layout.minHeight);
  const scroll = scrollPolicy(layout);
  const height: UiHeightPolicy = scroll.y && maxHeight !== undefined
    ? { kind: "scrollport", ...(minHeight !== undefined ? { min: minHeight } : {}), max: maxHeight }
    : { kind: "content", ...(minHeight !== undefined ? { min: minHeight } : {}), ...(maxHeight !== undefined ? { max: maxHeight } : {}) };

  return {
    width,
    height,
    display: displayPolicy(layout),
    scroll,
  };
}

function scrollPolicy(layout: LandmarkLayoutContract): UiScrollPolicy {
  const scrollableX = (layout.overflowX === "auto" || layout.overflowX === "scroll")
    && layout.scrollWidth > layout.clientWidth + 1;
  const scrollableY = (layout.overflowY === "auto" || layout.overflowY === "scroll")
    && layout.scrollHeight > layout.clientHeight + 1;
  return { x: scrollableX, y: scrollableY };
}

function displayPolicy(layout: LandmarkLayoutContract): UiDisplayPolicy {
  const cols = splitTrackList(layout.gridTemplateColumns);
  const rows = splitTrackList(layout.gridTemplateRows);
  const colSubgrid = cols.includes("subgrid");
  const rowSubgrid = rows.includes("subgrid");
  if (colSubgrid || rowSubgrid) {
    return {
      kind: "subgrid",
      axis: colSubgrid && rowSubgrid ? "both" : colSubgrid ? "columns" : "rows",
    };
  }
  if (layout.display.includes("grid")) {
    return {
      kind: "grid",
      columns: cols.length > 0 ? cols : ["1fr"],
      rows: rows.length > 0 ? rows : ["auto"],
    };
  }
  if (layout.display.includes("flex")) {
    return { kind: "flex", direction: "row" };
  }
  return { kind: "block" };
}

export function landmarkRegionsToUiContract(
  input: LandmarkRegionsToUiContractInput,
): UiContract {
  const baseCapture = input.captures[0];
  const landmarks = (baseCapture?.landmarks ?? []).map((landmark): UiContractLandmark => ({
    id: landmarkId(landmark),
    role: landmark.role,
    name: landmark.name,
    layout: landmark.layout
      ? layoutContractToUiLayout(landmark.layout)
      : {
          width: { kind: "fluid" },
          height: { kind: "content" },
          display: { kind: "block" },
          scroll: { x: false, y: false },
        },
  }));

  return {
    version: 1,
    screens: [{
      id: input.screenId,
      ...(input.pattern ? { pattern: input.pattern } : {}),
      ...(input.goal ? { goal: input.goal } : {}),
      viewports: input.viewports,
      ...(input.hints?.markers?.length ? { markers: input.hints.markers } : {}),
      ...(input.hints?.states?.length ? { states: input.hints.states } : {}),
      ...(input.hints?.assets?.length ? { assets: input.hints.assets } : {}),
      ...(input.hints?.canvas ? { canvas: input.hints.canvas } : {}),
      landmarks,
    }],
  };
}

function landmarkId(landmark: LandmarkRegion): string {
  const raw = `${landmark.role}-${landmark.name || landmark.path || landmark.order}`;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `${landmark.role}-${landmark.order}`;
}

export async function introspectUiContractFromHtml(
  options: IntrospectUiContractOptions,
): Promise<UiContract> {
  const viewports = options.viewports ?? DEFAULT_VIEWPORTS;
  const input = options.input;
  const screenId = options.screenId ?? (basename(input).replace(/\.[^.]+$/, "") || "screen");
  const browser = await chromium.launch();
  const captures: LandmarkCapture[] = [];
  let hints: UiContractDomHints | undefined;
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.dpr ?? 1,
      });
      const target = /^https?:\/\//u.test(input)
        ? input
        : pathToFileURL(resolve(input)).toString();
      await page.goto(target, { waitUntil: "networkidle" });
      const landmarks = await captureLandmarkRegions(page, {
        deviceScaleFactor: viewport.dpr ?? 1,
      });
      if (!hints) hints = await captureUiContractDomHints(page);
      captures.push({ viewport: viewport.label, landmarks });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return landmarkRegionsToUiContract({
    screenId,
    pattern: options.pattern,
    goal: options.goal,
    viewports,
    captures,
    hints,
  });
}

async function captureUiContractDomHints(page: import("playwright").Page): Promise<UiContractDomHints> {
  return await page.evaluate(() => {
    type Hint = {
      markers?: UiMarkerContract[];
      states?: UiStateContract[];
      assets?: UiAssetContract[];
      canvas?: UiCanvasContract;
    };

    function has(selector: string): boolean {
      return document.querySelector(selector) !== null;
    }

    const markers: UiMarkerContract[] = [];
    if (has("[data-primary-cta]")) {
      markers.push({ kind: "primary-cta", selector: "[data-primary-cta]", attribute: "data-primary-cta", required: true });
    }
    if (has("[data-next-section]")) {
      markers.push({ kind: "next-section", selector: "[data-next-section]", attribute: "data-next-section", required: true });
    }
    if (has("[data-media-slot]")) {
      markers.push({ kind: "media-slot", selector: "[data-media-slot]", attribute: "data-media-slot", required: true });
    }
    if (has("[data-hero-title]")) {
      markers.push({ kind: "hero-title", selector: "[data-hero-title]", attribute: "data-hero-title" });
    }

    for (const el of Array.from(document.querySelectorAll("[data-scrollport], [data-vlmkit-scrollport], [data-ui-scrollport], [data-scroll-region]"))) {
      const value = el.getAttribute("data-scrollport")
        || el.getAttribute("data-vlmkit-scrollport")
        || el.getAttribute("data-ui-scrollport")
        || el.getAttribute("data-scroll-region")
        || "";
      const attribute = el.hasAttribute("data-scrollport")
        ? "data-scrollport"
        : el.hasAttribute("data-vlmkit-scrollport")
          ? "data-vlmkit-scrollport"
          : el.hasAttribute("data-ui-scrollport")
            ? "data-ui-scrollport"
            : "data-scroll-region";
      markers.push({
        kind: "scrollport",
        name: value || undefined,
        attribute,
        value: value || undefined,
        selector: value ? `[${attribute}="${value}"]` : `[${attribute}]`,
        required: true,
      });
    }

    if (has("[aria-current=\"page\"], [data-selected=\"true\"]")) {
      markers.push({ kind: "selected", selector: "[aria-current=\"page\"], [data-selected=\"true\"]" });
    }
    if (has("[data-unread], [data-unread=\"true\"]")) {
      markers.push({ kind: "unread", selector: "[data-unread], [data-unread=\"true\"]" });
    }

    const states: UiStateContract[] = [];
    if (has("[aria-current=\"page\"], [data-selected=\"true\"]")) {
      states.push({ id: "selected", kind: "selected", selector: "[aria-current=\"page\"], [data-selected=\"true\"]" });
    }

    const assets: UiAssetContract[] = [];
    let assetIndex = 0;
    for (const img of Array.from(document.querySelectorAll("img"))) {
      assets.push({
        id: img.id || img.getAttribute("data-media-slot") || `image-${assetIndex++}`,
        kind: "image",
        policy: "replaceable",
        slot: img.getAttribute("data-media-slot") || undefined,
      });
    }
    if (document.querySelector("svg")) {
      assets.push({ id: "inline-svg", kind: "svg", policy: "literal" });
    }
    const canvasElements = Array.from(document.querySelectorAll("canvas"));
    for (let i = 0; i < canvasElements.length; i++) {
      assets.push({ id: canvasElements[i]!.id || `canvas-${i}`, kind: "procedural", policy: "procedural" });
    }

    const gameState = (window as unknown as { __gameState?: unknown }).__gameState;
    const canvas: UiCanvasContract | undefined = canvasElements.length > 0
      ? {
          ...(gameState !== undefined ? { stateHook: "window.__gameState" } : {}),
          ...(gameState && typeof gameState === "object" ? { requiredStateFields: Object.keys(gameState as Record<string, unknown>) } : {}),
        }
      : undefined;
    if (gameState !== undefined) {
      markers.push({ kind: "game-state", target: "window.__gameState", required: true });
    }

    const hint: Hint = {};
    if (markers.length > 0) hint.markers = markers;
    if (states.length > 0) hint.states = states;
    if (assets.length > 0) hint.assets = assets;
    if (canvas) hint.canvas = canvas;
    return hint;
  });
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const viewports: UiContractViewport[] = [];
  let out = "";
  let screenId = "";
  let pattern = "";
  let goal = "";
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--out" || arg === "-o") out = argv[++i] ?? "";
    else if (arg === "--screen-id") screenId = argv[++i] ?? "";
    else if (arg === "--pattern") pattern = argv[++i] ?? "";
    else if (arg === "--goal") goal = argv[++i] ?? "";
    else if (arg === "--viewport") viewports.push(parseViewport(argv[++i] ?? ""));
    else positional.push(arg);
  }
  return { input: positional[0], out, screenId, pattern, goal, viewports, help };
}

function parseViewport(raw: string): UiContractViewport {
  const match = raw.match(/^([^:]+):(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/u);
  if (!match) throw new Error(`Invalid --viewport: ${raw}. Expected label:WIDTHxHEIGHT[@DPR]`);
  return {
    label: match[1]!,
    width: Number(match[2]),
    height: Number(match[3]),
    ...(match[4] ? { dpr: Number(match[4]) } : {}),
  };
}

function printHelp(): void {
  console.log("Usage: vlmkit contract introspect <html-file-or-url> [options]");
  console.log("Options:");
  console.log("  --out, -o <path>                 Write UI Contract JSON");
  console.log("  --screen-id <id>                 Screen id (default: input basename)");
  console.log("  --pattern <name>                 Optional pattern: editorial|landing|app-shell|dashboard|canvas|mixed");
  console.log("  --goal <name>                    Optional validation goal: app|layout|pixel|draft|app-shell|landing|canvas");
  console.log("  --viewport <label:WxH[@DPR]>     Capture viewport; repeatable");
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || !args.input) {
    printHelp();
    if (!args.input && !args.help) process.exit(1);
    return;
  }
  const contract = await introspectUiContractFromHtml({
    input: args.input,
    screenId: args.screenId || undefined,
    pattern: args.pattern ? args.pattern as UiContractPattern : undefined,
    goal: args.goal ? args.goal as UiContractGoal : undefined,
    viewports: args.viewports.length > 0 ? args.viewports : undefined,
  });
  const issues = validateUiContract(contract);
  const json = JSON.stringify(contract, null, 2);
  if (args.out) {
    await writeFile(args.out, json);
    console.log(`UI Contract written to: ${args.out}`);
  } else {
    console.log(json);
  }
  const screen = contract.screens[0];
  if (screen) console.error(`- ${summarizeUiContractScreen(screen)}`);
  for (const landmark of screen?.landmarks ?? []) {
    console.error(`- ${summarizeUiContractLandmark(landmark)}`);
  }
  if (issues.length > 0) {
    console.error(`\n${issues.length} validation issue(s):`);
    for (const issue of issues) console.error(`- ${issue.path}: ${issue.message}`);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "contract-introspect"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
