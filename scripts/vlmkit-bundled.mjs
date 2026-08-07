#!/usr/bin/env node
/**
 * Distribution-only CLI entrypoint.
 *
 * The source workspace can compile MoonBit lazily, but npm consumers should
 * not need the MoonBit toolchain. Import the generated JS bridge statically so
 * tsdown bundles it, then inject that implementation before loading the CLI.
 *
 * ## Every entry point, not just the positional one
 *
 * This file listed only `run_markup_core` for as long as that was the only entry
 * point, and adding the JSON boundary did not update it. The consequence was
 * invisible in the workspace and total in the shipped CLI: `loadMarkupCoreApi` found
 * the injected global, `api.run_markup_core_json` was `undefined`, and every JSON
 * command fell through to `ensureMarkupCoreCli()` — which runs `moon build`, the one
 * thing an npm consumer is guaranteed not to have. Positional commands kept working,
 * so the CLI looked healthy.
 *
 * Nothing caught it because the tests run from source, where the runtime finds the
 * generated bridge through `apiPath` and never consults this global at all. The
 * bundled layout is the only place these two lines matter.
 *
 * **Adding an entry point to `DirectMarkupCoreModule` means adding it here.**
 * `markup-core-injection.test.ts` fails if the two drift, because the whole
 * failure mode is a name that is missing rather than wrong.
 */
import {
  markup_core_json_commands,
  run_markup_core,
  run_markup_core_json,
} from "../packages/vlmkit-markup/_build/js/debug/build/markup-core-api/markup-core-api.js";

globalThis.__MIZCHI_VLMKIT_MARKUP_CORE_API__ = {
  run_markup_core,
  run_markup_core_json,
  markup_core_json_commands,
};

const { runCli } = await import("../src/cli/cli.ts");

runCli().catch((error) => {
  console.error(error);
  process.exit(1);
});
