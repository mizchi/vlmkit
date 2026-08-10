/**
 * The last two gates that measured a document without a base URL.
 *
 * `page-open.ts` documents the mechanism: `page.setContent(await readFile(file))` leaves the
 * document's base URL at `about:blank`, so `<link rel="stylesheet">` never loads and the gate
 * measures unstyled markup. Ten gates had it; `fixtures/external-assets/` exists to catch it,
 * with every defect declared in `style.css` and none in `page.html`.
 *
 * Eight were converted earlier. These two were the remainder, and they are the two where the
 * consequence is worst, because both read **geometry** rather than a style value:
 *
 * - `check a11y focus` classifies each step by the element's x/y. With no CSS every element
 *   sits in DOM order at the left margin, so `reverse-left` / `skip-row` have nothing to
 *   detect. Measured: **0 findings and exit 0** on a fixture whose only layout is external —
 *   and the `reverse` finding plus exit 1 with the identical CSS inlined. An accessibility
 *   gate reporting a real WCAG violation as clean is the worst failure available to it.
 * - `check drift component` screenshots each instance and compares pixels. Measured on three
 *   `.tile`s whose `--wrong` modifier lives only in CSS: **1.06% / 1.32% with `Δ 0 / 0` and
 *   exit 0** — three same-sized unstyled boxes, the difference attributed to the glyphs
 *   "Alpha" / "Beta" / "Gamma". The modifier that makes one instance genuinely inconsistent
 *   was invisible.
 *
 * These tests assert the *shape* of the corrected measurement rather than exact percentages:
 * a pixel ratio is antialiasing-sensitive and would make this file a maintenance tax. The
 * size delta is not — `+32` is arithmetic from the CSS (28px padding against 12px, both
 * sides), so it is asserted exactly. That is the assertion that fails if either gate goes
 * back to `setContent`, because unstyled boxes are always the same size.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { runFocusOrder } from "./a11y-focus-order.ts";
import { runComponentConsistency } from "./component/component-consistency.ts";

const FIXTURE = resolve(import.meta.dirname!, "../../../fixtures/external-assets/page.html");

async function outDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vlmkit-external-assets-"));
}

/**
 * The same markup with `<link>` replaced by an inline `<style>`.
 *
 * The control the original 2026-08-02 measurement used: if a gate reports the defect here and
 * not on the fixture, the only difference is whether the stylesheet resolved.
 */
async function inlinedCopy(): Promise<string> {
  const dir = await outDir();
  const html = await readFile(FIXTURE, "utf8");
  const css = await readFile(resolve(FIXTURE, "..", "style.css"), "utf8");
  const inlined = html.replace(/<link rel="stylesheet" href="style\.css">/, `<style>${css}</style>`);
  assert.notEqual(inlined, html, "the fixture stopped linking style.css — this control is void");
  const path = join(dir, "inlined.html");
  await writeFile(path, inlined);
  return path;
}

describe("check a11y focus reads the styled document", { timeout: 180_000 }, () => {
  it("finds the reverse-left violation whose geometry is external", async () => {
    const report = await runFocusOrder({ source: FIXTURE, outputDir: await outDir() });
    const reverse = report.findings.filter((f) => f.kind === "reverse");
    assert.ok(reverse.length > 0, `expected a reverse finding, got ${JSON.stringify(report.findings.map((f) => f.kind))}`);
    // The x values come from `style.css` (#focus-a at 700, #focus-b at 20) plus the body's
    // 32px padding. Asserting the direction rather than the exact pair: what matters is that
    // the gate saw a large rightward-then-leftward jump, which unstyled markup cannot produce.
    assert.match(reverse[0]!.message, /Focus moved left/);
    assert.match(reverse[0]!.message, /focus-a/);
  });

  it("agrees with the inlined-CSS control", async () => {
    // If these diverge, the load mechanism is measuring a different document again.
    const [external, inline] = await Promise.all([
      runFocusOrder({ source: FIXTURE, outputDir: await outDir() }),
      runFocusOrder({ source: await inlinedCopy(), outputDir: await outDir() }),
    ]);
    assert.deepEqual(
      external.findings.map((f) => f.kind).sort(),
      inline.findings.map((f) => f.kind).sort(),
      "the linked and inlined documents must yield the same findings",
    );
  });
});

describe("check drift component reads the styled document", { timeout: 180_000 }, () => {
  it("sees the size delta the external modifier creates", async () => {
    const report = await runComponentConsistency({
      htmlPath: FIXTURE,
      selector: ".tile",
      outputDir: await outDir(),
    });
    assert.equal(report.instances.length, 3);
    const wrong = report.deltas.find((d) => d.candidateIndex === 1);
    assert.ok(wrong, `no delta for instance #1: ${JSON.stringify(report.deltas.map((d) => d.candidateIndex))}`);
    // Arithmetic from the CSS: 28px padding against 12px is +16 per side on both axes.
    // Unstyled, all three tiles are the same size and this is 0 — which is exactly what the
    // gate reported before the conversion, alongside a ~1% ratio it attributed to glyphs.
    assert.equal(wrong.bboxDeltas.width, 32, `expected +32 width delta, got ${wrong.bboxDeltas.width}`);
    assert.equal(wrong.bboxDeltas.height, 32, `expected +32 height delta, got ${wrong.bboxDeltas.height}`);
    // And the unmodified third tile differs from the reference only by its glyphs.
    const plain = report.deltas.find((d) => d.candidateIndex === 2);
    assert.equal(plain?.bboxDeltas.width, 0);
  });

  it("resolves a URL spelling without mangling it into a path", async () => {
    // `resolve("http://x/p.html")` yields `<cwd>/http:/x/p.html`, so the gate's declared
    // `<html-or-url>` input has never worked. This asserts the failure is now a navigation
    // error naming the URL, not a file-not-found naming a nonsense path.
    const dir = await outDir();
    await assert.rejects(
      () => runComponentConsistency({
        htmlPath: "http://127.0.0.1:1/nope.html",
        selector: ".tile",
        outputDir: dir,
      }),
      (error: Error) => {
        // It must have tried to NAVIGATE. Before, `resolve()` produced
        // `<cwd>/http:/127.0.0.1:1/nope.html` and the failure was a file read.
        assert.match(error.message, /page\.goto/, `did not navigate: ${error.message}`);
        // The mangled form is `http:/` with a single slash. Matching `http:\/` alone would
        // also match the correct message, which quotes the URL intact — the first version of
        // this assertion did exactly that and failed on correct behaviour.
        assert.doesNotMatch(
          error.message,
          /http:\/(?!\/)/,
          `collapsed the URL's double slash into a path: ${error.message}`,
        );
        return true;
      },
    );
  });
});
