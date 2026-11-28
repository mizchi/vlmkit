/**
 * `check reset`: the page under every UA × reset branch, rendered in Chromium, Firefox and WebKit.
 * Measurement in `../inspect/reset-matrix.ts`, decisions in `@mizchi/vlmkit-judge/reset-matrix.ts`.
 * The browser-measured counterpart of veriss's `analyzeResetMatrix`, and held against it.
 */
import { hasFlag, readFlag, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { firstPositional } from "@mizchi/vlmkit-core/plugin/args.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { RESET_MATRIX_UAS, type ResetMatrixUa } from "@mizchi/vlmkit-judge/reset-matrix.ts";
import {
  DEFAULT_RESET_HEIGHT,
  formatResetMatrixReport,
  runResetMatrix,
  type ResetMatrixOptions,
  type ResetMatrixReport,
} from "../inspect/reset-matrix.ts";

const list = (argv: readonly string[], name: string): string[] | undefined =>
  readFlag(argv, name)
    ?.split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export const resetGate = defineGate<ResetMatrixReport, ResetMatrixOptions>({
  id: "check.reset",
  command: ["check", "reset"],
  title: "Every UA × reset branch",
  summary:
    "The page in Chromium, Firefox and WebKit under each reset stylesheet (veriss's manifest), judged by check integrity per branch; what breaks only in some branches named by the smallest UA × reset product",
  category: "correctness",
  usage: `A page starts from the browser's UA stylesheet and whatever reset a page or a host puts in
front of its own sheets. Each branch is one UA (chromium, firefox, webkit) and one reset
from veriss's veriss-resets/1 manifest (none, modern-normalize, normalize, sanitize,
josh-comeau, tailwind-preflight, destyle: the exact text a browser receives), put before
the page's first sheet by an init script — checked to be document.styleSheets[0] in every
branch. The page is opened once per branch and judged at one width per regime of its width
media queries (or --viewports) by check integrity's layout judges: text collision, clipped
text, collapsed containers, protrusion, contrast, occlusion, page overflow, clipped content.

A finding in every branch measured is every-branch. A finding only in some is branch-defect,
named by the smallest UA × reset product that covers where it is ("firefox × none",
"none, normalize (any UA)") with a UA × reset grid; it keeps check integrity's severity when
a branch with no reset has it (the page as shipped breaks in that browser), and is a warn when
only resets the page does not ship bring it. A branch that could not be measured is never
counted as absent: branch-unmeasured.

With veriss installed (an optional peer; it is also where the resets come from — without it
only reset none runs), the page's rendered DOM and sheets, read in Chromium with no reset as
check css hands them over, go to veriss's analyzeResetMatrix at each width over the same
branches. Every box veriss reports as not fitting its parent (E_LAYOUT_ITEM_SIZE, inline axis)
must stick out past its parent's content box in that branch's browser, and in a branch veriss
decided (no Unknown), every box the browser draws outside its parent must be one veriss reports.
A branch where veriss decided and the browser disagrees is veriss-disagrees: veriss is wrong
there, worth reporting upstream. Agreement is counted per branch.

Cost: one page load per branch (21 by default) plus one probe, and a resize per width.`,
  rules: [
    {
      id: "redirected",
      title: "Requested URL redirected elsewhere",
      severity: "suspect",
      docs: "Almost always a login wall (an expired --storage-state). Reported so a pass on the login page cannot be silent.",
    },
    {
      id: "every-branch",
      title: "A layout defect in every branch measured",
      severity: "suspect",
      docs: "check integrity's finding (its rule and severity are in the message): no browser and no reset avoids it.",
    },
    {
      id: "branch-defect",
      title: "A layout defect only in some UA × reset branches",
      severity: "suspect",
      docs: "Named by the smallest UA × reset product that covers where it is. A suspect when a branch with no reset has it (the page breaks in that browser as it ships); a warn when only resets the page does not ship bring it. Promote it to suspect (--rule check.reset/branch-defect=suspect) for a component embedded in pages whose reset you do not control.",
    },
    {
      id: "branch-unmeasured",
      title: "A branch that could not be measured",
      severity: "suspect",
      docs: "A suspect when the page failed to load or the judges threw in that branch; a warn when the engine is not installed (npx playwright install firefox webkit). Never counted as a branch where a defect is absent.",
    },
    {
      id: "veriss-disagrees",
      title: "veriss decided a branch and the browser drew it otherwise",
      severity: "warn",
      docs: "veriss's E_LAYOUT_ITEM_SIZE (inline axis) against the drawn boxes. veriss is wrong there, not the page: report it upstream (mizchi/veriss). A known case: macOS WebKit's form controls are not the Linux profile veriss models.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to check",
      positional: 0,
      required: true,
    },
    {
      name: "uas",
      placeholder: "ua,ua",
      kind: "string",
      description: "Browsers to render in",
      defaultDescription: RESET_MATRIX_UAS.join(","),
    },
    {
      name: "resets",
      placeholder: "id,id",
      kind: "string",
      description: "Resets from veriss's manifest",
      defaultDescription: "all",
    },
    {
      name: "viewports",
      placeholder: "w,w",
      kind: "string",
      description: "Widths to judge at",
      defaultDescription: "one per regime of the page's width media queries",
    },
    {
      name: "height",
      placeholder: "px",
      kind: "number",
      description: "Viewport height",
      defaultDescription: String(DEFAULT_RESET_HEIGHT),
    },
    { name: "no-veriss", kind: "boolean", description: "Skip the comparison with veriss's analyzeResetMatrix" },
    {
      name: "storage-state",
      placeholder: "file",
      kind: "path",
      description: "Playwright storage state for pages behind a login",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check reset <html-or-url>", [
      "--uas",
      "--resets",
      "--viewports",
      "--height",
      "--storage-state",
    ]);
    const uas = list(argv, "uas");
    if (uas) {
      const bad = uas.filter((u) => !(RESET_MATRIX_UAS as readonly string[]).includes(u));
      if (bad.length || uas.length === 0)
        throw new UsageError(`--uas takes ${RESET_MATRIX_UAS.join(", ")}; got ${readFlag(argv, "uas")}`);
    }
    const resets = list(argv, "resets");
    if (resets && resets.length === 0) throw new UsageError("--resets takes reset ids, e.g. none,destyle");
    const raw = readFlag(argv, "viewports");
    const viewports = raw?.split(",").map((w) => Number(w.trim()));
    if (viewports && viewports.some((w) => !Number.isInteger(w) || w < 200))
      throw new UsageError(`--viewports takes widths of 200px or more, e.g. 1280,375; got ${raw}`);
    const height = readNumber(argv, "height");
    if (height !== undefined && !(Number.isInteger(height) && height >= 200))
      throw new UsageError(`--height takes a whole number of 200 or more, got ${height}`);
    const storageState = readFlag(argv, "storage-state");
    return {
      source,
      ...(uas ? { uas: [...new Set(uas)] as ResetMatrixUa[] } : {}),
      ...(resets ? { resets: [...new Set(resets)] } : {}),
      ...(viewports ? { viewports: [...new Set(viewports)] } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(hasFlag(argv, "no-veriss") ? { noVeriss: true } : {}),
      ...(storageState ? { storageState } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runResetMatrix(options),
  findings: (report): Finding[] =>
    report.findings.map((f) => ({
      rule: f.rule,
      severity: f.severity,
      message: f.message,
      ...(f.selector ? { selector: f.selector } : {}),
      ...(f.evidence ? { evidence: f.evidence } : {}),
    })),
  format: formatResetMatrixReport,
  headline: (report) =>
    `${report.summary.space.measured}/${report.summary.space.total} branch(es) measured at ${report.widths.length} width(s): ${report.summary.holdsEverywhere.length} in every branch, ${report.summary.onlyIn.length} only in some${"skipped" in report.veriss ? "" : `; veriss ${report.veriss.comparison.agreed}/${report.veriss.comparison.compared} box claim(s) agree`}`,
  ledger: (report, options) => ({
    tool: "check-reset",
    source: options.source,
    headline: {
      branches: report.summary.space.total,
      measured: report.summary.space.measured,
      everywhere: report.summary.holdsEverywhere.length,
      onlyIn: report.summary.onlyIn.length,
      ...("skipped" in report.veriss
        ? {}
        : {
            verissCompared: report.veriss.comparison.compared,
            verissDisagree: report.veriss.comparison.disagreements.length,
          }),
    },
  }),
});
