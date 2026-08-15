/**
 * Everything the REFERENCE docs tell a reader to type must exist: flags, and command verbs.
 *
 * `docs/cli-reference.md` documented `--capture-spec <path>` and a `workflow.captureSpec`
 * config key for `vlmkit workflow init|capture`. Neither has ever existed in any version of the
 * code, and the example beside them named `vrt-capture.spec.ts` — a filename nothing has had
 * since the rename. A reader following that line gets `Unknown workflow option: --capture-spec`,
 * which reads as their mistake.
 *
 * Nothing could have caught it: the CLI cannot know what the docs claim, and the docs are not
 * executed. This test closes exactly that gap, and only that gap.
 *
 * ## Scope, stated because the limits matter more than the check
 *
 * It asserts a flag EXISTS, not that the command shown accepts it. `vlmkit check integrity
 * --variants` would pass here and fail in use. Pairing every documented flag with its command
 * needs a per-command parser, and the flags live in ~15 argv readers plus 78 gate input
 * declarations plus a pkl taskfile — the pairing is the expensive half and the existence check
 * is where the actual defect was.
 *
 * Reference docs only. `docs/design/*`, `docs/*-design.md` and `docs/*-plan.md` describe flags
 * that are PROPOSALS — `--adapter`, `--runner`, `--assert`, `--policy` — and requiring those to
 * exist would forbid writing a design doc before the code. `docs/authoring-gates.md` teaches the
 * contract with a worked example whose gate is hypothetical (`--max-nodes`), so it is out too.
 *
 * Four sources of false positives were measured while writing this, and each one is why the
 * corresponding pattern is in `knownFlags` below:
 *
 *   - `--strict-baseline-sanity` is read as `hasFlag(args, "no-baseline-sanity")` — the source
 *     never writes the dashes.
 *   - `--scenario` is a task parameter in `Taskfile.pkl`, not a flag in any `.ts`.
 *   - gate flags are declared as `{ name: "level", … }` and assembled by the runner.
 *   - `--var` in prose ("forgot a `--var`") is about CSS variables, not a CLI flag — which is
 *     why prose-only docs are excluded rather than parsed more cleverly.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The docs a reader copies commands out of. */
const REFERENCE_DOCS = [
  "README.md",
  "docs/cli-reference.md",
  "docs/configuration.md",
  "docs/markup-assist.md",
];

const FLAG = /--[a-z][a-z0-9-]{2,}/g;

/**
 * Flags the reference docs name in order to say they do NOT exist.
 *
 * One entry, and it is the defect this file was written for: `--capture-spec` is now documented
 * as never having existed, so the sentence explaining that necessarily contains the flag. An
 * allowlist rather than "ignore lines that look like a denial", because a denial is easy to
 * write and hard to pattern-match, and because this list is the audit trail — an entry that
 * later becomes real is one that must be deleted here.
 */
const DOCUMENTED_AS_ABSENT = new Set(["--capture-spec"]);

function documentedFlags() {
  const found = new Map();
  for (const doc of REFERENCE_DOCS) {
    const text = readFileSync(join(repoRoot, doc), "utf8");
    for (const [flag] of text.matchAll(FLAG)) if (!found.has(flag)) found.set(flag, doc);
  }
  return found;
}

/**
 * Every flag name the code could possibly accept, over-collected on purpose.
 *
 * Over-collection is the right bias: a missed pattern here reports a working flag as missing,
 * and a CI failure that is wrong about the codebase gets the test deleted. The cost is that a
 * flag existing only in a comment counts as existing — acceptable, since the defect class is a
 * flag mentioned in NO source file at all.
 */
function knownFlags() {
  const grep = (args) => {
    try {
      return execFileSync("grep", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      // grep exits 1 on no matches, which is not an error for us.
      if (e.status === 1) return "";
      throw e;
    }
  };
  const sources = grep([
    "-rho", "--include=*.ts", "--include=*.mjs", "--include=*.pkl", "--include=*.yml",
    "-e", "--[a-z][a-z0-9-]*",
    // `hasFlag(args, "no-baseline-sanity")`, `readFlag(argv, "level")`, `name = "scenario"`,
    // `{ name: "level" }` — every place a flag name appears without its dashes.
    "-e", 'name: "[a-z][a-z0-9-]*"',
    "-e", 'name = "[a-z][a-z0-9-]*"',
    "-e", '(argv, "[a-z][a-z0-9-]*"',
    "-e", '(args, "[a-z][a-z0-9-]*"',
    "src", "packages", "worker", "e2e", "Taskfile.pkl", "justfile", ".github",
  ]);
  const flags = new Set();
  for (const [flag] of sources.matchAll(FLAG)) flags.add(flag);
  // `\s*` around the separator: pkl writes `name = "scenario"`, TypeScript writes
  // `name: "level"`, and a pattern fitting only one of them reported every pkf task parameter
  // as a nonexistent flag.
  for (const [, name] of sources.matchAll(/name\s*[:=]\s*"([a-z][a-z0-9-]+)"/g)) flags.add(`--${name}`);
  for (const [, name] of sources.matchAll(/\((?:argv|args), "([a-z][a-z0-9-]+)"/g)) flags.add(`--${name}`);
  return flags;
}

/**
 * Command verbs the reference docs name in order to say they are GONE.
 *
 * `docs/cli-reference.md` carries a rename table (`vlmkit serve` -> `vlmkit api serve`), so the
 * old verbs necessarily appear. Same reasoning as `DOCUMENTED_AS_ABSENT`: an allowlist, because
 * a rename table is easier to enumerate than to pattern-match.
 */
const DOCUMENTED_AS_RENAMED = new Set(["serve", "status"]);

/** Code contexts only — fenced blocks and inline spans — with comment lines dropped. */
function documentedCommandVerbs() {
  const found = new Map();
  for (const doc of REFERENCE_DOCS) {
    const text = readFileSync(join(repoRoot, doc), "utf8");
    const chunks = [...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1])
      .concat([...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]));
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        // `# Install vlmkit with APM` is prose that happens to live in a shell block, and
        // "with" is not a verb. Dropping comment lines is cheaper than teaching the regex English.
        if (line.trim().startsWith("#")) continue;
        for (const m of line.matchAll(/(?:^|[\s(|$])(?:npx\s+)?vlmkit\s+([a-z][a-z0-9-]*)/g)) {
          if (!found.has(m[1])) found.set(m[1], doc);
        }
      }
    }
  }
  return found;
}

