import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { PNG } from "pngjs";
import { checkClaims, claimInstruction } from "./claims.ts";
import type { JevAsk } from "./locate.ts";

const png = (width: number, height: number) => new Uint8Array(PNG.sync.write(new PNG({ width, height })));

/** Answers each claim's `noul` from `nouls` in order, and records what it was sent. */
function fake(nouls: number[]) {
  const sent: { instructions: string[]; size: { width: number; height: number } }[] = [];
  const ask: JevAsk = async (req) => {
    const img = PNG.sync.read(Buffer.from(Object.values(req.assets ?? {})[0]!.bytes));
    const qs = Object.values(req.questions) as { instructions: string }[];
    sent.push({ instructions: qs.map((q) => q.instructions), size: { width: img.width, height: img.height } });
    const answers = Object.fromEntries(Object.keys(req.questions).map((k, i) => [k, { type: "noul", noul: nouls[i] }]));
    return {
      model: "fake-jev",
      answers,
      usage: { input_tokens: 3100, output_tokens: 3 },
      latencyMs: 1,
      costUsd: 0.00013,
    } as never;
  };
  return { ask, sent };
}

describe("claims", () => {
  it("words a statement as what the screenshot shows", () => {
    assert.equal(claimInstruction("an error message"), "`screenshot` shows an error message.");
    assert.equal(claimInstruction("The page shows a modal dialog."), "`screenshot` shows a modal dialog.");
    assert.equal(claimInstruction("contains a login form"), "`screenshot` contains a login form.");
  });

  it("asks every claim in one request and passes forbid below, expect at or above the threshold", async () => {
    const { ask, sent } = fake([0.02, 0.97, 0.6, 0.1]);
    const r = await checkClaims(
      png(1280, 800),
      [
        { statement: "an error message", expect: "absent" },
        { statement: "a login form", expect: "shown" },
        { statement: "a modal dialog open over the page", expect: "absent" },
        { statement: "a navigation bar", expect: "shown" },
      ],
      { ask },
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.instructions.length, 4);
    assert.deepEqual(
      r.results.map((x) => [x.pass, x.uncertain]),
      [
        [true, false],
        [true, false],
        [false, true],
        [false, false],
      ],
    );
    assert.equal(r.passed, false);
    assert.equal(r.costUsd, 0.00013);
  });

  it("shrinks a 2x capture to Jev's limits, and refuses no claims", async () => {
    const { ask, sent } = fake([0.1]);
    await checkClaims(png(2560, 1600), [{ statement: "an error message", expect: "absent" }], { ask });
    assert.ok(sent[0]!.size.width <= 1568 && sent[0]!.size.height <= 1568);
    await assert.rejects(checkClaims(png(1280, 800), [], { ask }), /no claims/);
  });
});
