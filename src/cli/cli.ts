/**
 * cac-based command tree for `vlmkit` (0.5.0+).
 *
 * cac doesn't natively support multi-token command names, so we use a
 * two-level routing strategy: cac matches the top-level verb
 * (`diff`/`check`/`inspect`/…) and an in-action switch picks the leaf.
 *
 * Each leaf delegates to the existing per-module `main()` via
 * `process.argv` swap — individual command files don't need to migrate
 * to a function-style API in this PR.
 *
 */

import { cac } from "cac";
import { BOLD, CYAN, DIM, RESET } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { loadGateRegistry } from "./gate-registry.ts";

const HELP_SENTINEL = "__VLMKIT_HELP_PASSTHROUGH__";

/**
 * The script this CLI was started from, captured at import time — `delegate`
 * overwrites `process.argv` before any leaf runs, so a leaf that needs to spawn
 * another gate (`vlmkit batch`) can no longer find it. Read at module scope,
 * which runs before the first delegate call.
 */
const CLI_ENTRY = process.argv[1];

/**
 * Each leaf is referenced as `{ name, loader }`. The loader is a
 * closure that returns the dynamic import — keeping the path as a
 * literal at the `import()` call site lets tsdown statically
 * discover the leaf and code-split it into a chunk that ships with
 * `dist/vlmkit.mjs`.
 *
 * The `name` is a per-leaf identifier set into `__VLMKIT_DISPATCHER_LEAF__`
 * around the await. Each leaf's CLI-entry guard checks that the env
 * var matches *its* name, so static cross-leaf imports (e.g.
 * `diff-pr.ts` importing `cross-browser.ts` for shared types) do not
 * accidentally fire the imported leaf's `main()`.
 */
type SpecLoader = () => Promise<unknown>;
interface Spec {
  name: string;
  loader: SpecLoader;
}

function spec(name: string, loader: SpecLoader): Spec {
  return { name, loader };
}

async function delegate(s: Spec, args: string[]): Promise<void> {
  process.argv = [
    process.argv[0],
    "(vrt-dispatcher)",
    ...args.map((a) => (a === HELP_SENTINEL ? "--help" : a)),
  ];
  const prev = process.env.__VLMKIT_DISPATCHER_LEAF__;
  process.env.__VLMKIT_DISPATCHER_LEAF__ = s.name;
  if (CLI_ENTRY) process.env.__VLMKIT_CLI_ENTRY__ = CLI_ENTRY;
  try {
    await s.loader();
  } finally {
    if (prev === undefined) {
      delete process.env.__VLMKIT_DISPATCHER_LEAF__;
    } else {
      process.env.__VLMKIT_DISPATCHER_LEAF__ = prev;
    }
  }
}

