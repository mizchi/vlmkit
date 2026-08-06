/**
 * The construction → maintenance bridge: a converged page becomes a story
 * gallery with baselines.
 *
 * ## The gap this closes
 *
 * `build component` is construction — converge markup toward a target you do
 * not yet match. `check story` is maintenance — this component is already
 * correct, did the last edit break it? Nothing converted one into the other, so
 * the handoff (`markup-decompose`'s Phase 3) was a manual list of steps: write a
 * gallery, add a story per component and per state, write baselines, record the
 * set in `vlmkit.gates.json`. Every one of those is derivable from the page that
 * just converged, which is what this module does.
 *
 * It is deterministic — no VLM, no LLM. It reads the rendered DOM and the CSS
 * the page already ships.
 *
 * ## Discovery is a proposal, not an answer
 *
 * `scan component` finds *visual* blocks and this finds *class* blocks; neither
 * finds the component boundaries a codebase would want. A card and its neighbour
 * can share one class; a toolbar's three children can be three separate ones.
 * So every candidate carries the evidence that produced it (instance count,
 * area, what it contains) and a `recommended` flag you are expected to
 * overrule — `--selector` bypasses discovery entirely.
 *
 * ## Per-story thresholds, and why the default is wrong for big components
 *
 * `check story`'s default threshold is a *ratio* (0.5%), and a ratio gets
 * coarser as area grows: a few hundred changed pixels is over a percent on a
 * 3.5k-pixel button and about a tenth of a percent on a 250k-pixel hero. The
 * same default that catches a button regression misses a corner-radius change on
 * a hero. So the threshold emitted here is a *pixel budget* converted to a ratio
 * per story — tolerate N noisy pixels, whatever the area — which is the
 * measurement in docs/reports/2026-08-06-component-vs-page-vrt-signal.md turned
 * into a number a config can hold.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleCliError, UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { hasFlag, readAll, readFlag, readInt, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

/**
 * A pixel budget rather than a ratio: how many differing pixels a story may
 * have before it counts as changed. Two glyph edges' worth — enough to absorb
 * antialiasing on a text-bearing component, small enough that a border, a
 * radius or a colour change on any component clears it.
 */
export const DEFAULT_NOISE_PIXELS = 24;

/**
 * `check story`'s own default, used as the ceiling. A component small enough
 * that 24px is more than 0.5% of it gets the gate's default instead, because
 * loosening past the gate's own default on the strength of a heuristic here
 * would be this tool quietly weakening a gate.
 */
export const THRESHOLD_CEILING = 0.005;

/**
 * Floor. Below this a threshold is indistinguishable from zero tolerance, and a
 * zero-tolerance visual gate fails on renderer noise — font hinting differences
 * between machines are real and are not regressions.
 */
export const THRESHOLD_FLOOR = 0.0002;

export interface DerivedThreshold {
  threshold: number;
  /** Human-readable derivation, printed and stored so the number is auditable. */
  reason: string;
}

/**
 * Convert a pixel budget into the ratio `check story` compares against.
 *
 * Rounded to two significant figures: an unrounded 0.00009353741 in a config
 * file reads as a measurement when it is a budget divided by an area.
 */
export function deriveStoryThreshold(
  area: number,
  options: { noisePixels?: number } = {},
): DerivedThreshold {
  const noisePixels = options.noisePixels ?? DEFAULT_NOISE_PIXELS;
  if (area <= 0) {
    return { threshold: THRESHOLD_CEILING, reason: "zero-area story — fell back to the gate default" };
  }
  const raw = noisePixels / area;
  if (raw >= THRESHOLD_CEILING) {
    return {
      threshold: THRESHOLD_CEILING,
      reason: `${noisePixels}px of ${area.toLocaleString()}px is ${(raw * 100).toFixed(2)}%,`
        + ` at or above the gate default — kept the default ${THRESHOLD_CEILING}`,
    };
  }
  if (raw <= THRESHOLD_FLOOR) {
    return {
      threshold: THRESHOLD_FLOOR,
      reason: `${noisePixels}px of ${area.toLocaleString()}px is ${(raw * 100).toFixed(4)}%,`
        + ` below the renderer-noise floor — clamped to ${THRESHOLD_FLOOR}`,
    };
  }
  return {
    threshold: round2(raw),
    reason: `${noisePixels}px budget over ${area.toLocaleString()}px`,
  };
}

