/**
 * UI Contract IR → HTML/CSS scaffold compiler.
 *
 * The reverse direction of `contract introspect`: given a UiContract JSON,
 * emit a semantic, landmark-faithful HTML skeleton with grid/flex CSS that
 * satisfies the contract's layout / responsive / slot / marker / state
 * declarations. The scaffold is a *starting point* for an agent's decoration
 * pass — placeholders are visibly placeholders, but the landmark tree,
 * layout policies, and breakpoints are real.
 *
 * CLI: vlmkit contract scaffold <ui.contract.json> [--screen <id>] [--out <dir>]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateUiContract,
  type LandmarkRole,
  type UiContract,
  type UiContractLandmark,
  type UiContractScreen,
  type UiContractViewport,
  type UiDisplayPolicy,
  type UiExpectedScrollportContract,
  type UiHeightPolicy,
  type UiLayoutContract,
  type UiMarkerContract,
  type UiResponsiveRule,
  type UiScrollPolicy,
  type UiSlotContract,
  type UiStateContract,
  type UiWidthPolicy,
} from "./ui-contract.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export interface ScaffoldOptions {
  /** Scaffold only this screen id (default: every screen). */
  screenId?: string;
  /** Document <title>. Defaults to the screen id. */
  title?: string;
}

export interface ScaffoldedScreen {
  screenId: string;
  html: string;
  /** Landmark ids in document order, for quick assertions. */
  landmarkIds: string[];
  warnings: string[];
}

export interface ScaffoldResult {
  screens: ScaffoldedScreen[];
  issues: { path: string; message: string }[];
  /** Set when contract validation itself could not run (e.g. no moon toolchain). */
  validationSkipped?: string;
}

const ROLE_TAGS: Record<LandmarkRole, { tag: string; role?: string }> = {
  banner: { tag: "header" },
  navigation: { tag: "nav" },
  main: { tag: "main" },
  complementary: { tag: "aside" },
  contentinfo: { tag: "footer" },
  region: { tag: "section" },
  search: { tag: "form", role: "search" },
  form: { tag: "form" },
};

const PLACEHOLDER_TEXT =
  "Placeholder copy — replace during the decoration pass.";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `lm-${cleaned}`;
}

function px(value: number): string {
  return `${value}px`;
}

function widthDecls(policy: UiWidthPolicy): string[] {
  switch (policy.kind) {
    case "fluid": {
      const decls = ["width: 100%"];
      if (policy.min !== undefined) decls.push(`min-width: ${px(policy.min)}`);
      if (policy.max !== undefined) {
        decls.push(`max-width: ${px(policy.max)}`, "margin-inline: auto");
      }
      return decls;
    }
    case "fixed":
      return [`width: ${px(policy.value)}`];
    case "intrinsic": {
      const decls = ["width: fit-content"];
      if (policy.max !== undefined) decls.push(`max-width: ${px(policy.max)}`);
      return decls;
    }
  }
}

function heightDecls(policy: UiHeightPolicy): string[] {
  switch (policy.kind) {
    case "content": {
      const decls: string[] = [];
      if (policy.min !== undefined) decls.push(`min-height: ${px(policy.min)}`);
      if (policy.max !== undefined) decls.push(`max-height: ${px(policy.max)}`);
      return decls;
    }
    case "fixed":
      return [`height: ${px(policy.value)}`];
    case "scrollport": {
      const decls = [`max-height: ${px(policy.max)}`, "overflow-y: auto"];
      if (policy.min !== undefined) decls.push(`min-height: ${px(policy.min)}`);
      return decls;
    }
  }
}

