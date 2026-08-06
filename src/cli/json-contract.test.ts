/**
 * `--json` must put nothing but JSON on stdout, and a blocking check must
 * return a blocking exit code.
 *
 * History (kept because it is the reason this file spawns a real process):
 * the 2026-08-02 truncation pass added `--json` to four gates because the
 * console caps its list and the new "… N more (see the report, or --json for
 * all)" notice had to point somewhere real. It shipped broken — the JSON was
 * printed *after* the human block, so `JSON.parse` threw on line 1. The
 * original verification had asserted `report.failures.length` from the run
 * function, which never touches stdout: it proved the data existed and said
 * nothing about whether an agent could read it.
 *
 * Two things changed with the gate plugin migration, and this file moved from
 * `packages/vlmkit-markup/` to here because of the first:
 *
 *   1. These gates are no longer executable modules. `node a11y-contrast.ts`
 *      does nothing now — the measurement code is not a command. The test
 *      spawns the actual CLI, which is what its own docstring always claimed
 *      ("the way the bundled binary does").
 *   2. `--json` is the runner's, not each gate's. The mutual exclusion it
 *      checks is now structurally impossible to get wrong: one code path
 *      decides between prose and JSON for every gate at once. The payload is
 *      the shared envelope, so a gate's own report is nested under `report`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./vlmkit.ts", import.meta.url));

/** More rows than any of these gates prints, so truncation is always in play. */
const PAGE = (() => {
  const rows = Array.from({ length: 12 }, (_, i) => `<p class="low${i}">Low contrast line ${i}</p>`).join("");
  const taps = Array.from({ length: 12 }, (_, i) => `<a class="tap${i}" href="#${i}" aria-label="tap ${i}"></a>`).join("");
  const wide = Array.from({ length: 12 }, (_, i) => `<div class="box${i}"><span>Overflowing label ${i}</span></div>`).join("");
  const css = Array.from({ length: 12 }, (_, i) =>
    `.low${i}{color:#bbb}`
    + `.tap${i}{display:inline-block;width:18px;height:18px;background:#333;margin:2px}`
    + `.box${i}{width:80px;overflow:auto;white-space:nowrap}`).join("");
  const dir = mkdtempSync(join(tmpdir(), "json-contract-"));
  const file = join(dir, "page.html");
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>rows</title><style>body{background:#fff;font:16px sans-serif}${css}</style><body>${rows}${taps}${wide}</body>`);
  return file;
})();

/**
 * Colour codes have to come off before matching. `\bvrt\s` looked right and was
 * vacuous: the header is `\x1b[36mvrt a11y-contrast`, and the escape ends in
 * `m`, a word character — so there is no word boundary before `vrt` and the
 * assertion passed against the very output it was written to reject.
 */
const plain = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

function runGate(command: string[], args: string[]): { stdout: string; stderr: string; status: number | null } {
  const out = mkdtempSync(join(tmpdir(), "json-contract-out-"));
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", CLI, ...command, PAGE, "--output-dir", out, ...args],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } },
  );
  return { stdout: plain(r.stdout ?? ""), stderr: plain(r.stderr ?? ""), status: r.status };
}

const GATES: { label: string; command: string[]; rowsKey: string }[] = [
  { label: "check a11y contrast", command: ["check", "a11y", "contrast"], rowsKey: "failures" },
  { label: "check a11y touch", command: ["check", "a11y", "touch"], rowsKey: "failures" },
  { label: "check a11y focus", command: ["check", "a11y", "focus"], rowsKey: "findings" },
  { label: "stress i18n", command: ["stress", "i18n"], rowsKey: "overflowing" },
];

describe("--json puts nothing but JSON on stdout", () => {
  for (const gate of GATES) {
    it(`${gate.label} --json parses as a whole`, () => {
      const { stdout } = runGate(gate.command, ["--json"]);
      // The whole stream, not a scraped tail: an agent pipes this to a parser.
      const parsed = JSON.parse(stdout) as { report: Record<string, unknown> };
      assert.ok(Array.isArray(parsed.report[gate.rowsKey]), `expected report.${gate.rowsKey}[] in the JSON`);
    });

    it(`${gate.label} --json carries the shared envelope`, () => {
      const parsed = JSON.parse(runGate(gate.command, ["--json"]).stdout) as Record<string, unknown>;
      // One shape for every gate is the point of the envelope: a client gates
      // on `verdict` / `counts` without knowing which gate produced them.
      assert.deepEqual(Object.keys(parsed), [
        "gate",
        "command",
        "verdict",
        "counts",
        "findings",
        "suppressed",
        "retuned",
        "report",
      ]);
      assert.equal(parsed.command, gate.label);
      assert.ok(["pass", "fail"].includes(parsed.verdict as string));
    });

    it(`${gate.label} without --json prints the human block`, () => {
      const { stdout } = runGate(gate.command, []);
      assert.match(stdout, /vlmkit/, "expected the human header");
      assert.throws(() => JSON.parse(stdout), "human output is deliberately not JSON");
    });
  }

  it("the JSON carries every row the console truncates", () => {
    // The point of the flag: the notice promises the full list lives here.
    const human = runGate(["check", "a11y", "contrast"], []).stdout;
    const json = runGate(["check", "a11y", "contrast"], ["--json"]).stdout;
    const rows = (JSON.parse(json) as { report: { failures: unknown[] } }).report.failures;
    assert.equal(rows.length, 12);
    const shown = human.split("\n").filter((l) => /\d+\.\d+:1/.test(l)).length;
    assert.ok(shown < rows.length, "this fixture is meant to exceed the console cap");
    assert.match(human, /… \d+ more \(see the report, or --json for all\)/);
  });

  it("stress i18n discloses its cut too", () => {
    // It was the one gate the truncation pass gave `--json` but not the notice,
    // so a seventh issue still vanished silently.
    const { stdout } = runGate(["stress", "i18n"], []);
    const json = runGate(["stress", "i18n"], ["--json"]).stdout;
    const rows = (JSON.parse(json) as { report: { overflowing: unknown[] } }).report.overflowing;
    if (rows.length > 6) assert.match(stdout, /… \d+ more \(see the report, or --json for all\)/);
    else assert.ok(rows.length > 0, "fixture produced no i18n findings to cap");
  });
});

