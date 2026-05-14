#!/usr/bin/env node
/**
 * vrt -- unified CLI entry point
 */
import { resolveRootCommand } from "./vrt-command-router.ts";

const MODULE_LOADERS = {
  "./api-server.ts": () => import("./api-server.ts"),
  "./css-challenge-bench.ts": () => import("./css-challenge-bench.ts"),
  "./detection-report.ts": () => import("./detection-report.ts"),
  "./element-compare.ts": () => import("./element-compare.ts"),
  "./migration-compare.ts": () => import("./migration-compare.ts"),
  "./png-diff.ts": () => import("./png-diff.ts"),
  "./smoke-runner.ts": () => import("./smoke-runner.ts"),
  "./snapshot.ts": () => import("./snapshot.ts"),
  "./flipbook-cli.ts": () => import("./flipbook-cli.ts"),
  "./diff-for-agent-cli.ts": () => import("./diff-for-agent-cli.ts"),
  "./compare-runs-cli.ts": () => import("./compare-runs-cli.ts"),
  "./component-from-image.ts": () => import("./component-from-image.ts"),
  "./multi-page-consistency.ts": () => import("./multi-page-consistency.ts"),
  "./component-consistency.ts": () => import("./component-consistency.ts"),
  "./theme-parity.ts": () => import("./theme-parity.ts"),
  "./i18n-stress.ts": () => import("./i18n-stress.ts"),
  "./a11y-contrast.ts": () => import("./a11y-contrast.ts"),
  "./a11y-touch.ts": () => import("./a11y-touch.ts"),
  "./a11y-focus-order.ts": () => import("./a11y-focus-order.ts"),
  "./interact.ts": () => import("./interact.ts"),
  "./media-variants.ts": () => import("./media-variants.ts"),
  "./cross-browser.ts": () => import("./cross-browser.ts"),
  "./design-tokens.ts": () => import("./design-tokens.ts"),
  "./perf.ts": () => import("./perf.ts"),
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
      const { runWorkflowCli } = await import("./vrt-cli.ts");
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
  const { discoverViewports } = await import("./viewport-discovery.ts");
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
