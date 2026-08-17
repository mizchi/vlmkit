/**
 * The bundled CLI must hand the runtime a *complete* markup-core API.
 *
 * The root package ships `dist/**` only — no `_build`, no `.mbt` sources — so the CLI's
 * one route to MoonBit is `scripts/vlmkit-bundled.mjs`, which statically imports the
 * generated bridge and puts it on a global before the CLI loads. If anything the runtime
 * needs is missing from that hand-off, the CLI has no way to recover: `moon build` needs a
 * toolchain npm consumers do not have, and the spawned CLI needs a `_build` the package
 * does not ship.
 *
 * That is exactly what happened. The file used to name its exports —
 * `import { run_markup_core }` then `globalThis.… = { run_markup_core }` — a hand-written
 * list that had to agree with `DirectMarkupCoreModule`, and the JSON boundary landed
 * without updating it. In `dist/`, `run_markup_core_json` read as `undefined` and every
 * JSON command silently fell back to shelling out. Positional commands kept working.
 *
 * Nothing could catch it: the suite runs from source, where the runtime finds the bridge
 * on disk through `apiPath` and never reads the global; the existing `direct-js` backend
 * assertion is true from source for the same reason; and the global is assigned in a
 * `.mjs` file to a `Partial<DirectMarkupCoreModule>`, where a missing field is legal.
 *
 * So this checks the two halves of "always connected" separately:
 *
 *  1. **Structural** — the hand-off is a namespace import, so there is no list to drift.
 *     A named-import version is rejected even if it currently happens to be complete,
 *     because completeness by remembering is the thing that failed.
 *  2. **Behavioural** — the generated bridge really does export every entry point the
 *     runtime declares, and a run against the injected global actually answers a JSON
 *     command. Reading source alone would pass against a bridge that was never rebuilt.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const RUNTIME = resolve(REPO_ROOT, "packages/vlmkit-markup/src/markup-core-runtime.ts");
const BUNDLED = resolve(REPO_ROOT, "scripts/vlmkit-bundled.mjs");
const BRIDGE = resolve(
  REPO_ROOT,
  "packages/vlmkit-markup/_build/js/debug/build/markup-core-api/markup-core-api.js",
);

/** Field names of `interface DirectMarkupCoreModule`. */
function declaredEntryPoints() {
  const source = readFileSync(RUNTIME, "utf8");
  const start = source.indexOf("interface DirectMarkupCoreModule {");
  assert.notEqual(start, -1, "DirectMarkupCoreModule not found — did it move or get renamed?");
  const body = source.slice(start, source.indexOf("\n}", start));
  const fields = [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]).sort();
  assert.ok(fields.length >= 3, `expected at least 3 entry points, parsed ${fields.join(", ")}`);
  return fields;
}

describe("bundled CLI is structurally connected to markup-core", () => {
  it("hands over the whole bridge as a namespace, with no per-name list", () => {
    const source = readFileSync(BUNDLED, "utf8");
    assert.match(
      source,
      /import \* as (\w+) from "[^"]*markup-core-api\.js";/,
      "the bridge must be imported as a namespace — a named-import list is what drifted",
    );
    const namespaceName = source.match(/import \* as (\w+) from "[^"]*markup-core-api\.js";/)[1];
    assert.match(
      source,
      new RegExp(`globalThis\\.__MIZCHI_VLMKIT_MARKUP_CORE_API__ = ${namespaceName};`),
      "the namespace must be assigned directly; rebuilding an object re-introduces the list",
    );
    // The specific regression: no `{ a, b }` object literal standing in for the bridge.
    const assignment = source.slice(source.indexOf("globalThis.__MIZCHI_VLMKIT_MARKUP_CORE_API__"));
    assert.doesNotMatch(
      assignment.split("\n")[0],
      /\{/,
      "assigning an object literal means naming entry points by hand again",
    );
  });
});

describe("the generated bridge exports every entry point the runtime declares", () => {
  it("exports all of them", async (t) => {
    if (!existsSync(BRIDGE)) {
      t.skip("generated bridge absent — run `moon build` in packages/vlmkit-markup");
      return;
    }
    const bridge = await import(BRIDGE);
    const missing = declaredEntryPoints().filter((name) => typeof bridge[name] !== "function");
    assert.deepEqual(
      missing,
      [],
      `the bridge is missing ${missing.join(", ")}. A namespace import cannot fix an export `
      + "that does not exist: markup-core-api/main.mbt must expose it, and _build must be rebuilt.",
    );
  });

  it("answers a JSON command through the injected global, not a fallback", async (t) => {
    if (!existsSync(BRIDGE)) {
      t.skip("generated bridge absent");
      return;
    }
    // Drive the runtime the way the bundled CLI does — global first, then load — and
    // assert it reports `direct-js`. If the hand-off were incomplete this now raises a
    // packaging error rather than quietly spawning, which is the behaviour under test.
    const bridge = await import(BRIDGE);
    globalThis.__MIZCHI_VLMKIT_MARKUP_CORE_API__ = bridge;
    try {
      const runtime = await import("@mizchi/vlmkit-markup/markup-core-runtime.ts");
      assert.equal(
        runtime.callMarkupCoreJson("grid-gcd", { a: 24, b: 36 }),
        12,
        "a JSON command must answer from the injected bridge",
      );
      assert.equal(runtime.getMarkupCoreRuntimeBackend(), "direct-js");
    } finally {
      delete globalThis.__MIZCHI_VLMKIT_MARKUP_CORE_API__;
    }
  });
});
