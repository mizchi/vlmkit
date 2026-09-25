/**
 * `scan a11y` and `check a11y tree` as gate definitions: a platform's accessibility tree
 * collected once, then judged with no browser. Measurement lives in `../a11y-tree/`, the
 * judging in `@mizchi/vlmkit-judge/a11y-tree.ts`.
 */
import { readAll, readChoice, readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding, RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { tierIssues } from "@mizchi/vlmkit-core/plugin/rule-prose.ts";
import { firstPositional, viewportFlag } from "@mizchi/vlmkit-core/plugin/args.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { parseSelectorAllowRules } from "@mizchi/vlmkit-judge/allow.ts";
import { formatRgb } from "@mizchi/vlmkit-judge/color.ts";
import { DEFAULT_A11Y_TREE, runScanA11y, type ScanA11yOptions, type ScanA11yReport } from "../a11y-tree/scan-a11y.ts";
import { runCheckA11yTree, type CheckA11yTreeOptions, type CheckA11yTreeReport } from "../a11y-tree/check-a11y-tree.ts";
import type { WcagTouchLevel } from "../a11y-touch.ts";

// ---------------------------------------------------------------------------
// scan a11y

const semanticsEmpty = (report: ScanA11yReport): string | null =>
  report.counts.named === 0
    ? `the tree holds ${report.counts.nodes} node(s) and none has a name — every gate reading it would measure nothing and pass.`
    : null;

function formatScanA11y(report: ScanA11yReport, rules?: RuleView): string {
  const issues = [
    ...(report.redirect ? [{ kind: "redirected", severity: "suspect" as const, message: report.redirect }] : []),
    ...(semanticsEmpty(report) ? [{ kind: "semantics-empty", severity: "suspect" as const, message: semanticsEmpty(report)! }] : []),
  ];
  const { shown, note } = tierIssues(issues, rules);
  return [
    "",
    `${BOLD}${CYAN}vlmkit scan a11y${RESET}  ${DIM}${report.platform}${RESET}`,
    `${DIM}source: ${report.source}${report.clicks.length ? ` → ${report.clicks.map((c) => JSON.stringify(c)).join(" → ")}` : ""}${RESET}`,
    "",
    `tree:  ${report.out}  (${report.viewport.width}x${report.viewport.height})`,
    `frame: ${report.frame ?? `${DIM}none — contrast will not be measured (pass --frame)${RESET}`}`,
    `  ${report.counts.nodes} node(s), ${report.counts.named} named, ${report.counts.interactive} operable`,
    ...shown.map(({ row, tier }) => `\n${YELLOW}! [${row.kind}]${tier === row.severity ? "" : ` (re-tuned to ${tier})`} ${row.message}${RESET}`),
    ...(note ? [`${DIM}${note}${RESET}`] : []),
    "",
    `${DIM}judge it without a browser:${RESET}`,
    `  vlmkit check a11y tree ${report.out}`,
    "",
  ].join("\n");
}

export const a11yScanGate = defineGate<ScanA11yReport, ScanA11yOptions>({
  id: "scan.a11y",
  command: ["scan", "a11y"],
  title: "Accessibility tree snapshot (Flutter web, Android)",
  summary: "Write a platform's accessibility tree and its frame for check a11y tree",
  category: "correctness",
  usage: `Collects an accessibility tree as vlmkit-a11y/1 JSON plus the frame it was
painted into, from a platform with no DOM to read paint from:

  Flutter web (a URL or HTML file)
    vlmkit scan a11y https://example.com/app/ --out a11y.json
    vlmkit scan a11y https://example.com/app/ --click Practice --click Start --out game.json
  Switches Flutter's semantics tree on before the app starts (the placeholder
  click a served-copy injection used to do), waits for it to stop changing, taps
  --click names in order, and screenshots the screen.

  Android (a uiautomator dump)
    adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml
    adb exec-out screencap -p > frame.png
    vlmkit scan a11y ui.xml --density $(adb shell wm density | grep -o '[0-9]*$') --frame frame.png --out a11y.json
  Bounds become dp, the unit WCAG's target floors mean on Android.

Any other platform (macOS AX, Windows UIA, iOS, a Flutter desktop semantics
dump) writes the same JSON with its own tool — docs/a11y-tree.md has the
contract. Then: vlmkit check a11y tree a11y.json`,
  rules: [
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
    {
      id: "semantics-empty",
      title: "The tree has no named node, so nothing downstream can judge it",
      severity: "suspect",
      docs: "Flutter builds its tree only when asked; a build with semantics disabled, or a screen captured before it booted, reads as an empty page that passes every rule.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "url|page.html|dump.xml", kind: "path-or-url", description: "Flutter web page, or a uiautomator dump", positional: 0, required: true },
    { name: "out", placeholder: "file", kind: "path", description: "Tree file to write", defaultDescription: DEFAULT_A11Y_TREE },
    {
      name: "frame", placeholder: "frame.png", kind: "path",
      description: "Page: where to write the screenshot. Dump: the screenshot taken with it",
      defaultDescription: "page: beside --out",
    },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Page viewport", defaultDescription: "375x812" },
    { name: "click", placeholder: "name", kind: "string", repeatable: true, description: "Tap a node by its exact accessible name before collecting (page)" },
    { name: "locale", placeholder: "bcp47", kind: "string", description: "Page locale (pinned so the host's LANG cannot change the app)", defaultDescription: "en-US" },
    { name: "density", placeholder: "dpi", kind: "number", description: "Device dpi, required for a dump (adb shell wm density)" },
    { name: "storage-state", placeholder: "file", kind: "path", description: "Playwright storage state for pages behind a login" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit scan a11y <url|page.html|dump.xml> [--out a11y.json]", [
      "--out", "--frame", "--viewport", "--click", "--density", "--locale", "--storage-state",
    ]);
    const densityRaw = readFlag(argv, "density");
    const density = densityRaw === undefined ? undefined : Number(densityRaw);
    if (density !== undefined && !(density > 0)) throw new UsageError(`--density expects the device dpi, got ${JSON.stringify(densityRaw)}.`);
    const frame = readFlag(argv, "frame");
    const viewport = viewportFlag(argv);
    const clicks = readAll(argv, "click");
    const storageState = readFlag(argv, "storage-state");
    const locale = readFlag(argv, "locale");
    return {
      source,
      out: readFlag(argv, "out") ?? DEFAULT_A11Y_TREE,
      ...(locale ? { locale } : {}),
      ...(frame ? { frame } : {}),
      ...(viewport ? { viewport } : {}),
      ...(clicks.length > 0 ? { clicks } : {}),
      ...(density !== undefined ? { density } : {}),
      ...(storageState ? { storageState } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runScanA11y(options),
  findings: (report): Finding[] => [
    ...(report.redirect ? [{ rule: "redirected", severity: "suspect" as const, message: report.redirect }] : []),
    ...(semanticsEmpty(report) ? [{ rule: "semantics-empty", severity: "suspect" as const, message: semanticsEmpty(report)! }] : []),
  ],
  format: formatScanA11y,
  headline: (report) => `${report.platform} tree ${report.out}: ${report.counts.nodes} node(s), ${report.counts.named} named, ${report.counts.interactive} operable`,
  ledger: (report) => ({
    tool: "scan-a11y",
    source: report.source,
    headline: { platform: report.platform, out: report.out, ...report.counts },
  }),
});

// ---------------------------------------------------------------------------
// check a11y tree

const rect = (r: { left: number; top: number; width: number; height: number }) =>
  `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}`;

function treeFindings(report: CheckA11yTreeReport): Finding[] {
  return [
    ...report.unlabelled.map((f): Finding => ({
      rule: "unlabelled-control",
      severity: "suspect",
      message: `${f.role} with no accessible name (${rect(f.rect)}) — a screen reader announces only "${f.role}"`,
      selector: f.path,
      evidence: { path: f.path, role: f.role, rect: f.rect },
    })),
    ...report.unreachable.map((f): Finding => ({
      rule: "unreachable-content",
      severity: "suspect",
      message: `${f.count} named node(s) past the ${f.beyond.join("/")} edge with nothing that scrolls to them`
        + ` — first: "${f.first.name || f.first.role}" (${rect(f.first.rect)})${f.container ? ` in ${f.container}` : ""}`,
      selector: f.first.path,
      evidence: { container: f.container, first: f.first, count: f.count, beyond: f.beyond },
    })),
    ...(report.contrast?.failures ?? []).map((f): Finding => ({
      rule: "contrast-below-aa",
      severity: "suspect",
      message: `"${f.name}" ${f.ratio}:1, needs ${f.floor}:1 — ${formatRgb(f.ink)} on ${formatRgb(f.background)}`
        + ` (text ${f.textSize}, ${f.textSizeFrom})`,
      selector: f.path,
      evidence: { ...f },
    })),
    ...report.touch.failures.map((f): Finding => ({
      rule: "target-undersized",
      severity: "suspect",
      message: `${Math.round(f.bbox.width)}x${Math.round(f.bbox.height)} (min side ${f.minSide}, need ${f.required})`
        + `${f.cluster ? ", clustered" : ""} — "${f.text}"`,
      selector: f.path,
      evidence: { path: f.path, minSide: f.minSide, required: f.required, cluster: f.cluster },
    })),
  ];
}

function formatCheckA11yTree(report: CheckA11yTreeReport, rules?: RuleView): string {
  const rows = treeFindings(report).map((f) => ({ kind: f.rule, severity: f.severity, message: f.message }));
  const { shown, note } = tierIssues(rows, rules);
  const measured = report.contrast
    ? `${report.contrast.samples.length} text node(s) measured on the frame`
      + (report.contrast.skipped.length ? `, ${report.contrast.skipped.length} skipped (${[...new Set(report.contrast.skipped.map((s) => s.reason))].join(", ")})` : "")
    : `${YELLOW}no frame — contrast NOT measured (pass --image, or scan with a frame)${RESET}`;
  return [
    "",
    `${BOLD}${CYAN}vlmkit check a11y tree${RESET}  ${DIM}${report.platform}, ${report.viewport.width}x${report.viewport.height}${RESET}`,
    `${DIM}source: ${report.source}${report.frame ? `  frame: ${report.frame}` : ""}${RESET}`,
    "",
    `${report.inspected.nodes} node(s), ${report.inspected.interactive} operable; ${measured}`,
    `touch floor ${report.touch.required} (${report.touch.level})`
      + (report.touch.wcagExempt.length ? `; ${report.touch.wcagExempt.length} undersized but spaced (2.5.8 exception)` : "")
      + (report.touch.enclosed.length ? `; ${report.touch.enclosed.length} smaller target(s) inside a target that meets it, judged as that one` : ""),
    "",
    ...(shown.length === 0
      ? [`${GREEN}✓ no finding${RESET}`]
      : shown.map(({ row, tier }) => `${tier === "suspect" ? RED : YELLOW}✗ [${row.kind}]${tier === row.severity ? "" : ` (re-tuned to ${tier})`} ${row.message}${RESET}`)),
    ...(note ? [`${DIM}${note}${RESET}`] : []),
    ...(report.allowed.length ? ["", `${DIM}allowed: ${report.allowed.map((a) => `${a.selector} — ${a.reason}`).join("; ")}${RESET}`] : []),
    ...(report.unusedAllow.length ? [`${YELLOW}${report.unusedAllow.length} --allow rule(s) matched nothing: ${report.unusedAllow.join(", ")}${RESET}`] : []),
    "",
  ].join("\n");
}

export const a11yTreeGate = defineGate<CheckA11yTreeReport, CheckA11yTreeOptions>({
  id: "check.a11y.tree",
  command: ["check", "a11y", "tree"],
  title: "Accessibility tree check (any platform)",
  summary: "Names, reach, pixel contrast and target size, judged from an accessibility tree and its frame",
  category: "correctness",
  usage: `Judges a vlmkit-a11y/1 tree — written by \`vlmkit scan a11y\` (Flutter web,
Android) or by any other platform's tool — and the frame it was painted into.
No browser, no DOM: every rule reads roles, names, rects and states from the
tree, and paint from the frame's pixels.

  unlabelled-control   an operable node with no name, itself or from its content
  unreachable-content  named content past the viewport with no scrolling ancestor;
                       one finding per container, with the count
  contrast-below-aa    text under 4.5:1 (3:1 at 24 units, or 18.66 bold), the
                       most common colour in the rect against the most contrasting
                       one; disabled nodes are exempt (WCAG 1.4.3). Needs a frame.
  target-undersized    check a11y touch's own policy, on the tree's operable nodes;
                       a small control inside an operable ancestor that meets the
                       floor is judged as that ancestor (listed as enclosed)

Rects are viewport units — CSS px, dp, pt — so the 24-unit floors mean what WCAG
means on each platform. --allow matches a node's path or its quoted name:
  --allow '"Seed: 1234";decorative debug readout'`,
  rules: [
    { id: "unlabelled-control", title: "Operable node with no accessible name", severity: "suspect" },
    { id: "unreachable-content", title: "Named content outside the viewport with nothing that scrolls to it", severity: "suspect" },
    { id: "contrast-below-aa", title: "Text contrast below WCAG AA, measured on the frame", severity: "suspect" },
    {
      id: "target-undersized",
      title: "Operable target smaller than the WCAG minimum",
      severity: "suspect",
      docs: "Switch the threshold with --level AA (24) or AAA (44) instead of disabling the rule.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "a11y.json", kind: "path", description: "Accessibility tree (vlmkit-a11y/1)", positional: 0, required: true },
    { name: "image", placeholder: "frame.png", kind: "path", description: "Frame PNG", defaultDescription: "the tree's own frame" },
    {
      name: "level", kind: "string", choices: ["AAA", "AA"], defaultDescription: "AA",
      description: "Target-size floor — AA is 24 (WCAG 2.5.8), AAA is 44 (2.5.5)",
    },
    {
      name: "allow", placeholder: "<path-or-\"name\">;<reason>", kind: "string", repeatable: true,
      description: "Exempt one node from every rule, with the reason; unused rules are reported",
    },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check a11y tree <a11y.json> [--image frame.png]", ["--image", "--level", "--allow"]);
    const allow = readAll(argv, "allow");
    parseSelectorAllowRules(allow); // a typo fails before the tree is read
    const image = readFlag(argv, "image");
    return {
      source,
      ...(image ? { image } : {}),
      level: (readChoice(argv, "level", ["AAA", "AA"] as const) ?? "AA") as WcagTouchLevel,
      ...(allow.length > 0 ? { allow } : {}),
    };
  },
  run: (options) => runCheckA11yTree(options),
  findings: treeFindings,
  format: formatCheckA11yTree,
  headline: (report) =>
    `${report.platform}: ${report.unlabelled.length} unlabelled, ${report.unreachable.length} unreachable,`
    + ` ${report.contrast ? `${report.contrast.failures.length} low-contrast` : "contrast not measured"},`
    + ` ${report.touch.failures.length} undersized`,
  ledger: (report) => ({
    tool: "check-a11y-tree",
    source: report.source,
    headline: {
      platform: report.platform,
      nodes: report.inspected.nodes,
      unlabelled: report.unlabelled.length,
      unreachable: report.unreachable.length,
      lowContrast: report.contrast?.failures.length ?? null,
      undersized: report.touch.failures.length,
    },
  }),
});