function round2(value: number): number {
  const magnitude = Math.floor(Math.log10(value));
  const factor = 10 ** (1 - magnitude);
  return Math.round(value * factor) / factor;
}

/** One element in the page, as collected in the browser. Deliberately flat. */
export interface RawElement {
  /** Class attribute, verbatim. */
  className: string;
  /** Depth from `<body>`, used to prefer the shallowest instance of a class. */
  depth: number;
  width: number;
  height: number;
  /** Index in document order, the tiebreaker and the identity for containment. */
  index: number;
  /** Document-order indices of this element's ancestors. */
  ancestors: number[];
  tagName: string;
  outerHtml: string;
  /** Present-and-true DOM state attributes worth naming as a story. */
  states: string[];
}

export interface StoryCandidate {
  /** Story id in the spec's grammar: `<path>/<ExportName>`. */
  id: string;
  /** Component name, shared by every variant. */
  component: string;
  /** Variant name — `Default`, or a modifier / state derived from the DOM. */
  variant: string;
  /** Selector that finds the exemplar, for `diff component` and for humans. */
  selector: string;
  html: string;
  width: number;
  height: number;
  /** How many elements in the page share this variant's class signature. */
  instances: number;
  threshold: number;
  thresholdReason: string;
  /** Components whose exemplars live inside this one. */
  contains: string[];
  recommended: boolean;
  /** Why it is or is not recommended. Always populated. */
  notes: string[];
}

export interface DiscoverOptions {
  /** Viewport the page was rendered at, for the "is this a page region" test. */
  viewport: { width: number; height: number };
  /** Only these class selectors (`.c-card`) become candidates. */
  selectors?: string[];
  /** Path prefix for story ids. */
  prefix?: string;
  noisePixels?: number;
  /** Fraction of the viewport above which a block is treated as page furniture. */
  maxAreaRatio?: number;
}

/**
 * Strip the conventional prefixes and produce a component name.
 *
 * `c-card` / `js-card` / `u-card` → `Card`; `data-table` → `DataTable`. The
 * prefix list is short on purpose: guessing at more of them would silently
 * rename components whose real name starts with a two-letter word.
 */
export function componentNameFromClass(className: string): string {
  const base = className.split("--")[0]!.split("__")[0]!;
  const withoutPrefix = base.replace(/^(?:c|js|u|is|has)-/, "");
  const words = (withoutPrefix || base).split(/[-_]+/).filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("") || "Component";
}

/** `btn--ghost` → `Ghost`. Modifierless classes have no variant of their own. */
function variantFromClass(className: string): string | undefined {
  const modifier = className.split("--")[1];
  if (!modifier) return undefined;
  const words = modifier.split(/[-_]+/).filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
}

/**
 * Group the page's elements into component variants.
 *
 * The grouping key is the *primary* class (the first token) with its BEM
 * modifier split off, so `btn` and `btn--ghost` are two variants of one
 * component rather than two components. DOM state attributes (`disabled`,
 * `aria-expanded`) become variants too, which is the only way the "a story per
 * named state" part of the handoff can come from the page rather than from
 * someone remembering.
 */
