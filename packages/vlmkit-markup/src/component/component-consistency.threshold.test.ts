import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runComponentConsistency } from "./component-consistency.ts";

/**
 * `--threshold` is the pass line, and a pass line must not change what it is
 * compared against.
 *
 * A dogfood agent found it doing both jobs: "Help says 'Pixel diff threshold
 * (default: 0.03)'; it is also the per-pixel colour tolerance, so it changes the
 * *measured* value: instance #1 reports 95.5% at 0.05 and 9.65% at 0.06. I first
 * read the drop as my fix working." Raising it lowered the measurement and raised
 * the bar at the same time — two moves from one flag, in the same direction.
 */
async function twoCards(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-drift-thr-"));
  const path = join(dir, "page.html");
  await writeFile(path, `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 10px; background: #fff; font: 14px system-ui; }
    .card { width: 160px; padding: 12px; border: 2px solid #333; background: #fff; margin: 6px; }
    .card--other { background: #ffdddd; border-color: #cc0000; }
  </style></head><body>
    <div class="card">Alpha</div>
    <div class="card card--other">Beta</div>
  </body></html>`);
  return path;
}

describe("check drift component: --threshold is a pass line only", () => {
  it("reports the same ratio at every threshold", { timeout: 180_000 }, async () => {
    const source = await twoCards();
    const ratios: number[] = [];
    for (const threshold of [0.03, 0.06, 0.5]) {
      const report = await runComponentConsistency({
        htmlPath: source,
        selector: ".card",
        outputDir: await mkdtemp(join(tmpdir(), "vlmkit-drift-out-")),
        threshold,
      });
      ratios.push(report.deltas.find((d) => d.candidateIndex === 1)!.diffRatio);
    }
    assert.equal(new Set(ratios).size, 1, `threshold moved the measurement: ${ratios.join(" vs ")}`);
  });

  it("still lets --pixel-tolerance move it, which is that flag's job", { timeout: 180_000 }, async () => {
    const source = await twoCards();
    const measure = async (pixelTolerance: number) => {
      const report = await runComponentConsistency({
        htmlPath: source,
        selector: ".card",
        outputDir: await mkdtemp(join(tmpdir(), "vlmkit-drift-out-")),
        pixelTolerance,
      });
      return report.deltas.find((d) => d.candidateIndex === 1)!.diffRatio;
    };
    const strict = await measure(0.01);
    const loose = await measure(0.6);
    assert.ok(strict > loose, `a looser tolerance must measure less: ${strict} vs ${loose}`);
  });
});

/**
 * Drift is a difference in styling. Pixels cannot tell that from different copy.
 *
 * A dogfood agent could not get this gate to pass on a page with real content:
 * "It raw-pixel-diffs crops, so two identically-styled cards with different copy read
 * `4.86% Δ 0 / 0` — above the 3% default. Proved it: same styling + identical text =
 * `0.00%`. The message […] claims drift where none exists, and the report's remedy
 * ('Replace the inline markup with the shared component invocation') is unfollowable
 * — the markup is already identical."
 */
async function page(cards: string, extraCss = ""): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-drift-style-"));
  const path = join(dir, "page.html");
  await writeFile(path, `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 10px; background: #fff; font: 14px/1.4 system-ui; }
    .card { width: 180px; padding: 12px; border: 2px solid #333; background: #fff; margin: 6px; }
    ${extraCss}
  </style></head><body>${cards}</body></html>`);
  return path;
}

describe("check drift component: styling decides, content does not", () => {
  it("reports no style delta for two instances that differ only in copy", { timeout: 180_000 }, async () => {
    const report = await runComponentConsistency({
      htmlPath: await page(
        `<div class="card"><b>1.4.0</b><p>Adds the export pipeline.</p></div>
         <div class="card"><b>1.5.0</b><p>Rewrites the scheduler entirely, top to bottom.</p></div>`,
      ),
      selector: ".card",
      outputDir: await mkdtemp(join(tmpdir(), "vlmkit-drift-out-")),
    });
    const delta = report.deltas.find((d) => d.candidateIndex === 1)!;
    assert.equal(delta.styleDeltas.length, 0, `expected no style delta, got ${JSON.stringify(delta.styleDeltas)}`);
    // The pixels and the height genuinely differ — that is what copy costs, and the
    // report still says so. It just is not drift.
    assert.ok(delta.diffRatio > 0.02, `the copy really does move pixels: ${delta.diffRatio}`);
    assert.ok(delta.bboxDeltas.height > 0, "the taller card is still reported as taller");
  });

  it("names the properties when the styling really differs", { timeout: 180_000 }, async () => {
    const report = await runComponentConsistency({
      htmlPath: await page(
        `<div class="card">Alpha</div><div class="card card--wide">Alpha</div>`,
        `.card--wide { padding: 30px; border-color: #2255cc; }`,
      ),
      selector: ".card",
      outputDir: await mkdtemp(join(tmpdir(), "vlmkit-drift-out-")),
    });
    const delta = report.deltas.find((d) => d.candidateIndex === 1)!;
    const properties = delta.styleDeltas.map((s) => s.property);
    assert.ok(properties.includes("padding-top"), `expected padding in ${properties.join(",")}`);
    assert.ok(properties.includes("border-top-color"), `expected border colour in ${properties.join(",")}`);
    // Each delta carries both values, so the message can be acted on rather than
    // guessed at.
    const padding = delta.styleDeltas.find((s) => s.property === "padding-top")!;
    assert.equal(padding.reference, "12px");
    assert.equal(padding.candidate, "30px");
  });

  it("does not count height as a style property", { timeout: 180_000 }, async () => {
    // `height` is content-derived when unset, so comparing it would put the copy
    // difference straight back into the verdict. The size delta is reported separately.
    const report = await runComponentConsistency({
      htmlPath: await page(
        `<div class="card">short</div>
         <div class="card">a much longer line of copy that has to wrap onto a second line</div>`,
      ),
      selector: ".card",
      outputDir: await mkdtemp(join(tmpdir(), "vlmkit-drift-out-")),
    });
    const delta = report.deltas.find((d) => d.candidateIndex === 1)!;
    assert.ok(delta.bboxDeltas.height !== 0, "the wrapped card is taller");
    assert.deepEqual(delta.styleDeltas.map((s) => s.property), [], "and that is not a style delta");
  });
});
