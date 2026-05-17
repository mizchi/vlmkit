#!/usr/bin/env node
/**
 * vrt -- unified CLI entry point
 */
import { resolveRootCommand } from "./router.ts";

const MODULE_LOADERS = {
  "../api/api-server.ts": () => import("../api/api-server.ts"),
  "../experiments/css-challenge/css-challenge-bench.ts": () => import("../experiments/css-challenge/css-challenge-bench.ts"),
  "../experiments/detection/detection-report.ts": () => import("../experiments/detection/detection-report.ts"),
  "../vrt/core/element-compare.ts": () => import("@mizchi/vrt-core/element-compare.ts"),
  "../experiments/migration/migration-compare.ts": () => import("../experiments/migration/migration-compare.ts"),
  "../vrt/core/png-diff.ts": () => import("@mizchi/vrt-core/png-diff.ts"),
  "../markup/inspect/smoke-runner.ts": () => import("./commands/smoke-runner.ts"),
  "../vrt/snapshot/snapshot.ts": () => import("../vrt/snapshot/snapshot.ts"),
  "./commands/flipbook-cli.ts": () => import("./commands/flipbook-cli.ts"),
  "./commands/diff-for-agent-cli.ts": () => import("./commands/diff-for-agent-cli.ts"),
  "./commands/compare-runs-cli.ts": () => import("./commands/compare-runs-cli.ts"),
  "../markup/component/component-from-image.ts": () => import("@mizchi/vrt-markup/component/component-from-image.ts"),
  "../markup/stress/multi-page-consistency.ts": () => import("@mizchi/vrt-markup/stress/multi-page-consistency.ts"),
  "../markup/component/component-consistency.ts": () => import("@mizchi/vrt-markup/component/component-consistency.ts"),
  "../markup/style/theme-parity.ts": () => import("@mizchi/vrt-markup/style/theme-parity.ts"),
  "../markup/stress/i18n-stress.ts": () => import("@mizchi/vrt-markup/stress/i18n-stress.ts"),
  "../a11y/a11y-contrast.ts": () => import("@mizchi/vrt-core/a11y-contrast.ts"),
  "../a11y/a11y-touch.ts": () => import("@mizchi/vrt-core/a11y-touch.ts"),
  "../a11y/a11y-focus-order.ts": () => import("@mizchi/vrt-core/a11y-focus-order.ts"),
  "../markup/inspect/interact.ts": () => import("@mizchi/vrt-markup/inspect/interact.ts"),
  "../markup/stress/media-variants.ts": () => import("@mizchi/vrt-markup/stress/media-variants.ts"),
  "../markup/stress/cross-browser.ts": () => import("@mizchi/vrt-markup/stress/cross-browser.ts"),
  "../markup/style/design-tokens.ts": () => import("@mizchi/vrt-markup/style/design-tokens.ts"),
  "../util/perf.ts": () => import("../util/perf.ts"),
  "../markup/inspect/explore.ts": () => import("@mizchi/vrt-markup/inspect/explore.ts"),
  "../util/skill.ts": () => import("../util/skill.ts"),
  "../markup/component/component-extract.ts": () => import("@mizchi/vrt-markup/component/component-extract.ts"),
} as const;

async function main() {
  const route = resolveRootCommand(process.argv.slice(2));

  switch (route.kind) {
    case "module":
      await runModuleCommand(route.modulePath, route.argv);
      return;
    case "discover":
      await runDiscover(route.argv);
      return;
    case "status":
      await runStatus(route.argv);
      return;
    case "workflow": {
      const { runWorkflowCli } = await import("./workflow.ts");
      await runWorkflowCli(route.argv);
      return;
    }
    case "usage":
      if (route.exitCode === 0) {
        console.log(route.message);
      } else {
        console.error(route.message);
        process.exit(route.exitCode);
      }
      return;
    default:
      route satisfies never;
  }
}

async function runModuleCommand(modulePath: string, argv: string[]) {
  const load = MODULE_LOADERS[modulePath as keyof typeof MODULE_LOADERS];
  if (!load) {
    throw new Error(`Unsupported module command: ${modulePath}`);
  }
  // Resolve to absolute path so each module's `isCliEntry` check
  // (`resolve(process.argv[1]) === fileURLToPath(import.meta.url)`)
  // matches in both dev (running src/*.ts) and prod (built bundle).
  const { fileURLToPath } = await import("node:url");
  const absoluteModulePath = fileURLToPath(new URL(modulePath, import.meta.url));
  process.argv = [process.argv[0], absoluteModulePath, ...argv];
  await load();
}

async function runDiscover(args: string[]) {
  const file = args[0];
  if (!file) { console.error("Usage: vrt discover <html-file>"); process.exit(1); }

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

async function runStatus(args: string[]) {
  const url = args.find((_, i) => args[i - 1] === "--url") ?? "http://localhost:3456";
  try {
    const res = await fetch(`${url}/api/status`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Server not available at ${url}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
