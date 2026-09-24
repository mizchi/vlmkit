/**
 * `check composition` — the browser half: collect the boxes, then judge them.
 *
 * The principles, every threshold and the pure judge live in
 * `@mizchi/vlmkit-judge/composition.ts`, which runs on a snapshot and never on a
 * page. They are re-exported here so every existing import keeps working.
 */
import { resolve } from "node:path";
import { settlePage, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyRuleTiers, hiddenByRuleNote } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { STYLE_SAMPLING_JS } from "./style-sampling.ts";
import {
  judgeComposition,
  type CompositionFinding,
  type CompositionInput,
  type CompositionJudgeOptions,
  type CompositionReport,
} from "@mizchi/vlmkit-judge/composition.ts";

export * from "@mizchi/vlmkit-judge/composition.ts";

// ---------------------------------------------------------------------------
// Browser collection

/**
 * Collect every visible layout box.
 *
 * `leaf` is computed after the walk because it needs descendants: a box carries
 * text of its own only if none of its collected descendants does. That
 * distinction is what makes the body-size estimate the size of actual
 * paragraphs rather than of every wrapper that inherits one.
 */
export const COLLECT_COMPOSITION = `(() => {
  ${STYLE_SAMPLING_JS}
  const boxes = [];
  const indexOf = new Map();
  for (const el of document.querySelectorAll("body *")) {
    // An SVG's internals are drawing instructions, not layout boxes.
    if (el.closest("svg")) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    // display:contents has no box, so it must not become a grouping parent.
    if (cs.display === "contents") continue;
    let parent = -1;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (indexOf.has(p)) { parent = indexOf.get(p); break; }
    }
    const i = boxes.length;
    indexOf.set(el, i);
    const tag = el.tagName.toLowerCase();
    boxes.push({
      i, parent, selector: path(el), tag,
      heading: /^h[1-6]$/.test(tag) ? Number(tag.slice(1)) : 0,
      x: Math.round(r.x * 10) / 10,
      y: Math.round((r.y + window.scrollY) * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      position: cs.position,
      fontSize: px(cs.fontSize),
      fontWeight: Number(cs.fontWeight) || 400,
      bg: cs.backgroundColor,
      border: px(cs.borderTopWidth),
      radius: px(cs.borderTopLeftRadius),
      textLen: (el.textContent || "").trim().length,
      leaf: false,
    });
  }
  const hasTextDescendant = new Array(boxes.length).fill(false);
  for (const b of boxes) {
    if (b.textLen === 0) continue;
    for (let p = b.parent; p >= 0; p = boxes[p].parent) hasTextDescendant[p] = true;
  }
  for (const b of boxes) b.leaf = b.textLen > 0 && !hasTextDescendant[b.i];
  return { boxes, viewport: { width: window.innerWidth, height: window.innerHeight } };
})()`;

export interface CompositionOptions extends CompositionJudgeOptions {
  source: string;
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  timeout?: number;
  har?: string;
  storageState?: string;
  /** Viewport width. Composition is a function of width, so it is reported. */
  viewport?: number;
  /** `--allow "<selector>;<reason>"` for a deviation that is deliberate. */
  allow?: readonly string[];
}

// ---------------------------------------------------------------------------
// Run

export async function runCompositionCheck(options: CompositionOptions): Promise<CompositionReport> {
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
    // Same reason `check design` settles: this gate judges gaps and type sizes,
    // and measuring before the webfont resolves reports the fallback face's
    // metrics as the composition.
    await settlePage(page, 250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const input = await page.evaluate(COLLECT_COMPOSITION) as CompositionInput;
    const judged = judgeComposition(input, options);
    if (redirect) {
      judged.findings.unshift({ kind: "redirected", severity: "suspect", message: redirect });
    }
    const report: CompositionReport = { source: options.source, ...judged };
    appendRunLedger({
      tool: "check-composition",
      source: options.source,
      headline: {
        verdict: report.verdict,
        proximity: report.labels.filter((l) => l.inverted).length,
        flatSteps: report.hierarchy.flat.length,
        railNearMisses: report.rails.near.length,
      },
    });
    return report;
  });
}

// ---------------------------------------------------------------------------
// Prose

