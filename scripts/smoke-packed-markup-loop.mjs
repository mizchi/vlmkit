#!/usr/bin/env node
/**
 * Packages the CLI and its internal runtime packages, then installs those
 * tarballs into a clean consumer. This intentionally avoids registry lookups
 * for the @mizchi/vlmkit namespace.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { access, mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootManifest = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
const packageDirectories = [
  ".",
  "packages/vlmkit-ai",
  "packages/vlmkit-capture",
  "packages/vlmkit-core",
  "packages/vlmkit-generate",
  "packages/vlmkit-heal",
  "packages/vlmkit-markup",
  "packages/vlmkit-mcp",
  "packages/vlmkit-plan",
];
const internalDependencySections = ["dependencies", "optionalDependencies", "peerDependencies"];

function fail(message) {
  throw new Error(`packed markup-loop smoke: ${message}`);
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
    if (stderr.includes("ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING")) {
      fail("installed packages execute TypeScript from node_modules, which Node 24 refuses to strip; publish JavaScript internal packages or bundle them before treating the root CLI as installable (follow-up: https://github.com/mizchi/vlmkit/issues/96)");
    }
    throw error;
  }
}

function readPackedManifest(tarball) {
  const tar = gunzipSync(readFileSync(tarball));
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!name) break;
    const rawSize = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(rawSize || "0", 8);
    if (!Number.isFinite(size)) fail(`cannot read tar header in ${tarball}`);
    const bodyStart = offset + 512;
    if (name === "package/package.json") {
      return JSON.parse(tar.subarray(bodyStart, bodyStart + size).toString("utf8"));
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  fail(`does not contain package/package.json: ${tarball}`);
}

function assertOutput(output, expected, label) {
  if (!output.includes(expected)) fail(`${label} did not print ${JSON.stringify(expected)}\n${output}`);
}

async function assertFile(path) {
  try {
    await access(path);
  } catch {
    fail(`expected generated file is missing: ${path}`);
  }
}

async function assertMissing(path) {
  if (existsSync(path)) fail(`dry run unexpectedly wrote ${path}`);
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), "vlmkit-packed-markup-loop-"));
  const tarballsDir = join(tempRoot, "tarballs");
  const consumerDir = join(tempRoot, "consumer");

  try {
    await mkdir(tarballsDir);
    await mkdir(consumerDir);

    console.log("==> building root package");
    run("pnpm", ["build"]);

    const packed = new Map();
    for (const directory of packageDirectories) {
      const packageDir = resolve(repoRoot, directory);
      const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
      const before = new Set(await readdir(tarballsDir));
      console.log(`==> packing ${manifest.name}`);
      run("pnpm", ["pack", "--pack-destination", tarballsDir], { cwd: packageDir });
      const created = (await readdir(tarballsDir)).filter((file) => file.endsWith(".tgz") && !before.has(file));
      if (created.length !== 1) fail(`expected one tarball for ${manifest.name}, found ${created.join(", ") || "none"}`);
      const tarball = join(tarballsDir, created[0]);
      const packedManifest = readPackedManifest(tarball);
      if (packedManifest.name !== manifest.name) fail(`tarball ${created[0]} has unexpected package name ${packedManifest.name}`);
      for (const section of internalDependencySections) {
        for (const [name, version] of Object.entries(packedManifest[section] ?? {})) {
          if (name.startsWith("@mizchi/vlmkit-") && String(version).startsWith("workspace:")) {
            fail(`${packedManifest.name} retains workspace protocol for ${name}`);
          }
        }
      }
      packed.set(manifest.name, tarball);
    }

    const localDependencies = Object.fromEntries(
      [...packed.entries()].map(([name, tarball]) => [name, `file:${relative(consumerDir, tarball)}`]),
    );
    await writeFile(join(consumerDir, "package.json"), `${JSON.stringify({
      name: "vlmkit-packed-markup-loop-consumer",
      private: true,
      type: "module",
      dependencies: localDependencies,
      pnpm: { overrides: localDependencies },
    }, null, 2)}\n`);
    await writeFile(join(consumerDir, "playwright.config.ts"), "export default {};\n");

    console.log("==> installing tarballs in isolated consumer");
    run("pnpm", ["install", "--ignore-scripts"], { cwd: consumerDir });
    const lockfile = await readFile(join(consumerDir, "pnpm-lock.yaml"), "utf8");
    for (const [name, tarball] of packed) {
      const localReference = `file:${relative(consumerDir, tarball)}`;
      if (!lockfile.includes(localReference)) fail(`lockfile does not resolve ${name} from ${localReference}`);
      const installed = await realpath(join(consumerDir, "node_modules", ...name.split("/")));
      if (!installed.includes(".pnpm") || !installed.includes("file+")) {
        fail(`${name} did not resolve from a local tarball (${installed})`);
      }
    }

    const bin = join(consumerDir, "node_modules", ".bin", "vlmkit");
    const version = run(bin, ["--version"], { cwd: consumerDir });
    assertOutput(version, rootManifest.version, "vlmkit --version");

    run(bin, ["markup-loop", "init", "--topic", "checkout", "--title", "Checkout Smoke", "--base-url", "http://127.0.0.1:4173", "--provider", "openrouter", "--playwright-config", "playwright.config.ts"], { cwd: consumerDir });
    for (const path of [
      ".vlmkit/markup-loop.json",
      ".vlmkit/markup-loop/AGENT.md",
      ".vlmkit/markup-loop/request.md",
      ".vlmkit/markup-loop/observations.json",
      ".vlmkit/markup-loop/_generation-rules.md",
      "tests/vlmkit/support/goto-app.ts",
    ]) await assertFile(join(consumerDir, path));

    const config = JSON.parse(await readFile(join(consumerDir, ".vlmkit/markup-loop.json"), "utf8"));
    if (config.title !== "Checkout Smoke") fail("init did not preserve the configured title");
    if (config.baseUrl !== "http://127.0.0.1:4173") fail("init did not preserve the configured base URL");
    if (config.provider !== "openrouter") fail("init did not preserve the configured provider");
    if (config.generatedTestFile !== "tests/vlmkit/checkout.spec.ts") fail("init generated an unexpected test path");
    if (config.helperImport !== "./support/goto-app") fail("init generated an unexpected helper import");
    if (config.runtimeGateRuns !== 2) fail("init generated an unexpected runtime gate count");

    const doctor = run(bin, ["markup-loop", "doctor"], { cwd: consumerDir });
    assertOutput(doctor, "Markup loop is configured.", "markup-loop doctor");
    assertOutput(doctor, "vlmkit-plan", "markup-loop doctor");
    assertOutput(doctor, "vlmkit-generate", "markup-loop doctor");

    const dryRunEnvironment = { ...process.env };
    delete dryRunEnvironment.OPENROUTER_API_KEY;
    delete dryRunEnvironment.ANTHROPIC_API_KEY;
    delete dryRunEnvironment.GEMINI_API_KEY;
    const dryRun = run(bin, ["markup-loop", "run", "--dry-run"], { cwd: consumerDir, env: dryRunEnvironment });
    assertOutput(dryRun, "vlmkit-plan", "markup-loop run --dry-run");
    assertOutput(dryRun, "vlmkit-generate", "markup-loop run --dry-run");
    await assertMissing(join(consumerDir, ".vlmkit/markup-loop/plan.md"));
    await assertMissing(join(consumerDir, ".vlmkit/markup-loop/plan.json"));
    await assertMissing(join(consumerDir, "tests/vlmkit/checkout.spec.ts"));

    run("node", ["--input-type=module", "--eval", "await Promise.all([import('@mizchi/vlmkit-plan/cli'), import('@mizchi/vlmkit-generate/cli'), import('@mizchi/vlmkit-heal')]);"], { cwd: consumerDir });
    console.log("==> packed markup-loop smoke passed");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
