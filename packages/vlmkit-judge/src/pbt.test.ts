import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  bisectChange,
  createRng,
  failingInterval,
  minimizeSubset,
  shrinkAlongLadder,
  shrinkIntToward,
  shrinkRecord,
} from "./pbt.ts";

describe("createRng", () => {
  it("is a pure function of its seed", () => {
    const a = createRng(11);
    const b = createRng(11);
    const draws = (r: ReturnType<typeof createRng>) => Array.from({ length: 20 }, () => r.int(320, 1440));
    assert.deepEqual(draws(a), draws(b));
    assert.notDeepEqual(draws(createRng(11)), draws(createRng(12)));
  });

  it("keeps int() inside both inclusive bounds and reaches them", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(1, 4);
      assert.ok(v >= 1 && v <= 4, String(v));
      seen.add(v);
    }
    assert.deepEqual([...seen].sort(), [1, 2, 3, 4]);
  });

  it("does not collapse seed 0 into a constant stream", () => {
    const rng = createRng(0);
    const values = new Set(Array.from({ length: 10 }, () => rng.next()));
    assert.ok(values.size > 5);
  });
});

describe("shrinkIntToward", () => {
  it("tries the target first, then halves the distance back", () => {
    assert.deepEqual(shrinkIntToward(100, 0), [0, 50, 75, 88, 94, 97, 99]);
    assert.deepEqual(shrinkIntToward(655, 900), [900, 777, 716, 685, 670, 662, 658, 656]);
    assert.deepEqual(shrinkIntToward(7, 7), []);
  });
});

describe("shrinkAlongLadder", () => {
  it("offers every simpler rung", () => {
    assert.deepEqual(shrinkAlongLadder(1.5, [1, 1.25, 1.5, 2]), [1, 1.25]);
    assert.deepEqual(shrinkAlongLadder(1, [1, 1.25]), []);
  });
});

describe("shrinkRecord", () => {
  it("drops every dimension the failure does not need and keeps the ones it does", async () => {
    // Fails whenever width < 500, whatever the height or scale.
    const result = await shrinkRecord(
      { width: 480, height: 655, scale: 1.5 },
      {
        height: (h) => shrinkIntToward(h, 900),
        scale: (s) => shrinkAlongLadder(s, [1, 1.25, 1.5, 2]),
      },
      async (c) => c.width < 500,
    );
    assert.deepEqual(result.value, { width: 480, height: 900, scale: 1 });
    assert.deepEqual(result.steps.map((s) => s.dimension), ["height", "scale"]);
    assert.equal(result.exhausted, false);
  });

  it("stops at the nearest still-failing value when the target passes", async () => {
    // Needs text scale >= 1.25 to fail.
    const result = await shrinkRecord(
      { scale: 2 },
      { scale: (s) => shrinkAlongLadder(s, [1, 1.25, 1.5, 2]) },
      async (c) => c.scale >= 1.25,
    );
    assert.equal(result.value.scale, 1.25);
  });

  it("says when the budget ran out", async () => {
    const result = await shrinkRecord(
      { height: 100_000 },
      { height: (h) => shrinkIntToward(h, 0) },
      async (c) => c.height > 50_000,
      3,
    );
    assert.equal(result.exhausted, true);
    assert.equal(result.attempts, 3);
  });
});

describe("failingInterval", () => {
  it("finds both edges exactly", async () => {
    let calls = 0;
    const result = await failingInterval(813, 320, 1440, async (w) => {
      calls++;
      return w >= 700 && w <= 871;
    });
    assert.equal(result.lo, 700);
    assert.equal(result.hi, 871);
    assert.equal(result.atMin, false);
    assert.equal(result.atMax, false);
    assert.equal(result.attempts, calls);
    // Two galloping-then-bisecting edges over a 1120px range: logarithmic, not linear.
    assert.ok(calls < 30, `took ${calls} calls`);
  });

  it("reports an edge that is the search bound", async () => {
    const result = await failingInterval(333, 320, 1440, async (w) => w <= 345);
    assert.equal(result.lo, 320);
    assert.equal(result.atMin, true);
    assert.equal(result.hi, 345);
  });

  it("handles a one-pixel failure (the orphan width between two queries)", async () => {
    const result = await failingInterval(768, 320, 1440, async (w) => w === 768);
    assert.deepEqual([result.lo, result.hi], [768, 768]);
  });

  it("returns what it has when the budget runs out", async () => {
    const result = await failingInterval(900, 0, 100_000, async (w) => w > 10 && w < 90_000, 4);
    assert.equal(result.exhausted, true);
    assert.ok(result.lo <= 900 && result.hi >= 900);
  });
});

describe("bisectChange", () => {
  it("pins the first value that differs", async () => {
    assert.equal(await bisectChange(600, 900, async (w) => w < 721), 721);
    assert.equal(await bisectChange(10, 11, async () => true), 11);
  });
});

describe("minimizeSubset", () => {
  const decls = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("isolates the one item that matters", async () => {
    const result = await minimizeSubset(decls, async (s) => s.includes("f"));
    assert.deepEqual(result?.subset, ["f"]);
    assert.equal(result?.complete, true);
  });

  it("keeps a pair that only works together", async () => {
    const result = await minimizeSubset(decls, async (s) => s.includes("b") && s.includes("g"));
    assert.deepEqual(result?.subset.sort(), ["b", "g"]);
  });

  it("returns null when even the full set does not hold", async () => {
    assert.equal(await minimizeSubset(decls, async () => false), null);
  });

  it("is 1-minimal: removing any survivor breaks it", async () => {
    const holds = async (s: string[]) => ["a", "d", "e"].every((x) => s.includes(x));
    const result = await minimizeSubset(decls, holds);
    assert.ok(result);
    for (const item of result.subset) {
      assert.equal(await holds(result.subset.filter((x) => x !== item)), false);
    }
  });

  it("stops at the budget and says so", async () => {
    const result = await minimizeSubset(decls, async (s) => s.includes("h"), 2);
    assert.equal(result?.complete, false);
    assert.ok(result?.subset.includes("h"));
  });
});
