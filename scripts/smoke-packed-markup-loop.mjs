#!/usr/bin/env node
/**
 * Packages only the root CLI tarball, then installs it into a clean consumer.
 * Internal workspace packages must be bundled into the CLI, not installed here.
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

async function readInstalledDistFiles(directory, prefix = "") {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = join(prefix, entry.name);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [nestedPath, contents] of await readInstalledDistFiles(path, relativePath)) {
        files.set(nestedPath, contents);
      }
    } else if (entry.isFile()) {
      files.set(relativePath, await readFile(path, "utf8"));
    }
  }
  return files;
}

function findInternalImportSpecifiers(source) {
  const specifiers = new Set();
  const dynamicImport = /\bimport\s*\(\s*["'](@mizchi\/vlmkit-[^"']+)["']\s*\)/g;
  const staticImport = /\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["'](@mizchi\/vlmkit-[^"']+)["']/g;
  for (const pattern of [dynamicImport, staticImport]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

async function assertBundledMarkupLoopChunks(installed) {
  const installedDist = join(installed, "dist");
  const distFiles = await readInstalledDistFiles(installedDist);
  const internalImports = [];
  for (const [path, contents] of distFiles) {
    for (const specifier of findInternalImportSpecifiers(contents)) internalImports.push(`${path}: ${specifier}`);
  }
  if (internalImports.length > 0) {
    fail(`installed dist retains internal import specifiers:\n${internalImports.join("\n")}`);
  }

  const markupLoopEntry = [...distFiles].find(([, contents]) => contents.includes("runMarkupLoop"));
  if (!markupLoopEntry) fail("installed dist does not contain the markup-loop command chunk");
  const [markupLoopPath, markupLoopSource] = markupLoopEntry;
  const chunks = [
    ["plan", "runPlanCli", /runPlanCli\s*}\s*=\s*await import\(["'](\.[^"']+)["']\)/],
    ["generate", "runGenerateCli", /runGenerateCli\s*}\s*=\s*await import\(["'](\.[^"']+)["']\)/],
  ].map(([name, exportName, pattern]) => {
    const match = markupLoopSource.match(pattern);
    if (!match) fail(`installed markup-loop chunk does not load bundled ${name} implementation`);
    const path = join(dirname(markupLoopPath), match[1]);
    if (!distFiles.has(path)) fail(`installed markup-loop ${name} chunk is missing: ${path}`);
    return { name, exportName, path };
  });

  for (const { name, exportName, path } of chunks) {
    const source = distFiles.get(path);
    if (!new RegExp(`\\bexport\\s*\\{[^}]*\\b${exportName}\\b`).test(source)) {
      fail(`installed markup-loop ${name} chunk does not export ${exportName}`);
    }
  }
  console.log("==> installed dist contains bundled plan/generate chunks and no internal package imports");
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
    console.log(`==> packing ${rootManifest.name}`);
    run("pnpm", ["pack", "--pack-destination", tarballsDir]);
    const tarballs = (await readdir(tarballsDir)).filter((file) => file.endsWith(".tgz"));
    if (tarballs.length !== 1) fail(`expected one root tarball, found ${tarballs.join(", ") || "none"}`);
    const tarball = join(tarballsDir, tarballs[0]);

    const packedManifest = readPackedManifest(tarball);
    if (packedManifest.name !== rootManifest.name) fail(`tarball has unexpected package name ${packedManifest.name}`);
    for (const section of internalDependencySections) {
      for (const name of Object.keys(packedManifest[section] ?? {})) {
        if (name.startsWith("@mizchi/vlmkit-")) {
          fail(`${packedManifest.name} retains internal runtime dependency ${name} in ${section}`);
        }
      }
    }

    const rootTarballReference = `file:${relative(consumerDir, tarball)}`;
    await writeFile(join(consumerDir, "package.json"), `${JSON.stringify({
      name: "vlmkit-packed-markup-loop-consumer",
      private: true,
      type: "module",
      dependencies: { [rootManifest.name]: rootTarballReference },
    }, null, 2)}\n`);
    await writeFile(join(consumerDir, "playwright.config.ts"), "export default {};\n");
    await writeFile(join(consumerDir, "fixture.html"), "<style>@media (min-width: 640px) { body { color: red; } }</style>\n");
    await writeFile(join(consumerDir, "before.html"), "<style>button { color: red; }</style><button>Save</button>\n");
    await writeFile(join(consumerDir, "after.html"), "<style>button { color: blue; }</style><button>Save</button>\n");

    console.log("==> installing root tarball in isolated consumer");
    run("pnpm", ["install", "--ignore-scripts"], { cwd: consumerDir });
    const lockfile = await readFile(join(consumerDir, "pnpm-lock.yaml"), "utf8");
    if (!lockfile.includes(rootTarballReference)) fail(`lockfile does not resolve root package from ${rootTarballReference}`);
    const installed = await realpath(join(consumerDir, "node_modules", ...rootManifest.name.split("/")));
    if (!installed.includes(".pnpm") || !installed.includes("file+")) {
      fail(`${rootManifest.name} did not resolve from the root tarball (${installed})`);
    }
    await assertBundledMarkupLoopChunks(installed);

    const bin = join(consumerDir, "node_modules", ".bin", "vlmkit");
    const version = run(bin, ["--version"], { cwd: consumerDir });
    assertOutput(version, rootManifest.version, "vlmkit --version");

    const compare = run(bin, ["diff", "html", "before.html", "after.html", "--output", "diff-output"], { cwd: consumerDir });
    assertOutput(compare, "after", "bundled diff html");

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

    const scan = run(bin, ["scan", "breakpoints", "fixture.html"], { cwd: consumerDir });
    assertOutput(scan, "Breakpoint Discovery", "bundled scan breakpoints");
    assertOutput(scan, "640px", "bundled scan breakpoints");
    console.log("==> packed markup-loop smoke passed");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
