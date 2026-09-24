#!/usr/bin/env node
/**
 * `check design` — the browser half: collect role-grouped style signatures, then judge them.
 *
 * The study behind every threshold, and the pure judge, live in
 * `@mizchi/vlmkit-judge/design-policy.ts`, which runs on a snapshot and never on a
 * page. They are re-exported here so every existing import keeps working.
 *
 * CLI:
 *   vlmkit check design <html-or-url> [--min-reuse 3] [--json] [--advisory]
 */
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
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
  judgeDesignPolicy,
  type DesignFinding,
  type DesignJudgeOptions,
  type DesignPolicyInput,
  type DesignPolicyReport,
} from "@mizchi/vlmkit-judge/design-policy.ts";

import { parseSceneElements, sceneToDesignPolicyInput } from "@mizchi/vlmkit-judge/scene.ts";

export * from "@mizchi/vlmkit-judge/design-policy.ts";

export interface DesignPolicyOptions extends DesignJudgeOptions {
  source: string;
  /** Vendor-owned subtrees omitted before component and spacing collection. */
  exclude?: readonly string[];
  /** Playwright navigation milestone. Defaults to networkidle. */
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  /** Navigation timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
  /** Replay network responses from a Playwright HAR for deterministic URL gates. */
  storageState?: string;
}


/**
 * Collect role-grouped style signatures and spacing usage.
 *
 * Role inference is deliberately narrow: an explicit `role`, or a tag whose
 * semantics are unambiguous. `input`, `select` and `textarea` are kept as
 * SEPARATE roles — grouping them as one "field" role produced a false drift
 * signal in the study, because the browser styles them differently by design.
 *
 * Non-resting states (disabled, pressed, expanded, current, selected,
 * checked) are excluded: a pressed button legitimately differs from an
 * unpressed one. Measured impact — this alone took the S19 fixture from 6
 * apparent signatures to 3 real ones.
 */
export const COLLECT_DESIGN_SAMPLES = `(() => {
  const excludedSelectors = [];
  const exclusions = excludedSelectors.map((selector) => {
    try {
      return { selector, matches: document.querySelectorAll(selector).length, elements: 0 };
    } catch (error) {
      throw new Error('invalid --exclude selector "' + selector + '": ' + error.message);
    }
  });
  ${STYLE_SAMPLING_JS}
  const STATE = ":disabled,[aria-disabled=true],[aria-pressed=true],[aria-expanded=true],[aria-current],[aria-selected=true],:checked";
  // Text the browser paints that the DOM does not expose as a child text node:
  // input[type=button] paints its \`value\`, a text input paints its value and
  // placeholder, a select paints the chosen option. textContent is "" for all
  // three, so a textContent-only test would drop the font comparison from
  // exactly the elements whose entire box is text.
  const IMPLICIT_TEXT = "input,select,textarea";
  // <title>/<desc> inside an SVG are tooltip and a11y metadata, never painted.
  // MapLibre's zoom buttons carry <title>Zoom in</title>, which would otherwise
  // make every icon-only control read as text-bearing and defeat the whole fix.
  const UNPAINTED_TEXT = "script,style,template,title,desc,metadata";
  const paintsText = (el) => {
    if (el.matches && el.matches(IMPLICIT_TEXT)) return true;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (node.parentElement && node.parentElement.closest(UNPAINTED_TEXT)) continue;
      return true;
    }
    // An icon-FONT glyph lives in generated content and scales with font-size,
    // so \`content: "\\f00c"\` makes the font observable even with no child text.
    // A url()/gradient \`content\` is an image and does not.
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(el, pseudo).content;
      if (!content || content === "none" || content === "normal") continue;
      if (/^(url|image|image-set|linear-gradient|radial-gradient|conic-gradient|element)\\(/.test(content)) continue;
      if (/^["']\\s*["']$/.test(content)) continue;
      return true;
    }
    return false;
  };
  const roleOf = (el) => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.trim();
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "input") {
      const t = (el.type || "text").toLowerCase();
      return /^(button|submit|reset)$/.test(t) ? "button" : "input:" + t;
    }
    if (tag === "select" || tag === "textarea") return tag;
    if (/^h[1-6]$/.test(tag)) return tag;
    return null;
  };
  const samples = [], spacing = [];
  // Tally the skipped elements BY TAG. \`skipped: 28\` alone is uninterpretable —
  // v6's adopting agent could not tell whether 28 of 30 meant "the page is
  // ordinary layout markup" or "the measurement broke". \`div x24, p x3\` answers
  // it at a glance, and answers it with the page's own markup rather than prose.
  const skippedTags = {};
  let skipped = 0, statefulSkipped = 0, excludedElements = 0;
  for (const el of document.querySelectorAll("body *")) {
    // The FIRST matching selector owns the element, so the per-selector counts
    // sum to \`excludedElements\` even when two exclusions nest. A report whose
    // rows disagree with its own total is worse than no rows.
    const owner = excludedSelectors.findIndex((selector) => el.closest(selector));
    if (owner >= 0) {
      exclusions[owner].elements++;
      excludedElements++;
      continue;
    }
    if (!visible(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const cs = getComputedStyle(el);
    for (const prop of ["paddingTop","paddingBottom","paddingLeft","paddingRight","marginTop","marginBottom","rowGap","columnGap"]) {
      const v = px(cs[prop]);
      if (v > 0) spacing.push({ selector: path(el), property: prop, value: v });
    }
    const role = roleOf(el);
    if (!role) {
      skipped++;
      const tag = el.tagName.toLowerCase();
      skippedTags[tag] = (skippedTags[tag] || 0) + 1;
      continue;
    }
    if (el.matches && el.matches(STATE)) { statefulSkipped++; continue; }
    // Rendered height is deliberately NOT in the signature: a button that is
    // taller only because its label wrapped is not a design inconsistency.
    //
    // The style FACTS, not the signature: the judge's designSample() joins them
    // (box and font halves, so a text-free element compares on the box alone),
    // which is what lets a scene from another renderer be compared the same way.
    samples.push({
      role,
      selector: path(el),
      padding: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)],
      radius: px(cs.borderTopLeftRadius),
      borderWidth: px(cs.borderTopWidth),
      background: cs.backgroundColor,
      fontSize: px(cs.fontSize),
      fontWeight: cs.fontWeight,
      textFree: !paintsText(el),
    });
  }
  return { samples, spacing, skipped, skippedTags, statefulSkipped, exclusions, excludedElements };
})()`;

