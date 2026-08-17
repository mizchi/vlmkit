/**
 * What the design-token scan must NOT report.
 *
 * Both exclusions here were found by pointing `check tokens` at `examples/solitaire/`, where it
 * returned 19 violations of which 13 were structural — not off-scale values at all:
 *
 * - `getComputedStyle` RESOLVES an `auto` margin to pixels. `margin: 0 auto` on a centred block
 *   reported 144px, and a flex item with `margin-left: auto` reported **1048.12px**, against a
 *   spacing scale topping out at 96. Three of the most ordinary layout idioms there are —
 *   `margin: 0 auto`, max-width centring, and `auto` as a flex spacer — each produced a finding,
 *   so the gate was noisiest on the most conventional CSS.
 * - The sr-only / visually-hidden idiom uses `margin: -1px`, which reaches the scale as three
 *   more violations per live region.
 *
 * A gate whose false positives scale with how ordinary the page is gets ignored, so these are
 * pinned rather than left to taste. The positive case is in the same test on purpose: an
 * explicitly off-scale margin still reports, which is the direction that matters.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, it } from "vitest";
import { runDesignTokens } from "./design-tokens.ts";

const FIXTURE = `<!doctype html>
<html><head><meta charset="utf-8"><title>token scan fixture</title><style>
  body { margin: 0 }
  /* auto margins, resolved to px by getComputedStyle — must NOT report */
  .centred { max-width: 300px; margin: 0 auto; height: 40px; background: #ddd }
  .flexbar { display: flex }
  .pushed { margin-left: auto; background: #eee; height: 32px; width: 80px }
  /* explicit off-scale margins — MUST report, both sides */
  .offscale { margin-left: 13px; margin-top: 7px; height: 40px; background: #ccc; width: 100px }
  /* sr-only: a 1x1 box whose margin:-1px is on no scale — must NOT report */
  .sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%) }
</style></head><body>
  <div class="centred">centred</div>
  <div class="flexbar"><span>a</span><div class="pushed">pushed</div></div>
  <div class="offscale">off scale</div>
  <div class="sr">screen reader only</div>
</body></html>
`;

let workDir: string | undefined;
afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("check tokens", () => {
  it("reports explicit off-scale margins and nothing structural", async () => {
    workDir = await mkdtemp(join(tmpdir(), "vlmkit-tokens-"));
    const html = join(workDir, "fixture.html");
    await writeFile(html, FIXTURE, "utf8");

    const report = await runDesignTokens({
      source: html,
      outputDir: join(workDir, "out"),
    });

    const margins = report.violations.filter((v) => v.property === "margin");
    assert.deepEqual(
      margins.map((v) => `${v.path} ${v.side} ${v.value}`).sort(),
      ["div.offscale left 13", "div.offscale top 7"],
    );

    // Stated as their own assertions so a failure names the regression rather than a diff.
    const paths = report.violations.map((v) => v.path).join(" ");
    assert.doesNotMatch(paths, /centred/, "margin: 0 auto reported as a spacing violation");
    assert.doesNotMatch(paths, /pushed/, "margin-left: auto reported as a spacing violation");
    assert.doesNotMatch(paths, /\bsr\b/, "the sr-only box reported as a spacing violation");
  });
});
