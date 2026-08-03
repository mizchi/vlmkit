/**
 * No command may tell the reader to run `vrt`.
 *
 * There is no `vrt` binary — `package.json` ships `bin: { vlmkit }` only — so
 * every `vrt <something>` in help text, a usage line or a fix instruction was an
 * instruction the reader could not paste. `vrt a11y-contrast` was wrong twice
 * over: dead binary AND a deprecated subcommand name.
 *
 * This test also pins the *exceptions*, which is the more useful half. A sweep
 * of the whole tree found ~1670 occurrences of `vrt`, and they are not one
 * thing:
 *
 *   renamed here          `vrt <cmd>` in help/usage/comments -> `vlmkit <cmd>`
 *   NOT renamed           `.vrt/`, `.vrt-skills/`, `vrt.config.json`, `VRT_*`
 *                         — live paths, filenames and env vars; renaming them
 *                         orphans existing baselines, configs and CI
 *   NOT renamed           `src/vrt/` — a real source directory
 *   NOT renamed           `.claude/skills/vrt-*` — real skill directory names
 *   NOT renamed           `"X-Title": "vrt"`, `projectName: "vrt"`, the plan
 *                         schema's `vrt?:` field, `title: "vrt HTTP API"` —
 *                         values on the wire, in snapshot paths, in user files
 *   NOT renamed           docs/reports/*, CHANGELOG.md, docs/migration-0.5.md
 *                         — dated records and the old->new mapping itself
 *
 * So the allowlist below is not slack in the test; it is the boundary between a
 * naming fix and a breaking change.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname!, "..", "..");
// The real entry: `cli.ts` prints help but the deprecation shims that route
// an alias to its leaf live in `vlmkit.ts`, so pointing at cli.ts made the
// alias case return empty output and "pass" for the wrong reason.
const ENTRY = resolve(ROOT, "src", "cli", "vlmkit.ts");

/** Every top-level command the CLI advertises as current (not a deprecated alias). */
const COMMANDS = [
  "diff", "check", "inspect", "stress", "scan", "build", "contract", "heal", "verify",
  "snapshot", "migration", "workflow", "bench", "report", "skill", "markup-loop",
  "api", "mcp", "batch", "gates", "manifest", "watch", "diff-pr", "baseline",
];

/**
 * `vrt` spellings that name something real and must survive. Each is a live
 * value, not prose — see the header for why renaming them is a separate,
 * breaking change.
 */
const ALLOWED = [
  ".vrt-skills",      // state directory `vlmkit skill` reads
  ".vrt/",            // state directory (baselines, runs, last-diff-for-agent)
  "vrt.config.json",  // default config filename `diff-pr` / `baseline` resolve
  "vrt.config.toml",
  "VRT_",             // environment variables
];

const strip = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

function help(args: string[]): string {
  try {
    return strip(execFileSync(process.execPath, ["--experimental-strip-types", ENTRY, ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } }));
  } catch (e) {
    // Several groups exit non-zero when given no leaf; the text is what matters.
    const err = e as { stdout?: string; stderr?: string };
    return strip((err.stdout ?? "") + (err.stderr ?? ""));
  }
}

/** Offending `vrt …` mentions, with the allowlisted spellings removed first. */
function offenders(text: string): string[] {
  let t = text;
  for (const a of ALLOWED) t = t.split(a).join("«ok»");
  return [...t.matchAll(/vrt[\s-][\w-]*/g)].map((m) => m[0].trim());
}

describe("no command tells the reader to run `vrt`", () => {
  it("package.json ships only the vlmkit binary — the premise of this test", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as { bin: Record<string, string> };
    assert.deepEqual(Object.keys(pkg.bin), ["vlmkit"]);
  });

  it("root --help is clean", () => {
    assert.deepEqual(offenders(help(["--help"])), []);
  });

  for (const cmd of COMMANDS) {
    it(`\`vlmkit ${cmd} --help\` is clean`, () => {
      const found = offenders(help([cmd, "--help"]));
      assert.deepEqual(found, [], `${cmd} --help still says: ${found.join(", ")}`);
    });
  }

  it("a deprecated alias still routes, and lands on help naming the CURRENT command", () => {
    // The alias is kept on purpose (removed in 1.0.0). What was broken is that
    // the help it delegates to described itself by the dead name.
    const text = help(["png-diff", "--help"]);
    assert.match(text, /vlmkit diff png/);
    assert.deepEqual(offenders(text), []);
  });
});

