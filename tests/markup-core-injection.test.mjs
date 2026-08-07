/**
 * The bundled CLI must inject every markup-core entry point the runtime can use.
 *
 * `scripts/vlmkit-bundled.mjs` exists because npm consumers have no MoonBit toolchain:
 * it imports the generated JS bridge so the bundler includes it, and hands it to the
 * runtime through a global. The runtime prefers that global over its on-disk lookup.
 *
 * The failure mode is a **missing name**, and it is silent in a specific way. When the
 * JSON boundary landed, this file still injected only `run_markup_core`. In the shipped
 * CLI `loadMarkupCoreApi` therefore returned an API whose `run_markup_core_json` was
 * `undefined`, so every JSON command fell through to `ensureMarkupCoreCli()` — which
 * shells out to `moon build`. Positional commands kept working, so nothing looked
 * broken until a gate that used a JSON command was run from `dist/`.
 *
 * No existing test could see it:
 *
 *  - Unit and integration tests run from **source**, where the runtime resolves the
 *    generated bridge through `apiPath` and never reads this global.
 *  - `markup-core-json.test.ts` asserts the backend is `direct-js`, which is true from
 *    source for the same reason.
 *  - Type checking cannot help: the global is assigned in a `.mjs` file to a
 *    `Partial<DirectMarkupCoreModule>`, where absent is legal.
 *
 * So this compares the two lists as text: the entry points the runtime declares, and
 * the ones the bundled entrypoint injects. Reading source rather than executing is
 * deliberate — the bug lives in the bundled layout, and reproducing that in a test
 * would mean depending on build order.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const RUNTIME = resolve(REPO_ROOT, "packages/vlmkit-markup/src/markup-core-runtime.ts");
const BUNDLED = resolve(REPO_ROOT, "scripts/vlmkit-bundled.mjs");

/** Field names of `interface DirectMarkupCoreModule`. */
function declaredEntryPoints() {
  const source = readFileSync(RUNTIME, "utf8");
  const start = source.indexOf("interface DirectMarkupCoreModule {");
  assert.notEqual(start, -1, "DirectMarkupCoreModule interface not found — did it move or get renamed?");
  const body = source.slice(start, source.indexOf("\n}", start));
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]).sort();
}

/** Property names assigned to the injected global. */
function injectedEntryPoints() {
  const source = readFileSync(BUNDLED, "utf8");
  const start = source.indexOf("globalThis.__MIZCHI_VLMKIT_MARKUP_CORE_API__");
  assert.notEqual(start, -1, "the injection assignment is gone — the bundled CLI would have no direct API at all");
  const body = source.slice(start, source.indexOf("};", start));
  // `{ run_markup_core, run_markup_core_json }` shorthand, one per line.
  return [...body.matchAll(/^\s{2}(\w+),?$/gm)].map((m) => m[1]).sort();
}

describe("bundled CLI injects the whole markup-core API", () => {
  it("injects every entry point the runtime declares", () => {
    const declared = declaredEntryPoints();
    const injected = injectedEntryPoints();
    assert.ok(declared.length >= 3, `expected at least 3 entry points, parsed ${declared.join(", ")}`);
    assert.deepEqual(
      injected,
      declared,
      "scripts/vlmkit-bundled.mjs must inject every field of DirectMarkupCoreModule. A missing one "
      + "does not fail loudly: the runtime finds the global, the missing function reads as undefined, "
      + "and that command silently falls back to spawning `moon build` — which npm consumers do not have.",
    );
  });

  it("imports those names from the generated bridge", () => {
    // Injecting a name that was never imported yields `undefined` with no error, which
    // is the same silent failure by a different route.
    const source = readFileSync(BUNDLED, "utf8");
    const importBlock = source.slice(source.indexOf("import {"), source.indexOf("markup-core-api.js"));
    for (const name of injectedEntryPoints()) {
      assert.match(
        importBlock,
        new RegExp(`\\b${name}\\b`),
        `${name} is injected but never imported — it would be injected as undefined`,
      );
    }
  });
});
