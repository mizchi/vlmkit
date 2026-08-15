#!/usr/bin/env node
/**
 * `check design` — conformance to the design system the page itself implies.
 *
 * The functional gates answer "is this broken". This one answers "is this
 * *coherent*", which generated markup routinely is not: every S15-S19
 * zero-shot fixture passed every functional gate while rendering its buttons
 * in three different styles.
 *
 * The line this gate does NOT cross: it never judges which value is right.
 * "Is 24px the correct gap" is taste and stays with humans. "You used 23px
 * once and 24px forty times" is a measurement, and that is all this reports.
 *
 * Feasibility study, with the measurements that shaped every threshold here:
 * docs/design/design-policy-metrics.md. Two findings from it are load-bearing:
 *
 *   - 4px/8px grid conformance was REJECTED as a quality signal. Agent-built
 *     pages score 0.86-1.00 on it while MDN scores 0.857 and web.dev 0.716,
 *     because LLM-written CSS uses round numbers religiously. Declared-scale
 *     conformance lives in `check tokens`; it is not evidence of coherence.
 *   - Signature REUSE discriminates. Measured reuse factors (instances per
 *     distinct signature): MDN buttons 8.0, web.dev menuitems 42, Wikipedia
 *     buttons 12.5 — versus agent buttons 2.0-2.3. Wikipedia's `navigation`
 *     role sits at 2.0 and is genuine organic drift, so the rule holds on
 *     both sides.
 *
 * CLI:
 *   vlmkit check design <html-or-url> [--min-reuse 3] [--json] [--advisory]
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyRuleTiers, hiddenByRuleNote } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import {
  type SelectorAllowRule,
  parseSelectorAllowRules,
} from "../inspect/selector-exemption.ts";

/** One visible element's style signature within its inferred role. */
export interface DesignSample {
  role: string;
  selector: string;
  /** Style tuple that defines "the same component", rendered. */
  signature: string;
  /**
   * `signature` with the two font fields dropped: padding, radius, border
   * width and background only. The comparison space for an element that paints
   * no text — see `textFree`.
   */
  boxSignature?: string;
  /**
   * The element paints nothing whose size or weight the font controls: no text
   * node, no generated `::before`/`::after` content, and not a form control
   * that renders its own `value`/`placeholder`.
   *
   * Issue #112: a MapLibre widget's zoom controls were restyled to match the
   * host app's padding/radius/border/background exactly and `check design`
   * still reported DRIFT, because the buttons contain only an SVG icon and
   * inherit `12px/400` where the app's buttons are `14px/600`. Nobody can see
   * that difference and no styling change removes it, so it cannot be evidence.
   */
  textFree?: boolean;
  /** Human-readable form of the signature for kickbacks. */
  described: string;
}

export interface DesignSpacingSample {
  selector: string;
  property: string;
  value: number;
}

export interface DesignPolicyInput {
  samples: DesignSample[];
  spacing: DesignSpacingSample[];
  /**
   * Elements skipped because no role could be inferred deterministically.
   * Reported, never silent — the gate's coverage has to be legible.
   */
  skipped: number;
  /**
   * Those same skipped elements tallied by tag name. The bare count cannot
   * distinguish "this page is divs and paragraphs" from "the measurement
   * broke", and that is the question a reader actually has.
   */
  skippedTags?: Record<string, number>;
  /** Elements skipped for being in a non-resting state. */
  statefulSkipped: number;
  /**
   * Per-selector audit of caller-owned subtree exclusions: how many roots the
   * selector matched, and how many elements that actually removed. Both,
   * because they answer different questions — `matches: 0` means the selector
   * is wrong or the widget is gone, while `matches: 1, elements: 0` means it
   * matched something outside the measured tree.
   */
  exclusions?: { selector: string; matches: number; elements: number }[];
  /** Unique elements omitted because they belong to an excluded subtree. */
  excludedElements?: number;
}

export type DesignFindingKind = "component-drift" | "scale-outlier" | "redirected" | "nothing-judged";