export function discoverStoryCandidates(
  elements: readonly RawElement[],
  options: DiscoverOptions,
): StoryCandidate[] {
  const wanted = options.selectors?.map((selector) => selector.replace(/^\./, ""));
  const prefix = options.prefix ?? "components";
  const maxAreaRatio = options.maxAreaRatio ?? 0.5;
  const viewportArea = options.viewport.width * options.viewport.height;

  const elementByIndex = new Map(elements.map((element) => [element.index, element]));
  /** variant key → the elements that share it. */
  const groups = new Map<string, { component: string; variant: string; primary: string; members: RawElement[] }>();
  for (const element of elements) {
    const classes = element.className.trim().split(/\s+/).filter(Boolean);
    const primary = classes[0];
    if (!primary) continue;
    if (wanted && !classes.some((cls) => wanted.includes(cls))) continue;
    if (element.width === 0 || element.height === 0) continue;

    const component = componentNameFromClass(primary);
    // A modifier on any class, not only the primary one: `btn btn--ghost` puts
    // the variant on the second token, which is the common BEM spelling.
    const modifier = classes.map(variantFromClass).find(Boolean);
    const variant = element.states.length > 0
      ? element.states.map(titleCase).join("")
      : modifier ?? "Default";
    const key = `${component}/${variant}`;
    const group = groups.get(key);
    if (group) group.members.push(element);
    else groups.set(key, { component, variant, primary: primary.split("--")[0]!, members: [element] });
  }

  const candidates: StoryCandidate[] = [];
  /** Exemplar document-order index → its candidate, for the containment pass. */
  const byExemplar = new Map<number, StoryCandidate>();
  for (const [key, group] of groups) {
    // Shallowest instance, then the largest: the shallowest is the component
    // itself rather than a nested repeat of it, and among equals the largest is
    // the one whose content is not truncated.
    const exemplar = [...group.members].sort(
      (a, b) => a.depth - b.depth || b.width * b.height - a.width * a.height || a.index - b.index,
    )[0]!;
    const area = exemplar.width * exemplar.height;
    const { threshold, reason } = deriveStoryThreshold(area, { noisePixels: options.noisePixels });
    const candidate: StoryCandidate = {
      id: `${prefix}/${key}`,
      component: group.component,
      variant: group.variant,
      selector: `.${group.primary}`,
      html: exemplar.outerHtml,
      width: exemplar.width,
      height: exemplar.height,
      instances: group.members.length,
      threshold,
      thresholdReason: reason,
      contains: [],
      recommended: true,
      notes: [],
    };
    candidates.push(candidate);
    // Keyed on the exemplar's document-order index rather than looked up by
    // markup later: two instances of a component can have byte-identical
    // `outerHTML`, so matching on the HTML would attribute containment to
    // whichever one happened to be found first.
    byExemplar.set(exemplar.index, candidate);
  }

  // Containment, computed after the exemplars are chosen: a candidate is inside
  // another when that other's exemplar is one of its ancestors.
  for (const [index, candidate] of byExemplar) {
    const element = elementByIndex.get(index)!;
    for (const ancestor of element.ancestors) {
      const container = byExemplar.get(ancestor);
      if (container && container !== candidate && !container.contains.includes(candidate.component)) {
        container.contains.push(candidate.component);
      }
    }
  }

  for (const candidate of candidates) {
    const area = candidate.width * candidate.height;
    const areaRatio = viewportArea > 0 ? area / viewportArea : 0;
    if (candidate.instances > 1) candidate.notes.push(`appears ${candidate.instances}x`);
    if (candidate.contains.length > 0) {
      candidate.notes.push(`contains ${candidate.contains.join(", ")}`);
    }
    // A layout wrapper: one child candidate, and the same box as that child.
    // Its story would be a byte-identical duplicate of the child's, so it costs
    // a second baseline to maintain and reports the child's changes as its own.
    // Checked before the area test because a wrapper around a large component is
    // large, and "page furniture" is the wrong explanation for it.
    const wrapped = candidate.contains.length === 1
      ? candidates.find((other) => other.component === candidate.contains[0])
      : undefined;
    if (wrapped && wrapped.width === candidate.width && wrapped.height === candidate.height) {
      candidate.recommended = false;
      candidate.notes.push(
        `same box as ${wrapped.component} which it wraps — a duplicate baseline;`
        + ` story ${wrapped.id} already covers these pixels`,
      );
    } else if (areaRatio > maxAreaRatio) {
      candidate.recommended = false;
      candidate.notes.push(
        `${(areaRatio * 100).toFixed(0)}% of the viewport — page furniture rather than a component;`
        + ` split it or pass --selector to keep it`,
      );
    } else if (candidate.contains.length >= 3) {
      // Not a hard reject: a Toolbar legitimately contains three things. But a
      // block whose diff is mostly other stories' pixels reports their changes
      // as its own, which is the cascade a story-scoped diff exists to avoid.
      candidate.recommended = false;
      candidate.notes.push(
        `wraps ${candidate.contains.length} other candidates — its diff would report their changes too`,
      );
    }
    if (candidate.threshold < THRESHOLD_CEILING) {
      candidate.notes.push(`threshold ${candidate.threshold} (${candidate.thresholdReason})`);
    }
  }

  return candidates.sort((a, b) => a.id.localeCompare(b.id));
}

function titleCase(value: string): string {
  const words = value.split(/[-_\s]+/).filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
}

