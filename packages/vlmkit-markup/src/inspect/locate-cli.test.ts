import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { LocateUsageError, markBox, parseLocateArgs, runLocateCli } from "./locate-cli.ts";

describe("inspect locate", () => {
  it("parses a screenshot, a description and its options", () => {
    assert.deepEqual(parseLocateArgs(["s.png", 'the "Save" button']), {
      image: "s.png",
      description: 'the "Save" button',
      json: false,
      threshold: 0.5,
      presence: true,
      refine: true,
    });
    const o = parseLocateArgs([
      "s.png",
      "x",
      "--json",
      "--dpr",
      "2.625",
      "--mark",
      "m.png",
      "--no-refine",
      "--threshold",
      "0.3",
    ]);
    assert.equal(o.dpr, 2.625);
    assert.equal(o.mark, "m.png");
    assert.equal(o.refine, false);
    assert.equal(o.threshold, 0.3);
  });

  it("refuses what it cannot run, and says to quote a description split into words", () => {
    for (const [argv, re] of [
      [["s.png"], /got 1 argument/],
      [["s.png", "the", "Save", "button"], /quote the description/],
      [["s.png", "x", "--dpr", "0"], /--dpr/],
      [["s.png", "x", "--threshold", "2"], /--threshold/],
      [["s.png", "x", "--mark"], /--mark needs a value/],
      [["s.png", "x", "--bogus"], /unknown option/],
      [["s.png", "  "], /empty/],
    ] as const) {
      assert.throws(
        () => parseLocateArgs([...argv]),
        (e: Error) => e instanceof LocateUsageError && re.test(e.message),
      );
    }
  });

  it("prints help with exit 0, and exits 2 without a key before reading the image", async () => {
    const saved = process.env.TYPESAFEAI_API_KEY;
    const savedAlt = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFEAI_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    const log = console.log;
    const err = console.error;
    const out: string[] = [];
    console.log = (s: string) => out.push(s);
    console.error = (s: string) => out.push(s);
    try {
      assert.equal(await runLocateCli(["--help"]), 0);
      assert.match(out.join("\n"), /Usage: vlmkit inspect locate/);
      assert.equal(await runLocateCli(["/nonexistent.png", "the Save button"]), 2);
      assert.match(out.at(-1)!, /TYPESAFEAI_API_KEY/);
    } finally {
      console.log = log;
      console.error = err;
      if (saved !== undefined) process.env.TYPESAFEAI_API_KEY = saved;
      if (savedAlt !== undefined) process.env.TYPESAFE_API_KEY = savedAlt;
    }
  });

  it("outlines the box outside it and marks its centre, red on light pixels and white on dark", () => {
    const img = { width: 40, height: 40, data: new Uint8Array(40 * 40 * 4).fill(255) };
    for (let y = 0; y < 40; y++) for (let x = 30; x < 40; x++) img.data.set([0, 0, 0, 255], (y * 40 + x) * 4);
    markBox(img, { x: 10, y: 10, width: 20, height: 20 });
    const at = (x: number, y: number) => [...img.data.subarray((y * 40 + x) * 4, (y * 40 + x) * 4 + 3)];
    assert.deepEqual(at(8, 15), [230, 20, 60]);
    assert.deepEqual(at(31, 15), [255, 255, 255]);
    assert.deepEqual(at(20, 20), [230, 20, 60]);
    assert.deepEqual(at(12, 12), [255, 255, 255]);
  });
});