export interface DesignFinding {
  kind: DesignFindingKind;
  /**
   * `warn` for design drift — information for a human, never a build failure.
   * `info` for rows that are true but do not carry the verdict: the study
   * measured spacing-vocabulary concentration as overlapping between designed
   * and generated pages (top-6 coverage 0.81-0.99 in both groups), so a
   * spacing straggler on its own is not evidence of incoherence. MDN authors
   * exactly one 43px padding against twelve 40px ones; reporting that is
   * useful, calling the page incoherent for it is not.
   */
  severity: "info" | "warn" | "suspect";
  role?: string;
  message: string;
}

export interface DesignPolicyReport {
  source: string;
  roles: {
    role: string;
    instances: number;
    signatures: number;
    /** instances / signatures — how often the average signature is reused. */
    reuse: number;
    singletons: number;
    /** Instances an `--allow` rule declared deliberate, excluded from the arithmetic. */
    allowed?: number;
    /**
     * Too few instances to judge against the reuse floor, so no finding can come
     * from this role. Reported rather than silent: an unjudged role used to render
     * exactly like a coherent one.
     */
    notJudged?: true;
    /** …and it would have been judged if `--allow` had not removed instances. */
    unjudgedByAllow?: true;
  }[];
  findings: DesignFinding[];
  skipped: number;
  /** Skipped elements by tag, most first — the shape of the blind spot. */
  skippedTags: { tag: string; count: number }[];
  /**
   * Elements that DID carry an inferable role, i.e. what the verdict rests on.
   * Printed as a fraction of everything considered, because a verdict drawn
   * from 2 of 30 elements is worth knowing about before it is trusted.
   */
  judgedElements: number;
  statefulSkipped: number;
  exclusions: { selector: string; matches: number; elements: number }[];
  excludedElements: number;
  unusedExcludes: string[];
  /** `--allow` rules that matched no instance. */
  unusedAllow?: string[];
  /** Elements judged on their box alone because they paint no text. */
  textFreeSamples: number;
  /**
   * Of those, how many joined a style the text-bearing elements had already
   * established. Reported so the fold is auditable rather than invisible: it is
   * the one place this gate deliberately compares less than it measured.
   */
  textFreeFolded: number;
  spacingValues: number;
  /**
   * Thresholds this run actually used. In the report because the role table
   * has to flag the same rows the verdict counted: reading them from the
   * module defaults made `--min-reuse 2` print `drift` next to a role while
   * the verdict said COHERENT.
   */
  thresholds: { minReuse: number; minInstances: number };
  /**
   * `not-judged` when no role had enough instances to be judged at all.
   *
   * A third state rather than a rendering tweak, because `--json` is what CI
   * reads: reporting `coherent` for a page nothing was measured on is the same
   * lie in the machine-readable path, where nobody is there to notice it.
   */
  verdict: "coherent" | "drift" | "not-judged";
}

export interface DesignPolicyOptions {
  source: string;
  /** Vendor-owned subtrees omitted before component and spacing collection. */
  exclude?: readonly string[];
  /** Playwright navigation milestone. Defaults to networkidle. */
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  /** Navigation timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
  /** Replay network responses from a Playwright HAR for deterministic URL gates. */
  har?: string;
  /**
   * Minimum times a signature must be reused before the role counts as
   * systematic. Default 3 — measured: designed roles sit at 5-42, drifting
   * ones at 2.0-2.3.
   */
  minReuse?: number;
  /**
   * Minimum instances before a role is judged at all. Default 3: with one or
   * two instances "every signature is unique" is trivially true and says
   * nothing.
   */
  minInstances?: number;
  /**
   * `--allow "<selector>;<reason>"` — instances whose deviation is deliberate.
   *
   * `--min-reuse` cannot express this, and v6's adopting agent found out the hard way
   * that the docs recommend it anyway: "`examples/vlmkit.gates.json` shows
   * `--min-reuse 2` as *the* way to approve deliberately-varied buttons. On this page it
   * changes nothing […] Because the metric is an *average*, any 3-element role with one
   * deviant is unfixable except by `--min-reuse 1`, which disables the check."
   *
   * So the lever has to name the instance, the way `check integrity --allow` and
   * `check drift component --allow` do. An allowed instance is excluded from the reuse
   * arithmetic and still listed, because an exemption a reader cannot see is a blind
   * spot rather than a decision.
   */
  allow?: readonly string[];
  /** Spacing values used less than this often are reported as outliers. Default 2. */
  outlierMaxUses?: number;
  storageState?: string;
}