export function formatCompositionReport(report: CompositionReport, rules?: RuleView): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit check composition${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  const tiers = applyRuleTiers(report.findings, (f) => ({ rule: f.kind, emitted: f.severity }), rules);
  const shown = tiers.shown;
  const suspects = shown.filter((f) => f.tier === "suspect").length;
  lines.push(
    `verdict: ${
      report.verdict === "composed"
        ? `${GREEN}COMPOSED${RESET}`
        : report.verdict === "unbalanced"
          ? `${YELLOW}UNBALANCED${RESET}`
          : `${YELLOW}NOT JUDGED${RESET}`
    } (${shown.length} finding(s)${suspects > 0 ? `, ${suspects} suspect` : ""})`,
  );
  const hidden = hiddenByRuleNote(tiers.hiddenByRule);
  if (hidden) lines.push(`${DIM}  ${hidden} — the verdict word above predates the settings${RESET}`);
  // Coverage on the verdict line, the way `check design` prints it: a quiet
  // verdict drawn from two labels is worth knowing about before it is trusted.
  lines.push(
    `${DIM}  measured: ${report.labels.length} label(s), ${report.hierarchy.levels.length} heading level(s),`
    + ` ${report.rails.blocks} wide block(s) on ${report.rails.lefts} left / ${report.rails.rights} right rail(s)`
    + ` — from ${report.boxes} visible box(es)${RESET}`,
  );
  if (report.labelsUnjudged.length > 0) {
    lines.push(
      `${DIM}  ${report.labelsUnjudged.length} label(s) not judged: they open a box that paints its own`
      + ` group edge, so nothing above them could be mis-grouped with${RESET}`,
    );
  }
  lines.push("");

  if (report.hierarchy.levels.length > 0) {
    lines.push(`${BOLD}Type hierarchy${RESET} ${DIM}(largest instance of each declared level)${RESET}`);
    for (const l of report.hierarchy.levels) {
      lines.push(`  h${l.level}  ${String(l.fontSize).padStart(5)}px / ${l.fontWeight}   ${DIM}${l.selector}${RESET}`);
    }
    lines.push(
      `${DIM}  body ${report.hierarchy.bodyFontSize}px, largest ${report.hierarchy.maxFontSize}px`
      + ` (${report.hierarchy.range}x), heaviest +${report.hierarchy.weightDelta} weight${RESET}`,
    );
    lines.push("");
  }
  if (report.separation.samples > 0) {
    // Measurement, not a verdict — and labelled as such, because the number
    // looks gateable and the study showed it is not.
    lines.push(
      `${DIM}Group gaps: ${report.separation.inter}px between heading-led groups vs`
      + ` ${report.separation.intra}px inside them (${report.separation.ratio}x, ${report.separation.samples} sample(s)).`
      + ` Context only — intact pages measure 0.86-3.00x, so this cannot carry a verdict.${RESET}`,
    );
    lines.push("");
  }
  if (report.allowed.length > 0) {
    for (const a of report.allowed) {
      lines.push(`${DIM}allowed: ${a.selector} — ${a.reason}${RESET}`);
    }
  }
  if (report.unusedAllow.length > 0) {
    lines.push(`${YELLOW}${report.unusedAllow.length} --allow rule(s) matched nothing: ${report.unusedAllow.join(", ")}${RESET}`);
    lines.push(`${DIM}Delete them: an exemption kept past what it covered only widens the blind spot.${RESET}`);
  }
  if (report.allowed.length > 0 || report.unusedAllow.length > 0) lines.push("");

  if (shown.length === 0) {
    lines.push(tiers.hiddenByRule.size > 0
      ? `${DIM}No composition finding reported — every finding's rule is off.${RESET}`
      : `${GREEN}Proximity, alignment and type hierarchy all read consistently.${RESET}`);
    return lines.join("\n");
  }
  const mark = (tier: CompositionFinding["severity"]) =>
    tier === "suspect" ? `${RED}x${RESET}` : tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
  const row = ({ row: f, tier }: { row: CompositionFinding; tier: CompositionFinding["severity"] }) =>
    `  ${mark(tier)} [${f.kind}]${tier === f.severity ? "" : ` (re-tuned to ${tier})`}: ${f.message}`;
  const carried = shown.filter((f) => f.tier !== "info");
  const informational = shown.filter((f) => f.tier === "info");
  if (carried.length > 0) {
    lines.push(`${BOLD}Findings${RESET}`);
    for (const f of carried) lines.push(row(f));
  }
  if (informational.length > 0) {
    if (carried.length > 0) lines.push("");
    lines.push(`${BOLD}Informational${RESET} ${DIM}(true, but does not carry the verdict)${RESET}`);
    for (const f of informational) lines.push(row(f));
  }
  return lines.join("\n");
}
