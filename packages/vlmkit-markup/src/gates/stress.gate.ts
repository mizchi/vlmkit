/**
 * The two `stress *` gates: i18n (inflated text) and media (forced-colors /
 * reduced-motion / print / RTL / 200% zoom).
 *
 * Both previously had no exit logic — they printed and exited 0. Their
 * findings are real layout defects under a condition the page will actually
 * meet, so they now fail: an element that overflows at 1.4x text length is
 * broken for German, not stylistically debatable. `--advisory` opts out, and
 * `stress media`'s own per-variant `verdict` already distinguished suspect
 * from warn, so that distinction is preserved rather than invented.
 */

import { join } from "node:path";
import { readAll, readFlag, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import {
  dataStressRuleOf,
  formatDataStressReport,
  runDataStress,
  type DataStressOptions,
  type DataStressReport,
} from "../stress/data-stress.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type I18nStressOptions,
  type I18nStressReport,
  formatI18nStressReport,
  runI18nStress,
} from "../stress/i18n-stress.ts";
import {
  ALL_VARIANTS,
  type MediaVariant,
  type MediaVariantsOptions,
  type MediaVariantsReport,
  formatMediaVariantsReport,
  runMediaVariants,
} from "../stress/media-variants.ts";
import { firstPositional } from "@mizchi/vlmkit-core/plugin/args.ts";

