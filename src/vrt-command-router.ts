export const WORKFLOW_COMMANDS = [
  "init",
  "capture",
  "verify",
  "approve",
  "report",
  "graph",
  "affected",
  "introspect",
  "spec-verify",
  "expect",
] as const;

export type WorkflowCommand = typeof WORKFLOW_COMMANDS[number];

type ModuleRoute = {
  kind: "module";
  modulePath: string;
  argv: string[];
};

type WorkflowRoute = {
  kind: "workflow";
  argv: string[];
};

type StatusRoute = {
  kind: "status";
  argv: string[];
};

type DiscoverRoute = {
  kind: "discover";
  argv: string[];
};

type UsageRoute = {
  kind: "usage";
  message: string;
  exitCode: number;
};

export type RootCommandRoute =
  | ModuleRoute
  | WorkflowRoute
  | StatusRoute
  | DiscoverRoute
  | UsageRoute;

const ROOT_MODULE_COMMANDS: Record<string, string> = {
  compare: "./migration-compare.ts",
  "png-diff": "./png-diff.ts",
  bench: "./css-challenge-bench.ts",
  report: "./detection-report.ts",
  snapshot: "./snapshot.ts",
  elements: "./element-compare.ts",
  smoke: "./smoke-runner.ts",
  flipbook: "./flipbook-cli.ts",
  "diff-for-agent": "./diff-for-agent-cli.ts",
  "compare-runs": "./compare-runs-cli.ts",
  // Markup-assistance scenarios (2026-05-13).
  "component-from-image": "./component-from-image.ts",
  "multi-page-consistency": "./multi-page-consistency.ts",
  "component-consistency": "./component-consistency.ts",
  "theme-parity": "./theme-parity.ts",
  "i18n-stress": "./i18n-stress.ts",
  "a11y-contrast": "./a11y-contrast.ts",
  "a11y-touch": "./a11y-touch.ts",
  "a11y-focus-order": "./a11y-focus-order.ts",
  "interact": "./interact.ts",
  "media-variants": "./media-variants.ts",
  "cross-browser": "./cross-browser.ts",
  "design-tokens": "./design-tokens.ts",
  "perf": "./perf.ts",
  "explore": "./explore.ts",
  "skill": "./skill.ts",
  "component-extract": "./component-extract.ts",
  "manifest": "./manifest-cli.ts",
};

const WORKFLOW_ALIAS_COMMANDS = new Set<WorkflowCommand>([
  "init",
  "capture",
  "verify",
  "approve",
  "graph",
  "affected",
  "introspect",
  "spec-verify",
  "expect",
]);

export function formatWorkflowUsage(): string {
  return `vrt workflow <command>

Commands:
  init [--config <path>] [--base-url <url>]
               Create baseline screenshots + a11y trees
  capture [--config <path>] [--base-url <url>]
               Take current snapshots
  verify       Compare snapshots against baselines
  approve      Promote current snapshots to new baselines
  report       Show the latest verification report
  graph        Display dependency graph
  affected     Show components affected by current changes
  introspect   Generate spec.json from current a11y snapshots
  spec-verify  Verify spec.json invariants against current state
  expect       Auto-generate expectation.json from baseline vs snapshot diff

Capture config (vrt.config.json):
  {
    "baseUrl": "http://localhost:3000",
    "capture": {
      "routes": [
        { "name": "home", "path": "/", "waitFor": "main" },
        { "name": "about", "path": "/about" }
      ]
    }
  }

Routes can also be supplied via env vars:
  VRT_CONFIG_PATH   Path to capture config file
  VRT_BASE_URL      Override the base URL
  VRT_CAPTURE_ROUTES JSON-encoded array of routes`;
}

