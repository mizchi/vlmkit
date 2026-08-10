#!/usr/bin/env node
/**
 * Distribution-only CLI entrypoint.
 *
 * The root package ships `dist/**` and nothing else — no `_build`, no `.mbt` sources —
 * so an npm consumer of the `vlmkit` CLI has no MoonBit toolchain and no generated
 * bridge on disk to find. (The `@mizchi/vlmkit-markup` *library* package does ship
 * `_build/js/debug/build/markup-core-api/markup-core-api.js`, which is why importing it
 * directly has always worked. Only the CLI depends on what happens below.)
 *
 * So: import the generated bridge statically, which makes the bundler include it, and
 * hand it to the runtime through a global before the CLI loads.
 *
 * ## Why this is a namespace import
 *
 * It used to name its exports: `import { run_markup_core }`, then
 * `globalThis.… = { run_markup_core }`. That is a hand-written list which has to agree
 * with `DirectMarkupCoreModule` in `markup-core-runtime.ts`, and when the JSON boundary
 * added two entry points, nobody updated it. The result was invisible in the workspace
 * and total in the shipped CLI: `loadMarkupCoreApi` found this global,
 * `run_markup_core_json` read as `undefined`, and every JSON command fell through to
 * `ensureMarkupCoreCli()` — which shells out to `moon build`, the one thing this file
 * exists to make unnecessary. Positional commands kept working, so nothing looked wrong.
 *
 * A namespace import has no list to forget. Every export of the bridge crosses over,
 * so adding an entry point on the MoonBit side connects it here by construction rather
 * than by remembering. `pickDirectApi` on the other side selects what it understands and
 * ignores the rest, and the runtime now raises rather than silently degrading if
 * something it needs is missing — see `runMarkupCoreJsonRaw`.
 */
import * as markupCoreApi from "../packages/vlmkit-markup/_build/js/debug/build/markup-core-api/markup-core-api.js";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

globalThis.__MIZCHI_VLMKIT_MARKUP_CORE_API__ = markupCoreApi;

const { runCli } = await import("../src/cli/cli.ts");

// `handleCliError`, not `console.error` — and this is the file that matters.
//
// `src/cli/vlmkit.ts` has always ended in `.catch(handleCliError)`, but that is
// the *workspace* entry. `tsdown.config.ts` builds the published `bin` from this
// file, which used to dump the raw error object. Every prettifier in
// `cli-error.ts` — ENOENT, EISDIR, the missing-browser diagnosis — was therefore
// dead in the shipped CLI while looking alive in the repo. That is exactly what
// issue #112 reported: `pnpm exec vlmkit check integrity page.html` printed
// Playwright's own "run `pnpm exec playwright install`" box, because vlmkit
// never got a chance to say anything. Reproduced 2026-08-10 with
// `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory.
runCli().catch(handleCliError);