describe("gate output names a command that exists", () => {
  for (const gate of GATES) {
    it(`${gate.label} never prints \`vrt\``, () => {
      // There is no `vrt` binary, and the old subcommand names are deprecated:
      // `vrt a11y-contrast` was wrong twice over. A fix instruction the reader
      // cannot paste is worse than none.
      const { stdout, stderr } = runGate(gate.command, []);
      assert.doesNotMatch(stdout + stderr, /vrt[ -]/, "user-facing output still says vrt");
    });
  }
});

describe("blocking checks return a blocking exit code", () => {
  it("check a11y contrast exits non-zero when WCAG AA failures exist", () => {
    const result = runGate(["check", "a11y", "contrast"], ["--json"]);
    const parsed = JSON.parse(result.stdout) as { report: { failures: unknown[] }; verdict: string };
    assert.ok(parsed.report.failures.length > 0, "fixture must contain contrast failures");
    assert.equal(parsed.verdict, "fail");
    assert.equal(result.status, 1);
  });

  it("--advisory keeps the verdict and drops the exit code", () => {
    // The contract `gate-exit.ts` documents, now enforced in one place for
    // every gate rather than in each gate's own main().
    const result = runGate(["check", "a11y", "contrast"], ["--json", "--advisory"]);
    assert.equal((JSON.parse(result.stdout) as { verdict: string }).verdict, "fail");
    assert.equal(result.status, 0);
  });

  it("a rule turned off can take the run green, and says so", () => {
    const result = runGate(["check", "a11y", "contrast"], ["--rule", "check.a11y.contrast/contrast-below-aa=off"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /finding\(s\) suppressed by rule settings/);
  });
});

describe("`vlmkit rules --json` is the machine-readable catalog", () => {
  /** No fixture page and no --output-dir: this asks about the catalog, not a run. */
  function rules(args: string[]): { stdout: string; status: number | null } {
    const r = spawnSync(process.execPath, ["--experimental-strip-types", CLI, "rules", ...args], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { stdout: plain(r.stdout ?? ""), status: r.status };
  }

  it("prints nothing but JSON, with the category glossary alongside the gates", () => {
    // A CI job that wants "fail the build if a gate appears un-triaged" reads
    // this. Scraping the prose listing is not an answer, so the shape is a
    // contract: categories are a map so a consumer can label a bucket without
    // hardcoding the descriptions.
    const { stdout, status } = rules(["--json"]);
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout) as {
      categories: Record<string, string>;
      gates: { id: string; command: string; category: string | null; plugin: string; rules: unknown[] }[];
    };
    assert.deepEqual(Object.keys(parsed.categories), [
      "correctness", "behavior", "design-system", "verdict", "infrastructure",
    ]);
    assert.ok(parsed.gates.length >= 26, `only ${parsed.gates.length} gates in the catalog`);
    for (const gate of parsed.gates) {
      assert.deepEqual(Object.keys(gate), [
        "id", "command", "title", "summary", "category", "plugin", "rules",
      ], `${gate.id} has the wrong keys`);
      // `category` is nullable in the shape — a third-party gate may decline to
      // pick one — but every gate the catalog ships must name a known bucket.
      assert.ok(gate.category && gate.category in parsed.categories, `${gate.id}: ${gate.category}`);
      assert.ok(gate.plugin, `${gate.id} has no plugin`);
      assert.ok(gate.rules.length > 0, `${gate.id} has no rules`);
    }
  });

  it("narrows to one gate, with the same shape", () => {
    const { stdout, status } = rules(["check", "integrity", "--json"]);
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout) as { id: string; command: string; rules: { id: string }[] };
    assert.equal(parsed.id, "check.integrity");
    assert.equal(parsed.command, "check integrity");
    assert.ok(parsed.rules.some((rule) => rule.id === "text-collision"));
  });
});
