/**
 * Coverage exclusions have to earn their place, and the rule is checkable.
 *
 * `vitest.config.ts` drops research and demo RUNNERS from the coverage denominator: entry points
 * that nothing imports, need an API key or a 30-trial loop to do anything, and are invoked as
 * `node src/...` from `Taskfile.pkl` rather than shipped. 2,802 statements of those made the
 * metric worse at its job — it moved when a bench script was added and not when a gate lost its
 * tests.
 *
 * The failure mode is obvious and this test is the whole defence: someone excludes a file
 * because it is inconveniently uncovered. So the criterion is mechanical rather than a matter of
 * taste — **no non-test file may import an excluded path**. `migration-compare.ts` has its own
 * CLI entry and is NOT excluded, because six modules import it and `vlmkit diff html` runs it;
 * that is shipped library code and it belongs in the denominator at whatever percentage it has
 * earned.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Excluded paths under the two runner directories — the ones this rule governs. */
function excludedRunnerPaths() {
  const cfg = readFileSync(join(repoRoot, "vitest.config.ts"), "utf8");
  // From `coverage:` onward. Anchoring on `exclude: [` alone found the WRONG array — vitest has
  // a `test.exclude` for node_modules/dist that appears first — and matched nothing, which the
  // length guard below is what caught.
  const coverage = cfg.slice(cfg.indexOf("coverage: {"));
  assert.ok(coverage.length > 0, "vitest.config.ts no longer has a coverage block");
  // Quoted paths only, so the rationale prose above the list (which names
  // `migration-compare.ts` as the counter-example) does not read as an entry.
  return [...coverage.matchAll(/"(src\/(?:demo|experiments)\/[^"]+)"/g)].map((m) => m[1]);
}

async function buildImporterMap() {
  const importers = new Map();
  for await (const relative of glob(["src/**/*.ts", "packages/*/src/**/*.ts"], { cwd: repoRoot })) {
    if (relative.endsWith(".test.ts")) continue;
    const source = readFileSync(join(repoRoot, relative), "utf8");
    // Relative specifiers only: a bare `@mizchi/...` import resolves through package exports and
    // can never name a file under `src/experiments` or `src/demo`.
    for (const m of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const target = normalize(join(dirname(relative), m[1]));
      if (!importers.has(target)) importers.set(target, []);
      importers.get(target).push(relative);
    }
  }
  return importers;
}

describe("coverage exclusions", () => {
  it("excludes only runners that nothing imports", async () => {
    const listed = excludedRunnerPaths();
    // Guards against a silently empty run: a renamed `exclude` key or a reformatted array would
    // otherwise pass by matching nothing.
    assert.ok(listed.length >= 10, `only found ${listed.length} excluded runner paths`);
    const importers = await buildImporterMap();
    const imported = listed
      .filter((entry) => !entry.endsWith("/**"))
      .map((entry) => ({ entry, users: importers.get(normalize(entry)) ?? [] }))
      .filter((row) => row.users.length > 0);
    assert.deepEqual(
      imported.map((row) => `${row.entry} <- ${row.users.join(", ")}`),
      [],
      "an excluded path is imported by shipped code, so it is library code and its coverage counts",
    );
  });

  it("catches an exclusion that is actually a library (this test is not vacuous)", async () => {
    // The rule applied to a file NOT on the list, chosen because it is the exact case the rule
    // exists to keep out: `migration-compare.ts` has a CLI entry point like every excluded
    // runner, and is imported by six modules.
    const importers = await buildImporterMap();
    const users = importers.get(normalize("src/experiments/migration/migration-compare.ts")) ?? [];
    assert.ok(users.length > 0, "migration-compare is imported — excluding it would be wrong");
    assert.ok(!excludedRunnerPaths().includes("src/experiments/migration/migration-compare.ts"));
  });
});
