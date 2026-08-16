#!/usr/bin/env node
/**
 * The built CLI must answer a JSON-boundary command with no MoonBit toolchain present.
 *
 * This is the one environment nothing else tested, and the one every npm consumer of the
 * `vlmkit` CLI is in. The root package ships `dist/**` and nothing else: no `_build`, no
 * `.mbt` sources. So the CLI's only route to MoonBit is the bridge that
 * `scripts/vlmkit-bundled.mjs` imports and hands over on a global — and if that hand-off
 * is incomplete, every fallback the runtime has is also unavailable here. `moon build`
 * needs a toolchain; the spawned `markup-core-cli` needs the `_build` that is not shipped.
 *
 * It shipped broken exactly once, and the shape of the miss is worth keeping in mind:
 *
 *  - `pnpm test` runs from **source**, where the runtime finds the bridge on disk through
 *    `apiPath` and never reads the global. Green.
 *  - `smoke:pack:workspaces` installs the **library** packages, and
 *    `@mizchi/vlmkit-markup` *does* ship `_build/.../markup-core-api.js`. Green.
 *  - The type checker cannot help: the global is assigned in a `.mjs` file to a
 *    `Partial<DirectMarkupCoreModule>`, where a missing field is legal.
 *
 * Every safety net was in a different room. So this one deliberately reproduces the
 * consumer's constraints instead of approximating them: run the built entrypoint with
 * `moon` removed from PATH, and require a gate that goes through the JSON boundary to
 * succeed. With `moon` gone, a silent fallback cannot pretend to work — it fails, which is
 * the point.
 *
 * Assert on a gate rather than on the presence of a symbol, because "the name is exported"
 * is what the unit test already covers and is not the same claim as "the CLI works".
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const CLI = join(REPO_ROOT, "dist", "vlmkit.mjs");
const FIXTURE = join(REPO_ROOT, "fixtures", "css-challenge", "page.html");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(CLI)) fail(`${CLI} is missing — run \`pnpm build\` first`);
if (!existsSync(FIXTURE)) fail(`${FIXTURE} is missing`);

/**
 * PATH with every directory containing a `moon` executable removed.
 *
 * Removing only `~/.moon/bin` would be a guess about where it is installed; this makes the
 * toolchain unreachable wherever it lives, which is the condition being reproduced.
 */
function pathWithoutMoon() {
  const entries = (process.env.PATH ?? "").split(delimiter);
  const kept = entries.filter((entry) => entry && !existsSync(join(entry, "moon")));
  const dropped = entries.length - kept.length;
  console.log(`==> removed ${dropped} PATH entr${dropped === 1 ? "y" : "ies"} containing \`moon\``);
  return kept.join(delimiter);
}

const env = { ...process.env, PATH: pathWithoutMoon(), NO_COLOR: "1" };
// Belt and braces: if `moon` is somehow still reachable, this makes the fallback's build
// fail anyway, so a silent fallback cannot masquerade as success.
env.MOON_HOME = join(REPO_ROOT, "does-not-exist");

// Sanity-check the check: if `moon` is still runnable the run below proves nothing.
try {
  execFileSync("moon", ["version"], { env, stdio: "ignore" });
  fail("`moon` is still reachable after sanitizing PATH — this smoke would pass vacuously");
} catch {
  // Expected: the toolchain is unreachable, so the CLI must succeed without it.
}

/**
 * Two gates, chosen for what they exercise rather than for coverage's sake.
 *
 * `check a11y contrast` (`contrast-evaluate`) is the long-standing case — it is what
 * caught the incomplete hand-off the first time. `check a11y touch` (`touch-policy`) is
 * the NEWEST JSON command, and a newly added one is precisely what an un-rebuilt bridge
 * omits: the older commands keep working, so a single-gate smoke stays green while the
 * command added this release is missing. That is the failure this file exists to catch,
 * and it can only see it if the gate it runs uses a recent command.
 */
const GATES = [
  { argv: ["check", "a11y", "contrast", FIXTURE], command: "contrast-evaluate", expect: /contrast/i },
  { argv: ["check", "a11y", "touch", FIXTURE], command: "touch-policy", expect: /undersized target/i },
];

for (const gate of GATES) {
  console.log(`==> running \`vlmkit ${gate.argv.slice(0, 3).join(" ")}\` (${gate.command}) without MoonBit`);
  let output;
  try {
    output = execFileSync(process.execPath, [CLI, ...gate.argv], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
    });
  } catch (error) {
    const combined = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    // Exit 1 is a legitimate outcome — these gates report real findings on this fixture.
    // What must not appear is the runtime reaching for a toolchain that is not there.
    if (/moon|not in a Moon project|ENOENT|run_markup_core_json|is unavailable/i.test(combined)) {
      fail(
        `the built CLI could not reach markup-core's \`${gate.command}\` over the JSON boundary:\n`
        + `${combined.split("\n").slice(0, 12).join("\n")}\n\n`
        + "scripts/vlmkit-bundled.mjs must hand the runtime the complete generated bridge "
        + "(namespace import), and the bridge must be rebuilt after adding an entry point.",
      );
    }
    output = combined;
  }

  if (!gate.expect.test(output)) {
    fail(`\`${gate.argv.join(" ")}\` produced no matching output:\n${output.slice(0, 600)}`);
  }
}
console.log("==> bundled CLI answered every JSON-boundary command with no MoonBit toolchain");