/**
 * Verbs the dispatcher accepts: the `cli.command(...)` declarations, the legacy `GROUPS` table,
 * and the first token of every registered gate.
 *
 * Three sources because reading fewer has already gone wrong once — `src/cli/cli.ts` says as
 * much: "Reading only one source silently dropped" group verbs from the help output.
 */
async function declaredVerbs() {
  const { loadGateRegistry, resetGateRegistryCache } = await import("../src/cli/gate-registry.ts");
  resetGateRegistryCache();
  const registry = await loadGateRegistry({ builtinsOnly: true });
  const source = readFileSync(join(repoRoot, "src/cli/cli.ts"), "utf8");
  const verbs = new Set(
    [...source.matchAll(/cli\.command\(`?"?\$?\{?([a-z][a-z0-9-]*)/g)]
      .map((m) => m[1])
      // `cli.command(`${groupName} [...args]`)` — the template's own identifier, not a verb.
      .filter((v) => v !== "group"),
  );
  const groups = source.slice(source.indexOf("const GROUPS"));
  for (const m of groups.slice(0, 4000).matchAll(/^\s{2}([a-z][a-z0-9-]*):\s*\{/gm)) verbs.add(m[1]);
  for (const { gate } of registry.list()) verbs.add(gate.command[0]);
  return verbs;
}

/** The comparison, separated so it can be run against a synthetic corpus below. */
function missingFlags(documented, known) {
  return [...documented]
    .filter(([flag]) => !known.has(flag))
    .filter(([flag]) => !DOCUMENTED_AS_ABSENT.has(flag));
}

describe("flags in the reference docs", () => {
  it("all exist in the code", () => {
    const documented = documentedFlags();
    const known = knownFlags();
    // Guards against a silently empty run: a broken regex or a moved doc would otherwise
    // report "every documented flag exists" over nothing at all.
    assert.ok(documented.size > 100, `only ${documented.size} flags found in the reference docs`);
    assert.ok(known.size > 100, `only ${known.size} flags found in the source`);

    const missing = missingFlags(documented, known);
    assert.deepEqual(
      missing.map(([flag, doc]) => `${flag} (${doc})`),
      [],
      "documented in the reference docs, absent from every source file — either implement it or "
      + "delete the line. `--capture-spec` sat in docs/cli-reference.md through a rename it "
      + "predated, and the reader who typed it got `Unknown workflow option`.",
    );
  });

  it("catches a flag that does not exist (this test is not vacuous)", () => {
    // The check above passes by finding nothing, so its own machinery is exercised here on a
    // flag chosen to be absent. Without this, a regex that matches nothing reads as a clean bill.
    const known = knownFlags();
    assert.equal(known.has("--no-such-flag-anywhere"), false);
    assert.equal(known.has("--json"), true, "and a real flag is found");
  });

  it("every documented command verb is one the dispatcher accepts", async () => {
    // The command-level twin of the flag check, and the reason it is worth having even though it
    // currently finds nothing: `tests/workflow-commands.test.mjs` exists because two CI jobs ran
    // `vlmkit compare` and `vlmkit smoke` after both had been renamed — one failed with "Unknown
    // command", the other swallowed the exit code and reported success while running nothing.
    // That test covers `.github/workflows/`. Nothing covered the docs, which is the surface a
    // human copies from.
    const documented = documentedCommandVerbs();
    const declared = await declaredVerbs();
    assert.ok(documented.size > 20, `only ${documented.size} command verbs found in the docs`);
    const unknown = [...documented]
      .filter(([verb]) => !declared.has(verb))
      .filter(([verb]) => !DOCUMENTED_AS_RENAMED.has(verb));
    assert.deepEqual(unknown.map(([verb, doc]) => `vlmkit ${verb} (${doc})`), []);
    // Non-vacuity: the same set must reject a verb that does not exist.
    assert.equal(declared.has("compare"), false, "renamed to `diff html` in 0.9.1");
    assert.equal(declared.has("check"), true);
  });

  it("would have caught the defect it was written for", () => {
    // `--capture-spec` is in DOCUMENTED_AS_ABSENT now, because the doc names it to say it never
    // existed — so the live corpus cannot demonstrate the catch. This runs the same comparison
    // over the doc line as it read BEFORE the fix, where the flag was offered as usable.
    const asItWas = new Map([
      ["--capture-spec", "docs/cli-reference.md"],
      ["--config", "docs/cli-reference.md"],
    ]);
    const known = knownFlags();
    const caught = missingFlags(asItWas, known).map(([flag]) => flag);
    // The allowlist is what keeps it green today, so it is bypassed here rather than trusted.
    assert.equal(known.has("--capture-spec"), false, "still absent from the code");
    assert.deepEqual(caught, [], "with the allowlist entry, the live corpus stays green");
    const withoutAllowlist = [...asItWas].filter(([flag]) => !known.has(flag)).map(([f]) => f);
    assert.deepEqual(withoutAllowlist, ["--capture-spec"], "and without it, the flag is reported");
  });
});
