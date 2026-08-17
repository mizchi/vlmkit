/**
 * Every workspace package's `test` script must be able to run that package's tests.
 *
 * All eight of them could not. The suite moved from `node:test` to vitest — a specifier
 * change, `describe`/`it`/`test` have the same names — but only the ROOT script was
 * migrated. Each package kept `node --test 'src/**\/*.test.ts'`, and every one of the 148
 * test files under `packages/` imports from `"vitest"`, so the documented per-package
 * command failed on all of them at once:
 *
 *     $ pnpm --filter @mizchi/vlmkit-core test
 *     # tests 38  # pass 0  # fail 38
 *     Error: Vitest failed to find the current suite. One of the following is possible:
 *     - "vitest" is imported directly without running "vitest" command
 *
 * `pnpm test` at the root was green throughout, which is why this lasted: the command that
 * runs in CI was fine and the command in `CLAUDE.md` was dead. The same shape as the two
 * dead `workflow` commands — a documented entrypoint nobody re-ran after a rename.
 *
 * Scope, stated honestly: this asserts the script *shape* — vitest, and a path filter that
 * actually selects that package's tests. It does not run the eight suites (that is the root
 * `pnpm test`, several minutes of browsers). All eight were run by hand once, and the file
 * counts they reported are recorded below as the counts this test recomputes from disk.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(repoRoot, "packages");

function testFilesUnder(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".test.ts")) found.push(full);
    }
  };
  try {
    if (statSync(dir).isDirectory()) walk(dir);
  } catch {
    // no src/ — reported by the caller as "no tests", not as an error
  }
  return found;
}

const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => {
    const dir = join(packagesDir, e.name);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    return {
      dir: e.name,
      name: manifest.name,
      script: manifest.scripts?.test,
      tests: testFilesUnder(join(dir, "src")),
    };
  });

describe("workspace package test scripts", () => {
  it("finds the packages at all (guards the rest of this file from going vacuous)", () => {
    assert.ok(packages.length >= 8, `expected the workspace packages, found ${packages.length}`);
    const withTests = packages.filter((p) => p.tests.length > 0);
    assert.equal(withTests.length, packages.length, "a package lost its tests — check the walk");
  });

  for (const pkg of packages) {
    it(`${pkg.name} runs its own ${pkg.tests.length} test files`, () => {
      assert.ok(pkg.script, `${pkg.name} has no test script`);

      // The specific dead combination, named so a revert reads as itself: a `node --test`
      // runner against files that import vitest cannot pass a single one of them.
      const importsVitest = pkg.tests.filter((f) => readFileSync(f, "utf8").includes('from "vitest"'));
      if (importsVitest.length > 0) {
        assert.doesNotMatch(
          pkg.script,
          /node\s+--test/,
          `${pkg.name}: ${importsVitest.length} of ${pkg.tests.length} test files import "vitest", `
          + `so \`node --test\` fails every one of them`,
        );
        assert.match(pkg.script, /vitest/, `${pkg.name} must run its tests with vitest`);
      }

      // And the filter has to select this package. `vitest run` with a path that matches
      // nothing exits 1 on "No test files found", which looks like a broken runner rather
      // than a wrong argument.
      const filters = pkg.script.split(/\s+/).filter((token) => token.includes("/"));
      const selects = filters.some((filter) =>
        pkg.tests.some((file) => relative(repoRoot, file).replaceAll("\\", "/").startsWith(filter)));
      assert.ok(
        selects,
        `${pkg.name}: none of the path arguments ${JSON.stringify(filters)} match a test file `
        + `(e.g. ${relative(repoRoot, pkg.tests[0])}). Paths are resolved from the repo root, `
        + `because the script runs vitest through \`pnpm --dir ../..\` to pick up the root config.`,
      );
    });
  }
});
