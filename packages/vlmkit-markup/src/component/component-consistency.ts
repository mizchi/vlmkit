#!/usr/bin/env node
/**
 * Inline → componentized refactor verifier.
 *
 * Use case: agent extracts an inline `<div class="card">…</div>`
 * into a shared `<Card />` component (React / Vue / Svelte / a
 * partial). On a page with N call sites, the agent intends every
 * `.card` to render identically. Bug class: they converted 4 of 5
 * instances; the 5th is still inline and has drifted (different
 * padding, missing border, etc.). A single-page VRT misses this
 * because the page diff is zero before vs after the refactor.
 *
 * Approach: capture every `--selector` match on the page via
 * Playwright `locator.screenshot()`, compare each instance against
 * the first one (the reference). Drift surfaces as pixel diff %.
 *
 * This is the single-page-multi-instance sibling of
 * `multi-page-consistency.ts` (which is one-match-per-page across
 * multiple pages).
 *
 * Usage:
 *   vlmkit check drift component <html> --selector .card
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { resolveSource, sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import { TRACKED_PROPERTIES } from "@mizchi/vlmkit-core/computed-style-capture.ts";
import {
  applyDriftAllowRules,
  parseDriftAllowRules,
  type DriftAllowRule,
  type ExemptedStyleDelta,
} from "./drift-exemption.ts";
import { extractPaletteFromFile } from "../style/palette-extract.ts";
import { diffPalettes } from "../style/palette-diff.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";


/**
 * The properties that say "this is the same component", with `width` and `height`
 * deliberately left out.
 *
 * Two instances of one component holding different copy have different computed
 * heights — the text wraps — and that is not drift. The size difference is already
 * reported as `bboxDeltas`, where a reader can see it and judge; folding it into the
 * style comparison would put the content difference straight back into the verdict
 * this exists to keep it out of.
 */
const STYLE_PROPERTIES = [
  ...TRACKED_PROPERTIES.filter((prop) => prop !== "width" && prop !== "height"),
  // `outline` is not in the shared list, and its absence was load-bearing: a dogfood
  // agent distinguished a variant with `outline: 3px solid #2255cc` and the gate
  // answered "every tracked computed style matches — different content, not drift" at
  // a 12.50% pixel difference. It is a styling difference; it just was not looked at.
  "outline-width", "outline-style", "outline-color", "outline-offset",
];
export interface ComponentConsistencyOptions {
  htmlPath: string;
  selector: string;
  outputDir: string;
  reportPath?: string;
  /**
   * Pass line on the measured diff ratio. **Not** the comparator's per-pixel colour
   * tolerance — that is `pixelTolerance`.
   *
   * The two were one flag until a dogfood agent found that raising it moved the
   * measurement as well as the bar: "instance #1 reports 95.5% at 0.05 and 9.65% at
   * 0.06. I first read the drop as my fix working." A pass line that changes what it
   * is compared against is not a pass line.
   */
  threshold?: number;
  /** Comparator per-pixel colour tolerance, 0-1. Default 0.1, as everywhere else. */
  pixelTolerance?: number;
  /**
   * `--allow` specs declaring which style differences are deliberate, e.g.
   * `"background-color@.card--featured;variant accent"`. See `drift-exemption.ts`.
   */
  allow?: string[];
  viewport?: { width: number; height: number };
  /** Which instance to use as the reference. Default 0 (first match). */
  referenceIndex?: number;
}

/** Computed style of one instance, over the properties that describe its styling. */
export type InstanceStyle = Record<string, string>;

