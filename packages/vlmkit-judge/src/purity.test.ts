import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";

/**
 * The one property this package exists for: nothing in it needs a browser, a
 * DOM or a Node runtime, so a judge runs on any snapshot — one Playwright
 * collected, one read back from disk, or one built from a game's scene graph.
 *
 * Checked on the source rather than trusted, because the layer this was split
 * out of had exactly this leak: `selector-exemption.ts` was pure except for
 * `UsageError`, whose module imports `node:fs`.
 */
const here = import.meta.dirname;
const sources = readdirSync(here).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

const specifiers = (text: string): string[] =>
  [...text.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)].map((m) => m[1]!);

/** Code only: a judge's doc comment may well say "the DOM". */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"/g, '""');

describe("@mizchi/vlmkit-judge purity", () => {
  it("has sources to check", () => {
    assert.ok(sources.length >= 5, sources.join(", "));
  });

  for (const file of sources) {
    it(`${file} imports only its own package`, () => {
      const outside = specifiers(readFileSync(join(here, file), "utf8")).filter((s) => !s.startsWith("./"));
      assert.deepEqual(outside, [], `${file} reaches outside the pure layer`);
    });

    it(`${file} touches no browser or Node global`, () => {
      const body = code(readFileSync(join(here, file), "utf8"));
      const hits = body.match(/\b(window|document|navigator|process|Buffer|require)\s*[.([]/g) ?? [];
      assert.deepEqual(hits, [], `${file} uses a runtime global`);
    });
  }
});
