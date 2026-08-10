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