export function buildDesignSampleScript(excludeSelectors: readonly string[] = []): string {
  return COLLECT_DESIGN_SAMPLES.replace(
    "const excludedSelectors = [];",
    `const excludedSelectors = ${JSON.stringify([...excludeSelectors])};`,
  );
}

export async function runDesignPolicyCheck(options: DesignPolicyOptions): Promise<DesignPolicyReport> {
  return await withBrowser(async (browser) => {
    const page = await browser.newPage(withAuthState({ viewport: { width: 1280, height: 900 } }, options.storageState));
    if (options.har) {
      await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
    }
    // Redirects only mean something for http(s); the URL itself comes from the shared converter.
    const isUrl = /^https?:\/\//.test(options.source);
    const url = sourceToUrl(options.source);
    await page.goto(url, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 30000,
    });
    // One definition of "settled" (`@mizchi/vlmkit-core/page-open.ts`): network idle, fonts
    // ready, then a frame. This gate judges spacing and component signatures, so measuring
    // before the webfont resolves reports the fallback face's metrics as the design system's.
    await settlePage(page, 250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const input = await page.evaluate(buildDesignSampleScript(options.exclude)) as DesignPolicyInput;
    const judged = judgeDesignPolicy(input, options);
    if (redirect) {
      judged.findings.unshift({ kind: "redirected", severity: "suspect", message: redirect });
    }
    return recordDesignRun({ source: options.source, ...judged });
  });
}

/**
 * `check design --elements scene.json`: the same judge over a scene — a canvas / WebGPU
 * frame, a native toolkit, a game HUD. No browser is started. Elements group by `role` (or
 * a heading level), and their `padding`, `radius`, `border`, `background`, `font_size` and
 * `font_weight` form the signature, as the page's computed style does.
 */
export async function runSceneDesignPolicyCheck(
  options: DesignJudgeOptions & { elementsPath: string },
): Promise<DesignPolicyReport> {
  const elements = parseSceneElements(await readFile(options.elementsPath, "utf8"));
  const judged = judgeDesignPolicy(sceneToDesignPolicyInput(elements), options);
  return recordDesignRun({ source: options.elementsPath, ...judged });
}

function recordDesignRun(report: DesignPolicyReport): DesignPolicyReport {
  appendRunLedger({
    tool: "check-design",
    source: report.source,
    headline: {
      verdict: report.verdict,
      drifting: report.findings.filter((f) => f.kind === "component-drift").length,
      roles: report.roles.length,
    },
  });
  return report;
}