/**
 * Embed a string in a `<script>` safely.
 *
 * `JSON.stringify` alone is not enough: a `</script>` inside captured markup
 * ends the script element, and captured markup is exactly where one shows up.
 */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    // U+2028 / U+2029 are literal line terminators in a script body but legal
    // inside a JSON string, so a paragraph separator in captured copy would be a
    // syntax error in the generated gallery rather than a stray character.
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export interface GalleryHtmlOptions {
  stories: readonly StoryCandidate[];
  /** CSS the page shipped, concatenated. Inlined so the gallery is portable. */
  css: string;
  title?: string;
  /** Recorded in a comment so a regenerated gallery is traceable to its page. */
  source?: string;
  /** `<base href>` so relative asset URLs in captured markup/CSS still resolve. */
  baseHref?: string;
}

/**
 * Emit a gallery implementing the page-side contract `check story` drives.
 *
 * Static HTML per story rather than a framework render, because the input is a
 * page that already rendered: capturing `outerHTML` is faithful to what
 * converged, and it needs no bundler, no dev server and no framework to mount.
 * The tradeoff is real and stated in the file's own comment — the stories are
 * frozen markup, so props do nothing and a component's behaviour is not
 * exercised. This is the maintenance instrument ("did my CSS edit change how
 * this looks"), not a replacement for a hand-written gallery.
 */
export function buildGalleryHtml(options: GalleryHtmlOptions): string {
  const registry: Record<string, { html: string; width: number }> = {};
  for (const story of options.stories) registry[story.id] = { html: story.html, width: story.width };
  const title = options.title ?? "vlmkit story gallery";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${options.baseHref ? `<base href="${escapeHtml(options.baseHref)}">\n` : ""}<!--
  Generated by \`vlmkit build gallery\`${options.source ? ` from ${escapeHtml(options.source)}` : ""}.

  Implements the Playwright component-testing gallery contract:

      window.mount({ story, props })   render into #root, reject on failure
      window.unmount()                 unmount the current story

  The stories are markup captured from the source page, so:

  - \`props\` are accepted and ignored. There is no component function to pass
    them to. A story that needs to vary by prop belongs in a hand-written
    gallery — see the templates in the component-vrt skill.
  - Behaviour is not exercised. This checks that a component still *looks*
    right, which is what a CSS or token edit can break.
  - Regenerating overwrites this file. Edit it and you own it; the generator
    will not merge.
-->
<style>
/* The gallery's own styling: none worth speaking of. A gallery that lays out
   its stories would put its own padding into every baseline. */
body { margin: 0; }
/* inline-block so the box hugs an intrinsically-sized component; mount() then
   pins the width to what the source page measured. */
#root { display: inline-block; }
</style>
<style>
/* ---- CSS captured from the source page ---- */
${options.css}
</style>
</head>
<body>
<div id="root"></div>
<script>
const STORIES = ${scriptSafeJson(registry)};

/**
 * Any unique trailing suffix resolves, per the spec's id grammar, so
 * \`Button/Primary\` finds \`components/Button/Primary\`. Ambiguity throws
 * rather than picking one: a silently-chosen story makes a diff untrustworthy.
 */
function resolveStory(id) {
  if (id in STORIES) return STORIES[id];
  const matches = Object.keys(STORIES).filter((key) => key === id || key.endsWith("/" + id));
  if (matches.length === 1) return STORIES[matches[0]];
  if (matches.length > 1) throw new Error('story id "' + id + '" is ambiguous: ' + matches.join(", "));
  throw new Error('unknown story "' + id + '". Known: ' + Object.keys(STORIES).join(", "));
}

const root = document.getElementById("root");

window.mount = async ({ story }) => {
  const entry = resolveStory(story);
  // Pin #root to the width the component had in the source page. A fluid
  // component otherwise takes its width from whatever viewport the checker runs
  // at, so its box — and therefore the per-story threshold derived from that
  // box — would change with an unrelated flag. Intrinsically-sized components
  // already are this width, so the pin is a no-op for them.
  root.style.width = entry.width + "px";
  root.innerHTML = entry.html;
  // Resolve only once the browser has laid the story out, so a screenshot taken
  // immediately after mount is not of an empty box.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
};

window.unmount = async () => {
  root.replaceChildren();
};
</script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The `vlmkit.gates.json` fragment for these stories.
 *
 * One page entry per story rather than one `check story` with every id, because
 * `--threshold` is per invocation and the thresholds differ per story by
 * design. Grouping them would mean one threshold for a button and a hero, which
 * is the thing this tool exists to stop.
 */
export function buildGatesConfigSnippet(
  stories: readonly StoryCandidate[],
  galleryUrl: string,
): { pages: { id: string; source: string; gates: string[] }[] } {
  return {
    pages: stories.map((story) => ({
      id: `story:${story.component}/${story.variant}`,
      source: story.id,
      gates: [`check story --gallery ${galleryUrl} --threshold ${story.threshold}`],
    })),
  };
}

export interface StoryScaffoldOptions {
  /** HTML file path or URL of the converged page. */
  source: string;
  outDir: string;
  viewport: { width: number; height: number };
  selectors?: string[];
  prefix?: string;
  noisePixels?: number;
  maxAreaRatio?: number;
  /** Include candidates discovery did not recommend. */
  includeAll?: boolean;
}

export interface StoryScaffoldResult {
  source: string;
  galleryPath: string;
  storiesPath: string;
  viewport: { width: number; height: number };
  stories: StoryCandidate[];
  /** Candidates found but not written, with the note explaining why. */
  skipped: StoryCandidate[];
  /** Stylesheets neither the browser nor a re-fetch could produce. */
  unreadableStylesheets: string[];
  /** Stylesheets the browser hid but the re-fetch recovered. */
  refetchedStylesheets: string[];
  cssBytes: number;
}

/** Runs in the page. Collects every classed element plus the page's own CSS. */
function collectInPage(): { elements: RawElement[]; css: string; unreadable: string[] } {
  const STATE_ATTRIBUTES = ["disabled", "checked", "open", "readonly", "required"];
  const elements: RawElement[] = [];
  const all = Array.from(document.body.querySelectorAll<HTMLElement>("[class]"));
  // Document-order index, shared by the element list and the ancestor lists, so
  // containment can be computed outside the browser without re-querying.
  const indexOf = new Map<Element, number>();
  all.forEach((element, index) => indexOf.set(element, index));

  all.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    let depth = 0;
    const ancestors: number[] = [];
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      depth += 1;
      const ancestorIndex = indexOf.get(node);
      if (ancestorIndex !== undefined) ancestors.push(ancestorIndex);
    }
    const states = STATE_ATTRIBUTES.filter((attribute) => element.hasAttribute(attribute));
    const expanded = element.getAttribute("aria-expanded");
    if (expanded === "true") states.push("expanded");
    elements.push({
      className: element.getAttribute("class") ?? "",
      depth,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      index,
      ancestors,
      tagName: element.tagName.toLowerCase(),
      outerHtml: element.outerHTML,
      states,
    });
  });

  const sheets: string[] = [];
  const unreadable: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      sheets.push(Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"));
    } catch {
      // Opaque stylesheet — `cssRules` throws for anything the page did not
      // load same-origin, and Chromium counts every `file://` stylesheet as
      // opaque, so this is the *normal* path for a local HTML file rather than
      // an edge case. The caller re-fetches these by href; whatever it cannot
      // get is reported, because a gallery missing a stylesheet produces a
      // baseline that looks fine and is wrong.
      unreadable.push(sheet.href ?? "(inline)");
    }
  }
  return { elements, css: sheets.join("\n"), unreadable };
}

