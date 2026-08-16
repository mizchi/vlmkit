/**
 * Every path a spec or task file declares must resolve.
 *
 * `Spec.pkl` links each Scenario to its code with `new Implementation { at = "<path>" }`, and
 * 20 of those still pointed at `packages/vrt-*` — the package names dropped in 0.6. Two more
 * named `src/cli/router.ts`, a file folded into `cli.ts` in a later refactor, one of them via
 * a `path:SYMBOL` form whose symbol no longer exists anywhere. `Taskfile.pkl` had the same
 * dead `router.ts` in a pkfire `inputs` list, where a missing path silently weakens change
 * detection rather than erroring.
 *
 * None of it was detectable here: `pkspec check` verifies that every approved Scenario HAS an
 * implementation link and `pkspec lint` reports dead *specRefs*, but neither opens the file a
 * link points at — and the toolchain runs through `nix run`, so it is not available in most
 * checkouts anyway. A stale link is worse than a missing one: it reads as "this is
 * implemented, here" and sends the reader to a path that has not existed for releases.
 *
 * Plain `node:fs` on purpose, so this runs wherever `pnpm test` does.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname!, "..", "..");
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), "utf8");

/**
 * Resolve one declared path.
 *
 * `at` accepts a bare path or `path:SYMBOL`. The symbol half is checked too: the dead link
 * that started this was `src/cli/router.ts:WORKFLOW_ALIAS_COMMANDS`, and had only the file
 * been checked, pointing it at an existing file with no such symbol would still have passed.
 */
function resolveDeclared(at: string): string | undefined {
  const [path, symbol] = at.includes(":") ? [at.slice(0, at.indexOf(":")), at.slice(at.indexOf(":") + 1)] : [at, undefined];
  if (!existsSync(resolve(ROOT, path))) return `${at} — no such file`;
  if (symbol !== undefined && symbol !== "" && !read(path).includes(symbol)) {
    return `${at} — file exists but does not contain \`${symbol}\``;
  }
  return undefined;
}

describe("Spec.pkl implementation links", () => {
  const declared = [...read("Spec.pkl").matchAll(/\bat = "([^"]+)"/g)].map((m) => m[1]!);

  it("declares a plausible number of them — guards against a vacuous pass", () => {
    assert.ok(declared.length >= 20, `only found ${declared.length} \`at = "…"\` links`);
  });

  it("every one resolves", () => {
    const broken = declared.map(resolveDeclared).filter((x): x is string => x !== undefined);
    assert.deepEqual(broken, [], `dead implementation links:\n  ${broken.join("\n  ")}`);
  });

  it("names no package that was renamed in 0.6", () => {
    // The specific rot, asserted by name: `packages/vrt-core` etc. resolve to nothing, and a
    // future `packages/vrt-*` directory would make the check above pass while still being
    // wrong about which package it is.
    const stale = declared.filter((at) => /packages\/vrt-/.test(at));
    assert.deepEqual(stale, [], `pre-0.6 package paths: ${stale.join(", ")}`);
  });
});

describe("Taskfile.pkl inputs", () => {
  // Literal paths only — pkfire globs (`src/**/*.ts`) are patterns, and a pattern matching
  // nothing today is not necessarily wrong.
  const declared = [...read("Taskfile.pkl").matchAll(/"([\w./-]+\.(?:ts|mjs|sh|json|html|pkl|mbt))"/g)]
    .map((m) => m[1]!)
    .filter((p) => !p.includes("*"));

  it("declares a plausible number of literal paths", () => {
    assert.ok(declared.length >= 20, `only found ${declared.length} literal paths`);
  });

  it("every literal path exists", () => {
    const missing = [...new Set(declared)].filter((p) => !existsSync(resolve(ROOT, p)));
    assert.deepEqual(missing, [], `these are declared as task inputs but do not exist: ${missing.join(", ")}`);
  });
});