async function runDiscover(args: string[]): Promise<void> {
  const file = args.find((a) => !a.startsWith("-") && a !== HELP_SENTINEL);
  if (!file || args.includes(HELP_SENTINEL) || args.includes("--help") || args.includes("-h")) {
    console.log("Usage: vlmkit scan breakpoints <html-file>");
    if (!file) process.exit(1);
    return;
  }
  const { readFile } = await import("node:fs/promises");
  const { discoverViewports } = await import("@mizchi/vlmkit-capture/viewport-discovery.ts");
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
  const { appendRunLedger } = await import("@mizchi/vlmkit-core/run-ledger.ts");
  appendRunLedger({
    tool: "scan-breakpoints",
    source: file,
    headline: { breakpoints: result.breakpoints.length, viewports: result.viewports.length },
  });
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

const SPECS: Record<string, Spec> = {
  migrationCompare: spec("migration-compare", () => import("../experiments/migration/migration-compare.ts")),
  pngDiff: spec("png-diff", () => import("@mizchi/vlmkit-markup/png-diff.ts")),
  cssBench: spec("css-challenge-bench", () => import("../experiments/css-challenge/css-challenge-bench.ts")),
  detectionReport: spec("detection-report", () => import("../experiments/detection/detection-report.ts")),
  snapshot: spec("snapshot", () => import("../vrt/snapshot/snapshot.ts")),
  snapshotReport: spec("snapshot-report", () => import("../vrt/snapshot/snapshot-report.ts")),
  migrationBlind: spec("migration-blind", () => import("../experiments/migration/migration-blind.ts")),
  migrationSubagent: spec("migration-subagent", () => import("../experiments/migration/migration-subagent.ts")),
  elementCompare: spec("element-compare", () => import("@mizchi/vlmkit-core/element-compare.ts")),
  smokeRunner: spec("smoke-runner", () => import("@mizchi/vlmkit-markup/inspect/smoke-runner.ts")),
  flipbook: spec("flipbook-cli", () => import("./commands/flipbook-cli.ts")),
  diffForAgent: spec("diff-for-agent-cli", () => import("./commands/diff-for-agent-cli.ts")),
  presenceMatrix: spec("presence-matrix", () => import("./commands/presence-matrix-cli.ts")),
  compareRuns: spec("compare-runs-cli", () => import("./commands/compare-runs-cli.ts")),
  batch: spec("batch", () => import("./commands/batch-cli.ts")),
  gates: spec("gates", () => import("./commands/gates-cli.ts")),
  componentFromImage: spec("component-from-image", () => import("@mizchi/vlmkit-markup/component/component-from-image.ts")),
  contractIntrospect: spec("contract-introspect", () => import("@mizchi/vlmkit-markup/contract/introspect-contract.ts")),
  contractValidate: spec("contract-validate", () => import("@mizchi/vlmkit-markup/contract/validate-contract.ts")),
  contractScaffold: spec("contract-scaffold", () => import("@mizchi/vlmkit-markup/contract/scaffold-contract.ts")),
  selectorHeal: spec("selector-heal-cli", () => import("@mizchi/vlmkit-markup/heal/selector-heal-cli.ts")),
  palette: spec("palette-cli", () => import("@mizchi/vlmkit-markup/style/palette-cli.ts")),
  pageCompose: spec("page-compose", () => import("@mizchi/vlmkit-markup/component/page-compose.ts")),
  interact: spec("interact", () => import("@mizchi/vlmkit-markup/inspect/interact.ts")),
  crossBrowser: spec("cross-browser", () => import("@mizchi/vlmkit-markup/stress/cross-browser.ts")),
  markupAutofix: spec("markup-autofix", () => import("@mizchi/vlmkit-markup/verify/markup-autofix.ts")),
  mockScan: spec("mock-scan", () => import("@mizchi/vlmkit-markup/inspect/mock-scan.ts")),
  explore: spec("explore", () => import("@mizchi/vlmkit-markup/inspect/explore.ts")),
  skill: spec("skill", () => import("../util/skill.ts")),
  markupLoop: spec("markup-loop", () => import("../util/markup-loop.ts")),
  componentExtract: spec("component-extract", () => import("@mizchi/vlmkit-markup/component/component-extract.ts")),
  apiServer: spec("api-server", () => import("../api/api-server.ts")),
  manifest: spec("manifest-cli", () => import("../manifest-cli.ts")),
  watch: spec("watch", () => import("../watch.ts")),
  diffPr: spec("diff-pr", () => import("../diff-pr.ts")),
  baseline: spec("baseline-cli", () => import("../baseline-cli.ts")),
};

const GROUPS: Record<string, Record<string, { spec?: Spec; run?: (args: string[]) => Promise<void>; desc: string }>> = {
  diff: {
    html: { spec: SPECS.migrationCompare, desc: "Compare two HTML files / URLs across viewports" },
    png: { spec: SPECS.pngDiff, desc: "Compare existing PNG screenshots directly" },
    matrix: { spec: SPECS.presenceMatrix, desc: "Region × viewport presence matrix with media-query hints" },
    elements: { spec: SPECS.elementCompare, desc: "Element-level comparison with shift isolation" },
    component: { spec: SPECS.elementCompare, desc: "Component selector comparison with shift isolation" },
    browsers: { spec: SPECS.crossBrowser, desc: "Render in chromium / firefox / webkit and diff" },
    agent: { spec: SPECS.diffForAgent, desc: "Generate agent-friendly Markdown diff report" },
    runs: { spec: SPECS.compareRuns, desc: "Aggregate multiple VRT runs" },
  },
  check: {
    palette: { spec: SPECS.palette, desc: "Dominant colors of a PNG, or palette diff of two PNGs" },
  },
  inspect: {
    interact: { spec: SPECS.interact, desc: "Scripted UI interaction sequence" },
    explore: { spec: SPECS.explore, desc: "Auto-discover declared actions and diff each" },
    smoke: { spec: SPECS.smokeRunner, desc: "A11y-driven exploratory smoke test" },
  },
  scan: {
    component: { spec: SPECS.componentExtract, desc: "Detect components in a screenshot; crop to standalone PNGs" },
    breakpoints: { run: runDiscover, desc: "Discover responsive breakpoints from HTML/CSS (verify them with `check breakpoints`)" },
    mock: { spec: SPECS.mockScan, desc: "Mock-image intake: infer @2x/@3x scale, write normalized @1x target, extraction sanity" },
  },
  build: {
    component: { spec: SPECS.componentFromImage, desc: "Build a component from a target screenshot" },
    page: { spec: SPECS.pageCompose, desc: "Page-level multi-component composition diff" },
  },
  contract: {
    introspect: { spec: SPECS.contractIntrospect, desc: "Infer UI Contract IR from existing HTML / URL" },
    validate: { spec: SPECS.contractValidate, desc: "Validate UI Contract IR" },
    scaffold: { spec: SPECS.contractScaffold, desc: "Compile UI Contract IR into an HTML/CSS scaffold" },
  },
  heal: {
    selector: { spec: SPECS.selectorHeal, desc: "Suggest replacements for a selector that no longer matches" },
    markup: { spec: SPECS.markupAutofix, desc: "Stage-2 auto-fix: LLM turns the verify-markup kickback into gated CSS overrides" },
  },
};

/**
 * Leaves of a group, merging the registry's gates with the legacy `GROUPS`
 * table. Group help has to read from both while the migration is in
 * progress, and merging here — rather than duplicating each migrated gate's
 * description back into `GROUPS` — is what keeps the definition the only
 * place a gate's summary is written.
 */
async function groupLeaves(groupName: string): Promise<{ name: string; desc: string }[]> {
  const legacy = Object.entries(GROUPS[groupName] ?? {}).map(([name, info]) => ({ name, desc: info.desc }));
  const registry = await loadGateRegistry();
  const registered = (registry.groups().get(groupName) ?? [])
    .map(({ gate }) => ({ name: gate.command.slice(1).join(" "), desc: gate.summary }));
  return [...legacy, ...registered].sort((a, b) => a.name.localeCompare(b.name));
}

async function printGroupHelp(groupName: string): Promise<void> {
  const leaves = await groupLeaves(groupName);
  if (groupName === "check") {
    // `a11y *` and `drift *` used to be printed by hand here because they were
    // not in any table. They are registry gates now, so they arrive in
    // `leaves` with everything else and the hand-written lines are gone.
    console.log(`vlmkit check <subcommand>\n`);
    console.log("Subcommands:");
    for (const leaf of leaves) {
      console.log(`  ${leaf.name.padEnd(30)}${leaf.desc}`);
    }
    console.log(`\nRun \`vlmkit rules\` to list the rules each gate can tune.`);
    return;
  }
  console.log(`vlmkit ${groupName} <subcommand>\n`);
  console.log("Subcommands:");
  for (const leaf of leaves) {
    console.log(`  ${leaf.name.padEnd(16)}${leaf.desc}`);
  }
}

/**
 * `vlmkit rules` / `vlmkit rules <gate>` — what the registry knows, and what
 * of it can be tuned. Without this the rule ids are only discoverable by
 * reading source, which would make rule settings a feature nobody finds.
 */
async function runRules(args: string[]): Promise<void> {
  const registry = await loadGateRegistry();
  const { formatRuleTable } = await import("@mizchi/vlmkit-core/plugin/runner.ts");
  const { GATE_CATEGORIES } = await import("@mizchi/vlmkit-core/plugin/contract.ts");
  const json = args.includes("--json");
  const wanted = args.filter((a) => !a.startsWith("-") && a !== HELP_SENTINEL);

  if (wanted.length > 0) {
    const gate = registry.byCommand(wanted) ?? registry.byId(wanted.join(" "));
    if (!gate) {
      const suggestions = registry.suggest(wanted);
      console.error(
        `Unknown gate: ${wanted.join(" ")}`
        + (suggestions.length > 0 ? ` — did you mean ${suggestions.map((s) => `"${s}"`).join(", ")}?` : ""),
      );
      process.exitCode = 1;
      return;
    }
    if (json) {
      console.log(JSON.stringify({ ...describeGate(gate, registry), rules: gate.rules }, null, 2));
      return;
    }
    console.log(formatRuleTable(gate));
    return;
  }

  if (json) {
    // The whole catalog, machine-readable: what exists, what it answers, and
    // every tunable rule. A CI job that wants "fail the build if a new gate
    // appears un-triaged" needs this, and scraping the prose is not an answer.
    const gates = registry.list().map(({ gate }) => ({
      ...describeGate(gate, registry),
      rules: gate.rules,
    }));
    console.log(JSON.stringify({ categories: GATE_CATEGORIES, gates }, null, 2));
    return;
  }

  // Grouped by what kind of question each gate answers, not by CLI verb. A
  // reader choosing what to run is asking "what can go wrong with my page",
  // and `check`/`scan`/`stress`/`verify` does not answer that — `scan scroll`
  // and `check breakpoints` are spelled differently and answer the same thing.
  console.log(`\nvlmkit rules — every gate, by the kind of question it answers\n`);
  for (const [category, entries] of registry.categories()) {
    const description = category === "other"
      ? "Uncategorized (a plugin gate that declared no category)."
      : GATE_CATEGORIES[category];
    console.log(`${BOLD}${category}${RESET}  ${DIM}${description}${RESET}`);
    for (const { gate, plugin } of entries) {
      console.log(
        `  ${gate.command.join(" ").padEnd(21)}${String(gate.rules.length).padStart(2)} rule(s)`
        + `  ${DIM}${gate.id}${RESET}${plugin.startsWith("@mizchi/") || plugin === "vlmkit-app" ? "" : `  ${CYAN}[${plugin}]${RESET}`}`,
      );
    }
    console.log("");
  }
  const total = registry.list().reduce((n, { gate }) => n + gate.rules.length, 0);
  console.log(`${registry.list().length} gates, ${total} tunable rules, ${registry.plugins.length} plugin(s)\n`);
  console.log(`Detail:   vlmkit rules <gate>            (--json for the machine-readable catalog)`);
  console.log(`Tune:     vlmkit <gate> <source> --rule <gateId>/<ruleId>=off|suspect|warn|info`);
  console.log(`Persist:  "rules" in vlmkit.gates.json`);
  console.log(`Extend:   "plugins": ["./tools/house-gates.ts"] in vlmkit.config.json`);
  console.log(`          docs/authoring-gates.md walks through writing one.\n`);
}

/** The shared shape of a gate in `--json` output. */
function describeGate(
  gate: { id: string; command: readonly string[]; title: string; summary: string; category?: string },
  registry: { list(): readonly { gate: { id: string }; plugin: string }[] },
): Record<string, unknown> {
  return {
    id: gate.id,
    command: gate.command.join(" "),
    title: gate.title,
    summary: gate.summary,
    category: gate.category ?? null,
    plugin: registry.list().find((entry) => entry.gate.id === gate.id)?.plugin ?? null,
  };
}

function printRootHelp(): void {
  console.log(`vlmkit <command> [options]

Deterministic verification for frontend work.

Command groups:
  check                         Inspect accessibility, layout, and design quality
  diff                          Compare HTML, images, runs, and components
  inspect                       Explore browser behavior and page structure
  scan                          Inventory components, scrolling, and breakpoints
  stress                        Exercise responsive and cross-browser variants
  build / contract              Build and validate UI contract artifacts
  verify / heal                 Gate markup and repair actionable failures

Workflows:
  snapshot / baseline / watch   Capture and manage visual baselines
  diff-pr / batch / gates       Run repeatable local and CI gates
  rules                         List gates and the rules each one can tune
  workflow / markup-loop        Drive agent-oriented verification loops
  api / mcp                     Expose vlmkit to other tools

Run \`vlmkit <command> --help\` for subcommands, options, and examples.`);
}

async function runGroupLeaf(
  groupName: string,
  leafName: string,
  rest: string[],
): Promise<void> {
  // `check a11y` / `check drift` used to be hand-written two-segment branches
  // here, each with its own sub-table and its own "unknown X" error. They are
  // three-token gates now (`["check","a11y","contrast"]`) and the registry
  // resolves by longest prefix, so the branches are gone. A bare
  // `vlmkit check a11y` falls through to the suggestion path below, which
  // names the three real commands.
  // Legacy table first, registry second. The remaining `GROUPS` entries are
  // artifact producers (`diff`, `build`, `contract`, `scan component`, …), not
  // gates, and they still work the old way: their `main()` runs as a side
  // effect of module *evaluation*.
  //
  // That side effect is why the order matters. Composing the registry imports
  // the gate modules, which transitively import other leaves; consulting the
  // registry first therefore warmed the module cache for a `delegate`d leaf and
  // made `vlmkit <that leaf> --help` print nothing at all. Checking `GROUPS`
  // first means a legacy command never triggers the import. Every gate is
  // absent from `GROUPS`, so gates still reach the registry.
  const entry = GROUPS[groupName]?.[leafName];
  if (entry) {
    if (entry.run) await entry.run(rest);
    else if (entry.spec) await delegate(entry.spec, rest);
    return;
  }

  const registry = await loadGateRegistry();
  const resolved = registry.resolve([groupName, leafName, ...rest]);
  if (resolved) {
    const { runGateCli } = await import("@mizchi/vlmkit-core/plugin/runner.ts");
    const { readGateRuleSettings } = await import("./gate-rules.ts");
    // `resolved.rest` rather than `rest`: a three-token gate consumed one of
    // them, and handing that token back as a positional would look like a
    // second source argument.
    const gateArgv = resolved.rest.map((a) => (a === HELP_SENTINEL ? "--help" : a));
    const code = await runGateCli(resolved.gate, gateArgv, { rules: readGateRuleSettings() });
    if (code !== 0) process.exitCode = code;
    return;
  }

  const suggestions = registry.suggest([groupName, leafName]);
  console.error(
    `Unknown ${groupName} subcommand: ${leafName}`
    + (suggestions.length > 0 ? ` — did you mean ${suggestions.map((s) => `"vlmkit ${s}"`).join(", ")}?` : ""),
  );
  process.exit(1);
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  // Answered before anything else so the compact index — the most common
  // invocation — never pays for loading the gate registry.
  const isTopLevelHelp = argv.length === 0
    || (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help"));
  if (isTopLevelHelp) {
    printRootHelp();
    return;
  }

  const cli = cac("vlmkit");
  cli.version("0.9.1");

  cli.usage(`<command> [options]

Deterministic verification for frontend work.
Run \`vlmkit <command> --help\` for subcommands, options, and examples.`);

  if (argv[0] === "--version" || argv[0] === "-v") {
    cli.outputVersion();
    return;
  }

  // Group commands — second-level dispatch happens in the action.
  //
  // The verb list is the union of the legacy `GROUPS` table and the registry's
  // groups, because some verbs now exist ONLY in the registry: every gate under
  // `stress` and `verify` is registry-driven, so those keys are gone from
  // `GROUPS` entirely. Reading only one source silently dropped
  // `vlmkit verify markup` as an unknown command.
  const registryGroups = [...(await loadGateRegistry()).groups().keys()];
  for (const groupName of [...new Set([...Object.keys(GROUPS), ...registryGroups])]) {
    cli.command(`${groupName} [...args]`, `${groupName} group`)
      .allowUnknownOptions()
      .action(async () => {
        const groupArgs = passThrough(argv, [groupName]);
        // `vlmkit diff --help` (no leaf, just help) → group usage.
        // passThrough rewrites --help/-h to HELP_SENTINEL so cac
        // doesn't intercept; we restore the semantics here.
        if (
          groupArgs.length === 0 ||
          (groupArgs.length === 1 && groupArgs[0] === HELP_SENTINEL)
        ) {
          await printGroupHelp(groupName);
          return;
        }
        const [leaf, ...rest] = groupArgs;
        await runGroupLeaf(groupName, leaf, rest);
      });
  }

  // Snapshot / workflow / bench / api / report / skill (single-token).
  // `vlmkit snapshot flipbook ...` is special-cased to delegate directly
  // to the flipbook CLI (snapshot.ts doesn't have a `flipbook` mode).
  cli.command("snapshot [...args]", "Multi-viewport snapshot baseline + diff")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["snapshot"]);
      if (rest[0] === "flipbook") {
        await delegate(SPECS.flipbook, rest.slice(1));
        return;
      }
      if (rest[0] === "report") {
        await delegate(SPECS.snapshotReport, rest.slice(1));
        return;
      }
      await delegate(SPECS.snapshot, rest);
    });

  cli.command("migration [...args]", "Migration VRT (compare / blind / subagent)")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["migration"]);
      const sub = rest[0];
      if (!sub || sub === HELP_SENTINEL) {
        console.log("vlmkit migration <compare|blind|subagent>");
      } else if (sub === "compare") {
        await delegate(SPECS.migrationCompare, rest.slice(1));
      } else if (sub === "blind") {
        await delegate(SPECS.migrationBlind, rest.slice(1));
      } else if (sub === "subagent") {
        await delegate(SPECS.migrationSubagent, rest.slice(1));
      } else {
        console.log("vlmkit migration <compare|blind|subagent>");
        process.exitCode = 1;
      }
    });

  cli.command("workflow [...args]", "Stateful baseline/snapshot workflow")
    .allowUnknownOptions()
    .action(async () => runWorkflow(passThrough(argv, ["workflow"])));

  cli.command("bench [...args]", "CSS challenge benchmark, or `bench gates` for gate/rule cost")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["bench"]);
      // `bench` was a single delegated command before `bench gates` existed, so
      // the subcommand is intercepted here rather than turning `bench` into a
      // group — every other `bench` invocation must keep reaching the CSS
      // benchmark unchanged, including its own flags.
      if (rest[0] === "gates") {
        const gateArgs = rest.slice(1);
        const { benchGatesCli, benchGatesUsage } = await import("./workflow/bench-gates.ts");
        if (gateArgs.includes(HELP_SENTINEL) || gateArgs.length === 0) {
          console.log(benchGatesUsage());
          return;
        }
        await benchGatesCli(gateArgs);
        return;
      }
      await delegate(SPECS.cssBench, rest);
    });

  cli.command("report [...args]", "Detection pattern report (CSS challenge)")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["report"]);
      if (rest.length === 1 && rest[0] === HELP_SENTINEL) {
        console.log(`vlmkit report

Render the aggregate CSS benchmark detection report from local JSONL history.

Options:
  -h, --help  Show this help`);
        return;
      }
      await delegate(SPECS.detectionReport, rest);
    });

  cli.command("skill [...args]", "Per-project skill playbooks")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.skill, passThrough(argv, ["skill"])));

  cli.command("markup-loop [...args]", "Drop-in markup agent loop")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.markupLoop, passThrough(argv, ["markup-loop"])));

  cli.command("api [...args]", "HTTP API server (serve / status)")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["api"]);
      const sub = rest[0];
      if (!sub || sub === HELP_SENTINEL) {
        console.log("vlmkit api <serve|status>");
      } else if (sub === "serve") {
        await delegate(SPECS.apiServer, rest.slice(1));
      } else if (sub === "status") {
        await runApiStatus(rest.slice(1));
      } else {
        console.log("vlmkit api <serve|status>");
        process.exitCode = 1;
      }
    });

  cli.command("mcp [...args]", "MCP server exposing the deterministic verification gates (stdio)")
    .allowUnknownOptions()
    .action(async () => {
      const rest = passThrough(argv, ["mcp"]);
      if (rest.length === 1 && rest[0] === HELP_SENTINEL) {
        console.log(`vlmkit mcp

Start the Model Context Protocol server over stdio.

Options:
  -h, --help  Show this help`);
        return;
      }
      const { runStdioServer } = await import("@mizchi/vlmkit-mcp/stdio.ts");
      await runStdioServer();
    });

  cli.command("batch [...args]", "Run gates over many pages in parallel (glob, sharding, per-job timing)")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.batch, passThrough(argv, ["batch"])));

  cli.command("gates [...args]", "One reviewed config for per-page gate sets + auditable suppressions")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.gates, passThrough(argv, ["gates"])));

  cli.command("rules [...args]", "List registry-driven gates and the rules each one can tune")
    .allowUnknownOptions()
    .action(async () => runRules(passThrough(argv, ["rules"])));

  cli.command("manifest [...args]", "Author / edit approval.json manifests")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.manifest, passThrough(argv, ["manifest"])));

  cli.command("watch [...args]", "File-watcher inner loop with round-vs-round delta")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.watch, passThrough(argv, ["watch"])));

  cli.command("diff-pr [...args]", "PR CI gate: per-route thresholds + markdown summary")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.diffPr, passThrough(argv, ["diff-pr"])));

  cli.command("baseline [...args]", "Approve / inspect snapshot baselines")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.baseline, passThrough(argv, ["baseline"])));

  // Mask --help/-h so cac doesn't intercept; passThrough restores it.
  const maskedArgv = argv.map((a) => (a === "--help" || a === "-h" ? HELP_SENTINEL : a));

  // argv[1] is a placeholder — cac reads from index 2 and takes its display
  // name from `cac("vlmkit")` above — but leaving the old binary name here
  // invites the next reader to think the program is still called vrt.
  cli.parse(["node", "vlmkit", ...maskedArgv], { run: false });
  if (cli.matchedCommand) {
    await cli.runMatchedCommand();
  } else {
    process.stderr.write(`Unknown command: ${argv.join(" ")}\n\n`);
    printRootHelp();
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
