/**
 * cac-based command tree for `vrt` (0.5.0+).
 *
 * cac doesn't natively support multi-token command names, so we use a
 * two-level routing strategy: cac matches the top-level verb
 * (`diff`/`check`/`inspect`/…) and an in-action switch picks the leaf.
 *
 * Each leaf delegates to the existing per-module `main()` via
 * `process.argv` swap — individual command files don't need to migrate
 * to a function-style API in this PR.
 *
 * Old top-level commands (`vrt compare`, `vrt a11y-touch`, etc.) remain
 * as deprecation shims at the top level (still single-token, so cac
 * matches them directly).
 */

import { cac } from "cac";
import { fileURLToPath } from "node:url";
import { reportDeprecation } from "./deprecation.ts";

const HELP_SENTINEL = "__VRT_HELP_PASSTHROUGH__";

/**
 * Resolve a specifier (relative path or package export), swap
 * `process.argv` so the target module's `isCliEntry` check passes,
 * then import it.
 */
async function delegate(specifier: string, args: string[]): Promise<void> {
  const resolvedUrl = import.meta.resolve(specifier);
  const absoluteModulePath = fileURLToPath(resolvedUrl);
  process.argv = [
    process.argv[0],
    absoluteModulePath,
    ...args.map((a) => (a === HELP_SENTINEL ? "--help" : a)),
  ];
  await import(resolvedUrl);
}

async function runDiscover(args: string[]): Promise<void> {
  const file = args.find((a) => !a.startsWith("-") && a !== HELP_SENTINEL);
  if (!file || args.includes(HELP_SENTINEL) || args.includes("--help") || args.includes("-h")) {
    console.log("Usage: vrt scan breakpoints <html-file>");
    if (!file) process.exit(1);
    return;
  }
  const { readFile } = await import("node:fs/promises");
  const { discoverViewports } = await import("@mizchi/vrt-capture/viewport-discovery.ts");
  const html = await readFile(file, "utf-8");
  const result = discoverViewports(html, { randomSamples: 1, maxViewports: 15 });
  console.log();
  console.log(`\x1b[1m\x1b[36mBreakpoint Discovery\x1b[0m  \x1b[2m${file}\x1b[0m`);
  console.log();
  if (result.breakpoints.length > 0) {
    console.log(`  \x1b[1mBreakpoints:\x1b[0m`);
    for (const bp of result.breakpoints) console.log(`    ${bp.type}: ${bp.value}px  \x1b[2m${bp.raw}\x1b[0m`);
    console.log();
  }
  console.log(`  \x1b[1mViewports (${result.viewports.length}):\x1b[0m`);
  for (const vp of result.viewports) console.log(`    ${String(vp.width).padStart(5)}px  ${vp.label.padEnd(16)} \x1b[2m${vp.reason}\x1b[0m`);
  console.log();
}

