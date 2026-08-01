#!/usr/bin/env node
/**
 * Distribution-only CLI entrypoint.
 *
 * The source workspace can compile MoonBit lazily, but npm consumers should
 * not need the MoonBit toolchain. Import the generated JS bridge statically so
 * tsdown bundles it, then inject that implementation before loading the CLI.
 */
import { run_markup_core } from "../packages/vlmkit-markup/_build/js/debug/build/markup-core-api/markup-core-api.js";

globalThis.__MIZCHI_VLMKIT_MARKUP_CORE_API__ = { run_markup_core };

const { runCli } = await import("../src/cli/cli.ts");

runCli().catch((error) => {
  console.error(error);
  process.exit(1);
});