/**
 * Re-fetch the stylesheets the page would not expose.
 *
 * Over HTTP this uses Playwright's request context rather than `fetch` in Node,
 * so a stylesheet behind a session cookie is still readable. `file://` is read
 * from disk: `APIRequestContext` speaks HTTP only and rejects the scheme, which
 * is the case that matters most — a plain local HTML file is where every
 * stylesheet is opaque.
 */
async function refetchStylesheets(
  page: import("playwright").Page,
  hrefs: readonly string[],
): Promise<{ css: string; failed: string[] }> {
  const parts: string[] = [];
  const failed: string[] = [];
  for (const href of hrefs) {
    if (href === "(inline)") {
      // An inline <style> that threw is not re-fetchable by definition.
      failed.push(href);
      continue;
    }
    try {
      let text: string;
      if (href.startsWith("file:")) {
        text = await readFile(fileURLToPath(href), "utf-8");
      } else {
        const response = await page.request.get(href);
        if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
        text = await response.text();
      }
      if (!text.trim()) throw new Error("empty response");
      parts.push(`/* re-fetched: ${href} */\n${text}`);
    } catch {
      failed.push(href);
    }
  }
  return { css: parts.join("\n"), failed };
}

export async function scaffoldStoryGallery(options: StoryScaffoldOptions): Promise<StoryScaffoldResult> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: options.viewport });
    const url = options.source.includes("://")
      ? options.source
      : `file://${resolve(options.source)}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const collected = await page.evaluate(collectInPage);
    const refetched = await refetchStylesheets(page, collected.unreadable);
    const css = [collected.css, refetched.css].filter((part) => part.trim()).join("\n");

    const all = discoverStoryCandidates(collected.elements, {
      viewport: options.viewport,
      ...(options.selectors ? { selectors: options.selectors } : {}),
      ...(options.prefix ? { prefix: options.prefix } : {}),
      ...(options.noisePixels !== undefined ? { noisePixels: options.noisePixels } : {}),
      ...(options.maxAreaRatio !== undefined ? { maxAreaRatio: options.maxAreaRatio } : {}),
    });
    // An explicit --selector list is an instruction, not a suggestion: if you
    // named it, it becomes a story even if the heuristics dislike it.
    const keep = options.includeAll || options.selectors
      ? all
      : all.filter((candidate) => candidate.recommended);
    const skipped = all.filter((candidate) => !keep.includes(candidate));

    const outDir = resolve(options.outDir);
    await mkdir(outDir, { recursive: true });
    const galleryPath = join(outDir, "gallery.html");
    const storiesPath = join(outDir, "stories.json");
    const html = buildGalleryHtml({
      stories: keep,
      css,
      source: url,
      // Relative `url()` in the captured CSS and relative `src` in the captured
      // markup resolve against the gallery's own location otherwise, which puts
      // every image and font one directory-depth away from where it lives.
      baseHref: url,
      title: `story gallery — ${url}`,
    });
    await writeFile(galleryPath, html);
    await writeFile(
      storiesPath,
      `${JSON.stringify(
        {
          source: url,
          viewport: options.viewport,
          gallery: `file://${galleryPath}`,
          stories: keep.map(({ html: _html, ...rest }) => rest),
        },
        null,
        2,
      )}\n`,
    );

    return {
      source: url,
      galleryPath,
      storiesPath,
      viewport: options.viewport,
      stories: keep,
      skipped,
      unreadableStylesheets: refetched.failed,
      refetchedStylesheets: collected.unreadable.filter((href) => !refetched.failed.includes(href)),
      cssBytes: css.length,
    };
  } finally {
    await browser.close();
  }
}

export function formatStoryScaffoldResult(result: StoryScaffoldResult): string {
  const galleryUrl = `file://${result.galleryPath}`;
  const lines = [
    `${BOLD}${CYAN}vlmkit build gallery${RESET}`,
    `${DIM}source: ${result.source}  viewport: ${result.viewport.width}x${result.viewport.height}`
    + `  css: ${result.cssBytes.toLocaleString()} bytes${RESET}`,
    "",
    `${BOLD}${result.stories.length} story/stories${RESET}`,
  ];
  for (const story of result.stories) {
    lines.push(
      `  ${GREEN}+${RESET} ${story.id.padEnd(40)} ${`${story.width}x${story.height}`.padStart(10)}`
      + `  ${DIM}${story.selector}${RESET}`,
    );
    for (const note of story.notes) lines.push(`      ${DIM}${note}${RESET}`);
  }
  if (result.skipped.length > 0) {
    lines.push("", `${YELLOW}${result.skipped.length} candidate(s) not written${RESET}`
      + ` ${DIM}(--include-all keeps them, --selector overrides)${RESET}`);
    for (const story of result.skipped) {
      lines.push(`  ${DIM}- ${story.id} — ${story.notes.join("; ")}${RESET}`);
    }
  }
  if (result.refetchedStylesheets.length > 0) {
    lines.push(
      "",
      `${DIM}${result.refetchedStylesheets.length} stylesheet(s) were opaque to the browser and re-fetched by URL:${RESET}`,
    );
    for (const href of result.refetchedStylesheets) lines.push(`  ${DIM}- ${href}${RESET}`);
  }
  if (result.unreadableStylesheets.length > 0) {
    // Loud, because the failure mode is a baseline that looks fine and is wrong.
    lines.push(
      "",
      `${YELLOW}warning:${RESET} ${result.unreadableStylesheets.length} stylesheet(s) could not be read`
      + ` and could not be re-fetched, so the gallery may render differently from the page:`,
    );
    for (const href of result.unreadableStylesheets) lines.push(`  - ${href}`);
    lines.push(`  ${DIM}Inline the CSS into the page, or serve it somewhere this can GET it, before trusting baselines.${RESET}`);
  }
  lines.push(
    "",
    `${BOLD}Next${RESET}`,
    `  1. Check the gallery renders what you expect:  open ${galleryUrl}`,
    `  2. Write baselines (only once each component is converged):`,
  );
  for (const story of result.stories.slice(0, 3)) {
    lines.push(
      `     ${DIM}vlmkit check story ${story.id} --gallery "${galleryUrl}" --threshold ${story.threshold}${RESET}`,
    );
  }
  if (result.stories.length > 3) lines.push(`     ${DIM}… ${result.stories.length - 3} more in ${result.storiesPath}${RESET}`);
  lines.push(
    `  3. Record the set so CI runs it and the ids stop drifting:`,
    `     ${DIM}merge the "pages" array below into vlmkit.gates.json${RESET}`,
    `  4. Commit .vlmkit/stories/.`,
    "",
    JSON.stringify(buildGatesConfigSnippet(result.stories, galleryUrl), null, 2),
  );
  return lines.join("\n");
}

