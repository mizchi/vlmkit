import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname!, "..", "..");

async function readPackageJson() {
  const packagePath = resolve(repoRoot, "package.json");
  const raw = await readFile(packagePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function readWorkspacePackageManifests() {
  const packagesDir = resolve(repoRoot, "packages");
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const manifests: Array<{ dir: string; pkg: Record<string, unknown> }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = resolve(packagesDir, entry.name);
    const raw = await readFile(resolve(dir, "package.json"), "utf-8");
    manifests.push({ dir, pkg: JSON.parse(raw) as Record<string, unknown> });
  }

  return manifests;
}

describe("package manifest for publishable CLI", () => {
  it("uses the scoped npm package name for the published client", async () => {
    const pkg = await readPackageJson();
    assert.equal(pkg.name, "@mizchi/vlmkit");
  });

  it("points the CLI bin to built JavaScript", async () => {
    const pkg = await readPackageJson();
    assert.deepEqual(pkg.bin, { vlmkit: "./dist/vlmkit.mjs" });
  });

  it("declares a build script and supported Node runtime", async () => {
    const pkg = await readPackageJson();
    const scripts = pkg.scripts as Record<string, string> | undefined;
    const engines = pkg.engines as Record<string, string> | undefined;

    assert.equal(typeof scripts?.build, "string");
    assert.match(scripts!.build, /\btsdown\b/);
    assert.deepEqual(engines, { node: ">=24" });
  });

  it("runs TypeScript entrypoints without experimental strip flags on Node 24", async () => {
    const pkg = await readPackageJson();
    const scripts = pkg.scripts as Record<string, string> | undefined;

    assert.ok(scripts, "package.json should define scripts");
    for (const [name, command] of Object.entries(scripts)) {
      assert.doesNotMatch(command, /--experimental-strip-types/, `script ${name} should not need experimental strip flags`);
    }
  });

  it("wires example tests and offline dogfood into package scripts", async () => {
    const pkg = await readPackageJson();
    const scripts = pkg.scripts as Record<string, string> | undefined;

    assert.ok(scripts, "package.json should define scripts");
    assert.match(scripts.test, /examples\/\*\*\/\*\.test\.mjs/);
    assert.equal(scripts["test:examples"], "node --test 'examples/**/*.test.mjs'");
    assert.equal(scripts["dogfood:markup-vrt:offline"], "MARKUP_EVAL_OFFLINE=1 node examples/markup-vrt-eval/run.mjs");
  });

  it("exports the published client entrypoint", async () => {
    const pkg = await readPackageJson();
    assert.deepEqual(pkg.exports, {
      ".": {
        types: "./dist/client.d.mts",
        import: "./dist/client.mjs",
      },
      "./client": {
        types: "./dist/client.d.mts",
        import: "./dist/client.mjs",
      },
      "./playwright": {
        types: "./dist/playwright.d.mts",
        import: "./dist/playwright.mjs",
      },
    });
  });

  it("declares public publish metadata for npm", async () => {
    const pkg = await readPackageJson();
    assert.deepEqual(pkg.publishConfig, {
      access: "public",
    });
  });

  it("ships only runtime files needed for npm consumers", async () => {
    const pkg = await readPackageJson();
    const files = pkg.files as string[] | undefined;

    assert.ok(files, "package.json should define files");
    assert.ok(
      files.some((f) => f === "dist" || f.startsWith("dist/")),
      "dist should be published (either 'dist' or 'dist/**' patterns)",
    );
    assert.ok(files.includes("README.md"), "README should be published");
  });

  it("ships the planner, generator, and healer needed by the drop-in markup loop", async () => {
    const pkg = await readPackageJson();
    const dependencies = pkg.dependencies as Record<string, string> | undefined;

    assert.ok(dependencies, "package.json should define dependencies");
    assert.equal(dependencies["@mizchi/vlmkit-plan"], "workspace:*");
    assert.equal(dependencies["@mizchi/vlmkit-generate"], "workspace:*");
    assert.equal(dependencies["@mizchi/vlmkit-heal"], "workspace:*");
  });

  it("ships a complete LICENSE for every publishable workspace package", async () => {
    const rootLicense = await readFile(resolve(repoRoot, "LICENSE"), "utf-8");
    const manifests = await readWorkspacePackageManifests();

    for (const { dir, pkg } of manifests) {
      if (pkg.private === true) continue;
      const files = pkg.files as string[] | undefined;
      if (files && !files.includes("LICENSE")) continue;

      const license = await readFile(resolve(dir, "LICENSE"), "utf-8");
      assert.equal(
        license,
        rootLicense,
        `${pkg.name as string} should ship the canonical root MIT license text`,
      );
    }
  });
});
