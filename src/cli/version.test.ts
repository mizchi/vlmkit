import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One version, three places that state it.
 *
 * `vlmkit --version` and the MCP server's handshake both hardcode a string that
 * duplicates the root `package.json`, and the nine workspace packages carry their own.
 * A release bumps `package.json` and it is entirely possible to leave the other two
 * behind — at which point the CLI reports a version it is not, which is the worst kind
 * of wrong answer because nothing else contradicts it.
 *
 * Reading `package.json` at runtime would be better than a test, but the CLI ships as a
 * bundled `dist/vlmkit.mjs` whose path to the manifest differs from source, so the
 * import is not free. This is the cheap version of that fix.
 */

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(REPO_ROOT, rel), "utf8");
const rootVersion = JSON.parse(read("package.json")).version as string;

describe("the declared version", () => {
  it("looks like a version at all", () => {
    assert.match(rootVersion, /^\d+\.\d+\.\d+(-[\w.]+)?$/, `root package.json version: ${rootVersion}`);
  });

  it("is what `vlmkit --version` reports", () => {
    // Matched against source rather than by spawning: `cli.version(...)` is the string
    // cac prints, and spawning would only tell us the same thing more slowly.
    const cli = read("src/cli/cli.ts");
    const declared = cli.match(/cli\.version\("([^"]+)"\)/)?.[1];
    assert.ok(declared, "`cli.version(\"…\")` is gone — this test needs updating with it");
    assert.equal(declared, rootVersion, "`vlmkit --version` disagrees with package.json");
  });

  it("is what the MCP server tells a client during the handshake", () => {
    const server = read("packages/vlmkit-mcp/src/server.ts");
    const declared = server.match(/name:\s*"vlmkit",\s*version:\s*"([^"]+)"/)?.[1];
    assert.ok(declared, "the MCP server's version literal moved — update this test with it");
    assert.equal(declared, rootVersion, "the MCP handshake disagrees with package.json");
  });

  it("is the same across every workspace package", () => {
    // They are published together and cross-depend by `workspace:*`, so a package left
    // behind is a package whose published version pins nothing meaningful.
    const files = execSync("git ls-files 'packages/*/package.json'", { cwd: REPO_ROOT, encoding: "utf8" })
      .trim().split("\n").filter(Boolean);
    assert.ok(files.length >= 8, `only ${files.length} workspace packages found`);
    const mismatched = files
      .map((rel) => [rel, JSON.parse(read(rel)).version as string] as const)
      .filter(([, v]) => v !== rootVersion);
    assert.deepEqual(
      mismatched.map(([rel, v]) => `${rel} is ${v}, root is ${rootVersion}`),
      [],
    );
  });

  it("has a changelog section, and no `## Unreleased` above it", () => {
    // The release step is "rename Unreleased", and forgetting it leaves a version with
    // no notes while the notes sit under a heading that claims to be unreleased.
    const firstHeading = read("CHANGELOG.md").match(/^## .+$/m)?.[0] ?? "(none)";
    assert.match(
      firstHeading,
      new RegExp(`^## ${rootVersion.replace(/\./g, "\\.")} — \\d{4}-\\d{2}-\\d{2}$`),
      `the newest changelog heading is ${JSON.stringify(firstHeading)}; it should be `
      + `\`## ${rootVersion} — YYYY-MM-DD\`. Rename \`## Unreleased\` when stamping a release, `
      + `or add a new \`## Unreleased\` above it when starting the next one.`,
    );
  });
});
