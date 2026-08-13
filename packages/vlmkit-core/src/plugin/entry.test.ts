import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as plugin from "./index.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

describe("@mizchi/vlmkit-core/plugin — the declared plugin surface", () => {
  it("carries everything the bundled gates import, so a plugin needs no deep import", () => {
    // The entry's whole claim. Sized from what the 27 bundled gates actually
    // import rather than from taste, so the list is falsifiable: if a bundled
    // gate needs something, a third-party gate will too.
    for (const name of [
      "defineGate",
      "definePlugin",
      "ruleRef",
      "gateCommandString",
      "FINDING_SEVERITIES",
      "GATE_CATEGORIES",
      "RULE_SETTINGS",
      // page-load, so a navigating gate declares the same flags rather than
      // hand-rolling `--timeout` and leaving `--wait-until` ineffective.
      "PAGE_LOAD_INPUTS",
      "parsePageLoad",
      "pickPageLoad",
      "navigationOptions",
      // argv
      "hasFlag",
      "readAll",
      "readChoice",
      "readFlag",
      "readInt",
      "readPositionals",
      "firstPositional",
      "firstPositionalOrUndefined",
      "viewportFlag",
      "numberList",
      "optionalInt",
      "runOutputDir",
      // errors, colours, project paths
      "UsageError",
      "DIM",
      "RESET",
      "BOLD",
      "CONFIG_FILE",
      "resolveStatePath",
      "PLUGIN_API_VERSION",
    ]) {
      assert.ok(name in plugin, `@mizchi/vlmkit-core/plugin no longer exports ${name}`);
    }
  });

  it("loads without the browser chain, which is why `plugin/browser` is separate", () => {
    // Measured when the split was made: this entry loads in ~25ms and adding
    // `browser-launch` costs ~441ms, because that module pulls the capture chain
    // even though Playwright stays lazy. A plugin that only reads a file — the
    // `house-gates.ts` example — must not pay it.
    const loaded = (process as unknown as { moduleLoadList?: string[] }).moduleLoadList ?? [];
    const heavy = loaded.filter((m: string) => /browser-launch|page-open|playwright/i.test(m));
    assert.deepEqual(heavy, [], `the plugin entry pulled the browser chain: ${heavy.join(", ")}`);
  });

  it("is what the worked example imports, and the example imports nothing else", () => {
    // The example is the proof the entry is sufficient. If a future gate needs a
    // deep import to work, this fails and the missing export gets added here
    // rather than the deep import spreading.
    const files = ["index.ts", "house-gates.ts", "dom-budget.gate.ts"];
    const allowed = new Set(["@mizchi/vlmkit-core/plugin", "@mizchi/vlmkit-core/plugin/browser"]);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(repoRoot, "examples", "gate-plugin", file), "utf8");
      for (const m of text.matchAll(/from "(@mizchi\/[^"]+)"/g)) {
        if (!allowed.has(m[1]!)) offenders.push(`${file}: ${m[1]}`);
      }
    }
    assert.deepEqual(offenders, [], `the example reached past the declared entry: ${offenders.join(", ")}`);
  });

  it("states an API version a plugin can assert against", () => {
    assert.equal(typeof plugin.PLUGIN_API_VERSION, "number");
    assert.equal(plugin.PLUGIN_API_VERSION, 1);
  });

  it("declares both subpaths in the package's exports map", () => {
    // The exports map is the statement of what is public. `./*.ts` still resolves
    // every internal file, for this repo's own deep imports and for consumers
    // already using them, but only the named subpaths are a promise.
    const pkg = JSON.parse(readFileSync(join(repoRoot, "packages", "vlmkit-core", "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    assert.ok(pkg.exports["./plugin"], "./plugin must be a declared subpath");
    assert.ok(pkg.exports["./plugin/browser"], "./plugin/browser must be a declared subpath");
  });
});
