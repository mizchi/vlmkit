import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "vite-plus/test";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { a11yContrastGate } from "./a11y.gate.ts";
import { colorGate } from "./color.gate.ts";
import { compositionGate } from "./composition.gate.ts";
import { designGate } from "./design.gate.ts";
import { integrityGate } from "./integrity.gate.ts";
import { styleScanGate } from "./style-scan.gate.ts";

/**
 * `--color-scheme` on the gates that read paint (issue #217). The fixture follows the OS theme and
 * breaks only in its dark theme: a hint left in its light-theme grey, a footnote whose ink was never
 * changed, a field whose fill and border sit on the page's own dark surface. Each gate must be clean
 * on it as the browser loads it (light), name its defect with `--color-scheme dark`, and say which
 * scheme it judged.
 */
const ROOT = resolve(import.meta.dirname!, "../../../..");
const PAGE = join(ROOT, "fixtures/color-scheme/follows-os.html");
/** What the runner hands a gate; these tests call `parse` / `run` directly. */
const ctx = { cwd: ROOT, argv: [], json: true };
const out = () => mkdtempSync(join(tmpdir(), "vlmkit-scheme-"));

const integrity = (extra: string[]) =>
  integrityGate.run(integrityGate.parse([PAGE, "--viewports", "1280", ...extra], ctx), ctx);
const contrast = (extra: string[]) =>
  a11yContrastGate.run(a11yContrastGate.parse([PAGE, "--output-dir", out(), ...extra], ctx), ctx);
const color = (extra: string[]) => colorGate.run(colorGate.parse([PAGE, ...extra], ctx), ctx);

describe("--color-scheme: a dark theme judged by the gates, not by eye", () => {
  it("check integrity: clean in light, the footnote invisible and the hint low-contrast in dark", async () => {
    const light = await integrity([]);
    assert.equal(light.verdict, "clean");
    assert.equal(light.colorScheme, undefined);
    const dark = await integrity(["--color-scheme", "dark"]);
    assert.equal(dark.colorScheme, "dark");
    const kinds = dark.findings.map((f) => `${f.kind} ${f.selector}`).sort();
    assert.deepEqual(kinds, ["invisible-text p.footnote", "low-contrast-text p.hint"]);
    assert.match(integrityGate.format(dark), /color scheme: dark/);
  }, 120_000);

  it("check a11y contrast: no failure in light, both paragraphs in dark", async () => {
    assert.equal((await contrast([])).failures.length, 0);
    const dark = await contrast(["--color-scheme", "dark"]);
    assert.equal(dark.colorScheme, "dark");
    assert.deepEqual(dark.failures.map((f) => f.path).sort(), ["main>p.footnote", "main>p.hint"]);
  }, 120_000);

  it("check color: the field's boundary is visible in light and lost in dark", async () => {
    assert.deepEqual((await color([])).findings, []);
    const dark = await color(["--color-scheme", "dark"]);
    assert.equal(dark.colorScheme, "dark");
    assert.deepEqual(
      dark.findings.map((f) => f.kind),
      ["control-boundary-invisible"],
    );
  }, 120_000);

  it("scan style keeps the scheme, and --from judges in it", async () => {
    const file = join(out(), "snap.json");
    const scan = await styleScanGate.run(
      styleScanGate.parse([PAGE, "--color-scheme", "dark", "--out", file], ctx),
      ctx,
    );
    assert.equal(scan.colorScheme, "dark");
    const fromColor = await colorGate.run(colorGate.parse(["--from", file], ctx), ctx);
    assert.equal(fromColor.colorScheme, "dark");
    assert.deepEqual(
      fromColor.findings.map((f) => f.kind),
      ["control-boundary-invisible"],
    );
    const fromDesign = await designGate.run(designGate.parse(["--from", file], ctx), ctx);
    assert.equal(fromDesign.colorScheme, "dark");
    const fromComposition = await compositionGate.run(compositionGate.parse(["--from", file], ctx), ctx);
    assert.equal(fromComposition.colorScheme, "dark");
    // A live run in the same scheme reads what the snapshot kept.
    assert.deepEqual(await designGate.run(designGate.parse([PAGE, "--color-scheme", "dark"], ctx), ctx), {
      ...fromDesign,
      source: PAGE,
    });
  }, 180_000);

  it("refuses the flag where nothing can honour it, and an unknown scheme", () => {
    for (const gate of [colorGate, designGate, compositionGate] as const) {
      const parse = (argv: string[]) => gate.parse(argv, ctx);
      assert.throws(() => parse(["--from", "snap.json", "--color-scheme", "dark"]), UsageError);
      assert.throws(() => parse(["--elements", "scene.json", "--color-scheme", "dark"]), /a scene has no media query/);
    }
    assert.throws(
      () => integrityGate.parse(["--elements", "scene.json", "--color-scheme", "dark"], ctx),
      /a scene has no media query/,
    );
    assert.throws(() => integrityGate.parse([PAGE, "--color-scheme", "sepia"], ctx), /must be one of light, dark/);
    // The value is not read as the page.
    assert.equal(integrityGate.parse(["--color-scheme", "dark", PAGE], ctx).source, PAGE);
  });
});