export function formatDesignReport(report: DesignPolicyReport, rules?: RuleView): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit check design${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  // A finding's `kind` is the rule id on this gate, and its declared severity travels with it,
  // so the settings apply row by row. Everything above the Findings block — coverage, role
  // reuse, exclusions, allowances — is measurement and stays whatever the settings say.
  const tiers = applyRuleTiers(report.findings, (f) => ({ rule: f.kind, emitted: f.severity }), rules);
  const shownFindings = tiers.shown;
  const bad = shownFindings.filter((f) => f.tier === "suspect").length;
  // The size of the blind spot goes ON the verdict line, the way `check
  // integrity` prints `(2 fail, 1 warn, 5 exempted)`. A reader deciding how much
  // a COHERENT verdict is worth has to see how much of the page it covered
  // without scrolling for it.
  lines.push(
    `verdict: ${
      report.verdict === "coherent"
        ? `${GREEN}COHERENT${RESET}`
        : report.verdict === "drift"
          ? `${YELLOW}DRIFT${RESET}`
          : `${YELLOW}NOT JUDGED${RESET}`
    }`
    + ` (${shownFindings.length} finding(s)${bad > 0 ? `, ${bad} suspect` : ""}`
    + `${report.excludedElements > 0 ? `, ${report.excludedElements} element(s) excluded` : ""})`,
  );
  // The verdict WORD still comes from `report.verdict` — it is the JSON contract, the same
  // choice `check integrity` made. So a page whose only drift rule is off can print DRIFT
  // above zero findings, and this line is what keeps that from reading as a bug.
  const hiddenNote = hiddenByRuleNote(tiers.hiddenByRule);
  if (hiddenNote) lines.push(`${DIM}  ${hiddenNote} — the verdict word above predates the settings${RESET}`);
  // `roles.length` counted the unjudged ones, so this said `roles judged: 2` for a
  // page where the reuse check ran on nothing at all.
  const judgedRoleCount = report.roles.filter((r) => !r.notJudged).length;
  lines.push(
    `${DIM}  roles judged: ${judgedRoleCount}`
    + `${judgedRoleCount < report.roles.length ? ` of ${report.roles.length} seen` : ""}`
    + `, spacing values: ${report.spacingValues}${RESET}`,
  );
  // `skipped: 28 (no inferable role)` was the whole of this before, and v6's
  // adopting agent could not act on it: "28 of 30 elements skipped means the
  // verdict rests on almost nothing, and nothing says whether that is normal."
  // Three things fix that, in order of how fast they answer it: the fraction
  // (how much of the page the verdict covers), the tags (what the skipped
  // elements ARE), and one line saying where a role comes from at all.
  const considered = report.judgedElements + report.skipped + report.statefulSkipped;
  lines.push(
    `${DIM}  coverage: ${report.judgedElements} of ${considered} visible element(s) carried an`
    + ` inferable role${report.statefulSkipped > 0 ? `; ${report.statefulSkipped} skipped as non-resting` : ""}${RESET}`,
  );
  if (report.skippedTags.length > 0) {
    const shown = report.skippedTags.slice(0, 6).map((t) => `${t.tag} x${t.count}`).join(", ");
    const rest = report.skippedTags.length - 6;
    lines.push(`${DIM}    no role: ${shown}${rest > 0 ? `, +${rest} more tag(s)` : ""}${RESET}`);
  }
  if (report.skipped > 0) {
    // Kept next to the tally rather than in the docs, because the reader needing
    // it is looking at a number they did not expect. This mirrors `roleOf` in the
    // browser script above — if that list grows, this sentence grows with it.
    lines.push(
      `${DIM}    A role comes from role="..." or from button/input/select/textarea/h1-h6.`
      + ` Layout elements${RESET}`,
    );
    lines.push(
      `${DIM}    (div, span, p, a) have none, so a large skip count is normal —`
      + ` this gate judges components,${RESET}`,
    );
    lines.push(
      `${DIM}    not every box. Add role="..." where an element IS a component to widen the coverage.${RESET}`,
    );
  }
  if (report.textFreeSamples > 0) {
    lines.push(
      `${DIM}  text-free: ${report.textFreeSamples} (${report.textFreeFolded} judged on box alone —`
      + ` font-size/weight is not observable without painted text)${RESET}`,
    );
  }
  lines.push("");
  if (report.roles.length > 0) {
    lines.push(
      `${BOLD}Role reuse${RESET} ${DIM}(instances / distinct styles;`
      + ` drift below ${report.thresholds.minReuse}x from ${report.thresholds.minInstances} instances)${RESET}`,
    );
    const { minReuse, minInstances } = report.thresholds;
    for (const r of report.roles.slice(0, 10)) {
      // `not judged` is its own state, never `ok`. It used to render as `ok`, so a
      // role sitting at `reuse 1x, 2 one-off` printed green next to numbers that
      // contradicted it — the row carried its own refutation.
      const flag = r.notJudged
        ? `${YELLOW}not judged${RESET}`
        : r.reuse < minReuse
          ? `${YELLOW}drift${RESET}`
          : `${GREEN}ok${RESET}`;
      lines.push(`  ${r.role.padEnd(14)} ${String(r.instances).padStart(3)} inst  ${String(r.signatures).padStart(3)} styles`
        + `  reuse ${String(r.reuse).padStart(5)}x  ${r.singletons} one-off  ${flag}`);
    }
    const unjudged = report.roles.filter((r) => r.notJudged);
    if (unjudged.length > 0) {
      lines.push(
        `${DIM}  not judged: ${unjudged.map((r) => `${r.role} (${r.instances})`).join(", ")}`
        + ` — under --min-instances ${minInstances}, so no finding can come from`
        + ` ${unjudged.length === 1 ? "it" : "them"}.${RESET}`,
      );
      // The remedy has to name both flags. Lowering --min-instances alone leaves a
      // 2-instance role unable to clear a 3x floor, so the run would still never
      // move — which is the failure this whole block exists to stop.
      const byAllow = unjudged.filter((r) => r.unjudgedByAllow);
      if (byAllow.length > 0) {
        lines.push(
          `${YELLOW}  --allow took ${byAllow.map((r) => r.role).join(", ")} under that floor.`
          + ` A real drift there would NOT be reported.${RESET}`,
        );
      }
      lines.push(
        `${DIM}  To keep judging ${unjudged.length === 1 ? "it" : "them"}:`
        + ` --min-instances 2 --min-reuse 2 (both — a 2-instance role cannot reach`
        + ` ${minReuse}x however many instances the floor allows).${RESET}`,
      );
    }
    lines.push("");
  }
  if (report.exclusions.length > 0) {
    lines.push(`${BOLD}Excluded subtrees${RESET} ${DIM}(${report.excludedElements} unique element(s) omitted)${RESET}`);
    for (const exclusion of report.exclusions) {
      // Root matches AND elements removed, because they fail differently: 0
      // roots means the selector is wrong or the widget is gone, while roots
      // with 0 elements means it matched outside the measured tree.
      const marker = exclusion.elements === 0 ? `${YELLOW}!${RESET}` : `${DIM}-${RESET}`;
      lines.push(
        `  ${marker} ${exclusion.selector}: ${exclusion.matches} root match(es),`
        + ` ${exclusion.elements} element(s) removed`,
      );
    }
    if (report.unusedExcludes.length > 0) {
      lines.push(`${YELLOW}${report.unusedExcludes.length} --exclude selector(s) removed nothing${RESET}`);
      lines.push(`${DIM}Delete them: an exclusion kept past the widget it covered only widens the blind spot.${RESET}`);
    }
    lines.push("");
  }
  // Allowed instances, stated. Same property as `--exclude` and as `check integrity
  // --allow`: the exemption is visible, and a rule that matched nothing is reported.
  const allowedRoles = report.roles.filter((r) => (r.allowed ?? 0) > 0);
  if (allowedRoles.length > 0 || (report.unusedAllow ?? []).length > 0) {
    for (const r of allowedRoles) {
      lines.push(`${DIM}allowed: ${r.allowed} ${r.role} instance(s) declared deliberate and left out of the reuse figure${RESET}`);
    }
    if ((report.unusedAllow ?? []).length > 0) {
      lines.push(`${YELLOW}${report.unusedAllow!.length} --allow rule(s) matched nothing: ${report.unusedAllow!.join(", ")}${RESET}`);
    }
    lines.push("");
  }
  if (shownFindings.length === 0) {
    // Not "No design drift detected" when the drift was found and silenced: that sentence
    // would be false, and it is the one line a reader quotes back.
    lines.push(tiers.hiddenByRule.size > 0
      ? `${DIM}No design drift reported — every finding's rule is off.${RESET}`
      : `${GREEN}No design drift detected.${RESET}`);
    return lines.join("\n");
  }
  const carried = shownFindings.filter((f) => f.tier !== "info");
  const informational = shownFindings.filter((f) => f.tier === "info");
  const mark = (tier: DesignFinding["severity"]) =>
    tier === "suspect" ? `${RED}x${RESET}` : tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
  const row = ({ row: f, tier }: { row: DesignFinding; tier: DesignFinding["severity"] }) =>
    `  ${mark(tier)} [${f.kind}]${f.role ? ` ${f.role}` : ""}${tier === f.severity ? "" : ` (re-tuned to ${tier})`}`
    + `: ${f.message}`;
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

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check design` is declared in `../gates/design.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
