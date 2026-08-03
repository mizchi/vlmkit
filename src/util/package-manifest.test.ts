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

  it("keeps the packed markup-loop install smoke explicit and out of unit tests", async () => {
    const pkg = await readPackageJson();
    const scripts = pkg.scripts as Record<string, string> | undefined;

    assert.ok(scripts, "package.json should define scripts");
    assert.equal(scripts["smoke:pack:markup-loop"], "node scripts/smoke-packed-markup-loop.mjs");
    assert.equal(scripts["smoke:pack:workspaces"], "node scripts/smoke-packed-workspaces.mjs");
    assert.doesNotMatch(scripts.test, /smoke:pack:markup-loop|smoke-packed-markup-loop/);
    assert.doesNotMatch(scripts.test, /smoke:pack:workspaces|smoke-packed-workspaces/);
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

  it("keeps internal workspace packages as development links, not published runtime dependencies", async () => {
    const pkg = await readPackageJson();
    const dependencies = pkg.dependencies as Record<string, string> | undefined;
    const devDependencies = pkg.devDependencies as Record<string, string> | undefined;
    const internalPackages = [
      "@mizchi/vlmkit-ai",
      "@mizchi/vlmkit-capture",
      "@mizchi/vlmkit-core",
      "@mizchi/vlmkit-generate",
      "@mizchi/vlmkit-heal",
      "@mizchi/vlmkit-markup",
      "@mizchi/vlmkit-mcp",
      "@mizchi/vlmkit-plan",
    ];

    assert.ok(dependencies, "package.json should define dependencies");
    assert.ok(devDependencies, "package.json should define devDependencies");
    for (const name of internalPackages) {
      assert.equal(dependencies[name], undefined, `${name} must be bundled into the CLI`);
      assert.equal(devDependencies[name], "workspace:*", `${name} must remain available to source-level development`);
    }
  });

  it("keeps TypeScript external when the bundled CLI loads vlmkit-generate", async () => {
    const pkg = await readPackageJson();
    const dependencies = pkg.dependencies as Record<string, string> | undefined;
    const tsdownConfig = await readFile(resolve(repoRoot, "tsdown.config.ts"), "utf-8");

    assert.match(
      dependencies?.typescript ?? "",
      /^\^?\d+\.\d+\.\d+/,
      "the root CLI must install the TypeScript runtime used by bundled vlmkit-generate",
    );
    assert.match(
      tsdownConfig,
      /neverBundle:\s*\[\s*["']typescript["']\s*\]/,
      "TypeScript is CommonJS and must stay external to the root ESM bundle",
    );
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

  it("publishes runnable JavaScript for every public workspace package", async () => {
    const manifests = await readWorkspacePackageManifests();

    for (const { pkg } of manifests) {
      if (pkg.private === true) continue;

      const name = pkg.name as string;
      const scripts = pkg.scripts as Record<string, string> | undefined;
      const engines = pkg.engines as Record<string, string> | undefined;
      const publishConfig = pkg.publishConfig as Record<string, string> | undefined;
      const files = pkg.files as string[] | undefined;
      const exports = pkg.exports as Record<string, unknown> | undefined;
      const bin = pkg.bin as Record<string, string> | undefined;

      assert.match(scripts?.build ?? "", /\btsdown\b/, `${name} should build JavaScript with tsdown`);
      assert.equal(scripts?.prepack, "pnpm build", `${name} should build before packing`);
      assert.deepEqual(engines, { node: ">=24" }, `${name} should declare its Node runtime`);
      assert.deepEqual(publishConfig, { access: "public" }, `${name} should publish publicly`);
      assert.ok(files?.some((file) => file === "dist" || file.startsWith("dist/")), `${name} should publish dist`);
      assert.ok(!files?.some((file) => file.startsWith("src/")), `${name} should not publish raw TypeScript sources`);
      assert.ok(exports, `${name} should declare exports`);

      for (const [subpath, target] of Object.entries(exports!)) {
        assert.equal(typeof target, "object", `${name} ${subpath} should use conditional exports`);
        const conditions = target as Record<string, string>;
        assert.match(conditions.types ?? "", /^\.\/dist\/.*\.d\.mts$/, `${name} ${subpath} should export declarations`);
        assert.match(conditions.import ?? "", /^\.\/dist\/.*\.mjs$/, `${name} ${subpath} should export JavaScript`);
      }

      for (const [command, target] of Object.entries(bin ?? {})) {
        assert.match(target, /^\.\/dist\/.*\.mjs$/, `${name} bin ${command} should execute built JavaScript`);
      }
    }
  });
});
