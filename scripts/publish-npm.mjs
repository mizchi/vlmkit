#!/usr/bin/env node
/**
 * Publishes every public package of the workspace to npm, dependencies first. Run by
 * `.github/workflows/publish.yml` on a `v*` tag, where npm Trusted Publishing (OIDC) supplies
 * the credential — no token is stored anywhere.
 *
 *     node scripts/publish-npm.mjs --dry-run            # pack everything, `npm publish --dry-run`
 *     node scripts/publish-npm.mjs --tag v0.23.0        # what the workflow runs
 *
 * What it refuses, before anything is published:
 * - a tag that is not `v` + the version every package carries, or packages at different versions;
 * - a packed tarball whose package.json still says `workspace:` (pnpm pack rewrites those; npm
 *   publish of a directory would not, which is why each package is packed by pnpm first).
 *
 * A version that is already on the registry is skipped, so a run that failed half way can be run
 * again. The order is computed from the manifests (a package after everything it depends on), so
 * a new package needs no edit here.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tag = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : null;

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** Public packages: every workspace package that is not private, plus the root CLI. */
export function publicPackages(root = repoRoot) {
  const pkgs = readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ dir: join(root, "packages", d.name), manifest: readJson(join(root, "packages", d.name, "package.json")) }))
    .filter((p) => !p.manifest.private);
  pkgs.push({ dir: root, manifest: readJson(join(root, "package.json")) });
  return pkgs;
}

/** Dependencies first. Only `dependencies` and `peerDependencies` order a publish. */
export function publishOrder(pkgs) {
  const byName = new Map(pkgs.map((p) => [p.manifest.name, p]));
  const deps = (p) => Object.keys({ ...p.manifest.dependencies, ...p.manifest.peerDependencies, ...p.manifest.optionalDependencies }).filter((n) => byName.has(n));
  const out = [];
  const state = new Map();
  const visit = (p) => {
    if (state.get(p) === "done") return;
    if (state.get(p) === "visiting") throw new Error(`dependency cycle at ${p.manifest.name}`);
    state.set(p, "visiting");
    for (const n of deps(p)) visit(byName.get(n));
    state.set(p, "done");
    out.push(p);
  };
  // The root last: it is the CLI and nothing depends on it.
  for (const p of [...pkgs].sort((a, b) => (a.dir === repoRoot) - (b.dir === repoRoot) || a.manifest.name.localeCompare(b.manifest.name))) visit(p);
  return out;
}

function run(cmd, argv, cwd) {
  return execFileSync(cmd, argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 << 20 });
}

function onRegistry(name, version) {
  try {
    return run("npm", ["view", `${name}@${version}`, "version"], repoRoot).trim() === version;
  } catch {
    return false; // E404: the package or that version is not there
  }
}

function main() {
  const order = publishOrder(publicPackages());
  const versions = new Set(order.map((p) => p.manifest.version));
  if (versions.size !== 1) throw new Error(`packages are at different versions: ${order.map((p) => `${p.manifest.name}@${p.manifest.version}`).join(", ")}`);
  const [version] = versions;
  if (tag && tag !== `v${version}`) throw new Error(`tag ${tag} does not match the packages' version ${version}`);
  console.log(`publishing ${version}${dryRun ? " (dry run)" : ""}: ${order.map((p) => p.manifest.name).join(" → ")}`);

  const out = mkdtempSync(join(tmpdir(), "vlmkit-publish-"));
  try {
    // Pack everything first: a tarball that would publish a `workspace:` range stops the run
    // before the first package reaches the registry.
    const tarballs = order.map((p) => {
      const file = run("pnpm", ["pack", "--pack-destination", out], p.dir).trim().split("\n").pop().trim();
      const manifest = JSON.parse(run("tar", ["-xOzf", file, "package/package.json"], out));
      const leaked = Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies }).filter(([, v]) => String(v).startsWith("workspace:"));
      if (leaked.length) throw new Error(`${p.manifest.name}: packed package.json still has ${leaked.map(([k, v]) => `${k}@${v}`).join(", ")}`);
      return { name: p.manifest.name, file };
    });
    for (const { name, file } of tarballs) {
      if (!dryRun && onRegistry(name, version)) {
        console.log(`  ${name}@${version} is already on npm — skipped`);
        continue;
      }
      run("npm", ["publish", file, "--access", "public", ...(dryRun ? ["--dry-run"] : [])], repoRoot);
      console.log(`  ${name}@${version} ${dryRun ? "would be published" : "published"}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
