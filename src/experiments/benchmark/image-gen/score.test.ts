import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vite-plus/test";
import { IMAGE_GEN_DEFAULT_MODEL } from "../../../../packages/vlmkit-ai/src/image-gen-client.ts";
import { BRIEFS, briefHash } from "./briefs.ts";
import { SAVED_EVALUATION } from "./image-gen-bench.ts";
import { newEvaluation, problems, renderMarkdown, summarize, type Evaluation } from "./score.ts";

const saved = JSON.parse(readFileSync(SAVED_EVALUATION, "utf8")) as Evaluation;

describe("the saved evaluation", () => {
  it("still answers the current briefs, and every image is scored", () => {
    // A failure here after editing briefs.ts is expected: re-run the bench and save a new evaluation.
    assert.deepEqual(problems(saved), []);
    assert.deepEqual(
      Object.keys(saved.briefs),
      BRIEFS.map((b) => b.id),
    );
  });

  it("gives the default image model full marks — the default is the evidence's, not a guess", () => {
    const row = summarize(saved).find((r) => r.model === IMAGE_GEN_DEFAULT_MODEL);
    assert.ok(row, `${IMAGE_GEN_DEFAULT_MODEL} is not in ${SAVED_EVALUATION}`);
    assert.equal(row.points, row.of);
  });
});

describe("scoring", () => {
  const runs = [
    { model: "a/x", brief: "zoom", costUsd: 0.05, latencyMs: 9000, file: "zoom--a.png" },
    { model: "a/x", brief: "vrt", costUsd: 0.05, latencyMs: 9000, file: "vrt--a.png" },
    { model: "b/y", brief: "zoom", costUsd: 0.01, latencyMs: 20000, file: "zoom--b.png" },
    { model: "b/y", brief: "vrt", costUsd: null, latencyMs: 100, error: "403" },
  ];
  const briefs = BRIEFS.filter((b) => b.id === "zoom" || b.id === "vrt");

  it("a fresh evaluation lists every image, unscored, and says so", () => {
    const ev = newEvaluation("2026-01-01", runs, briefs);
    assert.equal(ev.scores.length, 3);
    const found = problems(ev, briefs);
    assert.ok(found.includes("no scorer recorded"));
    assert.ok(found.includes("a/x × zoom is not scored"));
    assert.ok(!found.some((p) => p.includes("b/y × vrt")), "a failed call has no image to score");
  });

  it("a verdict short of pass needs a note, and an edited brief is named", () => {
    const ev = newEvaluation("2026-01-01", runs, briefs);
    ev.scorer = "test";
    for (const s of ev.scores) s.verdict = "pass";
    ev.scores[0].verdict = "partial";
    ev.briefs.zoom = "000000000000";
    const found = problems(ev, briefs);
    assert.ok(found.some((p) => p.includes("is partial with no note")));
    assert.ok(found.some((p) => p.startsWith("brief zoom changed")));
    assert.ok(!found.some((p) => p.startsWith("brief vrt")), briefHash(briefs[1]));
  });

  it("ranks by points, then the cheaper worst case, and renders failed calls", () => {
    const ev = newEvaluation("2026-01-01", runs, briefs);
    ev.scorer = "test";
    for (const s of ev.scores) s.verdict = "pass";
    const rows = summarize(ev);
    assert.deepEqual(
      rows.map((r) => [r.model, r.points]),
      [
        ["a/x", 2],
        ["b/y", 1],
      ],
    );
    const md = renderMarkdown(ev);
    assert.match(md, /\| a\/x \| ✓ \| ✓ \| 2\/2 \| 0\.050 \| 9s \|/);
    assert.match(md, /Scored by test on 2026-01-01\. 3 images/);
  });
});
