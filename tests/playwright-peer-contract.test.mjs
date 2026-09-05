/**
 * The Playwright peer-dependency contract (issue #112, item 2).
 *
 * Three invariants, each of which was violated or nearly violated at some point:
 *
 *  1. `playwright` is a REQUIRED peer everywhere; `@playwright/test` is OPTIONAL
 *     at the root and declared nowhere else. The asymmetry looks like an
 *     oversight and is not — the argument is spelled out on the test below so it
 *     survives in the repo rather than in a review thread.
 *
 *  2. The published `bin` entry routes failures through `handleCliError`. It did
 *     not, which silently disabled every error prettifier in the shipped CLI —
 *     the actual cause of the "run `pnpm exec playwright install`" complaint.
 *
 *  3. `PLAYWRIGHT_PEER_RANGE` in `cli-error.ts` matches the manifests it quotes,
 *     since the diagnosis prints that range at the user.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

function manifest(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf8"));
}

const PEER_PACKAGES = [
  "package.json",
  "packages/vlmkit-core/package.json",
  "packages/vlmkit-capture/package.json",
  "packages/vlmkit-animation-eval/package.json",
  "packages/vlmkit-markup/package.json",
];

test("`playwright` is a required peer in every package that declares it", () => {
  // WHY required rather than optional, measured 2026-08-10:
  //
  // The pixel-only commands (`diff png`, `check palette`, `check asset`,
  // `scan component`, `check integrity --elements`) genuinely need no browser at
  // runtime — but they cannot even be *reached* without the module. The gate
  // registry composes all three built-in plugins eagerly, and `perf.gate` has a
  // static `import { chromium } from "playwright"`. In a tree with the package
  // removed, `node dist/vlmkit.mjs diff png --help` dies with
  // ERR_MODULE_NOT_FOUND out of the ESM resolver before printing usage.
  //
  // So marking it optional would buy nothing real (`npx @mizchi/vlmkit` would
  // skip the download and then fail on the first command, browser gate or not)
  // and would cost the package manager's warning, which is the only pre-runtime
  // signal a consumer gets. `formatMissingPlaywrightModuleError` covers the
  // case where a consumer removes it anyway.
  for (const relativePath of PEER_PACKAGES) {
    const pkg = manifest(relativePath);
    assert.equal(
      pkg.peerDependencies?.playwright,
      ">=1.61 <2",
      `${relativePath} must declare the playwright peer range`,
    );
    assert.equal(
      pkg.peerDependenciesMeta?.playwright?.optional,
      undefined,
      `${relativePath} must NOT mark playwright optional — the gate registry imports it eagerly`,
    );
  }
});

test("`@playwright/test` is optional, and only the root declares it", () => {
  // WHY optional: nothing in the shipped runtime imports it. The root declares
  // it because the repo ships Playwright *specs* (`e2e/`, the `vrt` scripts) and
  // because `build spec` / `heal` emit code that imports it — emitted text, not
  // an import this process performs. `files` excludes `dist/e2e/**`, so a
  // consumer who never runs a spec never needs the package.
  const root = manifest("package.json");
  assert.equal(root.peerDependencies?.["@playwright/test"], ">=1.61 <2");
  assert.equal(root.peerDependenciesMeta?.["@playwright/test"]?.optional, true);

  for (const relativePath of PEER_PACKAGES.slice(1)) {
    assert.equal(
      manifest(relativePath).peerDependencies?.["@playwright/test"],
      undefined,
      `${relativePath} should not declare @playwright/test`,
    );
  }

  // And no runtime source actually imports it. `markup-loop.ts` mentions the
  // specifier inside a template literal it emits; that is not an import, so the
  // check anchors on a real import statement.
  const sources = execFileSync(
    "git",
    ["ls-files", "src/**/*.ts", "packages/*/src/**/*.ts"],
    { cwd: ROOT, encoding: "utf8" },
  ).split("\n").filter((f) => f && !f.includes(".test."));
  const offenders = sources.filter((file) =>
    /^\s*import\s[^\n]*from\s+["']@playwright\/test["']/m.test(readFileSync(resolve(ROOT, file), "utf8"))
  );
  assert.deepEqual(offenders, [], `optional peer imported at runtime by: ${offenders.join(", ")}`);
});

test("the published bin entry routes failures through handleCliError", () => {
  // Regression guard. `scripts/vlmkit-bundled.mjs` is what `tsdown.config.ts`
  // builds into `dist/vlmkit.mjs` (the `bin`); `src/cli/vlmkit.ts` is only the
  // workspace entry. When the bundled entry did its own `console.error(error)`,
  // the ENOENT / EISDIR / missing-browser prettifiers were all dead in the
  // shipped CLI and alive in the repo, which is impossible to notice from tests
  // that run the workspace entry.
  const entry = readFileSync(resolve(ROOT, "scripts/vlmkit-bundled.mjs"), "utf8");
  assert.match(entry, /import \{ handleCliError \} from "@mizchi\/vlmkit-core\/cli-error\.ts";/);
  assert.match(entry, /runCli\(\)\.catch\(handleCliError\);/);
  assert.doesNotMatch(entry, /catch\(\(error\) => \{/);

  // Both entries must agree; `tsdown.config.ts` must still point `bin` here.
  const tsdown = readFileSync(resolve(ROOT, "tsdown.config.ts"), "utf8");
  assert.match(tsdown, /vlmkit: "scripts\/vlmkit-bundled\.mjs"/);
  assert.match(
    readFileSync(resolve(ROOT, "src/cli/vlmkit.ts"), "utf8"),
    /runCli\(\)\.catch\(handleCliError\);/,
  );
});

test("PLAYWRIGHT_PEER_RANGE quotes the range the manifests declare", () => {
  const source = readFileSync(resolve(ROOT, "packages/vlmkit-core/src/cli-error.ts"), "utf8");
  const declared = source.match(/PLAYWRIGHT_PEER_RANGE = "([^"]+)"/)?.[1];
  assert.equal(declared, manifest("packages/vlmkit-core/package.json").peerDependencies.playwright);
});