export interface InstanceEntry {
  index: number;
  screenshotPath: string;
  /** Computed styling, for telling drift apart from different copy. */
  style?: InstanceStyle;
  /** `class` attribute, which is what an `--allow` rule's selector part matches. */
  classList?: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface InstanceDelta {
  candidateIndex: number;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  bboxDeltas: { width: number; height: number };
  paletteOnlyInRef: number;
  paletteOnlyInCand: number;
  /**
   * Computed-style properties that differ from the reference. Empty means the two
   * instances are styled identically and the pixel difference is their content.
   */
  styleDeltas: { property: string; reference: string; candidate: string }[];
  /**
   * Differences an `--allow` rule declared deliberate. Still listed — an exemption
   * a reader cannot see is a blind spot rather than a decision.
   */
  exemptedStyleDeltas: ExemptedStyleDelta[];
}

export interface ComponentConsistencyReport {
  /**
   * `--allow` rules that matched nothing on any instance. Reported so a rule kept
   * alive past the variant it covered gets deleted rather than quietly widening the
   * blind spot — the property the adoption report singled out about
   * `check integrity --allow`.
   */
  unusedAllowRules?: string[];
  /** How many `--allow` rules the run was given, so the report can offer the flag to someone who has not used it. */
  allowRuleCount: number;
  html: string;
  selector: string;
  instanceCount: number;
  referenceIndex: number;
  instances: InstanceEntry[];
  deltas: InstanceDelta[];
  reportPath: string;
}

export async function runComponentConsistency(
  options: ComponentConsistencyOptions,
): Promise<ComponentConsistencyReport> {
  if (!options.selector) throw new UsageError("--selector is required");
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  // `resolveSource`, not `resolve`: the latter turns "http://x/p.html" into
  // "<cwd>/http:/x/p.html", which then fails as "file not found" and tells the caller
  // nothing. The gate's input has always been spelled `<html-or-url>`.
  const htmlPath = resolveSource(options.htmlPath);
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const referenceIndex = options.referenceIndex ?? 0;
  const threshold = options.threshold ?? 0.03;
  const pixelTolerance = options.pixelTolerance ?? 0.1;
  const allowRules = parseDriftAllowRules(options.allow ?? []);

  const instances: InstanceEntry[] = [];
  // `withBrowser`: the zero-match `UsageError` below is thrown from inside this
  // scope, and on the straight-line form that throw skipped the close entirely.
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    // Navigate; do not `setContent` bytes read off disk.
    //
    // This gate screenshots each instance and compares pixels, so a document with no
    // base URL does not merely lose styling — it makes the numbers describe a page that
    // does not exist. Measured on a fixture whose `.card--wrong` modifier lives only in
    // `card.css` (padding 28px vs 12px): `setContent` reported instance deltas of 1.06%
    // and 1.32% with `Δ 0 / 0`, i.e. it saw three same-sized unstyled boxes and
    // attributed the difference to the glyphs "Alpha" / "Beta" / "Gamma". The modifier
    // that actually makes one instance inconsistent was invisible.
    //
    // Same mechanism `page-open.ts` documents for `check a11y contrast`; converting this
    // also makes the `<html-or-url>` spelling true for the first time.
    await page.goto(sourceToUrl(htmlPath), { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
    const locator = page.locator(options.selector);
    const count = await locator.count();
    if (count === 0) {
      throw new UsageError(`Selector \`${options.selector}\` matched zero elements on ${htmlPath}`);
    }
    for (let i = 0; i < count; i++) {
      const inst = locator.nth(i);
      const bbox = await inst.boundingBox();
      if (!bbox) continue;
      const screenshotPath = join(outputDir, `instance-${i}.png`);
      await inst.screenshot({ path: screenshotPath });
      const style = await inst.evaluate((el, props) => {
        const computed = getComputedStyle(el as Element);
        const out: Record<string, string> = {};
        for (const prop of props as string[]) out[prop] = computed.getPropertyValue(prop);
        return out;
      }, STYLE_PROPERTIES);
      const classList = await inst.evaluate((el) => {
        const element = el as Element;
        // Prefixed with `.` per class so `@.card--featured` matches as a substring the
        // way an author writes it, and the tag name is included so `@article` works too.
        const classes = Array.from(element.classList).map((c) => `.${c}`).join("");
        return `${element.tagName.toLowerCase()}${classes}`;
      });
      instances.push({ index: i, screenshotPath, bbox, style, classList });
    }
    await page.close();
  });

  if (instances.length < 2) {
    throw new UsageError(`Selector matched ${instances.length} element(s); need at least 2 to check consistency.`);
  }

  const reference = instances[referenceIndex] ?? instances[0]!;
  const deltas: InstanceDelta[] = [];
  const usedAllowRules = new Set<string>();
  for (const cand of instances) {
    if (cand.index === reference.index) continue;
    const snap: VrtSnapshot = {
      testId: `consistency-${cand.index}`,
      testTitle: `${cand.index} vs ${reference.index}`,
      projectName: "component-consistency",
      screenshotPath: cand.screenshotPath,
      baselinePath: reference.screenshotPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, { outputDir, threshold: pixelTolerance });
    const [refPalette, candPalette] = await Promise.all([
      extractPaletteFromFile(reference.screenshotPath).catch(() => []),
      extractPaletteFromFile(cand.screenshotPath).catch(() => []),
    ]);
    const paletteDiff = diffPalettes(refPalette, candPalette);
    deltas.push({
      candidateIndex: cand.index,
      diffRatio: diff?.diffRatio ?? 0,
      diffPixels: diff?.diffPixels ?? 0,
      totalPixels: diff?.totalPixels ?? 0,
      bboxDeltas: {
        width: Math.round(cand.bbox.width - reference.bbox.width),
        height: Math.round(cand.bbox.height - reference.bbox.height),
      },
      paletteOnlyInRef: paletteDiff.onlyInBaseline.length,
      paletteOnlyInCand: paletteDiff.onlyInVariant.length,
      ...splitDeltas(cand, reference, allowRules, usedAllowRules),
    });
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport(htmlPath, options.selector, instances, reference.index, deltas);
  await writeFile(reportPath, md);


  return {
    html: htmlPath,
    selector: options.selector,
    instanceCount: instances.length,
    referenceIndex: reference.index,
    instances,
    deltas,
    reportPath,
    allowRuleCount: allowRules.length,
    ...(allowRules.length > 0
      ? { unusedAllowRules: allowRules.filter((r) => !usedAllowRules.has(r.raw)).map((r) => r.raw) }
      : {}),
  };
}

/**
 * Terminal summary, extracted from the measurement function. A gate's `run`
 * must not print — the core runner owns output and decides between prose and
 * `--json`.
 */
export function formatComponentConsistencyReport(report: ComponentConsistencyReport, rules?: RuleView): string {
  const lines: string[] = [];
  // Which rule a row would be reported under, decided the same way `../gates/drift.gate.ts`
  // decides it: tracked properties differ -> `instance-drift`, otherwise the pixels differ for
  // some other reason -> `instance-content-differs`. The gate additionally drops rows below
  // `--threshold`, and this cannot see that number; dimming a sub-threshold row whose rule is
  // off is still true — nothing under an off rule is being reported either way.
  const ruleOf = (d: InstanceDelta) => d.styleDeltas.length > 0
    ? { rule: "instance-drift", emitted: "suspect" as const }
    : { rule: "instance-content-differs", emitted: "info" as const };
  const offRules = new Map<string, number>();
  lines.push(`  ${BOLD}${CYAN}vlmkit check drift component${RESET}`);
  lines.push(`  ${DIM}html: ${report.html}  selector: ${report.selector}${RESET}`);
  lines.push(`  ${DIM}${report.instanceCount} instance(s), reference = #${report.referenceIndex}${RESET}`);
  // Said once, at the top, because the pixel percentage is the number a reader's eye
  // lands on and it is not the number that gates. v4's repair agent proved how far
  // that goes wrong: "instance #1 read `9.15%` while instance #2 read `4.45%` — yet #1
  // was ✗ and #2 was ~. […] After `--allow`, instance #1 still prints `9.15%` and now
  // passes, so the same number means 'fail' and 'pass' in two runs."
  lines.push(`  ${DIM}verdict is set by tracked computed style; the pixel % is context, not the pass line${RESET}`);
  for (const d of report.deltas) {
    const pct = (d.diffRatio * 100).toFixed(2);
    // The icon follows the computed style, not the pixel count. A pixel ratio cannot
    // tell "this instance is styled differently" from "this instance holds different
    // copy", and marking the second one ✗ is what made this gate unpassable on a page
    // with real content.
    const ruled = ruleOf(d);
    const tier = ruleTier(rules, ruled.rule, ruled.emitted);
    if (tier === "off" && !(d.styleDeltas.length === 0 && d.diffRatio === 0)) {
      offRules.set(ruled.rule, (offRules.get(ruled.rule) ?? 0) + 1);
    }
    const icon = tier === "off"
      ? `${DIM}-${RESET}`
      : d.styleDeltas.length > 0
      ? (tier === "suspect" ? `${RED}✗${RESET}` : `${YELLOW}!${RESET}`)
      : d.diffRatio === 0
        ? `${GREEN}✓${RESET}`
        : `${YELLOW}~${RESET}`;
    // And the verdict in words next to the icon, so the row states its own reason
    // rather than leaving the reader to infer it from which number moved.
    const verdict = d.styleDeltas.length > 0
      ? `${d.styleDeltas.length} tracked propert${d.styleDeltas.length === 1 ? "y" : "ies"} differ`
      : d.exemptedStyleDeltas.length > 0
        ? `all ${d.exemptedStyleDeltas.length} difference(s) exempted`
        : d.diffRatio === 0
          ? "identical"
          : "no tracked property differs";
    const whDelta = `Δ ${d.bboxDeltas.width > 0 ? "+" : ""}${d.bboxDeltas.width} / ${d.bboxDeltas.height > 0 ? "+" : ""}${d.bboxDeltas.height}`;
    const retuned = tier !== "off" && tier !== ruled.emitted && d.styleDeltas.length > 0
      ? ` ${DIM}[${ruled.rule} re-tuned to ${tier}]${RESET}`
      : "";
    lines.push(`  ${icon} instance #${d.candidateIndex}  ${verdict.padEnd(30)}  ${DIM}${pct.padStart(6)}% px  ${whDelta}${RESET}${retuned}`);
    if (d.styleDeltas.length > 0) {
      // The properties are the actionable part: an agent told to "replace the inline
      // markup with the shared component invocation" on markup that was already
      // identical had nothing to act on.
      for (const s of d.styleDeltas.slice(0, 6)) {
        lines.push(`      ${DIM}${s.property}: ${s.reference} → ${s.candidate}${RESET}`);
      }
      if (d.styleDeltas.length > 6) {
        lines.push(`      ${DIM}and ${d.styleDeltas.length - 6} more propert${d.styleDeltas.length - 6 === 1 ? "y" : "ies"}${RESET}`);
      }
    }
    for (const e of d.exemptedStyleDeltas.slice(0, 4)) {
      lines.push(`      ${DIM}exempted ${e.property}: ${e.reference} → ${e.candidate} — ${e.reason}${RESET}`);
    }
    if (d.exemptedStyleDeltas.length > 4) {
      lines.push(`      ${DIM}and ${d.exemptedStyleDeltas.length - 4} more exempted${RESET}`);
    }
    if (d.styleDeltas.length === 0 && d.diffRatio > 0) {
      // Deliberately NOT "not drift". The comparison is 64 computed properties on the
      // instance root, so a styling difference on a descendant or in an untracked
      // property is invisible to it, and the same agent caught the overclaim: the
      // verdict read "different content, not drift" for a variant whose accent lived
      // on a child `h2`. State the scope of the check instead of the conclusion.
      const palette = d.paletteOnlyInCand + d.paletteOnlyInRef;
      lines.push(palette > 0
        ? `      ${YELLOW}every property on the instance root matches, but ${palette} colour(s) appear in`
          + ` one instance and not the other — a styling difference on a descendant or in an`
          + ` untracked property, not necessarily content${RESET}`
        : `      ${DIM}every property on the instance root matches and the palettes agree —`
          + ` this looks like different content${RESET}`);
    }
  }
  if (offRules.size > 0) {
    const detail = [...offRules].map(([rule, n]) => `${rule} x${n}`).join(", ");
    lines.push(`  ${DIM}${[...offRules.values()].reduce((a, b) => a + b, 0)} instance(s) measured and NOT reported — rule turned off (${detail})${RESET}`);
  }
  // The escape hatch was documented only in `--help`, which is not where a reader of a
  // failing run is looking. v4's repair agent found it there and said what it cost:
  // "Nothing in the four gates' default output hints that an intentional-variant escape
  // hatch exists. […] The failing output itself says nothing like 'if this difference is
  // intentional, declare it with `--allow`' — which is where an agent would actually
  // read it." It was also pointed at the wrong lever: the rule's docs offered
  // `--threshold`, a blunt fudge, where `--allow` is the reviewable answer.
  const failing = report.deltas.find((d) => d.styleDeltas.length > 0);
  if (failing && report.allowRuleCount === 0) {
    lines.push(`  ${DIM}if a difference is intentional, declare it — it stays listed and a stale rule is reported:${RESET}`);
    lines.push(`  ${DIM}  --allow "${failing.styleDeltas[0].property}${variantScope(report, failing.candidateIndex)};<why>"${RESET}`);
  }
  if (report.unusedAllowRules && report.unusedAllowRules.length > 0) {
    // A rule that matched nothing is either stale or misspelled, and either way it is
    // widening the blind spot for a defect that is no longer there.
    lines.push(`  ${YELLOW}! ${report.unusedAllowRules.length} --allow rule(s) matched nothing:`
      + ` ${report.unusedAllowRules.join(", ")}${RESET}`);
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

/**
 * The `@<selector>` part of a suggested `--allow`, scoped to what actually makes this
 * instance a variant: a class it has and the reference does not. Without one the
 * suggestion is left unscoped rather than guessed, since an over-broad exemption is
 * exactly the failure mode `--allow` is built to avoid.
 */
function variantScope(report: ComponentConsistencyReport, candidateIndex: number): string {
  // `classList` here is the instance's selector — `article.card.card--featured` — so the
  // classes are `.`-separated and the first segment is the tag name, not a class.
  const classesOf = (index: number) =>
    (report.instances.find((i) => i.index === index)?.classList ?? "").split(".").slice(1).filter(Boolean);
  const refClasses = new Set(classesOf(report.referenceIndex));
  const only = classesOf(candidateIndex).find((c) => !refClasses.has(c));
  return only ? `@.${only}` : "";
}

/**
 * Style differences split into the ones that count and the ones an `--allow` rule
 * declared deliberate. Records which rules fired so an unused one can be reported.
 */
function splitDeltas(
  cand: InstanceEntry,
  reference: InstanceEntry,
  rules: readonly DriftAllowRule[],
  used: Set<string>,
): Pick<InstanceDelta, "styleDeltas" | "exemptedStyleDeltas"> {
  const all = STYLE_PROPERTIES.flatMap((property) => {
    const ref = reference.style?.[property];
    const value = cand.style?.[property];
    return ref !== undefined && value !== undefined && ref !== value
      ? [{ property, reference: ref, candidate: value }]
      : [];
  });
  // Matched against the instance's own tag + classes rather than the gate's
  // `--selector`, so `@.card--featured` can pick out one instance of several.
  const applied = applyDriftAllowRules(all, cand.classList ?? "", rules);
  for (const raw of applied.usedRaw) used.add(raw);
  return { styleDeltas: applied.styleDeltas, exemptedStyleDeltas: applied.exempted };
}

function renderReport(
  html: string,
  selector: string,
  instances: InstanceEntry[],
  refIdx: number,
  deltas: InstanceDelta[],
): string {
  const lines: string[] = [];
  lines.push("# Component consistency report");
  lines.push("");
  lines.push(`HTML: \`${html}\``);
  lines.push(`Selector: \`${selector}\`  —  **${instances.length}** instance(s) detected.`);
  lines.push(`Reference: instance **#${refIdx}**.`);
  lines.push("");
  lines.push("After an inline → componentized refactor, every call site should " +
    "render identically. Per-instance pixel diff against the reference reveals " +
    "which instances drifted — typically because one call site was missed during " +
    "the refactor and is still inline with stale styles.");
  lines.push("");
  lines.push("## Drift summary");
  lines.push("");
  lines.push("| Instance | Pixel diff | Δ W / H | Missing palette | Extra palette |");
  lines.push("|---|---|---|---|---|");
  for (const d of deltas) {
    const pct = (d.diffRatio * 100).toFixed(2) + "%";
    const wh = `${d.bboxDeltas.width > 0 ? "+" : ""}${d.bboxDeltas.width} / ${d.bboxDeltas.height > 0 ? "+" : ""}${d.bboxDeltas.height}`;
    lines.push(`| #${d.candidateIndex} | ${pct} | ${wh} | ${d.paletteOnlyInRef} | ${d.paletteOnlyInCand} |`);
  }
  lines.push("");
  lines.push("## Captured screenshots");
  lines.push("");
  for (const inst of instances) {
    const ref = inst.index === refIdx ? "  **(reference)**" : "";
    lines.push(`- instance #${inst.index}${ref} — ${inst.bbox.width}×${inst.bbox.height} at ${inst.bbox.x},${inst.bbox.y} — \`${inst.screenshotPath}\``);
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  // Keyed on style deltas, not on the pixel ratio. On a run the gate passed, this
  // section told an agent "2 instance(s) differ from the reference [...] Replace the
  // inline markup with the shared component invocation" — a refactor that did not
  // apply, on markup that was already identical.
  const drifters = deltas.filter((d) => d.styleDeltas.length > 0);
  const contentOnly = deltas.filter((d) => d.styleDeltas.length === 0 && d.diffRatio > 0.005);
  if (drifters.length === 0) {
    lines.push(contentOnly.length === 0
      ? "All instances render identically to the reference — refactor is consistent."
      : `No instance differs in any tracked style property. ${contentOnly.length} differ(s) in pixels,`
        + " which is what different copy costs — compare the screenshots if you want to confirm that is"
        + " all it is, since a difference on a descendant or in an untracked property would look the same"
        + " from here.");
  } else {
    lines.push(`${drifters.length} instance(s) differ from the reference. For each:`);
    lines.push("1. Open the candidate screenshot next to the reference; identify the visible delta.");
    lines.push("2. Locate the call site in the source. If the page contains a mix of inline " +
      "markup and component invocations (`<Card>`), the drifting instance is likely the " +
      "still-inline one.");
    lines.push("3. Replace the inline markup with the shared component invocation.");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check drift component` is declared in `../gates/drift.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
