import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VLMKIT_VERSION } from "@mizchi/vlmkit-core/version.ts";

/**
 * One version, and the places that have to agree with it.
 *
 * `vlmkit --version` and the MCP server's handshake used to hardcode their own copies of the root
 * `package.json` version, and this test existed to catch a release that bumped one and not the
 * others — the CLI reporting a version it is not is the worst kind of wrong answer, because nothing
 * else contradicts it. The 0.11.0 bump failed here twice, which was the argument for removing the
 * duplication rather than only detecting it: both now read `VLMKIT_VERSION`
 * (`packages/vlmkit-core/src/version.ts`).
 *
 * So the checks below changed shape. Instead of comparing three literals, they assert the two
 * consumers read the constant and carry no literal of their own — a string comparison cannot see a
 * *fourth* copy, but this can. The constant is still a literal, because the CLI ships as a bundled
 * `dist/vlmkit.mjs` whose path to the manifest differs from source; the manifest and CHANGELOG
 * checks are what keep that literal honest.
 */

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(REPO_ROOT, rel), "utf8");
const rootVersion = JSON.parse(read("package.json")).version as string;

describe("the declared version", () => {
  it("looks like a version at all", () => {
    assert.match(rootVersion, /^\d+\.\d+\.\d+(-[\w.]+)?$/, `root package.json version: ${rootVersion}`);
  });

  it("is stated once, in `version.ts`, and matches the manifest", () => {
    assert.equal(VLMKIT_VERSION, rootVersion, "VLMKIT_VERSION disagrees with package.json");
  });

  it("is what `vlmkit --version` and the MCP handshake report, by reading the constant", () => {
    // The two places a build identifies itself to someone else: a `--version` line pasted into a
    // bug report, and the handshake an MCP client logs. Both must resolve to the constant — a
    // re-introduced literal here is a build that lies about which release it is.
    for (const [relative, marker] of [
      ["src/cli/cli.ts", "cli.version(VLMKIT_VERSION)"],
      ["packages/vlmkit-mcp/src/server.ts", "version: VLMKIT_VERSION"],
    ] as const) {
      const source = read(relative);
      assert.ok(source.includes(marker), `${relative} no longer contains \`${marker}\``);
      // Comments carry version numbers legitimately — cli.ts's own docstring says "(0.5.0+)".
      const code = source.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
      const literal = code.match(/["']\d+\.\d+\.\d+(-[\w.]+)?["']/);
      assert.equal(
        literal?.[0],
        undefined,
        `${relative} carries its own version literal (${literal?.[0]}) again — import `
        + "VLMKIT_VERSION from @mizchi/vlmkit-core/version.ts instead",
      );
    }
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
