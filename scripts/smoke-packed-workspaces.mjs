#!/usr/bin/env node
/**
 * Packs every public workspace package and installs the tarballs into a clean
 * consumer. This catches exports or bin entries that accidentally target raw
 * TypeScript or files omitted from the published package.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectories = [
  "vlmkit-core",
  "vlmkit-ai",
  "vlmkit-capture",
  "vlmkit-generate",
  "vlmkit-plan",
  "vlmkit-markup",
  "vlmkit-heal",
];
const playwrightPeerPackages = new Set([
  "@mizchi/vlmkit-core",
  "@mizchi/vlmkit-capture",
  "@mizchi/vlmkit-markup",
  "@mizchi/vlmkit-heal",
]);

function fail(message) {
  throw new Error(`packed workspace smoke: ${message}`);
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd ?? repoRoot,
      encoding: "utf8",
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    if (stdout) process.stderr.write(stdout);
    if (stderr) process.stderr.write(stderr);
    throw error;
  }
}

function assertCliHelp(bin, cwd) {
  const result = spawnSync(bin, ["--help"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!output.includes("Usage:")) fail(`${bin} --help did not print usage\n${output}`);
  if (result.status !== 0) fail(`${bin} --help exited with ${result.status}, expected 0`);
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), "vlmkit-packed-workspaces-"));
  const tarballsDir = join(tempRoot, "tarballs");
  const consumerDir = join(tempRoot, "consumer");

  try {
    await mkdir(tarballsDir);
    await mkdir(consumerDir);

    console.log("==> building public workspace packages");
    run("pnpm", ["build:packages"]);

    const tarballs = new Map();
    for (const directory of packageDirectories) {
      const packageDir = join(repoRoot, "packages", directory);
      const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
      const before = new Set(await readdir(tarballsDir));
      console.log(`==> packing ${manifest.name}`);
      run("pnpm", ["pack", "--pack-destination", tarballsDir], { cwd: packageDir });
      const created = (await readdir(tarballsDir)).filter((file) => !before.has(file) && file.endsWith(".tgz"));
      if (created.length !== 1) fail(`${manifest.name} produced ${created.length} tarballs`);
      const tarball = join(tarballsDir, created[0]);
      const entries = run("tar", ["-tzf", tarball]).split("\n").filter(Boolean);
      if (!entries.some((entry) => entry.startsWith("package/dist/") && entry.endsWith(".mjs"))) {
        fail(`${manifest.name} tarball contains no compiled JavaScript`);
      }
      if (entries.some((entry) => /^package\/src\/.*\.ts$/.test(entry))) {
        fail(`${manifest.name} tarball contains raw TypeScript sources`);
      }
      if (playwrightPeerPackages.has(manifest.name)) {
        if (manifest.dependencies?.playwright) fail(`${manifest.name} retains a private Playwright dependency`);
        if (manifest.peerDependencies?.playwright !== ">=1.61 <2") {
          fail(`${manifest.name} has unexpected Playwright peer range`);
        }
      }
      tarballs.set(manifest.name, tarball);
    }

    const localReferences = Object.fromEntries(
      [...tarballs].map(([name, tarball]) => [name, `file:${relative(consumerDir, tarball)}`]),
    );
    await writeFile(join(consumerDir, "package.json"), `${JSON.stringify({
      name: "vlmkit-packed-workspaces-consumer",
      private: true,
      type: "module",
      dependencies: { "@playwright/test": "1.61.0", ...localReferences },
      pnpm: { overrides: localReferences },
    }, null, 2)}\n`);
    await writeFile(join(consumerDir, "smoke.mjs"), `
import assert from "node:assert/strict";

const packageNames = ${JSON.stringify([...tarballs.keys()])};
for (const name of packageNames) {
  const module = await import(name);
  assert.ok(Object.keys(module).length > 0, name + " root export should be importable");
}

const { compareScreenshots } = await import("@mizchi/vlmkit-core/heatmap.ts");
assert.equal(typeof compareScreenshots, "function");
const { STOP_WORDS } = await import("@mizchi/vlmkit-ai/nlp.ts");
assert.equal(STOP_WORDS.has("the"), true);
const { extractBreakpoints } = await import("@mizchi/vlmkit-capture/viewport-discovery.ts");
assert.deepEqual(extractBreakpoints("@media (min-width: 640px) {}").map(({ value }) => value), [640]);
const { estimateCost } = await import("@mizchi/vlmkit-heal/cost.ts");
assert.equal(estimateCost({ promptCostPerToken: 2, completionCostPerToken: 3 }, { promptTokens: 4, completionTokens: 5 }), 23);
const { computeGridGcd } = await import("@mizchi/vlmkit-markup/markup-core-grid.ts");
assert.equal(computeGridGcd(12, 18), 6);
const { listComponentGoals } = await import("@mizchi/vlmkit-markup/component/component-goal.ts");
assert.equal(listComponentGoals().includes("app"), true);
await import("@mizchi/vlmkit-generate/cli");
await import("@mizchi/vlmkit-plan/cli");
console.log("workspace package imports passed");
`);

    console.log("==> installing tarballs in isolated consumer");
    run("pnpm", ["install", "--ignore-scripts"], { cwd: consumerDir });
    const projectRequire = createRequire(join(consumerDir, "package.json"));
    const testRequire = createRequire(projectRequire.resolve("@playwright/test/package.json"));
    const projectPlaywright = await realpath(testRequire.resolve("playwright/package.json"));
    for (const name of playwrightPeerPackages) {
      const installedManifest = await realpath(join(consumerDir, "node_modules", ...name.split("/"), "package.json"));
      const packageRequire = createRequire(installedManifest);
      const packagePlaywright = await realpath(packageRequire.resolve("playwright/package.json"));
      if (packagePlaywright !== projectPlaywright) {
        fail(`${name} did not reuse the consumer's Playwright installation`);
      }
    }
    run(process.execPath, ["smoke.mjs"], { cwd: consumerDir });
    assertCliHelp(join(consumerDir, "node_modules", ".bin", "vlmkit-plan"), consumerDir);
    assertCliHelp(join(consumerDir, "node_modules", ".bin", "vlmkit-generate"), consumerDir);
    console.log("==> packed workspace smoke passed");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