/** Flags that consume the next argv entry, so the source positional is found. */

const DEFAULT_MIN_REUSE = 3;
const DEFAULT_MIN_INSTANCES = 3;
const DEFAULT_OUTLIER_MAX_USES = 2;

/**
 * Below this, a spacing value is not a scale decision. Measured: the only
 * `scale-outlier` rows MDN and web.dev produced were 2/2.5/5/6px paddings on
 * inline `<code>` and hairline offsets — none of them design choices. A real
 * spacing scale starts around 8px.
 */
const SCALE_FLOOR_PX = 8;

/**
 * A design decision is expressed as a whole pixel. Fractional computed values
 * come from rem/em/percentage arithmetic (web.dev's `21.4px` next to a
 * "common" `21.3px` was the reductio: two rem-derived neighbours, zero design
 * content). Both the outlier and its reference must be integral.
 */
const isScaleValue = (v: number): boolean =>
  v >= SCALE_FLOOR_PX && Math.abs(v - Math.round(v)) < 0.05;

/**
 * How far off the scale still counts as "just off" rather than "a different
 * step". 23-vs-24 is drift; 12-vs-8 is a second step in the scale. Scales with
 * itself so 60-vs-64 stays reportable.
 */
const scaleWindow = (reference: number): number => Math.max(2, Math.round(reference * 0.1));

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
  const visible = (el) => typeof el.checkVisibility === "function"
    ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })
    : getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; };
  const STATE = ":disabled,[aria-disabled=true],[aria-pressed=true],[aria-expanded=true],[aria-current],[aria-selected=true],:checked";
  const path = (el) => {
    const parts = [];
    for (let cur = el; cur && cur !== document.body && parts.length < 3; cur = cur.parentElement) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(p + "#" + cur.id); break; }
      if (typeof cur.className === "string" && cur.className.trim()) p += "." + cur.className.trim().split(/\\s+/)[0];
      parts.unshift(p);
    }
    return parts.join(">");
  };
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
    // Split into box and font halves so the judge can compare a text-free
    // element on the box alone; the joined string is still the signature.
    const box = [
      px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft),
      px(cs.borderTopLeftRadius), px(cs.borderTopWidth), cs.backgroundColor,
    ];
    const font = [px(cs.fontSize), cs.fontWeight];
    const textFree = !paintsText(el);
    samples.push({
      role,
      selector: path(el),
      boxSignature: box.join("|"),
      signature: box.concat(font).join("|"),
      textFree,
      described: "padding " + box.slice(0, 4).join("/") + ", radius " + box[4]
        + ", " + (textFree ? "no painted text" : font[0] + "px/" + font[1])
        + ", border " + box[5] + ", bg " + box[6],
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

/**
 * Judge role coherence. Pure so the thresholds are unit-testable without a
 * browser.
 */
/**
 * The signature's fields, in the order the collector joins them. Kept next to the
 * only consumer that needs to name them, so a field added to the collector without
 * a label here shows up as `field 9` rather than as a silently wrong name.
 */
const SIGNATURE_FIELDS = [
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-radius", "border-width", "background-color",
  "font-size", "font-weight",
] as const;

/**
 * Which signature terms differ between two samples, as property names.
 *
 * `described` collapses several fields into one phrase (`border 1` is the width
 * only, `bg` is the colour), so two styles can print the same words while differing
 * in a property neither phrase mentions. This compares the raw signature instead.
 *
 * A text-free element is compared on the box alone, matching how it was grouped —
 * otherwise the answer would name `font-size` on an icon button whose inherited font
 * paints nothing, which is the #112 false positive this gate already refuses to make.
 */
function describeSignatureDelta(reference: DesignSample, candidate: DesignSample): string {
  const textFree = reference.textFree === true || candidate.textFree === true;
  const a = ((textFree ? reference.boxSignature : reference.signature) ?? "").split("|");
  const b = ((textFree ? candidate.boxSignature : candidate.signature) ?? "").split("|");
  const differing: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    differing.push(`${SIGNATURE_FIELDS[i] ?? `field ${i}`} ${a[i] ?? "-"} → ${b[i] ?? "-"}`);
  }
  // Capped: the question this answers is "one property or several?", and a style
  // that differs in everything answers it with the count. Listing all nine terms
  // buries the narrow case that made this worth printing.
  const NAMED = 3;
  if (differing.length <= NAMED) return differing.join(", ");
  return `${differing.slice(0, NAMED).join(", ")} and ${differing.length - NAMED} more`;
}

/**
 * Does this style have the shape of a third-party widget's own controls?
 *
 * No painted text, no padding, no radius, no background — a bare icon box. An app's
 * own button role practically never looks like this, and when such a style becomes
 * the DOMINANT one it means vendor DOM outnumbered the page's own components, which
 * is #112 item 4 exactly. Used only to decide whether to mention `--exclude`, so a
 * false positive costs one sentence.
 */
function looksLikeVendorChrome(sample: DesignSample): boolean {
  if (sample.textFree !== true) return false;
  const box = (sample.boxSignature ?? "").split("|");
  const zeroPadding = box.slice(0, 4).every((v) => v === "0");
  const noRadius = box[4] === "0";
  const noBackground = /rgba\(0, 0, 0, 0\)|transparent/.test(box[6] ?? "");
  return zeroPadding && noRadius && noBackground;
}

/**
 * Parse `--allow ".btn--primary;the primary action is deliberately distinct"`.
 *
 * Thin wrapper over the shared `<selector>;<reason>` parser — this gate's form is
 * that form exactly, and `check a11y touch` / `check a11y contrast` gained the same
 * one in v7. `check integrity` and `check drift component` keep their own parsers
 * because their syntax carries more than a selector (a rule kind and viewport; a
 * computed property).
 */
export function parseDesignAllowRules(specs: readonly string[]): SelectorAllowRule[] {
  return parseSelectorAllowRules(specs, { ruleId: "component-drift" });
}

export const DESIGN_ALLOW_HELP = `Declare one instance's deviation deliberate, repeatable. Syntax:
  <selector>;<reason>
Use the selector AS PRINTED in the finding — it is an id-preferring path, so
\`button#export\` matches and \`.btn--primary\` does not (a rule matching nothing is
reported, so the mistake is loud rather than silent).
e.g. --allow "button#export;the primary action is deliberately distinct"
A reason is required; a bare \`*\` is refused because that is \`--rule component-drift=off\`;
an allowed instance leaves the reuse arithmetic and is still listed.
Prefer this over raising --min-reuse: reuse is instances/styles, an AVERAGE, so a
3-element role with one deliberate variant sits at 1.5x and no threshold reaches it.
ON A SMALL ROLE, PASS --min-instances TOO. Allowing 1 of 3 leaves 2, under the default
--min-instances 3, and the role then stops being judged at all: the run reports
\`NOT JUDGED\` and a real drift among the remaining instances would not be found. For a
3-element role that is \`--min-instances 2 --min-reuse 2\` — both, because 2 instances
cannot reach 3x however low the instance floor goes.`

export function judgeDesignPolicy(
  input: DesignPolicyInput,
  options: Pick<DesignPolicyOptions, "minReuse" | "minInstances" | "outlierMaxUses" | "allow"> = {},
): Omit<DesignPolicyReport, "source"> {
  const minReuse = options.minReuse ?? DEFAULT_MIN_REUSE;
  const minInstances = options.minInstances ?? DEFAULT_MIN_INSTANCES;
  const outlierMax = options.outlierMaxUses ?? DEFAULT_OUTLIER_MAX_USES;
  const allowRules = parseDesignAllowRules(options.allow ?? []);
  const usedAllow = new Set<string>();

  const byRole = new Map<string, DesignSample[]>();
  for (const s of input.samples) {
    const list = byRole.get(s.role) ?? [];
    list.push(s);
    byRole.set(s.role, list);
  }

  const roles: DesignPolicyReport["roles"] = [];
  const findings: DesignFinding[] = [];
  const textFreeSamples = input.samples.filter((s) => s.textFree && s.boxSignature).length;
  let textFreeFolded = 0;

  for (const [role, list] of [...byRole.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const counts = new Map<string, DesignSample[]>();
    // Which signature owns each box, so a text-free element can be folded into
    // the style its visible properties already match (issue #112).
    const boxOfSignature = new Map<string, string>();
    const deferred: DesignSample[] = [];
    for (const s of list) {
      if (s.textFree && s.boxSignature) {
        deferred.push(s);
        continue;
      }
      const same = counts.get(s.signature) ?? [];
      same.push(s);
      counts.set(s.signature, same);
      boxOfSignature.set(s.signature, s.boxSignature ?? s.signature);
    }
    // Resolved from the TEXT-BEARING groups only, and before any folding, so the
    // result does not depend on the order the text-free elements arrive in.
    // Largest group wins; the key breaks ties so two equal groups are stable.
    const hostByBox = new Map<string, string>();
    for (const [key, members] of counts) {
      const box = boxOfSignature.get(key)!;
      const held = hostByBox.get(box);
      const heldSize = held === undefined ? -1 : counts.get(held)!.length;
      if (members.length > heldSize || (members.length === heldSize && key < held!)) hostByBox.set(box, key);
    }
    for (const s of deferred) {
      // No host means no text-bearing element shares this box — an unmatched
      // BOX is visible drift and stays counted. Text-free elements then group
      // with each other by box, keyed on the 7-field box string, which can
      // never collide with a 9-field signature.
      const host = hostByBox.get(s.boxSignature!);
      const key = host ?? s.boxSignature!;
      if (host !== undefined) textFreeFolded++;
      const same = counts.get(key) ?? [];
      same.push(s);
      counts.set(key, same);
    }
    // Allowed instances leave the arithmetic before it is done: a deliberate primary
    // button should not drag the role's reuse figure down, which is the whole reason
    // `--min-reuse` could not serve as this lever.
    const allowedHere: { selector: string; reason: string }[] = [];
    for (const [key, group] of [...counts.entries()]) {
      const kept = group.filter((sample) => {
        const rule = allowRules.find((r) => sample.selector.includes(r.selector));
        if (!rule) return true;
        allowedHere.push({ selector: sample.selector, reason: rule.reason });
        usedAllow.add(rule.raw);
        return false;
      });
      if (kept.length === 0) counts.delete(key);
      else counts.set(key, kept);
    }
    const judged = [...counts.values()].flat();

    const signatures = counts.size;
    const reuse = signatures === 0 ? 0 : Math.round((judged.length / signatures) * 100) / 100;
    const singletons = [...counts.values()].filter((v) => v.length === 1).length;
    // A role with too few instances to have a "system" is not judged: with a 3x
    // reuse floor, two elements sharing one style still only average 2.0 and could
    // never clear it. Skipping is defensible. Skipping SILENTLY is not — and until
    // `--allow` existed, nothing could push a role under this floor at runtime.
    //
    // v7's agent-m found the consequence, having followed this gate's own help:
    //
    //   "Allowing one of 3 buttons leaves 2, below the default --min-instances 3, so
    //    the role stops being judged and a skipped role prints identically to a
    //    coherent one. […] I then broke #snooze on purpose — COHERENT again. So both
    //    documented configurations reproduce the exact complaint I was sent to fix —
    //    a verdict that never moves."
    //
    // That is a false negative, which is worse than the false positive `--allow` was
    // added to remove. The arithmetic stays; what changes is that an unjudged role
    // says so, on its own row and on the verdict line, and names `--allow` when
    // `--allow` is what put it there.
    const notJudged = judged.length < minInstances;
    roles.push({
      role,
      instances: judged.length,
      signatures,
      reuse,
      singletons,
      ...(allowedHere.length > 0 ? { allowed: allowedHere.length } : {}),
      ...(notJudged
        ? {
          notJudged: true as const,
          // Would it have been judged without the exemptions? That distinction is
          // the difference between "this page is small" and "your config silenced
          // the only role on the page".
          ...(allowedHere.length > 0 && judged.length + allowedHere.length >= minInstances
            ? { unjudgedByAllow: true as const }
            : {}),
        }
        : {}),
    });

    if (notJudged) continue;
    if (signatures === 0 || reuse >= minReuse) continue;

    const ranked = [...counts.entries()].sort((a, b) => b[1].length - a[1].length);
    const dominant = ranked[0]!;
    const minority = ranked.slice(1);
    // Name the properties that actually differ from the dominant style, not just both
    // fingerprints. Two of them can print identical terms — `border 1` on each side
    // while the real delta is `border-color` — and a dogfood agent had to open the
    // stylesheet to find out: "Both styles print `border 1`; the actual delta is
    // `background` *and* `border-color`, and border-color is never shown. I opened
    // the stylesheet to learn whether the deviation was one property or two."
    const examples = minority.slice(0, 3).map(([, els]) => {
      const differing = describeSignatureDelta(dominant[1][0]!, els[0]!);
      return `${els[0]!.selector} (${els[0]!.described})`
        + (differing ? ` — differs in ${differing}` : "");
    });
    findings.push({
      kind: "component-drift",
      severity: "warn",
      role,
      message:
        `${list.length} "${role}" elements render ${signatures} distinct styles `
        // `reuse` is instances/styles — an average, and it used to be printed as
        // "each style reused only 1.5x", which contradicted the very next sentence
        // ("Dominant style, used 2x") and described a count no style had. The same
        // agent: "No style is used 1.5 times. […] I could not tune the gate into
        // agreement with itself, and had to reverse-engineer the formula."
        + `(used ${ranked.map(([, els]) => `${els.length}x`).slice(0, 4).join(", ")}`
        + `${ranked.length > 4 ? ", …" : ""}; `
        + `a system reuses each style ${minReuse}x or more, and this role averages ${reuse}x). `
        + `Dominant style, used ${dominant[1].length}x: ${dominant[1][0]!.described}. `
        + `Deviating: ${examples.join("; ")}`
        + (minority.length > 3 ? ` and ${minority.length - 3} more.` : ".")
        + ` This reports inconsistency, not which style is correct.`
        // The escape hatch #112 asked for, offered where the problem appears. Two
        // agents found `--exclude` only by opening `--help`, and one of them pointed
        // out that the gate has the evidence to suggest it: a dominant style that
        // paints no text in a zero-padding, zero-radius, transparent box is vendor
        // chrome, not a design decision.
        + (looksLikeVendorChrome(dominant[1][0]!)
          ? ` The dominant style paints no text and has no padding, radius or background`
            + ` — that shape is usually a third-party widget's own controls. If it is not yours,`
            + ` exclude its subtree: --exclude "<selector>" (the exclusion is reported, not silent).`
          : ""),
    });
  }

  // Spacing outliers against the page's OWN dominant vocabulary — the
  // inferred twin of `check tokens`, usable with no config file.
  const spacingCounts = new Map<number, DesignSpacingSample[]>();
  for (const s of input.spacing) {
    const list = spacingCounts.get(s.value) ?? [];
    list.push(s);
    spacingCounts.set(s.value, list);
  }
  //
  // Every clause below exists because a designed page tripped the rule without
  // it. The first implementation reported `verdict: DRIFT` on both MDN and
  // web.dev — pages the study established as coherent — on rows like
  // "21.4px, nearest common 21.3px". A metric that fires on the reference set
  // is not a metric.
  const scaleReferences = [...spacingCounts.entries()]
    .filter(([value, uses]) => isScaleValue(value) && uses.length > outlierMax);
  const candidates = [...spacingCounts.entries()]
    .filter(([value, uses]) => isScaleValue(value) && uses.length <= outlierMax);
  // Only meaningful once the page HAS a vocabulary to deviate from.
  if (scaleReferences.length >= 3 && candidates.length > 0) {
    const nearest = (v: number) => scaleReferences
      .reduce((best, entry) => (Math.abs(entry[0] - v) < Math.abs(best[0] - v) ? entry : best));
    const worst = candidates
      .map(([value, uses]) => {
        const [near, nearUses] = nearest(value);
        return { value, uses: uses.length, near, nearUses: nearUses.length, sample: uses[0]! };
      })
      .filter((r) =>
        r.value !== r.near
        && Math.abs(r.value - r.near) <= scaleWindow(r.near)
        // The reference has to be genuinely established, or "off the page's own
        // scale" is claiming a scale that does not exist: 2 uses vs 3 uses is
        // not a majority worth snapping to.
        && r.nearUses >= 4
        && r.nearUses >= r.uses * 3
      )
      .sort((a, b) => Math.abs(a.value - a.near) - Math.abs(b.value - b.near))
      .slice(0, 5);
    if (worst.length > 0) {
      findings.push({
        kind: "scale-outlier",
        severity: "info",
        message:
          `${worst.length} spacing value(s) sit just off the page's own scale: `
          + worst.map((w) =>
            `${w.value}px (${w.uses}x) next to ${w.near}px (${w.nearUses}x) — ${w.sample.selector} ${w.sample.property}`
          ).join("; ")
          + `. Snap them to the established value or add them deliberately.`,
      });
    }
  }

  // How many roles the drift check actually ran on. `roles.length` counts the
  // unjudged ones too, so it was reported as `roles judged: 2` for a page where
  // the number was zero.
  const judgedRoles = roles.filter((r) => !r.notJudged).length;
  if (judgedRoles === 0 && roles.length > 0) {
    // A finding, not just a verdict word, so a project can gate on it:
    // `--rule nothing-judged=suspect` makes "the design gate must actually judge
    // something" enforceable. Default `info` — a genuinely small page is not a
    // defect, and turning one into a build failure would be its own bad message.
    //
    // v7's agent-m: "A tool whose job is telling you when a number stops moving
    // should not be able to stop moving in silence."
    const byAllow = roles.filter((r) => r.unjudgedByAllow);
    findings.push({
      kind: "nothing-judged",
      severity: "info",
      message:
        `No role had ${minInstances} or more instances, so the reuse check ran on nothing`
        + ` and this verdict rests on no component evidence`
        + ` (roles seen: ${roles.map((r) => `${r.role} (${r.instances})`).join(", ")}).`
        + (byAllow.length > 0
          ? ` --allow took ${byAllow.map((r) => r.role).join(", ")} under the floor, so a real`
            + ` drift there would not be reported.`
          : "")
        + ` To judge them: --min-instances 2 --min-reuse 2 — both, because a 2-instance role`
        + ` cannot reach ${minReuse}x.`,
    });
  }

  return {
    roles,
    findings,
    skipped: input.skipped,
    skippedTags: Object.entries(input.skippedTags ?? {})
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    judgedElements: input.samples.length,
    statefulSkipped: input.statefulSkipped,
    exclusions: input.exclusions ?? [],
    excludedElements: input.excludedElements ?? 0,
    // Judged on elements REMOVED, not on root matches: `--exclude head` matches
    // a root and removes nothing, and a selector that removes nothing is dead
    // config however many roots it found.
    unusedExcludes: (input.exclusions ?? []).filter((entry) => entry.elements === 0).map((entry) => entry.selector),
    // A rule that matched nothing is stale or misspelled, and either way it is widening
    // the blind spot for a variant that is no longer there — the property `check
    // integrity --allow` established and the adoption report praised by name.
    unusedAllow: allowRules.filter((r) => !usedAllow.has(r.raw)).map((r) => r.raw),
    textFreeSamples,
    textFreeFolded,
    spacingValues: spacingCounts.size,
    thresholds: { minReuse, minInstances },
    // `info` rows do not move the verdict, and `redirected` is a navigation
    // problem rather than a design one (it still exits non-zero, being suspect).
    verdict: findings.some((f) => f.severity === "warn")
      ? "drift"
      : judgedRoles === 0 && roles.length > 0
        ? "not-judged"
        : "coherent",
  };
}

export async function runDesignPolicyCheck(options: DesignPolicyOptions): Promise<DesignPolicyReport> {
  return await withBrowser(async (browser) => {
    const page = await browser.newPage(withAuthState({ viewport: { width: 1280, height: 900 } }, options.storageState));
    if (options.har) {
      await page.routeFromHAR(resolve(options.har), { notFound: "abort" });
    }
    const isUrl = /^https?:\/\//.test(options.source);
    const url = isUrl ? options.source : pathToFileURL(resolve(options.source)).href;
    await page.goto(url, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 30000,
    });
    await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined));
    await page.waitForTimeout(250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const input = await page.evaluate(buildDesignSampleScript(options.exclude)) as DesignPolicyInput;
    const judged = judgeDesignPolicy(input, options);
    if (redirect) {
      judged.findings.unshift({ kind: "redirected", severity: "suspect", message: redirect });
    }
    const report: DesignPolicyReport = { source: options.source, ...judged };
    appendRunLedger({
      tool: "check-design",
      source: options.source,
      headline: {
        verdict: report.verdict,
        drifting: report.findings.filter((f) => f.kind === "component-drift").length,
        roles: report.roles.length,
      },
    });
    return report;
  });
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
