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
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { applyGateExit } from "@mizchi/vlmkit-core/gate-exit.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

/** One visible element's style signature within its inferred role. */
export interface DesignSample {
  role: string;
  selector: string;
  /** Style tuple that defines "the same component", rendered. */
  signature: string;
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
  /** Elements skipped for being in a non-resting state. */
  statefulSkipped: number;
}

export type DesignFindingKind = "component-drift" | "scale-outlier" | "redirected";

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
  }[];
  findings: DesignFinding[];
  skipped: number;
  statefulSkipped: number;
  spacingValues: number;
  verdict: "coherent" | "drift";
}

export interface DesignPolicyOptions {
  source: string;
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
  /** Spacing values used less than this often are reported as outliers. Default 2. */
  outlierMaxUses?: number;
  storageState?: string;
}

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
  let skipped = 0, statefulSkipped = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const cs = getComputedStyle(el);
    for (const prop of ["paddingTop","paddingBottom","paddingLeft","paddingRight","marginTop","marginBottom","rowGap","columnGap"]) {
      const v = px(cs[prop]);
      if (v > 0) spacing.push({ selector: path(el), property: prop, value: v });
    }
    const role = roleOf(el);
    if (!role) { skipped++; continue; }
    if (el.matches && el.matches(STATE)) { statefulSkipped++; continue; }
    // Rendered height is deliberately NOT in the signature: a button that is
    // taller only because its label wrapped is not a design inconsistency.
    const sig = [
      px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft),
      px(cs.borderTopLeftRadius), px(cs.fontSize), cs.fontWeight,
      px(cs.borderTopWidth), cs.backgroundColor,
    ];
    samples.push({
      role,
      selector: path(el),
      signature: sig.join("|"),
      described: "padding " + sig.slice(0, 4).join("/") + ", radius " + sig[4]
        + ", " + sig[5] + "px/" + sig[6] + ", border " + sig[7] + ", bg " + sig[8],
    });
  }
  return { samples, spacing, skipped, statefulSkipped };
})()`;

/**
 * Judge role coherence. Pure so the thresholds are unit-testable without a
 * browser.
 */
export function judgeDesignPolicy(
  input: DesignPolicyInput,
  options: Pick<DesignPolicyOptions, "minReuse" | "minInstances" | "outlierMaxUses"> = {},
): Omit<DesignPolicyReport, "source"> {
  const minReuse = options.minReuse ?? DEFAULT_MIN_REUSE;
  const minInstances = options.minInstances ?? DEFAULT_MIN_INSTANCES;
  const outlierMax = options.outlierMaxUses ?? DEFAULT_OUTLIER_MAX_USES;

  const byRole = new Map<string, DesignSample[]>();
  for (const s of input.samples) {
    const list = byRole.get(s.role) ?? [];
    list.push(s);
    byRole.set(s.role, list);
  }

  const roles: DesignPolicyReport["roles"] = [];
  const findings: DesignFinding[] = [];

  for (const [role, list] of [...byRole.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const counts = new Map<string, DesignSample[]>();
    for (const s of list) {
      const same = counts.get(s.signature) ?? [];
      same.push(s);
      counts.set(s.signature, same);
    }
    const signatures = counts.size;
    const reuse = Math.round((list.length / signatures) * 100) / 100;
    const singletons = [...counts.values()].filter((v) => v.length === 1).length;
    roles.push({ role, instances: list.length, signatures, reuse, singletons });

    if (list.length < minInstances) continue;
    if (reuse >= minReuse) continue;

    const ranked = [...counts.entries()].sort((a, b) => b[1].length - a[1].length);
    const dominant = ranked[0]!;
    const minority = ranked.slice(1);
    const examples = minority.slice(0, 3).map(([, els]) =>
      `${els[0]!.selector} (${els[0]!.described})`
    );
    findings.push({
      kind: "component-drift",
      severity: "warn",
      role,
      message:
        `${list.length} "${role}" elements render ${signatures} distinct styles `
        + `(each style reused only ${reuse}x; a system reuses each style ${minReuse}x or more). `
        + `Dominant style, used ${dominant[1].length}x: ${dominant[1][0]!.described}. `
        + `Deviating: ${examples.join("; ")}`
        + (minority.length > 3 ? ` and ${minority.length - 3} more.` : ".")
        + ` This reports inconsistency, not which style is correct.`,
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

  return {
    roles,
    findings,
    skipped: input.skipped,
    statefulSkipped: input.statefulSkipped,
    spacingValues: spacingCounts.size,
    // `info` rows do not move the verdict, and `redirected` is a navigation
    // problem rather than a design one (it still exits non-zero, being suspect).
    verdict: findings.some((f) => f.severity === "warn") ? "drift" : "coherent",
  };
}

export async function runDesignPolicyCheck(options: DesignPolicyOptions): Promise<DesignPolicyReport> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(withAuthState({ viewport: { width: 1280, height: 900 } }, options.storageState));
    const isUrl = /^https?:\/\//.test(options.source);
    const url = isUrl ? options.source : pathToFileURL(resolve(options.source)).href;
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined));
    await page.waitForTimeout(250);
    const redirect = isUrl ? describeRedirect(options.source, page.url()) : null;
    const input = await page.evaluate(COLLECT_DESIGN_SAMPLES) as DesignPolicyInput;
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
  } finally {
    await browser.close();
  }
}

export function formatDesignReport(report: DesignPolicyReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${BOLD}${CYAN}vlmkit check design${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  const bad = report.findings.filter((f) => f.severity === "suspect").length;
  lines.push(
    `verdict: ${report.verdict === "coherent" ? `${GREEN}COHERENT${RESET}` : `${YELLOW}DRIFT${RESET}`}`
    + ` (${report.findings.length} finding(s)${bad > 0 ? `, ${bad} suspect` : ""})`,
  );
  lines.push(`${DIM}  roles judged: ${report.roles.length}, spacing values: ${report.spacingValues},`
    + ` skipped: ${report.skipped} (no inferable role), ${report.statefulSkipped} (non-resting state)${RESET}`);
  lines.push("");
  if (report.roles.length > 0) {
    lines.push(`${BOLD}Role reuse${RESET} ${DIM}(instances / distinct styles)${RESET}`);
    for (const r of report.roles.slice(0, 10)) {
      const flag = r.instances >= DEFAULT_MIN_INSTANCES && r.reuse < DEFAULT_MIN_REUSE ? `${YELLOW}drift${RESET}` : `${GREEN}ok${RESET}`;
      lines.push(`  ${r.role.padEnd(14)} ${String(r.instances).padStart(3)} inst  ${String(r.signatures).padStart(3)} styles`
        + `  reuse ${String(r.reuse).padStart(5)}x  ${r.singletons} one-off  ${flag}`);
    }
    lines.push("");
  }
  if (report.findings.length === 0) {
    lines.push(`${GREEN}No design drift detected.${RESET}`);
    return lines.join("\n");
  }
  const carried = report.findings.filter((f) => f.severity !== "info");
  const informational = report.findings.filter((f) => f.severity === "info");
  const mark = (f: DesignFinding) =>
    f.severity === "suspect" ? `${RED}x${RESET}` : f.severity === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
  if (carried.length > 0) {
    lines.push(`${BOLD}Findings${RESET}`);
    for (const f of carried) {
      lines.push(`  ${mark(f)} [${f.kind}]${f.role ? ` ${f.role}` : ""}: ${f.message}`);
    }
  }
  if (informational.length > 0) {
    if (carried.length > 0) lines.push("");
    lines.push(`${BOLD}Informational${RESET} ${DIM}(true, but does not carry the verdict)${RESET}`);
    for (const f of informational) {
      lines.push(`  ${mark(f)} [${f.kind}]${f.role ? ` ${f.role}` : ""}: ${f.message}`);
    }
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check design <html-or-url> [options]

Conformance to the design system the page itself implies: are components
styled consistently, and does spacing stay on the page's own scale? Reports
INCONSISTENCY, never which value is correct — taste stays with humans.

Options:
  --min-reuse <n>         Times each style must be reused (default 3)
  --min-instances <n>     Instances before a role is judged (default 3)
  --json                  Print JSON report
  --storage-state <file>  Playwright storage state for pages behind a login
  --advisory              Print findings but exit 0 (default: suspects exit 1)

Findings are warn-level by design; a drifting design system is information,
not a broken page. Study behind the thresholds:
docs/design/design-policy-metrics.md`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let json = false;
  let advisory = false;
  let minReuse: number | undefined;
  let minInstances: number | undefined;
  let storageState: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json") json = true;
    else if (arg === "--advisory") advisory = true;
    else if (arg === "--fail-on-suspect") { /* accepted no-op: suspects already fail */ }
    else if (arg === "--min-reuse") minReuse = Number.parseFloat(argv[++i] ?? "3");
    else if (arg === "--min-instances") minInstances = Number.parseInt(argv[++i] ?? "3", 10);
    else if (arg === "--storage-state") storageState = argv[++i];
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  const source = positional[0];
  if (!source) printUsage(1);
  const report = await runDesignPolicyCheck({
    source,
    ...(minReuse !== undefined ? { minReuse } : {}),
    ...(minInstances !== undefined ? { minInstances } : {}),
    ...(storageState ? { storageState } : {}),
  });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatDesignReport(report));
  applyGateExit(report.findings.some((f) => f.severity === "suspect"), { advisory });
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "design-policy" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) main().catch(handleCliError);
