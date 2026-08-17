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
 *   NOT renamed           `.vrt-skills/` — the current skill store name
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
 *
 * ## What this test could not see, and what now covers it
 *
 * It greps the CLI's own **help output**, which is the right place for help text and blind
 * to everything else. A later sweep found three more categories that had rotted for
 * releases, none of them reachable from `--help`:
 *
 *   `scripts/smoke-all-clis.sh`  0 of 22 — every command used the flat pre-0.6 spelling
 *   `Test.pkl`                   22 tests spawning `src/cli/vrt.ts`, a file that is gone
 *   `Spec.pkl`                   20 `Implementation.at` paths under `packages/vrt-*`
 *
 * `src/cli/smoke-commands.test.ts` covers the first two by asking the CLI whether each
 * command in those harnesses routes. The third is covered by
 * `spec-implementation-paths.test.ts`, which resolves every declared path.
 *
 * Two further categories were found and deliberately LEFT, both because they name real
 * things rather than the tool:
 *
 *   `window.__vrtActions`, `data-vrt-action`  the `inspect explore` page contract — user
 *                                            markup sets these, so renaming breaks pages
 *   `flaker.vrt.json`, `vrt-bench`/`vrt-migration`  adapter and config names owned by
 *                                            metric-ci, outside this repo
 *
 * And one that is data: `fixtures/google-search/*.a11y.json` records a page titled
 * "vrt testing - Google Search", and `fixtures/css-challenge/page.html` renders `just
 * vrt-test` inside a `<code>` block that a11y baselines have captured. Editing either
 * rewrites recorded measurements.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname!, "..", "..");
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
      const text = help([cmd, "--help"]);
      assert.match(
        text,
        /Subcommands:|Commands:|Options:|Usage:|vlmkit \w+ </,
        `${cmd} --help must describe its own usage`,
      );
      const found = offenders(text);
      assert.deepEqual(found, [], `${cmd} --help still says: ${found.join(", ")}`);
    });
  }

  it("removed aliases no longer route", () => {
    const text = help(["png-diff", "--help"]);
    assert.match(text, /Unknown command/);
    assert.doesNotMatch(text, /deprecated/);
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
      const path = resolve(ROOT, f);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8");
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
  it("no file claims the shipped binary does not exist — in English or Japanese", () => {
    const files = execFileSync("git", ["ls-files", "*.ts", "*.md"], { cwd: ROOT, encoding: "utf8" })
      .split("\n").filter(Boolean);
    const claims: string[] = [];
    for (const f of files) {
      const path = resolve(ROOT, f);
      // `git ls-files` keeps an unstaged deletion in the index. Renames are a
      // normal state while this test runs locally, so inspect only paths that
      // still exist in the worktree; CI sees the committed destination.
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8");
      text.split("\n").forEach((line, i) => {
        // English and Japanese. The English-only version let a FIFTH instance through, in the
        // very TODO entry that documents this failure: it claimed the `vlmkit` binary does not
        // exist where it meant `vrt`, in Japanese, one line below saying `bin` is `vlmkit`.
        // This repo's notes are bilingual, so a guard that reads one language guards half the
        // prose.
        const claimsMissing = /\bno\s+`?vlmkit`?\s+binary\b/i.test(line)
          || /`?vlmkit`?\s*(バイナリ|コマンド)\s*(は|が)\s*(存在しない|存在せず|無い|ない)/.test(line);
        if (!claimsMissing) return;
        // An old -> new illustration is not a claim. Narrowly defined: a line
        // that shows a quoted before AND a quoted after, separated by an arrow —
        // the shape the comment above uses. Excluding every line with an arrow
        // would repeat the mistake this whole gate is about.
        if (/".*`vrt`.*"\s*(?:->|→)\s*".*`vlmkit`.*"/.test(line)) return;
        // Nor is a line that names `vrt` as the thing which does not exist. That line is
        // DISCUSSING the old name — quoting the corrupted phrase next to the correction is how
        // the repair gets recorded — and it cannot be the claim this gate is for, because it
        // says which binary is missing and gets it right. Narrow on purpose: the exemption
        // needs the old name present on the SAME line, so a bare inverted sentence still fails.
        if (/`vrt`/.test(line)) return;
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

describe("workflows that run a src/ entrypoint build the packages first", () => {
  it("no job invokes src/ without pnpm build:packages", () => {
    // 0.8.1 made the workspace packages publish compiled JS, so their `exports`
    // map deep imports to `./dist/*` and `node src/cli/vlmkit.ts` cannot resolve
    // `@mizchi/vlmkit-core/cli-error.ts` until the packages are built. Four
    // workflows were never updated, and the failure is a bare
    // ERR_MODULE_NOT_FOUND that says nothing about a missing build step.
    // Reproduced on a clean `origin/main` checkout, so this is not branch-local.
    //
    // `pnpm test` counts as satisfying it — `pretest` runs build:packages.
    const files = execFileSync("git", ["ls-files", ".github/workflows/*.yml"], { cwd: ROOT, encoding: "utf8" })
      .split("\n").filter(Boolean);
    const missing: string[] = [];
    for (const f of files) {
      const path = resolve(ROOT, f);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8");
      for (const job of text.split(/^ {2}(?=[\w-]+:$)/m)) {
        const name = /^([\w-]+):/.exec(job)?.[1] ?? "?";
        const runsSrc = /node (?:--experimental-strip-types )?src\//.test(job);
        // `build:packages:js` counts: it emits the same dist, skipping only the
        // MoonBit step, which is loaded at runtime rather than needed to build.
        const builds = /build:packages(:js)?|pnpm test\b/.test(job);
        if (runsSrc && !builds) missing.push(`${f}:${name}`);
      }
    }
    assert.deepEqual(missing, [], `these jobs will fail with ERR_MODULE_NOT_FOUND: ${missing.join(", ")}`);
  });
});
