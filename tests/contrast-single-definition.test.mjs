/**
 * One definition of WCAG luminance and contrast: `packages/vlmkit-judge/src/color.ts`.
 *
 * The formula was written out seven times. Four copies ran in Node and were replaced by imports
 * from `color.ts`; they had drifted in the small ways copies do — `asset-check.ts` used IEC's
 * 0.04045 threshold where the rest wrote WCAG's 0.03928 (harmless on 8-bit channels, which
 * `color.test.ts` proves exhaustively, but not a thing a reader should have to prove). The
 * copies that remain are there because they cannot import: they run inside the browser, or
 * they are a different conversion that shares the first step. This test lists them by name, so
 * a new copy fails here instead of merging, and one of the listed ones going away is noticed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The sRGB linearisation's linear segment: every copy of the formula carries it. */
const LINEARISE = /\/\s*12\.92\b/;

/** Where the formula may appear, and why each is not an import. */
const ALLOWED = new Map([
  ["packages/vlmkit-judge/src/color.ts", "the definition"],
  ["packages/vlmkit-markup/src/contrast-background.ts", "in-page script; held to color.ts by contrast-parity.test.ts"],
  ["packages/vlmkit-markup/src/component/component-from-image.ts", "one copy inside a page.evaluate callback, which is serialized into the browser"],
  ["src/experiments/migration/design-md-tokens.ts", "sRGB to Lab for colour distance, not contrast"],
]);

describe("color.ts is the only WCAG luminance", () => {
  it("no other source file linearises sRGB itself", async () => {
    const found = new Map();
    let scanned = 0;
    for await (const relative of glob(["src/**/*.ts", "packages/*/src/**/*.ts"], { cwd: repoRoot })) {
      if (relative.endsWith(".test.ts")) continue;
      scanned++;
      const source = readFileSync(join(repoRoot, relative), "utf8");
      const hits = source.split("\n").filter((line) => LINEARISE.test(line.replace(/\/\/.*$/, ""))).length;
      if (hits > 0) found.set(relative.replaceAll("\\", "/"), hits);
    }
    assert.ok(scanned > 100, `scanned only ${scanned} files — the glob is not reaching the sources`);
    const offenders = [...found.keys()].filter((file) => !ALLOWED.has(file));
    assert.deepEqual(offenders, [], "linearise with relativeLuminance / contrastRatio / luminanceContrast from @mizchi/vlmkit-judge/color.ts");
    // The in-page component copy is one, not two: the Node-side twin was the one replaced.
    assert.equal(found.get("packages/vlmkit-markup/src/component/component-from-image.ts"), 1);
    const gone = [...ALLOWED.keys()].filter((file) => !found.has(file));
    assert.deepEqual(gone, [], "an allowed copy is gone — take it off the list");
  });
});