describe("the allowlist is real, not slack", () => {
  it("each allowlisted spelling is actually present in the source", () => {
    // If one of these stops existing, the exception should be deleted rather
    // than left as a hole the next sweep can drive through.
    const src = execFileSync("git", ["grep", "-rhoE", ALLOWED.map((a) =>
      a.replace(/[.]/g, "\\.")).join("|"), "--", "*.ts"], { cwd: ROOT, encoding: "utf8" });
    for (const a of ALLOWED) {
      assert.ok(src.includes(a), `${a} is allowlisted but no longer appears in the source — drop it`);
    }
  });
});

describe("a rename never leaves a definition and its reference disagreeing", () => {
  it("every GitHub Actions step id referenced by `steps.<id>` is defined", () => {
    // Caught during this rename: `- id: vrt` was renamed to `- id: vlmkit`
    // while the `if: steps.vrt.outcome == 'failure'` that consumes it was NOT,
    // because `steps.vrt.outcome` has `vrt` followed by a dot and did not match
    // the sweep's pattern. The template still parsed — the review step just
    // silently never ran.
    const files = execFileSync("git", ["ls-files", "*.yml", "*.yaml"], { cwd: ROOT, encoding: "utf8" })
      .split("\n").filter(Boolean);
    const problems: string[] = [];
    for (const f of files) {
      const text = readFileSync(resolve(ROOT, f), "utf8");
      const defined = new Set([...text.matchAll(/^\s*-?\s*id:\s*([\w-]+)/gm)].map((m) => m[1]!));
      for (const m of text.matchAll(/steps\.([\w-]+)\./g)) {
        if (!defined.has(m[1]!)) problems.push(`${f}: steps.${m[1]} is referenced but no step declares that id`);
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });
});

describe("the rename did not invert text that is about the old name", () => {
  /**
   * Fourth instance of the same failure in one day, and the first three were
   * only caught by reading the diff. A sweep that replaces `vrt` with `vlmkit`
   * corrupts any sentence whose subject IS the old name, and the corruption is
   * invisible to tsc and to every other test:
   *
   *   "There is no `vrt` binary"        -> "There is no `vlmkit` binary"
   *   "~1670 occurrences of `vrt`"      -> "~1670 occurrences of `vlmkit`"
   *   "no word boundary before `vrt`"   -> "… before `vlmkit`"
   *
   * Each reads as confident documentation and says the opposite of the truth.
   * This is a cheap, general detector: the shipped binary exists, so no file may
   * claim it does not.
   */
  it("no file claims the shipped binary does not exist", () => {
    const files = execFileSync("git", ["ls-files", "*.ts", "*.md"], { cwd: ROOT, encoding: "utf8" })
      .split("\n").filter(Boolean);
    const claims: string[] = [];
    for (const f of files) {
      const text = readFileSync(resolve(ROOT, f), "utf8");
      text.split("\n").forEach((line, i) => {
        if (!/\bno\s+`?vlmkit`?\s+binary\b/i.test(line)) return;
        // An old -> new illustration is not a claim. Narrowly defined: a line
        // that shows a quoted before AND a quoted after, separated by an arrow —
        // the shape the comment above uses. Excluding every line with an arrow
        // would repeat the mistake this whole gate is about.
        if (/".*`vrt`.*"\s*(?:->|→)\s*".*`vlmkit`.*"/.test(line)) return;
        claims.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    assert.deepEqual(claims, [], claims.join("\n"));
  });

  it("this file still quotes the old name it exists to talk about", () => {
    // If a future sweep erases `vrt` from here, the header stops explaining why
    // the allowlist exists and the exceptions look arbitrary.
    const self = readFileSync(resolve(ROOT, "src", "cli", "binary-name.test.ts"), "utf8");
    assert.match(self, /There is no `vrt` binary/);
    assert.match(self, /`vrt a11y-contrast` was wrong twice over/);
  });
});
