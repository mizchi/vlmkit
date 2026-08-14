/**
 * No gate may statically reach a CLI-entry module.
 *
 * Legacy leaf commands (`build page`, `diff html`, `scan component`, …) have no
 * handler the router calls. `delegate` sets `__VLMKIT_DISPATCHER_LEAF__` and imports
 * the leaf's module; a top-level guard reads that variable and calls `main()`. The
 * command *is* the module's evaluation.
 *
 * So if anything imports a leaf's module earlier in the same process, the guard has
 * already run with the variable unset, and `delegate`'s import is an ESM cache hit
 * that executes nothing. The command prints nothing and exits 0 — it type-checks,
 * every unit test of its internals passes, and it is gone.
 *
 * `runCli` composes the gate registry on **every** invocation, to enumerate its verbs
 * for the command table. That makes the gate plugins' static import graph the danger
 * zone: anything they reach is evaluated before any leaf can dispatch. `vlmkit build
 * page` was dead for exactly this reason (`verify.gate.ts` → `markup-verify.ts` →
 * `page-compose.ts`), which is why `loadPng` / `renderHtmlToPng` now live in
 * `page-render.ts`.
 *
 * ## Why this walks source text instead of spawning the CLI
 *
 * Because spawning cannot see it. Run from source, `markup-verify.ts`'s relative
 * `../component/page-compose.ts` and `delegate`'s package specifier
 * `@mizchi/vlmkit-markup/component/page-compose.ts` resolve to different URLs, so
 * Node holds two module instances and the guard fires on the second. The collision
 * only exists once the bundler merges them into one chunk — the bug reproduces in
 * `dist/` and not in `src/`. A test that spawned the built CLI would depend on build
 * order and pass vacuously whenever `dist/` was stale.
 *
 * Walking imports tests the invariant rather than the symptom, needs no build, and
 * names the offending edge — which is what someone who just added the import needs.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");

/** Kept in step with `loadGateRegistry`'s three built-in plugin imports. */
const PLUGIN_ENTRIES = [
  "packages/vlmkit-markup/src/gates/index.ts",
  "packages/vlmkit-capture/src/gates/crater.gate.ts",
  "src/gates/perf.gate.ts",
];

/**
 * `@mizchi/vlmkit-<pkg>/<path>` → `packages/vlmkit-<pkg>/src/<path>`, relative paths
 * as written, and everything else (node builtins, npm packages) unresolvable and
 * skipped. The `resolved.size` assertion at the bottom is what keeps a wrong mapping
 * here from turning the whole check green and empty.
 */
function resolveSpecifier(specifier: string, fromFile: string): string | undefined {
  if (specifier.startsWith(".")) {
    const path = resolve(dirname(fromFile), specifier);
    return existsSync(path) ? path : undefined;
  }
  const scoped = specifier.match(/^@mizchi\/(vlmkit-[a-z-]+)\/(.+)$/);
  if (scoped) {
    const path = resolve(REPO_ROOT, "packages", scoped[1]!, "src", scoped[2]!);
    return existsSync(path) ? path : undefined;
  }
  // The curated barrel: `@mizchi/vlmkit-<pkg>` with no subpath.
  const barrel = specifier.match(/^@mizchi\/(vlmkit-[a-z-]+)$/);
  if (barrel) {
    const path = resolve(REPO_ROOT, "packages", barrel[1]!, "src", "index.ts");
    return existsSync(path) ? path : undefined;
  }
  return undefined;
}

/**
 * Static imports only. A `await import(...)` is exactly the escape hatch a module
 * SHOULD use to reach a CLI entry, so counting it would flag the correct pattern:
 * `region-judge.ts` dynamically imports `renderHtmlToPng`, and that is fine because
 * nothing is evaluated until the call runs.
 */
function staticImportsOf(source: string): string[] {
  const out: string[] = [];
  // `[^;]` rather than `[^;\n]`: a multi-line `import {\n  a,\n  b,\n} from "x"` is the
  // common shape in this repo, and the first version of this regex skipped every one of
  // them — resolving three modules from a file that imports a dozen, which the vacuity
  // check below is here to catch.
  const pattern = /(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) out.push(match[1]!);
  // Side-effect-only `import "x"`, which evaluates the module just the same.
  for (const match of source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) out.push(match[1]!);
  return out;
}

/**
 * Both spellings of the guard, because there are two.
 *
 * The original was a hand-rolled `process.env.__VLMKIT_DISPATCHER_LEAF__ === "x" ||
 * resolve(process.argv[1]) === fileURLToPath(import.meta.url)`. Twelve modules now
 * call the shared `isCliEntry(import.meta.url, "x")` instead, and matching only the
 * literal made every one of them invisible here — the check would have gone quiet
 * about exactly the modules most recently touched. Matching the source text at all
 * is the compromise: this walker reads files rather than importing them, precisely
 * because importing a CLI-entry module runs its command.
 */
