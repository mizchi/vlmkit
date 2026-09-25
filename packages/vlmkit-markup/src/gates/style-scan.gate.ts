/**
 * `scan style` as a gate definition: one page load, the collectors of `check design`,
 * `check composition` and `check color`, one snapshot file. Measurement lives in
 * `../style/style-snapshot.ts`.
 *
 * A `scan` like `scan scroll`: an inventory first. Its only verdict is `redirected`, because a
 * snapshot of the login screen would be judged three times as the page that was asked for.
 */
import { readAll, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding, RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { tierIssues } from "@mizchi/vlmkit-core/plugin/rule-prose.ts";
import { firstPositional } from "@mizchi/vlmkit-core/plugin/args.ts";
import { BOLD, CYAN, DIM, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  captureStyleSnapshot,
  DEFAULT_STYLE_SNAPSHOT,
  type StyleSnapshot,
  type StyleSnapshotOptions,
} from "../style/style-snapshot.ts";

export interface StyleScanReport {
  source: string;
  out: string;
  redirect: string | null;
  viewport: StyleSnapshot["viewport"];
  exclude: string[];
  /** What each gate will judge: samples, boxes, fields and links. */
  counts: { designSamples: number; compositionBoxes: number; colorControls: number; colorLinks: number };
}

function formatStyleScan(report: StyleScanReport, rules?: RuleView): string {
  const from = `--from ${report.out}`;
  // The one verdict this scan has, through the rule settings like every gate's prose.
  const { shown, note } = tierIssues(
    report.redirect ? [{ kind: "redirected", severity: "suspect" as const, message: report.redirect }] : [],
    rules,
  );
  return [
    "",
    `${BOLD}${CYAN}vlmkit scan style${RESET}`,
    `${DIM}source: ${report.source}${RESET}`,
    "",
    `snapshot: ${report.out}  (${report.viewport.width}x${report.viewport.height}, one page load)`,
    `  design       ${report.counts.designSamples} role sample(s)${report.exclude.length ? `, --exclude ${report.exclude.join(" ")}` : ""}`,
    `  composition  ${report.counts.compositionBoxes} box(es)`,
    `  color        ${report.counts.colorControls} field(s), ${report.counts.colorLinks} link(s)`,
    ...shown.map(({ row, tier }) => `\n${YELLOW}! [${row.kind}]${tier === row.severity ? "" : ` (re-tuned to ${tier})`} ${row.message}${RESET}`),
    ...(note ? [`${DIM}${note}${RESET}`] : []),
    "",
    `${DIM}judge it without a browser:${RESET}`,
    `  vlmkit check design ${from}`,
    `  vlmkit check composition ${from}`,
    `  vlmkit check color ${from}`,
    "",
  ].join("\n");
}

export const styleScanGate = defineGate<StyleScanReport, StyleSnapshotOptions & { out: string }>({
  id: "scan.style",
  command: ["scan", "style"],
  title: "Style snapshot (design + composition + color)",
  summary: "Load a page once and save what check design, check composition and check color read",
  category: "design-system",
  usage: `Collect once, judge many. Loads the page once — the same 1280x900, networkidle and
settle the three gates each use — runs the collectors of check design, check
composition and check color, and writes their output to one snapshot file.
Then judge it with no browser:

  vlmkit scan style page.html --out snap.json
  vlmkit check design --from snap.json
  vlmkit check composition --from snap.json
  vlmkit check color --from snap.json

Each --from report equals what the live gate reports on the same page. The
snapshot is one render: its --viewport applies to all three, and --exclude
(design's vendor subtrees) is applied at capture time.`,
  rules: [
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to capture", positional: 0, required: true },
    { name: "out", placeholder: "file", kind: "path", description: "Snapshot file to write", defaultDescription: DEFAULT_STYLE_SNAPSHOT },
    { name: "viewport", kind: "number", description: "Viewport width, for all three gates", defaultDescription: "1280" },
    {
      name: "exclude", placeholder: "selector", kind: "string", repeatable: true,
      description: "Vendor subtree left out of the design collection (check design --exclude)",
    },
    { name: "storage-state", placeholder: "file", kind: "path", description: "Playwright storage state for pages behind a login" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit scan style <html-or-url> [--out snap.json]", [
      "--out", "--viewport", "--exclude", "--storage-state",
    ]);
    const viewport = readInt(argv, "viewport", { min: 200 });
    const exclude = readAll(argv, "exclude");
    const storageState = readFlag(argv, "storage-state");
    return {
      source,
      out: readFlag(argv, "out") ?? DEFAULT_STYLE_SNAPSHOT,
      ...(viewport !== undefined ? { viewport } : {}),
      ...(exclude.length > 0 ? { exclude } : {}),
      ...(storageState ? { storageState } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: async (options) => {
    const snapshot = await captureStyleSnapshot(options);
    return {
      source: snapshot.source,
      out: options.out,
      redirect: snapshot.redirect,
      viewport: snapshot.viewport,
      exclude: snapshot.exclude,
      counts: {
        designSamples: snapshot.design.samples.length,
        compositionBoxes: snapshot.composition.boxes.length,
        colorControls: snapshot.color.controls.length,
        colorLinks: snapshot.color.links.length,
      },
    };
  },
  findings: (report): Finding[] =>
    report.redirect ? [{ rule: "redirected", severity: "suspect", message: report.redirect }] : [],
  format: formatStyleScan,
  headline: (report) =>
    `snapshot ${report.out}: ${report.counts.designSamples} design sample(s), ${report.counts.compositionBoxes} box(es),`
    + ` ${report.counts.colorControls} field(s), ${report.counts.colorLinks} link(s)`,
  ledger: (report) => ({
    tool: "scan-style",
    source: report.source,
    headline: { out: report.out, ...report.counts },
  }),
});
