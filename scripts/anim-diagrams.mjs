#!/usr/bin/env node
/**
 * Regenerate `docs/diagrams/`: the workspace's own architecture, drawn by
 * `vlmkit-anim repo` from the package.json files. Committed so the README can
 * show it and so a review of a dependency change can look at the picture
 * instead of at eleven manifests. Run after adding a package or a workspace
 * dependency:
 *
 *     pnpm anim:diagrams
 *
 * Change maps of pull requests are not committed here: the `pr-visual`
 * workflow draws them per PR and posts them on the PR.
 */
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "packages", "vlmkit-anim", "src", "cli.ts");
const out = join(repoRoot, "docs", "diagrams");

execFileSync(process.execPath, ["--experimental-strip-types", cli, "repo", "--root", repoRoot, "--out", out, "--name", "vlmkit-architecture", "--title", "vlmkit — the workspace and its dependencies"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, NO_COLOR: "1" },
});