function printHelp(): void {
  console.log(`Usage: vlmkit build gallery <html-file-or-url> [options]

Turn a converged page into a story gallery: capture each component's markup and
the page's CSS, emit a gallery implementing Playwright's component-testing
contract, and derive a per-story threshold so \`check story\` can maintain it.

Deterministic — no VLM. Discovery is a proposal: candidates carry the evidence
that produced them, and --selector overrides it entirely.

Options:
  --out <dir>            Output directory (default: .vlmkit/gallery)
  --selector <.class>    Only this class becomes a story (repeatable). Bypasses discovery.
  --prefix <path>        Story id prefix (default: components)
  --viewport <WxH>       Viewport to render the source page at (default: 1280x800)
  --noise-pixels <n>     Pixel budget per story, converted to a ratio threshold (default: ${DEFAULT_NOISE_PIXELS})
  --max-area-ratio <r>   Above this fraction of the viewport a block is page furniture (default: 0.5)
  --include-all          Write the candidates discovery did not recommend too
  --json                 Emit the result as JSON
  -h, --help             Show this help

Example:
  vlmkit build gallery dist/index.html --out .vlmkit/gallery
  vlmkit check story components/Card/Default --gallery "file://$PWD/.vlmkit/gallery/gallery.html"`);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (hasFlag(argv, "help") || argv.includes("-h")) {
    printHelp();
    return;
  }
  const valueFlags = ["--out", "--selector", "--prefix", "--viewport", "--noise-pixels", "--max-area-ratio"];
  const source = argv.find((arg, index) => !arg.startsWith("-") && !valueFlags.includes(argv[index - 1] ?? ""));
  if (!source) {
    printHelp();
    throw new UsageError("missing required argument <html-file-or-url>");
  }
  const rawViewport = readFlag(argv, "viewport") ?? "1280x800";
  const match = /^(\d+)x(\d+)$/.exec(rawViewport.trim());
  if (!match) throw new UsageError(`--viewport expects <width>x<height>, got ${JSON.stringify(rawViewport)}`);
  const selectors = readAll(argv, "selector");

  const result = await scaffoldStoryGallery({
    source,
    outDir: readFlag(argv, "out") ?? join(process.cwd(), ".vlmkit", "gallery"),
    viewport: { width: Number(match[1]), height: Number(match[2]) },
    ...(selectors.length > 0 ? { selectors } : {}),
    ...(readFlag(argv, "prefix") ? { prefix: readFlag(argv, "prefix")! } : {}),
    ...(readInt(argv, "noise-pixels", { min: 1 }) !== undefined
      ? { noisePixels: readInt(argv, "noise-pixels", { min: 1 })! }
      : {}),
    ...(readNumber(argv, "max-area-ratio", { min: 0, max: 1 }) !== undefined
      ? { maxAreaRatio: readNumber(argv, "max-area-ratio", { min: 0, max: 1 })! }
      : {}),
    includeAll: hasFlag(argv, "include-all"),
  });

  if (hasFlag(argv, "json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(formatStoryScaffoldResult(result));
  if (result.stories.length === 0) {
    console.error(
      "\nNo stories written. Pass --selector <.class> to name components explicitly,"
      + " or --include-all to see what discovery rejected.",
    );
    process.exitCode = 1;
  }
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "build-gallery"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