function displayDecls(policy: UiDisplayPolicy): string[] {
  switch (policy.kind) {
    case "block":
      return ["display: block"];
    case "flex": {
      const decls = ["display: flex", `flex-direction: ${policy.direction}`];
      if (policy.gap !== undefined) decls.push(`gap: ${px(policy.gap)}`);
      return decls;
    }
    case "grid": {
      const decls = [
        "display: grid",
        `grid-template-columns: ${policy.columns.join(" ")}`,
      ];
      if (policy.rows.length > 0) {
        decls.push(`grid-template-rows: ${policy.rows.join(" ")}`);
      }
      if (policy.areas && policy.areas.length > 0) {
        const areas = policy.areas.map((row) => `"${row.join(" ")}"`).join(" ");
        decls.push(`grid-template-areas: ${areas}`);
      }
      if (policy.gap) {
        const row = policy.gap.row ?? 0;
        const column = policy.gap.column ?? row;
        decls.push(`gap: ${px(row)} ${px(column)}`);
      }
      return decls;
    }
    case "subgrid": {
      const decls = ["display: grid"];
      if (policy.axis === "rows" || policy.axis === "both") {
        decls.push("grid-template-rows: subgrid");
      }
      if (policy.axis === "columns" || policy.axis === "both") {
        decls.push("grid-template-columns: subgrid");
      }
      return decls;
    }
  }
}

function scrollDecls(policy: UiScrollPolicy, height: UiHeightPolicy): string[] {
  const decls: string[] = [];
  if (policy.x) decls.push("overflow-x: auto");
  // scrollport height already emits overflow-y.
  if (policy.y && height.kind !== "scrollport") decls.push("overflow-y: auto");
  return decls;
}

function layoutDecls(layout: UiLayoutContract): string[] {
  return [
    ...widthDecls(layout.width),
    ...heightDecls(layout.height),
    ...displayDecls(layout.display),
    ...scrollDecls(layout.scroll, layout.height),
  ];
}

function declMap(decls: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of decls) {
    const colon = decl.indexOf(": ");
    map.set(decl.slice(0, colon), decl.slice(colon + 2));
  }
  return map;
}

/** Initial values used to clear a base declaration an override no longer sets. */
const RESET_VALUES: Record<string, string> = {
  width: "auto",
  "min-width": "auto",
  "max-width": "none",
  "margin-inline": "0",
  height: "auto",
  "min-height": "auto",
  "max-height": "none",
  "overflow-x": "visible",
  "overflow-y": "visible",
};

function responsiveDecls(rule: UiResponsiveRule, base: UiLayoutContract): string[] {
  // Compile the merged layout and diff it against the base render: emit the
  // declarations that changed, and explicitly reset base declarations the
  // merged layout no longer produces — otherwise a desktop `height`,
  // `max-height`, or `overflow` would survive inside the media rule (e.g.
  // scrollport→content would keep the desktop scroll constraints on mobile).
  const merged: UiLayoutContract = {
    width: rule.width ?? base.width,
    height: rule.height ?? base.height,
    display: rule.display ?? base.display,
    scroll: rule.scroll ?? base.scroll,
  };
  const baseDecls = declMap(layoutDecls(base));
  const mergedDecls = declMap(layoutDecls(merged));
  const decls: string[] = [];
  for (const [property, value] of mergedDecls) {
    if (baseDecls.get(property) !== value) decls.push(`${property}: ${value}`);
  }
  for (const property of baseDecls.keys()) {
    if (!mergedDecls.has(property)) {
      decls.push(`${property}: ${RESET_VALUES[property] ?? "initial"}`);
    }
  }
  return decls;
}

/**
 * Convention: the widest declared viewport is the base render; a responsive
 * rule targeting a narrower viewport compiles to `@media (max-width: W px)`,
 * a wider one to `@media (min-width: W px)`.
 */
export function mediaQueryForViewport(
  viewport: UiContractViewport,
  viewports: UiContractViewport[],
): string {
  const widest = Math.max(...viewports.map((v) => v.width));
  return viewport.width < widest
    ? `@media (max-width: ${viewport.width}px)`
    : `@media (min-width: ${viewport.width}px)`;
}