function isCliEntryModule(source: string): boolean {
  return source.includes("__VLMKIT_DISPATCHER_LEAF__ ===")
    || /isCliEntry\(\s*import\.meta\.url/.test(source);
}

/** Every module statically reachable from `entry`, with the path that got there. */
function reachableFrom(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    const trail = seen.get(file)!;
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const specifier of staticImportsOf(source)) {
      const target = resolveSpecifier(specifier, file);
      if (!target || seen.has(target)) continue;
      seen.set(target, [...trail, target]);
      queue.push(target);
    }
  }
  return seen;
}

describe("gate plugins do not statically reach CLI-entry modules", () => {
  for (const entry of PLUGIN_ENTRIES) {
    it(`${entry} reaches no module that runs main() on evaluation`, () => {
      const entryPath = resolve(REPO_ROOT, entry);
      assert.ok(existsSync(entryPath), `plugin entry moved: ${entry}`);
      const offenders: string[] = [];
      for (const [file, trail] of reachableFrom(entryPath)) {
        if (file === entryPath) continue;
        if (!isCliEntryModule(readFileSync(file, "utf8"))) continue;
        offenders.push(trail.map((step) => relative(REPO_ROOT, step)).join("\n    → "));
      }
      assert.deepEqual(
        offenders,
        [],
        "A gate statically imports a module whose evaluation runs a CLI command. That "
        + "kills the command silently — see this file's header. Move the shared code "
        + `into a module with no CLI guard, or import it dynamically.\n\n${offenders.join("\n\n")}`,
      );
    });
  }

  it("no module hand-rolls the entry guard", () => {
    // `argv[1]?.endsWith("thing.ts")` is a suffix match, so it cannot tell
    // suffix-sharing files apart — `src/vrt/snapshot/snapshot.ts`'s guard also matched
    // `src/cli/commands/snapshot.ts` — and it silently stops matching once the file is
    // built to `.mjs`. That second half was live: `node dist/png-diff.mjs --help`
    // printed nothing at all, because the guard tested for `png-diff.ts`.
    //
    // Fifteen modules carried it. `isCliEntry(import.meta.url, name)` resolves both
    // sides, so it is exact in both directions.
    const files = execSync("git ls-files '*.ts'", { cwd: REPO_ROOT, encoding: "utf8" })
      .trim().split("\n").filter(Boolean);
    assert.ok(files.length > 200, `git ls-files returned ${files.length} — the listing is broken, not the code`);
    const offenders: string[] = [];
    for (const rel of files) {
      // `cli-entry.ts` quotes the bad spelling in its own docstring, which is where the
      // explanation belongs; tests may quote it too.
      if (rel.endsWith("cli-entry.ts") || rel.endsWith(".test.ts")) continue;
      const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
      // Both halves of the guard in one statement — `process.argv[1]` reached by a
      // suffix comparison — which is the shape, in every spelling it appeared in.
      if (/process\.argv\[1\][^;]{0,200}?\.endsWith\(/s.test(source)) offenders.push(rel);
    }
    assert.deepEqual(
      offenders,
      [],
      "hand-rolled entry guard — use `isCliEntry(import.meta.url, \"<dispatcher-name>\")` "
      + "from @mizchi/vlmkit-core/plugin/cli-entry.ts",
    );
  });

  it("the walker actually finds CLI entries, or the check above is vacuous", () => {
    // `page-compose.ts` is a CLI entry and reachable from `page-compose-diff.ts`'s
    // neighbourhood; assert the two primitives work rather than trusting a green
    // result that could just mean the regex matched nothing.
    const entry = resolve(REPO_ROOT, "packages/vlmkit-markup/src/component/page-compose.ts");
    assert.ok(isCliEntryModule(readFileSync(entry, "utf8")), "page-compose.ts should read as a CLI entry");
    // And one of each spelling, so neither branch of the detector can rot unnoticed.
    assert.ok(
      isCliEntryModule(readFileSync(resolve(REPO_ROOT, "packages/vlmkit-markup/src/inspect/explore.ts"), "utf8")),
      "explore.ts uses the shared isCliEntry() guard and must still read as an entry",
    );
    assert.ok(!isCliEntryModule("export const x = 1;\n"), "a plain module is not an entry");
    const reached = reachableFrom(entry);
    assert.ok(reached.size > 3, `walker resolved only ${reached.size} modules from a real entry`);
    assert.ok(
      [...reached.keys()].some((f) => f.endsWith("page-render.ts")),
      "walker should follow relative imports",
    );
    assert.ok(
      [...reached.keys()].some((f) => f.includes("vlmkit-core")),
      "walker should follow @mizchi/vlmkit-* specifiers",
    );
  });
});
