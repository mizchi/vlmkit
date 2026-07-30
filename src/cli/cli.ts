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
import { reportDeprecation } from "./deprecation.ts";

const HELP_SENTINEL = "__VRT_HELP_PASSTHROUGH__";

/**
 * Each leaf is referenced as `{ name, loader }`. The loader is a
 * closure that returns the dynamic import — keeping the path as a
 * literal at the `import()` call site lets tsdown statically
 * discover the leaf and code-split it into a chunk that ships with
 * `dist/vrt.mjs`.
 *
 * The `name` is a per-leaf identifier set into `__VRT_DISPATCHER_LEAF__`
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
  const prev = process.env.__VRT_DISPATCHER_LEAF__;
  process.env.__VRT_DISPATCHER_LEAF__ = s.name;
  try {
    await s.loader();
  } finally {
    if (prev === undefined) {
      delete process.env.__VRT_DISPATCHER_LEAF__;
    } else {
      process.env.__VRT_DISPATCHER_LEAF__ = prev;
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
  vlmRegionDiff: spec("vlm-region-diff", () => import("../experiments/migration/vlm-region-diff.ts")),
  elementCompare: spec("element-compare", () => import("@mizchi/vlmkit-core/element-compare.ts")),
  smokeRunner: spec("smoke-runner", () => import("@mizchi/vlmkit-markup/inspect/smoke-runner.ts")),
  flipbook: spec("flipbook-cli", () => import("./commands/flipbook-cli.ts")),
  diffForAgent: spec("diff-for-agent-cli", () => import("./commands/diff-for-agent-cli.ts")),
  presenceMatrix: spec("presence-matrix", () => import("./commands/presence-matrix-cli.ts")),
  compareRuns: spec("compare-runs-cli", () => import("./commands/compare-runs-cli.ts")),
  componentFromImage: spec("component-from-image", () => import("@mizchi/vlmkit-markup/component/component-from-image.ts")),
  contractIntrospect: spec("contract-introspect", () => import("@mizchi/vlmkit-markup/contract/introspect-contract.ts")),
  contractValidate: spec("contract-validate", () => import("@mizchi/vlmkit-markup/contract/validate-contract.ts")),
  contractScaffold: spec("contract-scaffold", () => import("@mizchi/vlmkit-markup/contract/scaffold-contract.ts")),
  selectorHeal: spec("selector-heal-cli", () => import("@mizchi/vlmkit-markup/heal/selector-heal-cli.ts")),
  palette: spec("palette-cli", () => import("@mizchi/vlmkit-markup/style/palette-cli.ts")),
  pageCompose: spec("page-compose", () => import("@mizchi/vlmkit-markup/component/page-compose.ts")),
  multiPageConsistency: spec("multi-page-consistency", () => import("@mizchi/vlmkit-markup/stress/multi-page-consistency.ts")),
  componentConsistency: spec("component-consistency", () => import("@mizchi/vlmkit-markup/component/component-consistency.ts")),
  themeParity: spec("theme-parity", () => import("@mizchi/vlmkit-markup/style/theme-parity.ts")),
  i18nStress: spec("i18n-stress", () => import("@mizchi/vlmkit-markup/stress/i18n-stress.ts")),
  a11yContrast: spec("a11y-contrast", () => import("@mizchi/vlmkit-markup/a11y-contrast.ts")),
  a11yTouch: spec("a11y-touch", () => import("@mizchi/vlmkit-markup/a11y-touch.ts")),
  a11yFocusOrder: spec("a11y-focus-order", () => import("@mizchi/vlmkit-markup/a11y-focus-order.ts")),
  interact: spec("interact", () => import("@mizchi/vlmkit-markup/inspect/interact.ts")),
  mediaVariants: spec("media-variants", () => import("@mizchi/vlmkit-markup/stress/media-variants.ts")),
  crossBrowser: spec("cross-browser", () => import("@mizchi/vlmkit-markup/stress/cross-browser.ts")),
  designTokens: spec("design-tokens", () => import("@mizchi/vlmkit-markup/style/design-tokens.ts")),
  motionDetect: spec("motion-detect", () => import("@mizchi/vlmkit-markup/style/motion-detect.ts")),
  animationEval: spec("animation-eval", () => import("@mizchi/vlmkit-markup/style/animation-eval.ts")),
  scrollScan: spec("scroll-scan", () => import("@mizchi/vlmkit-markup/inspect/scroll-scan.ts")),
  integrityCheck: spec("integrity-check", () => import("@mizchi/vlmkit-markup/inspect/integrity-check.ts")),
  layoutContract: spec("layout-contract", () => import("@mizchi/vlmkit-markup/inspect/layout-contract.ts")),
  breakpointCheck: spec("breakpoint-check", () => import("@mizchi/vlmkit-markup/stress/breakpoint-check.ts")),
  markupVerify: spec("markup-verify", () => import("@mizchi/vlmkit-markup/verify/markup-verify.ts")),
  flowVerify: spec("flow-verify", () => import("@mizchi/vlmkit-markup/inspect/flow-verify.ts")),
  markupAutofix: spec("markup-autofix", () => import("@mizchi/vlmkit-markup/verify/markup-autofix.ts")),
  regionJudge: spec("region-judge", () => import("@mizchi/vlmkit-markup/inspect/region-judge.ts")),
  interactionMap: spec("interaction-map", () => import("@mizchi/vlmkit-markup/inspect/interaction-map.ts")),
  handlerMap: spec("handler-map", () => import("@mizchi/vlmkit-markup/inspect/handler-map.ts")),
  copyCheck: spec("copy-check", () => import("@mizchi/vlmkit-markup/inspect/copy-check.ts")),
  scrollBehavior: spec("scroll-behavior", () => import("@mizchi/vlmkit-markup/inspect/scroll-behavior.ts")),
  mockScan: spec("mock-scan", () => import("@mizchi/vlmkit-markup/inspect/mock-scan.ts")),
  craterSmoke: spec("crater-smoke", () => import("@mizchi/vlmkit-capture/crater-smoke.ts")),
  perf: spec("perf", () => import("../util/perf.ts")),
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
    region: { spec: SPECS.vlmRegionDiff, desc: "VLM region diff from before/after PNGs" },
    matrix: { spec: SPECS.presenceMatrix, desc: "Region × viewport presence matrix with media-query hints" },
    elements: { spec: SPECS.elementCompare, desc: "Element-level comparison with shift isolation" },
    component: { spec: SPECS.elementCompare, desc: "Component selector comparison with shift isolation" },
    browsers: { spec: SPECS.crossBrowser, desc: "Render in chromium / firefox / webkit and diff" },
    agent: { spec: SPECS.diffForAgent, desc: "Generate agent-friendly Markdown diff report" },
    runs: { spec: SPECS.compareRuns, desc: "Aggregate multiple VRT runs" },
  },
  check: {
    palette: { spec: SPECS.palette, desc: "Dominant colors of a PNG, or palette diff of two PNGs" },
    tokens: { spec: SPECS.designTokens, desc: "Design-token scale conformance" },
    theme: { spec: SPECS.themeParity, desc: "Theme parity (hard-coded color scan in dark mode)" },
    motion: { spec: SPECS.motionDetect, desc: "CSS motion detection (animation / transition / reduced-motion)" },
    animation: { spec: SPECS.animationEval, desc: "Frame-sampled animation evaluation (visible effect / settle / reduced-motion behavior)" },
    breakpoints: { spec: SPECS.breakpointCheck, desc: "Boundary quickcheck: render at B-1/B/B+1 per breakpoint, flag spikes/gaps/overflow (--sweep fuzzes widths in between)" },
    scroll: { spec: SPECS.scrollBehavior, desc: "Scroll behavior: fixed holds position, engaged sticky sticks, mandatory snap lands on a child edge" },
    copy: { spec: SPECS.copyCheck, desc: "Copy fidelity: placeholder scan + --manifest verification + --target image check (VLM or agent-vision sheets)" },
    equivalence: { spec: SPECS.regionJudge, desc: "Visual equivalence judge for residual regions (measured delta + refutation-gated VLM or pair sheets)" },
    interactions: { spec: SPECS.interactionMap, desc: "A11y-event state map: keyboard probes -> ARIA transitions; --reference makes it a behavioral contract" },
    integrity: { spec: SPECS.integrityCheck, desc: "Reference-free defect gate: JS errors, empty render, broken resources, text collision/clipping/protrusion, collapsed containers, overflow, invisible text, near-misalignment, unstyled page (multi-viewport)" },
    layout: { spec: SPECS.layoutContract, desc: "Layout contract: verify a brief's structural requirements (widths, per-row counts, stacking order) per viewport — deterministic DOM math" },
    crater: { spec: SPECS.craterSmoke, desc: "Crater BiDi backend smoke check" },
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
    breakpoints: { run: runDiscover, desc: "Discover responsive breakpoints from HTML/CSS (verify them with `check breakpoints`)" },
    scroll: { spec: SPECS.scrollScan, desc: "Annotation-free scroll inventory: containers, page overflow-x, clipped content" },
    mock: { spec: SPECS.mockScan, desc: "Mock-image intake: infer @2x/@3x scale, write normalized @1x target, extraction sanity" },
    handlers: { spec: SPECS.handlerMap, desc: "Event-callback surface: every wired listener + pointer-only-control cross-check (experimental)" },
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
  verify: {
    markup: { spec: SPECS.markupVerify, desc: "One-shot done-condition verdict: composition per target + gates + pixel diff + kickback list with selector attribution" },
    flow: { spec: SPECS.flowVerify, desc: "Verified scripted browser flow: action -> deterministic post-condition assert (no LLM)" },
  },
};

// Two-segment subcommands inside `check` (a11y, drift).
const CHECK_A11Y: Record<string, { spec: Spec; desc: string }> = {
  contrast: { spec: SPECS.a11yContrast, desc: "WCAG AA contrast scan" },
  touch: { spec: SPECS.a11yTouch, desc: "Touch-target size check" },
  focus: { spec: SPECS.a11yFocusOrder, desc: "Focus order / trap check" },
};
const CHECK_DRIFT: Record<string, { spec: Spec; desc: string }> = {
  component: { spec: SPECS.componentConsistency, desc: "Drift across N selector instances on one page" },
  pages: { spec: SPECS.multiPageConsistency, desc: "Drift of one selector across N pages" },
};

const DEPRECATED_TOP_LEVEL: Record<string, { newName: string; spec: Spec }> = {
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
// "verify" is NOT in this list: it is a real command group now
// (`vlmkit verify markup`); the group handler keeps the old
// `verify → workflow verify` deprecation shim for non-leaf usage.
const WORKFLOW_ALIASES = [
  "init", "capture", "approve",
  "graph", "affected", "introspect", "spec-verify", "expect",
];

function printGroupHelp(groupName: string): void {
  const group = GROUPS[groupName];
  if (groupName === "check") {
    console.log(`vlmkit check <subcommand>\n`);
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
  console.log(`vlmkit ${groupName} <subcommand>\n`);
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
      console.log("vlmkit check a11y <contrast|touch|focus> <html>");
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
      console.log("vlmkit check drift <component|pages> <html>");
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
    // Back-compat: `vlmkit verify <anything-but-a-leaf>` was the deprecated
    // single-word alias for `vlmkit workflow verify` before the verify group
    // existed; keep that shim for unknown leaves.
    if (groupName === "verify") {
      reportDeprecation("verify", "vlmkit workflow verify");
      await runWorkflow(["verify", leafName === HELP_SENTINEL ? "--help" : leafName, ...rest]);
      return;
    }
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
  const cli = cac("vlmkit");
  cli.version("0.7.0");

  cli.usage(`<command> [options]

VLM-driven frontend toolkit. Visual regression (snapshot / diff /
regression-watch) + markup synthesis + design audits + CSS auto-repair.

Common command groups:
  vlmkit diff html|png|region|elements|component|browsers|agent|runs
  vlmkit check a11y|palette|tokens|theme|motion|animation|breakpoints|scroll|copy|crater|perf|drift
  vlmkit inspect interact|explore|smoke
  vlmkit stress i18n|media
  vlmkit scan component|breakpoints|scroll|mock
  vlmkit build component|page
  vlmkit contract introspect|validate|scaffold
  vlmkit heal selector
  vlmkit verify markup
  vlmkit snapshot [<url>...]
  vlmkit workflow <subcommand>
  vlmkit markup-loop <command>
  vlmkit bench / api / skill / report

Run \`vlmkit <command> --help\` for command-specific options.`);

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
          // Bare `vlmkit verify` was the documented legacy alias for
          // `workflow verify` — printing group help and exiting 0 here
          // would let CI scripts silently skip verification (Codex #86).
          // Only the explicit `verify --help` form gets the group help.
          if (groupName === "verify" && groupArgs.length === 0) {
            reportDeprecation("verify", "vlmkit workflow verify");
            await runWorkflow(["verify"]);
            return;
          }
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
      if (sub === "compare") {
        await delegate(SPECS.migrationCompare, rest.slice(1));
      } else if (sub === "blind") {
        await delegate(SPECS.migrationBlind, rest.slice(1));
      } else if (sub === "subagent") {
        await delegate(SPECS.migrationSubagent, rest.slice(1));
      } else {
        console.log("vlmkit migration <compare|blind|subagent>");
        if (sub) process.exitCode = 1;
      }
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

  cli.command("markup-loop [...args]", "Drop-in markup agent loop")
    .allowUnknownOptions()
    .action(async () => delegate(SPECS.markupLoop, passThrough(argv, ["markup-loop"])));

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
        console.log("vlmkit api <serve|status>");
        if (sub) process.exitCode = 1;
      }
    });

  cli.command("mcp [...args]", "MCP server exposing the deterministic verification gates (stdio)")
    .allowUnknownOptions()
    .action(async () => {
      const { runStdioServer } = await import("@mizchi/vlmkit-mcp/stdio.ts");
      await runStdioServer();
    });

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

  // Deprecated top-level command shims.
  for (const [oldName, { newName, spec }] of Object.entries(DEPRECATED_TOP_LEVEL)) {
    cli.command(`${oldName} [...args]`, `[deprecated] Use 'vlmkit ${newName}'`)
      .allowUnknownOptions()
      .action(async () => {
        reportDeprecation(oldName, `vlmkit ${newName}`);
        await delegate(spec, passThrough(argv, [oldName]));
      });
  }

  // Workflow single-word aliases — deprecation shims.
  for (const alias of WORKFLOW_ALIASES) {
    cli.command(`${alias} [...args]`, `[deprecated] Use 'vlmkit workflow ${alias}'`)
      .allowUnknownOptions()
      .action(async () => {
        reportDeprecation(alias, `vlmkit workflow ${alias}`);
        await runWorkflow([alias, ...passThrough(argv, [alias])]);
      });
  }

  // serve / status — legacy top-level aliases for api.
  cli.command("serve [...args]", "[deprecated] Use 'vlmkit api serve'")
    .allowUnknownOptions()
    .action(async () => {
      reportDeprecation("serve", "vlmkit api serve");
      await delegate(SPECS.apiServer, passThrough(argv, ["serve"]));
    });
  cli.command("status [...args]", "[deprecated] Use 'vlmkit api status'")
    .allowUnknownOptions()
    .action(async () => {
      reportDeprecation("status", "vlmkit api status");
      await runApiStatus(passThrough(argv, ["status"]));
    });

  cli.command("discover <file>", "[deprecated] Use 'vlmkit scan breakpoints'")
    .action(async (file: string) => {
      reportDeprecation("discover", "vlmkit scan breakpoints");
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