interface RenderContext {
  screen: UiContractScreen;
  childrenOf: Map<string | undefined, UiContractLandmark[]>;
  warnings: string[];
  landmarkIds: string[];
  css: string[];
  mediaCss: Map<string, string[]>;
  /** Scrollport expectations already attached to a landmark. */
  claimedScrollports: Set<string>;
  /** Screen-level selector markers re-homed onto a landmark, keyed by landmark id. */
  extraMarkers: Map<string, UiMarkerContract[]>;
}

/**
 * A scrollport expectation targets a landmark either explicitly via
 * `landmarkId`, or — for contracts round-tripped through `contract
 * introspect`, which records only a selector — when the selector's id or
 * attribute value names the landmark.
 */
function scrollportTargetsLandmark(
  scrollport: UiExpectedScrollportContract,
  landmark: UiContractLandmark,
  domId: string,
): boolean {
  if (scrollport.landmarkId) return scrollport.landmarkId === landmark.id;
  if (!scrollport.selector) return false;
  if (scrollport.selector === `#${domId}` || scrollport.selector === `#${landmark.id}`) return true;
  const attrValue = scrollport.selector.match(/^\[[^=\]]+="([^"]*)"\]$/)?.[1];
  return attrValue !== undefined
    && (attrValue === landmark.id || attrValue === domId || attrValue === landmark.name);
}

/**
 * Fallback for selector-based scrollports that name no landmark: emit a
 * standalone element that satisfies the selector and measurably scrolls,
 * so the scrolled state can still be exercised and a re-introspect
 * recovers the scrollport.
 */
