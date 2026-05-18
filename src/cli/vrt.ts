#!/usr/bin/env node
/**
 * vrt -- unified CLI entry point.
 *
 * Thin shim around `runCli()` in `./cli.ts`. The 0.5.0 cac-based
 * command tree lives there; this file just hands argv off.
 */
import { runCli } from "./cli.ts";

runCli().catch((e) => {
  console.error(e);
  process.exit(1);
});
