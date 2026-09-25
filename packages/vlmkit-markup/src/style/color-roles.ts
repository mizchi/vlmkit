/**
 * `check color` — the browser half: collect every visible box's colours, then judge them.
 *
 * The roles, both WCAG rules and the pure judge live in
 * `@mizchi/vlmkit-judge/color-roles.ts`, which runs on a snapshot and never on a
 * page. They are re-exported here so every existing import keeps working.
 */

import { resolve, dirname } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { settlePage, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { type PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyRuleTiers, hiddenByRuleNote } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { CONTRAST_BACKGROUND_JS } from "../contrast-background.ts";
import { STYLE_SAMPLING_JS } from "./style-sampling.ts";
import {
  colorOnlyLinks,
  invisibleControls,
  judgeColorRoles,
  trimPalette,
  type ColorRolesInput,
  type ColorRolesReport,
  type ColorUse,
} from "@mizchi/vlmkit-judge/color-roles.ts";
import { parseSceneElements, sceneToColorRolesInput } from "@mizchi/vlmkit-judge/scene.ts";

export * from "@mizchi/vlmkit-judge/color-roles.ts";

// ---------------------------------------------------------------------------
// Browser collection
// ---------------------------------------------------------------------------

/**
 * Collect every visible box's colours with the role its element plays.
 *
 * Interpolates `CONTRAST_BACKGROUND_JS`, so a gradient behind something stays
 * `composite: true` — a refusal, not a guess — and `lab()` / `oklch()` resolve
 * through the browser's own rasterisation.
 *
 * Contains no backticks and no interpolation of its own beyond that one
 * fragment, for the reason its header gives.
 */
export const COLLECT_COLOR_ROLES = `(() => {
  ${CONTRAST_BACKGROUND_JS}
  ${STYLE_SAMPLING_JS}

  const hex = (c) => "#" + c.slice(0, 3).map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("");
  const SKIP_TAGS = new Set(["script", "style", "head", "meta", "link", "title", "noscript", "template", "br", "wbr"]);
  // Colour's own answer to "is this on the page", because the shared visible() is
  // shaped for geometry: it skips an off-screen content-visibility: auto section,
  // and a footer drawn that way is still paint the page has. What colour must not
  // count is content that is never painted until someone opens it. A closed
  // details element is exactly that, and checkVisibility says so whatever it is
  // asked, while its descendants still report a size, because asking for one
  // forces layout. Reading only the size put 5615 collapsed elements into
  // css-tricks' palette and made its comment boxes the page's largest surface.
  const painted = (el) => {
    const shown = typeof el.checkVisibility === "function"
      ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
      : visible(el);
    if (!shown || inheritedOpacity(el) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };
  const ownText = (el) => {
    let n = 0;
    for (const node of el.childNodes) if (node.nodeType === 3) n += (node.nodeValue || "").trim().length;
    return n;
  };
  const SIDES = ["Top", "Right", "Bottom", "Left"];
  const drawnBorders = (cs) => {
    const out = [];
    for (const side of SIDES) {
      const w = parseFloat(cs["border" + side + "Width"]) || 0;
      const style = cs["border" + side + "Style"];
      if (w <= 0 || style === "none" || style === "hidden") continue;
      const c = parseColor(cs["border" + side + "Color"]);
      if (!c || c[3] <= 0.05) continue;
      out.push({ side: side.toLowerCase(), w: w, color: c });
    }
    return out;
  };

  // --- palette -------------------------------------------------------------
  const tally = { surfaces: new Map(), ink: new Map(), marks: new Map(), interactive: new Map() };
  const add = (into, h, area, sample) => {
    const e = into.get(h) || { hex: h, area: 0, count: 0, samples: [] };
    e.area += area; e.count++;
    if (e.samples.length < 3) e.samples.push(sample);
    into.set(h, e);
  };
  const unreadable = new Map();
  const noteUnreadable = (property, value, sample) => {
    const e = unreadable.get(property) || { property: property, count: 0, samples: [] };
    e.count++;
    if (e.samples.length < 2 && e.samples.indexOf(value) === -1) e.samples.push(value);
    unreadable.set(property, e);
  };

  const INTERACTIVE_SEL = "a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=radio], [role=switch], [role=option], [contenteditable=true]";
  const isInteractive = (el) => el.matches(INTERACTIVE_SEL) && !(el.tagName === "A" && !el.hasAttribute("href"));

  let boxes = 0;
  for (const el of document.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    if (el.closest("svg") && tag !== "svg") continue;
    if (!painted(el)) continue;
    boxes++;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const area = Math.round(r.width * r.height);
    const sel = path(el);

    const bg = parseColor(cs.backgroundColor);
    if (bg === null && cs.backgroundColor) noteUnreadable("background-color", cs.backgroundColor, sel);
    if (bg && bg[3] > 0.05) add(tally.surfaces, hex(bg), area, sel);

    if (ownText(el) > 0) {
      const fg = parseColor(cs.color);
      if (fg === null) noteUnreadable("color", cs.color, sel);
      else {
        const behind = resolveTextBackground(el);
        add(tally.ink, hex(blendColor(behind.bg, fg)), area, sel);
      }
    }
    for (const b of drawnBorders(cs)) {
      const along = b.side === "top" || b.side === "bottom" ? r.width : r.height;
      add(tally.marks, hex(b.color), Math.round(b.w * along), sel);
    }
  }

  // --- controls (WCAG 1.4.11) ---------------------------------------------
  // Only controls whose EXTENT is the affordance. A checkbox, radio, colour
  // swatch or range is drawn by the platform and a submit button carries its own
  // label, so none of those is a field whose boundary is the only thing saying
  // where to type.
  const OPAQUE_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "color", "range", "checkbox", "radio", "file"]);
  const controls = [], controlsSkipped = [];
  for (const el of document.querySelectorAll("input, textarea, select, [contenteditable=true]")) {
    if (!painted(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" && OPAQUE_INPUT_TYPES.has((el.getAttribute("type") || "text").toLowerCase())) continue;
    const sel = path(el);
    const behind = resolveTextBackground(el.parentElement || el);
    if (behind.composite) { controlsSkipped.push({ selector: sel, reason: "background-image behind the control" }); continue; }
    const cs = getComputedStyle(el);
    const own = parseColor(cs.backgroundColor);
    // An outline only stands in for a boundary when it is actually painted. A
    // reset that writes a 1px solid TRANSPARENT outline — to reserve the space a
    // focus ring will need — would otherwise suppress a real finding, which is
    // the same class of hole as counting a zero-width border-color.
    const outlineW = parseFloat(cs.outlineWidth) || 0;
    const outlineColor = parseColor(cs.outlineColor);
    const outlinePainted = outlineW > 0
      && cs.outlineStyle !== "none" && cs.outlineStyle !== "hidden"
      && !!outlineColor && outlineColor[3] > 0.05;
    // Resolved colours, not ratios: the judge's controlBoundary() does the arithmetic,
    // so a control from any renderer is measured by the same code as this one.
    controls.push({
      selector: sel, tag: tag, on: behind.bg,
      fill: own && own[3] > 0.05 ? own : null,
      borders: drawnBorders(cs).map((b) => b.color),
      hasShadow: (cs.boxShadow || "none") !== "none",
      hasOutline: outlinePainted,
    });
  }

  // --- links in a prose flow (WCAG 1.4.1 / G183) --------------------------
  const flows = new Set();
  for (const a of document.querySelectorAll("a[href]")) if (a.parentElement) flows.add(a.parentElement);
  const links = [];
  for (const flow of flows) {
    if (!painted(flow)) continue;
    const kids = [];
    for (const c of flow.children) if (c.matches("a[href]") && painted(c)) kids.push(c);
    if (kids.length === 0) continue;
    const flowCs = getComputedStyle(flow);
    const bodyInk = parseColor(flowCs.color);
    if (!bodyInk) continue;
    const behind = resolveTextBackground(flow);
    const prose = ownText(flow);
    for (const a of kids) {
      const cs = getComputedStyle(a);
      const linkInk = parseColor(cs.color);
      if (!linkInk) continue;
      const bordered = drawnBorders(cs).length > 0;
      const fill = parseColor(cs.backgroundColor);
      // The two inks and the surface under them; the judge's linkCue() composites and
      // compares. A background image behind the flow is shipped as null — refused, not
      // guessed — exactly as the ratio used to be.
      links.push({
        selector: path(a), flow: path(flow), proseChars: prose,
        link: linkInk, body: bodyInk,
        behind: behind.composite ? null : behind.bg,
        underlined: (cs.textDecorationLine || "").indexOf("underline") !== -1,
        weightStep: Math.abs((Number(cs.fontWeight) || 400) - (Number(flowCs.fontWeight) || 400)),
        hasFill: !!(fill && fill[3] > 0.05),
        hasBorder: bordered,
      });
    }
  }

  // Interactive ink: once per control, and read off the CONTROL rather than off
  // the boxes inside it. Counting every ink-bearing descendant instead made
  // css-tricks' nav — every link wrapping a span — outvote the page's real link
  // colour, 404 white to 410 blue, because each nav link counted twice.
  for (const el of document.querySelectorAll(INTERACTIVE_SEL)) {
    if (!isInteractive(el) || !painted(el)) continue;
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const r = el.getBoundingClientRect();
    const behind = resolveTextBackground(el);
    add(tally.interactive, hex(blendColor(behind.bg, fg)), Math.round(r.width * r.height), path(el));
  }

  const rank = (m) => [...m.values()].sort((a, b) => b.area - a.area);
  const pageBehind = resolveTextBackground(document.body || document.documentElement);
  return {
    palette: { surfaces: rank(tally.surfaces), ink: rank(tally.ink), marks: rank(tally.marks) },
    baseHex: hex(pageBehind.bg),
    interactiveInk: rank(tally.interactive),
    controls: controls, controlsSkipped: controlsSkipped, links: links,
    unreadable: [...unreadable.values()],
    boxes: boxes,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
})()`;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const pct = (n: number, total: number): string => total <= 0 ? "  —  " : `${(n / total * 100).toFixed(1)}%`;

function paletteBlock(name: string, list: readonly ColorUse[], limit = 5): string[] {
  const kept = trimPalette(list);
  if (kept.length === 0) return [`  ${name.padEnd(9)} ${DIM}—${RESET}`];
  const total = kept.reduce((n, c) => n + c.area, 0);
  const lines = [`  ${name.padEnd(9)} ${kept.length} distinct`];
  for (const c of kept.slice(0, limit)) {
    lines.push(
      `    ${c.hex}  ${pct(c.area, total).padStart(6)}  ${String(c.count).padStart(4)} el`
      + `  ${DIM}${c.samples[0] ?? ""}${RESET}`,
    );
  }
  if (kept.length > limit) lines.push(`    ${DIM}…and ${kept.length - limit} more${RESET}`);
  return lines;
}

export function formatColorRolesReport(report: ColorRolesReport, rules?: RuleView): string {
  const out: string[] = [];
  const verdictColor = report.verdict === "consistent" ? GREEN : report.verdict === "not-judged" ? YELLOW : RED;
  out.push("");
  out.push(`${BOLD}${CYAN}vlmkit check color${RESET}`);
  out.push(`${DIM}source: ${report.source}${RESET}`);
  out.push("");
  // The prose has to know when a rule was turned off or re-tuned, or it prints a
  // verdict drawn from findings the reader can no longer see.
  const tiers = applyRuleTiers(report.findings, (f) => ({ rule: f.kind, emitted: f.severity }), rules);
  const shown = tiers.shown;
  const suspects = shown.filter((f) => f.tier === "suspect").length;
  out.push(
    `verdict: ${verdictColor}${report.verdict.toUpperCase()}${RESET}`
    + ` (${shown.length} finding(s)${suspects > 0 ? `, ${suspects} suspect` : ""})`,
  );
  const hidden = hiddenByRuleNote(tiers.hiddenByRule);
  if (hidden) out.push(`${DIM}  ${hidden} — the verdict word above predates the settings${RESET}`);
  out.push(
    `${DIM}  measured: ${report.controls.length} control(s), ${report.links.length} link(s) in a text flow`
    + ` — from ${report.boxes} visible box(es)${RESET}`,
  );
  if (report.controlsSkipped.length > 0) {
    out.push(`${DIM}  ${report.controlsSkipped.length} control(s) not measurable: background-image behind them${RESET}`);
  }
  out.push("");
  out.push(`${BOLD}Palette${RESET} ${DIM}(by painted area; reported, never judged — see the rejected candidates in the module docs)${RESET}`);
  out.push(...paletteBlock("surfaces", report.palette.surfaces));
  out.push(...paletteBlock("ink", report.palette.ink));
  out.push(...paletteBlock("marks", report.palette.marks));
  out.push(
    `  ${DIM}base ${report.base?.hex ?? "?"}`
    + (report.base?.count === 0 ? " (page background; nothing declares one)" : "")
    + `, body ink ${report.bodyInk?.hex ?? "?"}`
    + `, link ink ${report.linkInk?.hex ?? "none"}`
    + (report.linkInk ? ` on ${report.linkInk.count} element(s)` : " — every link is set in the body ink")
    + `${RESET}`,
  );

  // Tiers, not the emitted severity: a rule promoted to suspect or demoted to
  // info by project settings has to print where the reader expects it.
  const carried = shown.filter((f) => f.tier !== "info");
  const info = shown.filter((f) => f.tier === "info");
  if (carried.length > 0) {
    out.push("");
    out.push(`${BOLD}Findings${RESET}`);
    for (const f of carried) {
      out.push(
        `  ${f.tier === "suspect" ? RED + "✗" : YELLOW + "!"}${RESET} [${f.row.kind}]:`
        + ` ${f.row.selector ? `${f.row.selector} — ` : ""}${f.row.message}`,
      );
    }
  }
  if (info.length > 0) {
    out.push("");
    out.push(`${BOLD}Informational${RESET} ${DIM}(true, but does not carry the verdict)${RESET}`);
    for (const f of info) out.push(`  ${DIM}i${RESET} [${f.row.kind}]: ${f.row.message}`);
  }
  if (report.allowed.length > 0) {
    out.push("");
    out.push(`${BOLD}Signed off${RESET} ${DIM}(--allow; off the verdict, still listed)${RESET}`);
    for (const a of report.allowed) out.push(`  ${DIM}-${RESET} ${a.selector} — ${a.reason}`);
  }
  if (report.unusedAllow.length > 0) {
    out.push("");
    out.push(`${YELLOW}${report.unusedAllow.length} --allow rule(s) matched nothing: ${report.unusedAllow.join(", ")}${RESET}`);
  }
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface ColorRolesOptions extends PageLoadOptions {
  source: string;
  viewport?: number;
  allow?: readonly string[];
  storageState?: string;
  reportPath?: string;
}

export async function runColorRolesCheck(options: ColorRolesOptions): Promise<ColorRolesReport> {
  return await withBrowser(async (browser) => {
    const width = options.viewport ?? 1280;
    const page = await browser.newPage(
      withAuthState({ viewport: { width, height: 900 } }, options.storageState),
    );
    if (options.har) await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
    // Redirects only mean something for http(s); the URL itself comes from the shared converter.
    const isUrl = /^https?:\/\//.test(options.source);
    const url = sourceToUrl(options.source);
    await page.goto(url, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 30000,
    });
    await settlePage(page, 250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const input = await page.evaluate(COLLECT_COLOR_ROLES) as ColorRolesInput;
    return await judgeCollectedColorRoles(input, redirect, options);
  });
}

/**
 * The judging half of `runColorRolesCheck`, for a palette collected earlier — by this runner,
 * or by `scan style` into a snapshot. Same judge, redirect finding, ledger entry and
 * `--report` file.
 */
export async function judgeCollectedColorRoles(
  input: ColorRolesInput,
  redirect: string | null,
  options: Pick<ColorRolesOptions, "source" | "allow" | "reportPath">,
): Promise<ColorRolesReport> {
  const report = judgeColorRoles(input, { source: options.source, allow: options.allow });
  if (redirect) {
    report.findings.unshift({ kind: "redirected", severity: "suspect", message: redirect });
  }
  return await finishColorRoles(report, options);
}

/**
 * `check color --elements scene.json`: the same judge over a scene instead of a page — a
 * canvas / WebGPU frame, a native toolkit, a game's HUD. No browser is started. The scene
 * contract (`@mizchi/vlmkit-judge/scene.ts`) says which fields each rule reads: `role`,
 * `color`, `background`, `border` + `border_color`, `underline`, `shadow` / `outline`.
 */
export async function runSceneColorRolesCheck(
  options: Pick<ColorRolesOptions, "allow" | "reportPath" | "viewport"> & { elementsPath: string },
): Promise<ColorRolesReport> {
  const elements = parseSceneElements(await readFile(options.elementsPath, "utf8"));
  const width = options.viewport ?? Math.max(0, ...elements.map((e) => e.left + e.width));
  const height = Math.max(0, ...elements.map((e) => e.top + e.height));
  const input = sceneToColorRolesInput(elements, { width, height });
  const report = judgeColorRoles(input, { source: options.elementsPath, allow: options.allow });
  return await finishColorRoles(report, { source: options.elementsPath, reportPath: options.reportPath });
}

/** The run ledger and the optional markdown report, whichever source the snapshot came from. */
async function finishColorRoles(
  report: ColorRolesReport,
  options: { source: string; reportPath?: string },
): Promise<ColorRolesReport> {
  {
    appendRunLedger({
      tool: "check-color",
      source: options.source,
      headline: {
        verdict: report.verdict,
        base: report.base?.hex ?? null,
        bodyInk: report.bodyInk?.hex ?? null,
        linkInk: report.linkInk?.hex ?? null,
        invisibleControls: invisibleControls(report.controls).length,
        colorOnlyLinks: colorOnlyLinks(report.links).weak.length,
        unreadableColors: report.unreadable.reduce((n, u) => n + u.count, 0),
      },
    });
    if (options.reportPath) {
      const target = resolve(options.reportPath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, markdownReport(report), "utf8");
    }
    return report;
  }
}

function markdownReport(report: ColorRolesReport): string {
  const rows = (name: string, list: readonly ColorUse[]) => {
    const kept = trimPalette(list);
    if (kept.length === 0) return [`### ${name}\n\nNone.\n`];
    const total = kept.reduce((n, c) => n + c.area, 0);
    return [
      `### ${name}\n`,
      "| colour | share of role | elements | example |",
      "|---|---|---|---|",
      ...kept.map((c) => `| \`${c.hex}\` | ${pct(c.area, total)} | ${c.count} | \`${c.samples[0] ?? ""}\` |`),
      "",
    ];
  };
  return [
    `# check color — ${report.source}`,
    "",
    `Verdict: **${report.verdict.toUpperCase()}** (${report.findings.length} finding(s))`,
    "",
    `Base \`${report.base?.hex ?? "?"}\`, body ink \`${report.bodyInk?.hex ?? "?"}\`,`
    + ` link ink \`${report.linkInk?.hex ?? "none"}\`.`,
    `${report.controls.length} control(s) and ${report.links.length} link(s) in a text flow measured,`
    + ` from ${report.boxes} visible boxes.`,
    "",
    "## Palette",
    "",
    ...rows("Surfaces", report.palette.surfaces),
    ...rows("Ink", report.palette.ink),
    ...rows("Marks", report.palette.marks),
    "## Findings",
    "",
    ...(report.findings.length === 0
      ? ["None."]
      : report.findings.map((f) => `- **${f.kind}** (${f.severity})${f.selector ? ` \`${f.selector}\`` : ""}: ${f.message}`)),
    "",
  ].join("\n");
}