function materializeScrollport(
  scrollport: UiExpectedScrollportContract,
  ctx: RenderContext,
): string {
  const idMatch = scrollport.selector?.match(/^#([a-zA-Z][\w-]*)$/)?.[1];
  const attrMatch = scrollport.selector?.match(/^\[([a-zA-Z][\w-]*)(?:="([^"]*)")?\]$/);
  const attribute = attrMatch?.[1] ?? "data-scrollport";
  const value = attrMatch?.[2] ?? scrollport.name ?? scrollport.id;
  const axis = scrollport.axis ?? "y";
  const style = axis === "x"
    ? "max-width: 100%; overflow-x: auto"
    : axis === "both"
      ? "max-height: 240px; overflow: auto"
      : "max-height: 240px; overflow-y: auto";
  const fillers: string[] = [];
  if (axis === "x" || axis === "both") fillers.push(`<div class="scroll-filler-x" aria-hidden="true"></div>`);
  if (axis === "y" || axis === "both") fillers.push(`<div class="scroll-filler-y" aria-hidden="true"></div>`);
  ctx.warnings.push(
    `scrollport ${scrollport.id}: selector "${scrollport.selector ?? ""}" names no landmark; materialized as a standalone scrollport`,
  );
  const idAttr = idMatch ? ` id="${esc(idMatch)}"` : "";
  return `<section class="scaffold-scrollport"${idAttr} aria-label="${esc(scrollport.name ?? scrollport.id)}" ${esc(attribute)}="${esc(value)}" style="${style}">${fillers.join("")}</section>`;
}

function markerAttrs(marker: UiMarkerContract): string {
  if (marker.attribute) {
    return ` ${esc(marker.attribute)}="${esc(marker.value ?? "")}"`;
  }
  return ` data-marker="${esc(marker.kind)}"`;
}

function renderMarkerElement(marker: UiMarkerContract, ctx: RenderContext): string {
  const attrs = markerAttrs(marker);
  const label = marker.name ?? marker.kind;
  switch (marker.kind) {
    case "hero-title":
      return `<h1${attrs}>${esc(label)}</h1>`;
    case "primary-cta":
      return `<a class="button"${attrs} href="#">${esc(label)}</a>`;
    case "next-section":
      return `<a class="next-link"${attrs} href="${esc(marker.target ?? "#")}">${esc(label)}</a>`;
    case "media-slot":
      return `<figure class="media-placeholder"${attrs}></figure>`;
    default:
      ctx.warnings.push(
        `marker ${marker.id ?? marker.kind}: no dedicated element; emitted as data attribute on a span`,
      );
      return `<span${attrs}>${esc(label)}</span>`;
  }
}

function renderSlot(slot: UiSlotContract, ctx: RenderContext): string {
  const gridArea = slot.gridArea ? ` style="grid-area: ${esc(slot.gridArea)}"` : "";
  const marker = slot.marker ? ` data-marker="${esc(slot.marker)}"` : "";
  const name = slot.name ?? slot.id;
  const base = `data-slot="${esc(slot.id)}"${marker}${gridArea}`;
  switch (slot.kind) {
    case "media":
      return `<figure class="slot slot-media" ${base}><div class="media-placeholder" role="img" aria-label="${esc(name)}"></div></figure>`;
    case "control":
      return `<button class="slot slot-control" type="button" ${base}>${esc(name)}</button>`;
    case "list":
      return [
        `<ul class="slot slot-list" ${base}>`,
        ...[1, 2, 3].map((n) => `  <li>${esc(name)} item ${n}</li>`),
        `</ul>`,
      ].join("\n");
    case "canvas":
      return `<canvas class="slot slot-canvas" ${base} width="320" height="180" aria-label="${esc(name)}"></canvas>`;
    case "adornment":
      return `<span class="slot slot-adornment" aria-hidden="true" ${base}></span>`;
    case "content":
      return `<div class="slot slot-content" ${base}><p>${esc(name)}: ${PLACEHOLDER_TEXT}</p></div>`;
  }
}

function renderContentPlaceholder(landmark: UiContractLandmark): string[] {
  const content = landmark.content;
  const out: string[] = [];
  if (!content) return out;
  const count = content.items?.exact ?? content.items?.min ?? 3;
  switch (content.kind) {
    case "list": {
      out.push(`<ul class="content-list">`);
      for (let i = 1; i <= count; i++) out.push(`  <li>List item ${i}</li>`);
      out.push(`</ul>`);
      break;
    }
    case "table": {
      const rows = content.text?.rowCount ?? count;
      out.push(`<table class="content-table"><thead><tr><th>Column A</th><th>Column B</th></tr></thead><tbody>`);
      for (let i = 1; i <= rows; i++) {
        out.push(`  <tr><td>Row ${i}A</td><td>Row ${i}B</td></tr>`);
      }
      out.push(`</tbody></table>`);
      break;
    }
    case "form": {
      out.push(
        `<div class="content-form">`,
        `  <label>Field one <input type="text" name="field-one" /></label>`,
        `  <label>Field two <input type="text" name="field-two" /></label>`,
        `  <button type="submit">Submit</button>`,
        `</div>`,
      );
      break;
    }
    case "chart":
      out.push(`<div class="chart-placeholder" role="img" aria-label="Chart placeholder"></div>`);
      break;
    case "canvas":
      out.push(`<canvas class="content-canvas" width="640" height="360" aria-label="Canvas placeholder"></canvas>`);
      break;
    default: {
      const rows = content.text?.rowCount ?? 1;
      for (let i = 0; i < rows; i++) out.push(`<p>${PLACEHOLDER_TEXT}</p>`);
    }
  }
  return out;
}

function renderRepeat(landmark: UiContractLandmark): string[] {
  const repeat = landmark.repeat;
  if (!repeat) return [];
  const count = repeat.minItems ?? 3;
  const name = repeat.itemName ?? "item";
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    out.push(
      `<article class="repeat-item" data-repeat-item="${esc(name)}">`,
      `  <h3>${esc(name)} ${i}</h3>`,
      `  <p>${PLACEHOLDER_TEXT}</p>`,
      `</article>`,
    );
  }
  return out;
}

function stateCss(landmarkSelector: string, states: UiStateContract[], css: string[]): void {
  for (const state of states) {
    const target = state.selector ?? `${landmarkSelector} .button, ${landmarkSelector} button`;
    switch (state.kind) {
      case "hover":
        css.push(`/* contract state: ${state.id} */`);
        css.push(`${target.split(", ").map((s) => `${s}:hover`).join(", ")} { filter: brightness(0.94); }`);
        break;
      case "focus-visible":
        css.push(`/* contract state: ${state.id} */`);
        css.push(
          `${target.split(", ").map((s) => `${s}:focus-visible`).join(", ")} { outline: 2px solid var(--color-accent, #2563eb); outline-offset: 2px; }`,
        );
        break;
      case "selected":
        css.push(`/* contract state: ${state.id} */`);
        css.push(`${target}[aria-selected="true"], ${target}[data-selected="true"] { background: var(--color-accent-soft, #dbeafe); }`);
        break;
      default:
        // Behavioral states (loading / error / playing / ...) need runtime
        // wiring the scaffold cannot provide; leave a hook only.
        css.push(`/* contract state ${state.id} (${state.kind}): wire at runtime via [data-state="${state.kind}"] */`);
    }
  }
}

function renderLandmark(landmark: UiContractLandmark, ctx: RenderContext, depth: number): string[] {
  const { tag, role } = ROLE_TAGS[landmark.role] ?? { tag: "section" };
  const id = cssId(landmark.id);
  ctx.landmarkIds.push(landmark.id);
  const indent = "  ".repeat(depth);
  const attrs: string[] = [`id="${esc(id)}"`];
  if (role) attrs.push(`role="${esc(role)}"`);
  // main gets its accessible name from the tag; everything else labels
  // itself so duplicate-role landmarks stay distinguishable.
  if (landmark.role !== "main") attrs.push(`aria-label="${esc(landmark.name)}"`);
  if (landmark.gridArea) attrs.push(`style="grid-area: ${esc(landmark.gridArea)}"`);

  const selector = `#${id}`;
  const decls = layoutDecls(landmark.layout);
  ctx.css.push(`${selector} {\n  ${decls.join(";\n  ")};\n}`);

  for (const rule of landmark.responsive ?? []) {
    const viewport = ctx.screen.viewports.find((v) => v.label === rule.viewport);
    if (!viewport) {
      ctx.warnings.push(`${landmark.id}: responsive rule references unknown viewport "${rule.viewport}"`);
      continue;
    }
    const query = mediaQueryForViewport(viewport, ctx.screen.viewports);
    const overrides = responsiveDecls(rule, landmark.layout);
    if (overrides.length === 0) continue;
    const bucket = ctx.mediaCss.get(query) ?? [];
    bucket.push(`${selector} {\n    ${overrides.join(";\n    ")};\n  }`);
    ctx.mediaCss.set(query, bucket);
  }

  stateCss(selector, landmark.states ?? [], ctx.css);

  const body: string[] = [];
  const markers = [...(landmark.markers ?? []), ...(ctx.extraMarkers.get(landmark.id) ?? [])];
  for (const marker of markers) {
    body.push(renderMarkerElement(marker, ctx));
  }
  // A landmark with no explicit heading marker still gets a visible name so
  // the scaffold reads as a wireframe.
  const hasHeading = markers.some((m) => m.kind === "hero-title");
  const rowContainer = landmark.layout.display.kind === "flex"
    && landmark.layout.display.direction === "row";
  if (!hasHeading && landmark.role !== "navigation" && !rowContainer) {
    body.push(`<h2 class="scaffold-label">${esc(landmark.name)}</h2>`);
  }
  if (landmark.role === "navigation") {
    body.push(
      `<ul class="nav-list">`,
      ...[1, 2, 3].map((n) => `  <li><a href="#">Nav link ${n}</a></li>`),
      `</ul>`,
    );
  }
  for (const slot of landmark.slots ?? []) body.push(renderSlot(slot, ctx));
  body.push(...renderContentPlaceholder(landmark));
  body.push(...renderRepeat(landmark));
  for (const child of ctx.childrenOf.get(landmark.id) ?? []) {
    body.push(...renderLandmark(child, ctx, 1));
  }

  const scrollport = (ctx.screen.expectedScrollports ?? []).find(
    (sp) => !ctx.claimedScrollports.has(sp.id) && scrollportTargetsLandmark(sp, landmark, id),
  );
  if (scrollport) {
    ctx.claimedScrollports.add(scrollport.id);
    attrs.push(`data-scrollport="${esc(scrollport.id)}"`);
    // Guarantee measurable overflow on the declared axis.
    const filler = scrollport.axis === "x"
      ? `<div class="scroll-filler-x" aria-hidden="true"></div>`
      : `<div class="scroll-filler-y" aria-hidden="true"></div>`;
    body.push(filler);
  }

  const open = `${indent}<${tag} ${attrs.join(" ")}>`;
  const close = `${indent}</${tag}>`;
  return [open, ...body.map((line) => `${indent}  ${line}`), close];
}

/** Conventional app-shell area layout when root landmarks declare grid areas. */
function screenWrapperCss(screen: UiContractScreen, roots: UiContractLandmark[]): string {
  const areas = roots.filter((l) => l.gridArea).map((l) => l.gridArea as string);
  if (areas.length >= 2) {
    const has = (a: string) => areas.includes(a);
    const rows: string[] = [];
    const bannerArea = roots.find((l) => l.role === "banner")?.gridArea;
    const navArea = roots.find((l) => l.role === "navigation")?.gridArea;
    const mainArea = roots.find((l) => l.role === "main")?.gridArea ?? "main";
    const asideArea = roots.find((l) => l.role === "complementary")?.gridArea;
    const footerArea = roots.find((l) => l.role === "contentinfo")?.gridArea;
    const middle = [navArea, mainArea, asideArea].filter(Boolean) as string[];
    if (bannerArea) rows.push(`"${middle.map(() => bannerArea).join(" ") || bannerArea}"`);
    if (middle.length > 0) rows.push(`"${middle.join(" ")}"`);
    if (footerArea) rows.push(`"${middle.map(() => footerArea).join(" ") || footerArea}"`);
    const columns = middle
      .map((area) => (area === mainArea ? "1fr" : "minmax(200px, 280px)"))
      .join(" ");
    if (rows.length > 0 && has(mainArea)) {
      return `.screen {\n  display: grid;\n  grid-template-columns: ${columns || "1fr"};\n  grid-template-areas: ${rows.join(" ")};\n  min-height: 100vh;\n}`;
    }
  }
  return `.screen {\n  display: flex;\n  flex-direction: column;\n  min-height: 100vh;\n}\n.screen > main {\n  flex: 1;\n}`;
}

function decorationCss(screen: UiContractScreen): string[] {
  const css: string[] = [];
  const vars: string[] = [];
  for (const color of screen.decoration?.palette ?? []) {
    if (color.value) vars.push(`--color-${cssId(color.role)}: ${color.value};`);
  }
  for (const token of screen.decoration?.tokens ?? []) {
    if (token.value !== undefined) {
      const value = typeof token.value === "number" ? px(token.value) : token.value;
      vars.push(`--${cssId(token.role)}: ${value};`);
    }
  }
  if (vars.length > 0) css.push(`:root {\n  ${vars.join("\n  ")}\n}`);
  for (const typography of screen.decoration?.typography ?? []) {
    const decls: string[] = [];
    if (typography.family) decls.push(`font-family: ${typography.family}`);
    if (typography.size !== undefined) decls.push(`font-size: ${px(typography.size)}`);
    if (typography.lineHeight !== undefined) decls.push(`line-height: ${typography.lineHeight}`);
    if (typography.weight !== undefined) decls.push(`font-weight: ${typography.weight}`);
    if (decls.length > 0) css.push(`.type-${cssId(typography.role)} {\n  ${decls.join(";\n  ")};\n}`);
  }
  return css;
}

const BASE_CSS = `* { box-sizing: border-box; margin: 0; }
body {
  font-family: system-ui, sans-serif;
  color: var(--color-text, #1f2937);
  background: var(--color-background, #ffffff);
  line-height: 1.5;
}
.scaffold-label { font-size: 1rem; color: #6b7280; padding: 8px 12px; grid-column: 1 / -1; }
[id] > .scaffold-label { border-bottom: 1px dashed #d1d5db; }
.screen > header, .screen > main, .screen > footer, .screen > nav,
.screen > aside, .screen > section, .screen > form { padding: 16px 24px; }
.slot, .media-placeholder, .chart-placeholder {
  border: 1px dashed #cbd5e1;
  background: repeating-linear-gradient(45deg, #f8fafc, #f8fafc 12px, #f1f5f9 12px, #f1f5f9 24px);
}
.slot { padding: 12px; }
.media-placeholder, .chart-placeholder { aspect-ratio: 16 / 9; width: 100%; }
.button {
  display: inline-block;
  align-self: start;
  justify-self: start;
  padding: 10px 20px;
  background: var(--color-accent, #2563eb);
  color: #ffffff;
  border-radius: 6px;
  text-decoration: none;
}
.nav-list { display: flex; gap: 16px; list-style: none; padding: 12px; }
.nav-list a { color: var(--color-text, #1f2937); text-decoration: none; }
.repeat-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
.content-list, .content-form { padding: 12px; display: grid; gap: 8px; }
.content-table { border-collapse: collapse; margin: 12px; }
.content-table td, .content-table th { border: 1px solid #e5e7eb; padding: 6px 12px; }
.scroll-filler-y { height: 200vh; }
.scroll-filler-x { width: 300vw; height: 1px; }
.scaffold-scrollport { border: 1px dashed #cbd5e1; padding: 12px; }`;

export function scaffoldUiContractScreen(
  screen: UiContractScreen,
  options: ScaffoldOptions = {},
): ScaffoldedScreen {
  const childrenOf = new Map<string | undefined, UiContractLandmark[]>();
  for (const landmark of screen.landmarks) {
    const key = landmark.parentId;
    const bucket = childrenOf.get(key) ?? [];
    bucket.push(landmark);
    childrenOf.set(key, bucket);
  }
  const roots = childrenOf.get(undefined) ?? [];
  const ctx: RenderContext = {
    screen,
    childrenOf,
    warnings: [],
    landmarkIds: [],
    css: [],
    mediaCss: new Map(),
    claimedScrollports: new Set(),
    extraMarkers: new Map(),
  };

  const bodyLines: string[] = [];
  // Screen-level markers (the shape `contract introspect` emits: selector +
  // attribute, no landmark) must still materialize or the scaffold loses the
  // semantic hooks and a re-introspect cannot recover the marker contract.
  // Re-home attribute-bearing ones onto a host landmark; selector-less ones
  // materialize at the top level as before.
  const host = roots.find((l) => l.role === "main") ?? roots[0];
  for (const marker of screen.markers ?? []) {
    if (!marker.selector) {
      bodyLines.push(`  ${renderMarkerElement(marker, ctx)}`);
      continue;
    }
    // Scrollport evidence markers are covered by expectedScrollports below.
    if (marker.kind === "scrollport") continue;
    const declaredOnLandmark = screen.landmarks.some((l) =>
      (l.markers ?? []).some((m) => m.kind === marker.kind),
    );
    if (declaredOnLandmark) continue;
    if (!marker.attribute) {
      ctx.warnings.push(
        `marker ${marker.id ?? marker.kind}: selector "${marker.selector}" carries no attribute the scaffold can emit; satisfy it during the decoration pass`,
      );
      continue;
    }
    if (!host) {
      bodyLines.push(`  ${renderMarkerElement(marker, ctx)}`);
      continue;
    }
    const bucket = ctx.extraMarkers.get(host.id) ?? [];
    bucket.push(marker);
    ctx.extraMarkers.set(host.id, bucket);
  }
  for (const root of roots) {
    bodyLines.push(...renderLandmark(root, ctx, 1));
  }
  for (const scrollport of screen.expectedScrollports ?? []) {
    if (!ctx.claimedScrollports.has(scrollport.id)) {
      bodyLines.push(`  ${materializeScrollport(scrollport, ctx)}`);
    }
  }

  const cssBlocks = [
    BASE_CSS,
    ...decorationCss(screen),
    screenWrapperCss(screen, roots),
    ...ctx.css,
  ];
  for (const [query, rules] of ctx.mediaCss) {
    cssBlocks.push(`${query} {\n  ${rules.join("\n  ")}\n}`);
  }

  const title = options.title ?? screen.id;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
${cssBlocks.join("\n\n")}
</style>
</head>
<body>
<div class="screen" data-screen="${esc(screen.id)}"${screen.pattern ? ` data-pattern="${esc(screen.pattern)}"` : ""}>
${bodyLines.join("\n")}
</div>
</body>
</html>
`;
  return { screenId: screen.id, html, landmarkIds: ctx.landmarkIds, warnings: ctx.warnings };
}

export function scaffoldUiContract(
  contract: UiContract,
  options: ScaffoldOptions = {},
): ScaffoldResult {
  // Validation runs on the MoonBit policy core; scaffolding must still work
  // where the moon toolchain is unavailable, so degrade to a note.
  let issues: { path: string; message: string }[] = [];
  let validationSkipped: string | undefined;
  try {
    issues = validateUiContract(contract);
  } catch (error) {
    validationSkipped = error instanceof Error ? error.message : String(error);
  }
  const screens = contract.screens
    .filter((screen) => !options.screenId || screen.id === options.screenId)
    .map((screen) => scaffoldUiContractScreen(screen, options));
  return { screens, issues, validationSkipped };
}

function printHelp(): void {
  console.log(`Usage: vlmkit contract scaffold <ui.contract.json> [options]

Compile a UI Contract IR into a semantic HTML/CSS scaffold.

Options:
  --screen <id>   Scaffold only this screen (default: all screens)
  --out <dir>     Output directory (default: alongside the contract as <screen>.scaffold.html)
  --title <text>  Document title (default: screen id)
  -h, --help      Show this help`);
}

async function main(argv = process.argv.slice(2)) {
  const help = argv.includes("--help") || argv.includes("-h");
  const input = argv.find((arg) => !arg.startsWith("-"));
  if (help || !input) {
    printHelp();
    if (!input && !help) process.exit(1);
    return;
  }
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const contract = JSON.parse(await readFile(input, "utf-8")) as UiContract;
  const outDir = flag("--out") ?? resolve(input, "..");
  const result = scaffoldUiContract(contract, {
    screenId: flag("--screen"),
    title: flag("--title"),
  });
  if (result.validationSkipped) {
    console.error(`Note: contract validation skipped (${result.validationSkipped.split("\n")[0]})`);
  } else if (result.issues.length > 0) {
    console.error(`Warning: contract has ${result.issues.length} validation issue(s); scaffolding anyway:`);
    for (const issue of result.issues) console.error(`- ${issue.path}: ${issue.message}`);
  }
  if (result.screens.length === 0) {
    console.error(flag("--screen") ? `No screen matches id "${flag("--screen")}"` : "Contract has no screens");
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });
  for (const screen of result.screens) {
    const outPath = join(outDir, `${cssId(screen.screenId)}.scaffold.html`);
    await writeFile(outPath, screen.html);
    console.log(`Scaffolded ${screen.screenId} -> ${outPath} (${screen.landmarkIds.length} landmarks)`);
    for (const warning of screen.warnings) console.log(`  warn: ${warning}`);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "contract-scaffold"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
