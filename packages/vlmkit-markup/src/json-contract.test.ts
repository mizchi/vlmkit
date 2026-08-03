/**
 * `--json` must put nothing but JSON on stdout.
 *
 * The 2026-08-02 truncation pass added `--json` to these four gates because the
 * console caps its list and the new "… N more (see the report, or --json for
 * all)" notice had to point somewhere real. It shipped broken: the JSON was
 * printed *after* the human block, so stdout looked like
 *
 *   vlmkit check a11y contrast
 *   html: /tmp/…/page.html
 *   ✗ 1 contrast failure(s)
 *   { "html": …                  <- and JSON.parse throws on line 1
 *
 * Caught by running the built CLI during release prep. The original
 * verification had asserted `report.failures.length` from the run function,
 * which never touches stdout — so it proved the data existed and said nothing
 * about whether an agent could read it. These tests spawn the real CLI.
 *
 * The gates that already had `--json` use `if (json) … else …`; these four now
 * pass `quiet` into the run function to get the same mutual exclusion.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL(".", import.meta.url));

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
 * `m`, a word character — so there is no word boundary before `vlmkit` and the
 * assertion passed against the very output it was written to reject. (`NO_COLOR`
 * is set below and these helpers emit colour anyway, so stripping is the only
 * reliable route.)
 */
const plain = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

/** Run a gate module's CLI entry directly, the way the bundled binary does. */
function runGate(module: string, args: string[]): { stdout: string; stderr: string; status: number | null } {
  const out = mkdtempSync(join(tmpdir(), "json-contract-out-"));
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", join(SRC, module), PAGE, "--output-dir", out, ...args],
    { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } },
  );
  return { stdout: plain(r.stdout ?? ""), stderr: plain(r.stderr ?? ""), status: r.status };
}

const GATES: { label: string; module: string; rowsKey: string }[] = [
  { label: "check a11y contrast", module: "a11y-contrast.ts", rowsKey: "failures" },
  { label: "check a11y touch", module: "a11y-touch.ts", rowsKey: "failures" },
  { label: "check a11y focus", module: "a11y-focus-order.ts", rowsKey: "findings" },
  { label: "stress i18n", module: "stress/i18n-stress.ts", rowsKey: "overflowing" },
];

describe("--json puts nothing but JSON on stdout", () => {
  for (const gate of GATES) {
    it(`${gate.label} --json parses as a whole`, () => {
      const { stdout } = runGate(gate.module, ["--json"]);
      // The whole stream, not a scraped tail: an agent pipes this to a parser.
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      assert.ok(Array.isArray(parsed[gate.rowsKey]), `expected ${gate.rowsKey}[] in the JSON`);
    });

    it(`${gate.label} without --json prints the human block`, () => {
      // `quiet` must be opt-in — the default output is what a person reads.
      const { stdout } = runGate(gate.module, []);
      assert.match(stdout, /vlmkit/, "expected the human header");
      assert.throws(() => JSON.parse(stdout), "human output is deliberately not JSON");
    });
  }

  it("the JSON carries every row the console truncates", () => {
    // The point of the flag: the notice promises the full list lives here.
    const { stdout: human } = runGate("a11y-contrast.ts", []);
    const { stdout: json } = runGate("a11y-contrast.ts", ["--json"]);
    const rows = (JSON.parse(json) as { failures: unknown[] }).failures;
    assert.equal(rows.length, 12);
    const shown = human.split("\n").filter((l) => /\d+\.\d+:1/.test(l)).length;
    assert.ok(shown < rows.length, "this fixture is meant to exceed the console cap");
    assert.match(human, /… \d+ more \(see the report, or --json for all\)/);
  });

  it("stress i18n discloses its cut too", () => {
    // It was the one gate the truncation pass gave `--json` but not the notice,
    // so a seventh issue still vanished silently.
    const { stdout } = runGate("stress/i18n-stress.ts", []);
    const rows = (JSON.parse(runGate("stress/i18n-stress.ts", ["--json"]).stdout) as { overflowing: unknown[] }).overflowing;
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
      const { stdout, stderr } = runGate(gate.module, []);
      assert.doesNotMatch(stdout + stderr, /vrt[ -]/, "user-facing output still says vlmkit");
    });
  }
});