export const i18nStressGate = defineGate<I18nStressReport, I18nStressOptions>({
  id: "stress.i18n",
  command: ["stress", "i18n"],
  title: "Inflated-text stress",
  summary: "Inflate text content; detect overflow / wrap bugs",
  category: "behavior",
  usage: `Re-renders the page with every text run lengthened by --inflate and
reports elements that then overflow their box, wrap to a new line, or extend
past their parent. Approximates translation into a longer language without
needing translations.`,
  rules: [
    {
      id: "horizontal-overflow",
      title: "Element overflows its box horizontally under inflated text",
      severity: "suspect",
    },
    {
      id: "extends-beyond-parent",
      title: "Element extends past its parent under inflated text",
      severity: "suspect",
    },
    {
      id: "vertical-wrap",
      title: "Element gained a line under inflated text",
      severity: "warn",
      docs: "Often intended — text is supposed to wrap. Promote it when a one-line constraint is a requirement.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to stress",
      positional: 0,
      required: true,
    },
    {
      name: "inflate",
      placeholder: "n",
      kind: "number",
      description: "Word-length inflation factor",
      defaultDescription: "1.4",
    },
    {
      name: "output-dir",
      placeholder: "dir",
      kind: "path",
      description: "Output directory",
      defaultDescription: "./test-results/i18n-stress",
    },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const htmlPath = firstPositional(argv, "vlmkit stress i18n <html-or-url>", [
      "--inflate",
      "--output-dir",
      "--report",
    ]);
    const inflateFactor = readNumber(argv, "inflate", { min: 1 });
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    return {
      htmlPath,
      outputDir: outputDir ?? join(process.cwd(), "test-results", "i18n-stress"),
      // The runner owns output; the measurement's own print block is off.
      quiet: true,
      ...(inflateFactor !== undefined ? { inflateFactor } : {}),
      ...(reportPath ? { reportPath } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runI18nStress(options),
  findings: (report): Finding[] =>
    report.overflowing.map((o) => ({
      rule: o.kind,
      severity: o.kind === "vertical-wrap" ? "warn" : "suspect",
      message:
        `${o.kind} at ${report.inflateFactor}x text` +
        ` — ${Math.round(o.before.width)}px -> ${Math.round(o.after.width)}px (scroll ${Math.round(o.after.scrollWidth)}px)` +
        ` — "${o.text}"`,
      evidence: { path: o.path, tag: o.tag, before: o.before, after: o.after },
    })),
  format: formatI18nStressReport,
  ledger: (report, options) => ({
    tool: "stress-i18n",
    source: options.htmlPath,
    headline: {
      inflate: report.inflateFactor,
      inspected: report.totalInspected,
      overflowing: report.overflowing.length,
      report: report.reportPath,
    },
  }),
});

export const dataStressGate = defineGate<DataStressReport, DataStressOptions>({
  id: "stress.data",
  command: ["stress", "data"],
  title: "Data-edge stress",
  summary:
    "Empty, one-item and multiplied lists, unbreakable names, huge counts, failing images — judged by check integrity",
  category: "behavior",
  usage: `Finds where the page holds data — repeated groups (three or more children of one shape),
short text slots in their items, counts, images — and loads the page once per variant: each
group emptied, cut to one item and multiplied (x5, up to 60), the slots set to a long name with
nowhere to break, the counts set to 9,999,999, the images failing to load. check integrity's
layout judges read each variant, and what a variant adds over the page as it is is reported with
the variant's id; --variant <id> replays one. DOM mutation only: an app that renders its own
empty or error state from data is not driven into it.`,
  rules: [
    {
      id: "variant-defect",
      title: "A layout defect a data variant brings (text overflow, collision, clipping, page overflow…)",
      severity: "suspect",
      docs: "The integrity rule it is, and the variant, are in the message; check integrity's warns stay warns.",
    },
    {
      id: "empty-collapses",
      title: "Emptied, a list collapses to nothing and nothing says it is empty",
      severity: "warn",
      docs: "Static markup only: an empty state a script renders cannot be reached by emptying the DOM.",
    },
    {
      id: "broken-image-collapses",
      title: "A failing image shrinks its slot to under half its area",
      severity: "warn",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to stress",
      positional: 0,
      required: true,
    },
    {
      name: "viewports",
      placeholder: "w,w",
      kind: "string",
      description: "Widths to judge at",
      defaultDescription: "1280,375",
    },
    {
      name: "variant",
      placeholder: "id",
      kind: "string",
      repeatable: true,
      description: "Run only this variant (repeat): an id the output prints (empty:ul.grid, long-text, …)",
    },
    {
      name: "storage-state",
      placeholder: "file",
      kind: "path",
      description: "Playwright storage state for pages behind a login",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit stress data <html-or-url>", [
      "--viewports",
      "--variant",
      "--storage-state",
    ]);
    const widths = readFlag(argv, "viewports");
    const viewports = widths?.split(",").map((w) => Number(w.trim()));
    if (viewports && viewports.some((w) => !Number.isInteger(w) || w < 200))
      throw new UsageError(`--viewports takes widths of 200px or more, e.g. 1280,375; got ${widths}`);
    const only = readAll(argv, "variant");
    const storageState = readFlag(argv, "storage-state");
    return {
      source,
      ...(viewports ? { viewports } : {}),
      ...(only.length > 0 ? { only } : {}),
      ...(storageState ? { storageState } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runDataStress(options),
  findings: (report): Finding[] =>
    report.findings.map((f) => {
      const rule = dataStressRuleOf(f);
      const own = rule !== "variant-defect";
      return {
        rule,
        severity: f.severity === "fail" ? ("suspect" as const) : ("warn" as const),
        message: `${f.variant}: ${own ? "" : `[${f.rule}] `}${f.message}`,
        viewport: f.viewport,
        ...(f.selector ? { selector: f.selector } : {}),
        evidence: { variant: f.variant, rule: f.rule, replay: `--variant ${f.variant}` },
      };
    }),
  format: formatDataStressReport,
  headline: (report) =>
    `${report.findings.length} finding(s) over ${report.variants.length} variant(s) of ${report.probe.groups.length} group(s)`,
  ledger: (report, options) => ({
    tool: "stress-data",
    source: options.source,
    headline: { variants: report.variants.length, findings: report.findings.length },
  }),
});

export const mediaVariantsGate = defineGate<MediaVariantsReport, MediaVariantsOptions>({
  id: "stress.media",
  command: ["stress", "media"],
  title: "Media-variant stress",
  summary: "Forced-colors / reduced-motion / print / RTL / 200% zoom",
  category: "behavior",
  usage: `Renders the page once per media variant and diffs each against the
default render. A variant that changes nothing usually means the page ignores
it; a variant that changes drastically usually means it broke the layout. The
per-variant note says which reading applies.

Available variants: ${ALL_VARIANTS.join(", ")}.`,
  rules: [
    {
      id: "variant-broken",
      title: "Variant changed the render drastically",
      severity: "suspect",
      docs: "The variant most likely broke the layout rather than adapting it.",
    },
    {
      id: "variant-ignored",
      title: "Variant changed little or nothing",
      severity: "warn",
      docs: "The page probably does not respond to this media condition at all.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to stress",
      positional: 0,
      required: true,
    },
    {
      name: "variants",
      placeholder: "list",
      kind: "string-list",
      description: `Comma-separated subset of ${ALL_VARIANTS.join(", ")}`,
      defaultDescription: "all",
    },
    {
      name: "threshold",
      placeholder: "0..1",
      kind: "number",
      description: "Pixel diff threshold",
      defaultDescription: "0.03",
    },
    {
      name: "output-dir",
      placeholder: "dir",
      kind: "path",
      description: "Output directory",
      defaultDescription: "./test-results/media-variants",
    },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit stress media <html-or-url>", [
      "--variants",
      "--threshold",
      "--output-dir",
      "--report",
    ]);
    const rawVariants = readFlag(argv, "variants");
    let variants: MediaVariant[] | undefined;
    if (rawVariants !== undefined) {
      const requested = rawVariants
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const unknown = requested.filter((v) => !(ALL_VARIANTS as string[]).includes(v));
      if (requested.length === 0 || unknown.length > 0) {
        throw new UsageError(
          `--variants: unknown ${unknown.map((u) => `"${u}"`).join(", ") || "(none given)"}.` +
            ` Available: ${ALL_VARIANTS.join(", ")}`,
        );
      }
      variants = requested as MediaVariant[];
    }
    const threshold = readNumber(argv, "threshold", { min: 0, max: 1 });
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    return {
      source,
      outputDir: outputDir ?? join(process.cwd(), "test-results", "media-variants"),
      ...(variants ? { variants } : {}),
      ...(threshold !== undefined ? { threshold } : {}),
      ...(reportPath ? { reportPath } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runMediaVariants(options),
  findings: (report): Finding[] =>
    report.variants
      .filter((v) => v.verdict === "suspect" || v.verdict === "warn")
      .map((v) => ({
        rule: v.verdict === "suspect" ? "variant-broken" : "variant-ignored",
        // Narrowed by the filter above, but TypeScript cannot see that through
        // the predicate, and the variant vocabulary has two values the finding
        // vocabulary does not ("ok", "skip").
        severity: v.verdict === "suspect" ? ("suspect" as const) : ("warn" as const),
        message: `${v.variant}: delta ${(v.deltaRatio * 100).toFixed(2)}% — ${v.note}`,
        evidence: { variant: v.variant, deltaRatio: v.deltaRatio, screenshot: v.screenshotPath },
      })),
  format: formatMediaVariantsReport,
  ledger: (report, options) => ({
    tool: "stress-media",
    source: options.source,
    headline: {
      variants: report.variants.length,
      suspects: report.variants.filter((v) => v.verdict === "suspect").length,
      warns: report.variants.filter((v) => v.verdict === "warn").length,
      report: report.reportPath,
    },
  }),
});
