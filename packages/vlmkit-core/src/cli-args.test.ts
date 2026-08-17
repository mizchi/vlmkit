import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import {
  getArg,
  getArgValues,
  getFloatArg,
  getIntArg,
  getPositionalArgs,
  getRawArgs,
  hasFlag,
} from "./cli-args.ts";

const REAL_ARGV = process.argv;
const withArgv = <T>(tail: string[], body: () => T): T => {
  process.argv = ["node", "cli.ts", ...tail];
  return body();
};

afterEach(() => {
  process.argv = REAL_ARGV;
});

describe("getArg", () => {
  it("reads a value and falls back when absent", () => {
    assert.equal(withArgv(["--fixture", "page"], () => getArg("fixture", "default")), "page");
    assert.equal(withArgv(["--json"], () => getArg("fixture", "default")), "default");
    assert.equal(withArgv([], () => getArg("fixture")), undefined);
  });

  it("treats an empty value as absent, as callers were written against", () => {
    assert.equal(withArgv(["--image", ""], () => getArg("image", "fallback.png")), "fallback.png");
  });

  it("refuses to return the next flag as the value", () => {
    // `fix-loop --seed --mode selector` used to yield "--mode", which the
    // caller's parseInt turned into a NaN seed with no complaint.
    assert.throws(
      () => withArgv(["--seed", "--mode", "selector"], () => getArg("seed", "1")),
      /--seed needs a value, got the next flag --mode/,
    );
  });

  it("reads argv per call, so a dispatcher-loaded leaf sees its own arguments", () => {
    // The previous module captured process.argv at import time; a leaf loaded
    // after the dispatcher rewrote argv saw the wrong list.
    assert.equal(withArgv(["--fixture", "a"], () => getArg("fixture", "?")), "a");
    assert.equal(withArgv(["--fixture", "b"], () => getArg("fixture", "?")), "b");
  });
});

describe("getIntArg / getFloatArg", () => {
  it("parses, falls back, and range-checks", () => {
    assert.equal(withArgv(["--max-rounds", "5"], () => getIntArg("max-rounds", 3)), 5);
    assert.equal(withArgv([], () => getIntArg("max-rounds", 3)), 3);
    assert.equal(withArgv(["--max-cost", "0.001"], () => getFloatArg("max-cost", 999)), 0.001);
  });

  it("rejects a non-number where the old code produced NaN", () => {
    assert.throws(() => withArgv(["--seed", "abc"], () => getIntArg("seed", 1)), /--seed must be a number/);
    assert.throws(
      () => withArgv(["--max-rounds", "0"], () => getIntArg("max-rounds", 3, { min: 1 })),
      /--max-rounds must be >= 1/,
    );
  });
});

describe("getPositionalArgs", () => {
  it("keeps a positional that follows a boolean flag", () => {
    // The old implementation assumed EVERY flag takes a value, so `--md model`
    // silently dropped the model name.
    assert.deepEqual(
      withArgv(["--md", "qwen/qwen3-vl", "--limit", "30"], () => getPositionalArgs(["limit"])),
      ["qwen/qwen3-vl"],
    );
  });

  it("still drops a named flag's value", () => {
    assert.deepEqual(
      withArgv(["model-a", "--max-cost", "0.001", "model-b"], () => getPositionalArgs(["max-cost"])),
      ["model-a", "model-b"],
    );
  });
});

describe("hasFlag / getArgValues / getRawArgs", () => {
  it("still work as before", () => {
    assert.equal(withArgv(["--no-db"], () => hasFlag("no-db")), true);
    assert.equal(withArgv([], () => hasFlag("no-db")), false);
    assert.deepEqual(withArgv(["--gate", "a", "--gate", "b"], () => getArgValues("gate")), ["a", "b"]);
    assert.deepEqual(withArgv(["--fixture", "page"], () => getRawArgs()), ["--fixture", "page"]);
  });
});