export function formatRootUsage(): string {
  return `vrt — Visual Regression Testing Harness

Core Commands:
  compare <before> <after>    Compare HTML files or URLs across viewports
  png-diff <baseline.png> <current.png>
                              Compare existing PNG screenshots directly
  snapshot <url...>           Capture multi-viewport snapshots with baseline diff
  snapshot approve            Promote accepted snapshot diffs to baselines
  manifest <command>          Author / inspect the approval manifest
                              (add | list | rm | check)
  elements [options]          Element-level comparison with shift isolation
  smoke <file-or-url>         A11y-driven smoke test
  discover <file>             Discover responsive breakpoints from HTML/CSS
  bench [options]             CSS challenge benchmark
  report                      Detection pattern report

Markup-Assistance Commands:
  component-from-image <target.png> <current.html>
                              Build a component from a target screenshot
  multi-page-consistency --selector <sel> --urls/--files ...
                              Drift check: same component across N pages
  component-consistency <html> --selector <sel>
                              Drift check: N instances of selector on one page
  theme-parity <html>         Detect hard-coded colors that don't respond
                              to prefers-color-scheme dark
  i18n-stress <html> [--inflate 1.4]
                              Inflate text content; detect overflow / wrap bugs
  a11y-contrast <html>        WCAG AA contrast scan on rendered text
  a11y-touch <html|url> [--level AAA|AA]
                              Touch-target size check (44×44 / 24×24)
  a11y-focus-order <html|url>
                              Tab through page, surface visual-order
                              mismatches and focus traps
  interact <html|url> --sequence <path.json>
                              Scripted UI interaction sequence
                              (click / hover / type / scroll + per-step diff)
  media-variants <html|url> [--variants ...]
                              Verify forced-colors / reduced-motion / print /
                              RTL / 200%-zoom adaptations
  cross-browser <html|url> [--engines ...]
                              Render in chromium / firefox / webkit and
                              diff (engines auto-skip if not installed)
  design-tokens <html|url> [--radius-scale ...]
                              Scale-conformance check for radius, spacing,
                              z-index, box-shadow tiers
  perf <html|url>             Web Vitals (CLS / LCP / FCP) via in-page
                              PerformanceObserver — Lighthouse-light
  explore <html|url>          Auto-discover declared actions
                              (window.__vrtActions / data-vrt-action)
                              and diff each transition
  skill <list|show|init|run>  Per-project skill playbooks under
                              .vrt-skills/ — bundle of checks per
                              target (selector, viewport, tools)
  component-extract <png> [--crop N | --at x,y | --crop-all]
                              Detect components in a page screenshot
                              and crop them to standalone PNGs
                              (= targets for component-from-image)

Workflow Commands:
  workflow <command>          Stateful baseline/snapshot verification workflow
  workflow verify             Compare current snapshots against baselines
  workflow report             Show the latest verification report

API Commands:
  api serve [--port N]        Start the HTTP API server
  api status [--url URL]      Check HTTP API server status

Compatibility Aliases:
  serve                       Alias for \`vrt api serve\`
  status                      Alias for \`vrt api status\`
  init|capture|verify|approve
  graph|affected|introspect|spec-verify|expect
                              Alias for \`vrt workflow <command>\`

Examples:
  vrt compare before.html after.html
  vrt png-diff baseline.png current.png
  vrt snapshot http://localhost:3000/ --output snapshots/
  vrt snapshot approve --output snapshots/
  vrt workflow verify
  vrt workflow report
  vrt api serve --port 3456`;
}

export function resolveRootCommand(args: string[]): RootCommandRoute {
  const [command, ...rest] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { kind: "usage", message: formatRootUsage(), exitCode: 0 };
  }

  if (command in ROOT_MODULE_COMMANDS) {
    return {
      kind: "module",
      modulePath: ROOT_MODULE_COMMANDS[command]!,
      argv: rest,
    };
  }

  if (command === "discover") {
    return { kind: "discover", argv: rest };
  }

  if (command === "workflow") {
    if (!rest[0] || rest[0] === "help" || rest[0] === "--help" || rest[0] === "-h") {
      return {
        kind: "usage",
        message: formatWorkflowUsage(),
        exitCode: rest[0] ? 0 : 1,
      };
    }
    return { kind: "workflow", argv: rest };
  }

  if (command === "api") {
    const [apiCommand, ...apiRest] = rest;
    if (!apiCommand || apiCommand === "help" || apiCommand === "--help" || apiCommand === "-h") {
      return {
        kind: "usage",
        message: `vrt api <command>\n\nCommands:\n  serve [--port N]\n  status [--url URL]`,
        exitCode: apiCommand ? 0 : 1,
      };
    }

    if (apiCommand === "serve") {
      return { kind: "module", modulePath: "./api-server.ts", argv: apiRest };
    }
    if (apiCommand === "status") {
      return { kind: "status", argv: apiRest };
    }

    return {
      kind: "usage",
      message: `Unknown api command: ${apiCommand}\n\n${formatRootUsage()}`,
      exitCode: 1,
    };
  }

  if (command === "serve") {
    return { kind: "module", modulePath: "./api-server.ts", argv: rest };
  }
  if (command === "status") {
    return { kind: "status", argv: rest };
  }

  if (WORKFLOW_ALIAS_COMMANDS.has(command as WorkflowCommand)) {
    return { kind: "workflow", argv: [command, ...rest] };
  }

  return {
    kind: "usage",
    message: `Unknown command: ${command}\n\n${formatRootUsage()}`,
    exitCode: 1,
  };
}
