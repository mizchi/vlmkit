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

describe("docs/SPEC.md", () => {
  /**
   * The generated artifact can be stale in BOTH directions, and was.
   *
   * `pkspec spec --output docs/SPEC.md Spec.pkl Test.pkl` regenerates it, and pkspec runs
   * through `nix run` — so in a checkout without nix the file is edited by hand or not at
   * all, and it drifted from its source in three ways at once: four scenarios spelled the
   * same live entry differently (`diff html` vs `migration compare`), one carried a sentence
   * about `check motion` that the source had lost, and M3 claimed typography hints work while
   * the source says the module is unimplemented — including a `- code:` link to
   * `src/typography-hints.ts`, a file that does not exist and that `Spec.pkl` no longer
   * declares.
   *
   * That last one is why this block exists rather than only the `Spec.pkl` one above: a dead
   * link can live in the artifact alone, where nothing was looking.
   */
  const doc = read("docs/SPEC.md");

  /**
   * Both rendered kinds. `kind = "code"` prints `- code:` and `kind = "doc"` prints `- doc:`,
   * and matching only the first made MIG-003's `docs/reset-css-comparison.md` look absent
   * while it was there all along — a false positive that would have been "fixed" by adding a
   * duplicate line.
   */
  const declaredInDoc = (): string[] =>
    [...doc.matchAll(/^\s*- (?:code|doc): `([^`]+)`/gm)].map((m) => m[1]!);

  it("declares no link to a file that does not exist", () => {
    const declared = declaredInDoc();
    assert.ok(declared.length >= 10, `only found ${declared.length} links`);
    const broken = declared.map(resolveDeclared).filter((x): x is string => x !== undefined);
    assert.deepEqual(broken, [], `dead links in the generated doc:\n  ${broken.join("\n  ")}`);
  });

  it("links exactly the set its source declares — no stale, none missing", () => {
    // Both directions, because the artifact had drifted both ways: it kept `src/compare.ts`
    // (12 sites) and a `vlm-region-diff.ts` link the source had dropped, while lacking the
    // `reasoning-pipeline.ts` link the source had gained.
    const spec = read("Spec.pkl");
    const inSource = new Set([...spec.matchAll(/\bat = "([^"]+)"/g)].map((m) => m[1]!));
    const inDoc = new Set(declaredInDoc());
    const stale = [...inDoc].filter((x) => !inSource.has(x)).sort();
    const missing = [...inSource].filter((x) => !inDoc.has(x)).sort();
    assert.deepEqual(
      { stale, missing },
      { stale: [], missing: [] },
      "docs/SPEC.md's implementation links disagree with Spec.pkl. Regenerate with "
      + "`pkf run spec-render` (pkspec), or update both together.",
    );
  });

  it("carries every scenario description its source declares", () => {
    // Single-line descriptions only: the `#"""` blocks are re-wrapped by the generator, so
    // comparing them verbatim would fail on formatting rather than on content.
    const spec = read("Spec.pkl");
    const scenarios = spec.slice(spec.indexOf("scenarios {"));
    const descriptions = [...scenarios.matchAll(/description = "([^"\n]{40,})"/g)].map((m) => m[1]!);
    assert.ok(descriptions.length >= 60, `only parsed ${descriptions.length} descriptions`);
    const stale = descriptions.filter((d) => !doc.includes(d));
    assert.deepEqual(
      stale,
      [],
      "docs/SPEC.md is behind Spec.pkl. Regenerate with `pkf run spec-render` "
      + `(pkspec), or update it in lockstep:\n  ${stale.map((d) => d.slice(0, 100)).join("\n  ")}`,
    );
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