async function runApiStatus(args: string[]): Promise<void> {
  const url = args.find((_, i) => args[i - 1] === "--url") ?? "http://localhost:3456";
  try {
    const res = await fetch(`${url}/api/status`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.error(`Server not available at ${url}`);
    process.exit(1);
  }
}

async function runWorkflow(args: string[]): Promise<void> {
  const { runWorkflowCli } = await import("./workflow.ts");
  await runWorkflowCli(args.map((a) => (a === HELP_SENTINEL ? "--help" : a)));
}

const SPECS = {
  migrationCompare: "../experiments/migration/migration-compare.ts",
  pngDiff: "@mizchi/vrt-core/png-diff.ts",
  cssBench: "../experiments/css-challenge/css-challenge-bench.ts",
  detectionReport: "../experiments/detection/detection-report.ts",
  snapshot: "../vrt/snapshot/snapshot.ts",
  elementCompare: "@mizchi/vrt-core/element-compare.ts",
  smokeRunner: "@mizchi/vrt-markup/inspect/smoke-runner.ts",
  flipbook: "./commands/flipbook-cli.ts",
  diffForAgent: "./commands/diff-for-agent-cli.ts",
  compareRuns: "./commands/compare-runs-cli.ts",
  componentFromImage: "@mizchi/vrt-markup/component/component-from-image.ts",
  multiPageConsistency: "@mizchi/vrt-markup/stress/multi-page-consistency.ts",
  componentConsistency: "@mizchi/vrt-markup/component/component-consistency.ts",
  themeParity: "@mizchi/vrt-markup/style/theme-parity.ts",
  i18nStress: "@mizchi/vrt-markup/stress/i18n-stress.ts",
  a11yContrast: "@mizchi/vrt-core/a11y-contrast.ts",
  a11yTouch: "@mizchi/vrt-core/a11y-touch.ts",
  a11yFocusOrder: "@mizchi/vrt-core/a11y-focus-order.ts",
  interact: "@mizchi/vrt-markup/inspect/interact.ts",
  mediaVariants: "@mizchi/vrt-markup/stress/media-variants.ts",
  crossBrowser: "@mizchi/vrt-markup/stress/cross-browser.ts",
  designTokens: "@mizchi/vrt-markup/style/design-tokens.ts",
  perf: "../util/perf.ts",
  explore: "@mizchi/vrt-markup/inspect/explore.ts",
  skill: "../util/skill.ts",
  componentExtract: "@mizchi/vrt-markup/component/component-extract.ts",
  apiServer: "../api/api-server.ts",
} as const;

const GROUPS: Record<string, Record<string, { spec?: string; run?: (args: string[]) => Promise<void>; desc: string }>> = {
  diff: {
    html: { spec: SPECS.migrationCompare, desc: "Compare two HTML files / URLs across viewports" },
    png: { spec: SPECS.pngDiff, desc: "Compare existing PNG screenshots directly" },
    elements: { spec: SPECS.elementCompare, desc: "Element-level comparison with shift isolation" },
    browsers: { spec: SPECS.crossBrowser, desc: "Render in chromium / firefox / webkit and diff" },
    agent: { spec: SPECS.diffForAgent, desc: "Generate agent-friendly Markdown diff report" },
    runs: { spec: SPECS.compareRuns, desc: "Aggregate multiple VRT runs" },
  },
  check: {
    tokens: { spec: SPECS.designTokens, desc: "Design-token scale conformance" },
    theme: { spec: SPECS.themeParity, desc: "Theme parity (hard-coded color scan in dark mode)" },
    perf: { spec: SPECS.perf, desc: "Web Vitals thresholds (CLS / LCP / FCP)" },
  },
  inspect: {
    interact: { spec: SPECS.interact, desc: "Scripted UI interaction sequence" },
    explore: { spec: SPECS.explore, desc: "Auto-discover declared actions and diff each" },
    smoke: { spec: SPECS.smokeRunner, desc: "A11y-driven exploratory smoke test" },
  },
  stress: {
    i18n: { spec: SPECS.i18nStress, desc: "Inflate text content; detect overflow / wrap bugs" },
    media: { spec: SPECS.mediaVariants, desc: "Forced-colors / reduced-motion / print / RTL / 200% zoom" },
  },
  scan: {
    component: { spec: SPECS.componentExtract, desc: "Detect components in a screenshot; crop to standalone PNGs" },
    breakpoints: { run: runDiscover, desc: "Discover responsive breakpoints from HTML/CSS" },
  },
  build: {
    component: { spec: SPECS.componentFromImage, desc: "Build a component from a target screenshot" },
  },
};

// Two-segment subcommands inside `check` (a11y, drift).
const CHECK_A11Y: Record<string, { spec: string; desc: string }> = {
  contrast: { spec: SPECS.a11yContrast, desc: "WCAG AA contrast scan" },
  touch: { spec: SPECS.a11yTouch, desc: "Touch-target size check" },
  focus: { spec: SPECS.a11yFocusOrder, desc: "Focus order / trap check" },
};
const CHECK_DRIFT: Record<string, { spec: string; desc: string }> = {
  component: { spec: SPECS.componentConsistency, desc: "Drift across N selector instances on one page" },
  pages: { spec: SPECS.multiPageConsistency, desc: "Drift of one selector across N pages" },
};

const DEPRECATED_TOP_LEVEL: Record<string, { newName: string; spec: string }> = {
  compare: { newName: "diff html", spec: SPECS.migrationCompare },
  "png-diff": { newName: "diff png", spec: SPECS.pngDiff },
  elements: { newName: "diff elements", spec: SPECS.elementCompare },
  "cross-browser": { newName: "diff browsers", spec: SPECS.crossBrowser },
  "diff-for-agent": { newName: "diff agent", spec: SPECS.diffForAgent },
  "compare-runs": { newName: "diff runs", spec: SPECS.compareRuns },
  "a11y-contrast": { newName: "check a11y contrast", spec: SPECS.a11yContrast },
  "a11y-touch": { newName: "check a11y touch", spec: SPECS.a11yTouch },
  "a11y-focus-order": { newName: "check a11y focus", spec: SPECS.a11yFocusOrder },
  "design-tokens": { newName: "check tokens", spec: SPECS.designTokens },
  "theme-parity": { newName: "check theme", spec: SPECS.themeParity },
  perf: { newName: "check perf", spec: SPECS.perf },
  "component-consistency": { newName: "check drift component", spec: SPECS.componentConsistency },
  "multi-page-consistency": { newName: "check drift pages", spec: SPECS.multiPageConsistency },
  interact: { newName: "inspect interact", spec: SPECS.interact },
  explore: { newName: "inspect explore", spec: SPECS.explore },
  smoke: { newName: "inspect smoke", spec: SPECS.smokeRunner },
  "i18n-stress": { newName: "stress i18n", spec: SPECS.i18nStress },
  "media-variants": { newName: "stress media", spec: SPECS.mediaVariants },
  "component-extract": { newName: "scan component", spec: SPECS.componentExtract },
  "component-from-image": { newName: "build component", spec: SPECS.componentFromImage },
  flipbook: { newName: "snapshot flipbook", spec: SPECS.flipbook },
};
const WORKFLOW_ALIASES = [
  "init", "capture", "verify", "approve",
  "graph", "affected", "introspect", "spec-verify", "expect",
];

function printGroupHelp(groupName: string): void {
  const group = GROUPS[groupName];
  if (groupName === "check") {
    console.log(`vrt check <subcommand>\n`);
    console.log("Subcommands:");
    console.log("  a11y contrast <html>          WCAG AA contrast scan");
    console.log("  a11y touch <html>             Touch-target size check");
    console.log("  a11y focus <html>             Focus order / trap check");
    for (const [name, info] of Object.entries(group)) {
      console.log(`  ${name.padEnd(30)}${info.desc}`);
    }
    console.log("  drift component <html>        Drift across N selector instances on one page");
    console.log("  drift pages --urls/--files    Drift of one selector across N pages");
    return;
  }
  console.log(`vrt ${groupName} <subcommand>\n`);
  console.log("Subcommands:");
  for (const [name, info] of Object.entries(group)) {
    console.log(`  ${name.padEnd(16)}${info.desc}`);
  }
}

async function runGroupLeaf(
  groupName: string,
  leafName: string,
  rest: string[],
): Promise<void> {
  if (groupName === "check" && leafName === "a11y") {
    const sub = rest[0];
    if (!sub || sub === HELP_SENTINEL) {
      console.log("vrt check a11y <contrast|touch|focus> <html>");
      return;
    }
    const entry = CHECK_A11Y[sub];
    if (!entry) {
      console.error(`Unknown a11y check: ${sub}`);
      process.exit(1);
    }
    await delegate(entry.spec, rest.slice(1));
    return;
  }
  if (groupName === "check" && leafName === "drift") {
    const sub = rest[0];
    if (!sub || sub === HELP_SENTINEL) {
      console.log("vrt check drift <component|pages> <html>");
      return;
    }
    const entry = CHECK_DRIFT[sub];
    if (!entry) {
      console.error(`Unknown drift check: ${sub}`);
      process.exit(1);
    }
    await delegate(entry.spec, rest.slice(1));
    return;
  }
  const entry = GROUPS[groupName]?.[leafName];
  if (!entry) {
    console.error(`Unknown ${groupName} subcommand: ${leafName}`);
    process.exit(1);
  }
  if (entry.run) {
    await entry.run(rest);
  } else if (entry.spec) {
    await delegate(entry.spec, rest);
  }
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const cli = cac("vrt");
  cli.version("0.5.0");

  cli.usage(`<command> [options]

Pixel / DOM / a11y diff toolkit with VLM-driven markup assistance.

Common command groups:
  vrt diff html|png|elements|browsers|agent|runs
  vrt check a11y|tokens|theme|perf|drift
  vrt inspect interact|explore|smoke
  vrt stress i18n|media
  vrt scan component|breakpoints
  vrt build component
  vrt snapshot [<url>...]
  vrt workflow <subcommand>
  vrt bench / api / skill / report

Run \`vrt <command> --help\` for command-specific options.`);

  // Group commands — second-level dispatch happens in the action.
  for (const groupName of Object.keys(GROUPS)) {
    cli.command(`${groupName} [...args]`, `${groupName} group`)
      .allowUnknownOptions()
      .action(async () => {
        const groupArgs = passThrough(argv, [groupName]);
        // `vrt diff --help` (no leaf, just help) → group usage.
        // passThrough rewrites --help/-h to HELP_SENTINEL so cac
        // doesn't intercept; we restore the semantics here.
        if (
          groupArgs.length === 0 ||
          (groupArgs.length === 1 && groupArgs[0] === HELP_SENTINEL)
        ) {
          printGroupHelp(groupName);
          return;
        }
        const [leaf, ...rest] = groupArgs;
        await runGroupLeaf(groupName, leaf, rest);
      });
  }

  // Snapshot / workflow / bench / api / report / skill (single-token).
  // `vrt snapshot flipbook ...` is special-cased to delegate directly
  // to the flipbook CLI (snapshot.ts doesn't have a `flipbook` mode).
  cli.command("snapshot [...args]", "Multi-viewport snapshot baseline + diff")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["snapshot"]);
      if (rest[0] === "flipbook") {
        await delegate(SPECS.flipbook, rest.slice(1));
        return;
      }
      await delegate(SPECS.snapshot, rest);
    });

  cli.command("workflow [...args]", "Stateful baseline/snapshot workflow")
    .allowUnknownOptions()
    .action(async () => runWorkflow(passThrough(argv, ["workflow"])));

  cli.command("bench [...args]", "CSS challenge benchmark")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.cssBench, passThrough(argv, ["bench"])));

  cli.command("report [...args]", "Detection pattern report (CSS challenge)")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.detectionReport, passThrough(argv, ["report"])));

  cli.command("skill [...args]", "Per-project skill playbooks")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.skill, passThrough(argv, ["skill"])));

  cli.command("api [...args]", "HTTP API server (serve / status)")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["api"]);
      const sub = rest[0];
      if (sub === "serve") {
        await delegate(SPECS.apiServer, rest.slice(1));
      } else if (sub === "status") {
        await runApiStatus(rest.slice(1));
      } else {
        console.log("vrt api <serve|status>");
        if (sub) process.exitCode = 1;
      }
    });

  // Deprecated top-level command shims.
  for (const [oldName, { newName, spec }] of Object.entries(DEPRECATED_TOP_LEVEL)) {
    cli.command(`${oldName} [...args]`, `[deprecated] Use 'vrt ${newName}'`)
      .allowUnknownOptions()
      .action(async () => {
        reportDeprecation(oldName, `vrt ${newName}`);
        await delegate(spec, passThrough(argv, [oldName]));
      });
  }

  // Workflow single-word aliases — deprecation shims.
  for (const alias of WORKFLOW_ALIASES) {
    cli.command(`${alias} [...args]`, `[deprecated] Use 'vrt workflow ${alias}'`)
      .allowUnknownOptions()
      .action(async () => {
        reportDeprecation(alias, `vrt workflow ${alias}`);
        await runWorkflow([alias, ...passThrough(argv, [alias])]);
      });
  }

  // serve / status — legacy top-level aliases for api.
  cli.command("serve [...args]", "[deprecated] Use 'vrt api serve'")
    .allowUnknownOptions()
    .action(async () => {
      reportDeprecation("serve", "vrt api serve");
      await delegate(SPECS.apiServer, passThrough(argv, ["serve"]));
    });
  cli.command("status [...args]", "[deprecated] Use 'vrt api status'")
    .allowUnknownOptions()
    .action(async () => {
      reportDeprecation("status", "vrt api status");
      await runApiStatus(passThrough(argv, ["status"]));
    });

  cli.command("discover <file>", "[deprecated] Use 'vrt scan breakpoints'")
    .action(async (file: string) => {
      reportDeprecation("discover", "vrt scan breakpoints");
      await runDiscover([file]);
    });

  // Top-level --help / -h / help: print cac usage.
  const isTopLevelHelp =
    argv.length === 0 ||
    (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help"));
  if (isTopLevelHelp) {
    cli.outputHelp();
    return;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    cli.outputVersion();
    return;
  }

  // Mask --help/-h so cac doesn't intercept; passThrough restores it.
  const maskedArgv = argv.map((a) => (a === "--help" || a === "-h" ? HELP_SENTINEL : a));

  cli.parse(["node", "vrt", ...maskedArgv], { run: false });
  if (cli.matchedCommand) {
    await cli.runMatchedCommand();
  } else {
    process.stderr.write(`Unknown command: ${argv.join(" ")}\n\n`);
    cli.outputHelp();
    process.exitCode = 1;
  }
}

/**
 * Strip command tokens from argv and forward the rest (with HELP_SENTINEL
 * preserved as-is — `delegate` / `runWorkflow` / `runApiStatus` restore
 * it to `--help` on output).
 */
function passThrough(argv: string[], commandTokens: string[]): string[] {
  const out: string[] = [];
  let tokenIdx = 0;
  for (const arg of argv) {
    if (tokenIdx < commandTokens.length && arg === commandTokens[tokenIdx]) {
      tokenIdx++;
      continue;
    }
    out.push(arg === "--help" || arg === "-h" ? HELP_SENTINEL : arg);
  }
  return out;
}
