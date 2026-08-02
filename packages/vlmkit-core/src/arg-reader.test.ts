import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasFlag,
  readAll,
  readFlag,
  readInt,
  readNumber,
  readPositionals,
  tokenizeCommand,
} from "./arg-reader.ts";

describe("readFlag", () => {
  it("reads a value, or nothing when the flag is absent", () => {
    assert.equal(readFlag(["--out", "dir"], "out"), "dir");
    assert.equal(readFlag(["--out", "dir"], "--out"), "dir");
    assert.equal(readFlag(["--json"], "out"), undefined);
  });

  it("refuses to swallow the next flag as a value", () => {
    // `--output --json` used to set the output directory to "--json".
    assert.throws(() => readFlag(["--output", "--json"], "output"), /needs a value, got the next flag --json/);
    assert.throws(() => readFlag(["--output", "-v"], "output"), /got the next flag -v/);
    assert.throws(() => readFlag(["--output"], "output"), /--output needs a value/);
  });

  it("treats a negative number as a value, not a flag", () => {
    assert.equal(readFlag(["--offset", "-3"], "offset"), "-3");
  });

  it("lets the last occurrence win", () => {
    assert.equal(readFlag(["--out", "a", "--out", "b"], "out"), "b");
  });
});

describe("readAll", () => {
  it("collects every occurrence of a repeatable flag", () => {
    assert.deepEqual(readAll(["--gate", "a", "--json", "--gate", "b"], "gate"), ["a", "b"]);
    assert.deepEqual(readAll(["--json"], "gate"), []);
  });

  it("does not read a flag as one of the values", () => {
    assert.throws(() => readAll(["--gate", "a", "--gate", "--json"], "gate"), /got the next flag/);
  });

  it("treats a repeated flag with no value between them as the error it is", () => {
    assert.throws(() => readAll(["--only", "--only"], "only"), /--only needs a value/);
  });
});

describe("readNumber / readInt", () => {
  it("parses and range-checks", () => {
    assert.equal(readInt(["--concurrency", "4"], "concurrency", { min: 1 }), 4);
    assert.equal(readNumber(["--min-reuse", "2.5"], "min-reuse", { min: 0 }), 2.5);
    assert.equal(readInt(["--json"], "concurrency"), undefined);
  });

  it("rejects a non-number instead of yielding NaN", () => {
    // NaN does not fail loudly: it made runPool build zero lanes and report
    // success having run nothing.
    assert.throws(() => readInt(["--concurrency", "abc"], "concurrency"), /must be a number, got "abc"/);
    assert.throws(() => readInt(["--concurrency", "4abc"], "concurrency"), /must be a number, got "4abc"/);
    assert.throws(() => readNumber(["--dpr", ""], "dpr"), /must be a number/);
  });

  it("rejects a fractional value where a whole number is required", () => {
    assert.throws(() => readInt(["--concurrency", "2.5"], "concurrency"), /must be a whole number/);
  });

  it("enforces min and max", () => {
    assert.throws(() => readInt(["--concurrency", "0"], "concurrency", { min: 1 }), /must be >= 1, got 0/);
    assert.throws(() => readInt(["--shards", "99"], "shards", { max: 32 }), /must be <= 32, got 99/);
  });
});

describe("hasFlag", () => {
  it("matches with or without the leading dashes", () => {
    assert.equal(hasFlag(["--json"], "json"), true);
    assert.equal(hasFlag(["--json"], "--json"), true);
    assert.equal(hasFlag([], "json"), false);
  });
});

describe("readPositionals", () => {
  const VALUE_FLAGS = ["gate", "concurrency", "output"];

  it("keeps positionals and drops flags with their values", () => {
    assert.deepEqual(
      readPositionals(["--gate", "check integrity", "a.html", "--concurrency", "4", "b.html", "--quiet"], VALUE_FLAGS),
      ["a.html", "b.html"],
    );
  });

  it("does not mistake a value-flag's value for a positional", () => {
    assert.deepEqual(readPositionals(["--concurrency", "4"], VALUE_FLAGS), []);
  });

  it("treats an unknown flag as valueless, so its argument stays a positional", () => {
    // Conservative on purpose: a swallowed page is worse than an extra one,
    // because the run would silently cover less than the user asked for.
    assert.deepEqual(readPositionals(["--unknown", "a.html"], VALUE_FLAGS), ["a.html"]);
  });

  it("returns nothing when there are no positionals", () => {
    assert.deepEqual(readPositionals(["--quiet", "--json"], VALUE_FLAGS), []);
  });
});

describe("tokenizeCommand", () => {
  it("splits on whitespace", () => {
    assert.deepEqual(tokenizeCommand("check design --min-reuse 4"), ["check", "design", "--min-reuse", "4"]);
    assert.deepEqual(tokenizeCommand("  check   integrity  "), ["check", "integrity"]);
    assert.deepEqual(tokenizeCommand(""), []);
  });

  it("keeps quoted values together", () => {
    // A path with a space, or a selector list, would otherwise arrive at the
    // gate as several arguments and fail as if the gate were broken.
    assert.deepEqual(
      tokenizeCommand('check copy --manifest "copy/press kit.txt"'),
      ["check", "copy", "--manifest", "copy/press kit.txt"],
    );
    assert.deepEqual(
      tokenizeCommand(`check breakpoints --mask '.hero, .promo'`),
      ["check", "breakpoints", "--mask", ".hero, .promo"],
    );
  });

  it("keeps an empty quoted argument", () => {
    assert.deepEqual(tokenizeCommand('check copy --prefix ""'), ["check", "copy", "--prefix", ""]);
  });

  it("allows quotes inside a word", () => {
    assert.deepEqual(tokenizeCommand(`--selector a"b"c`), ["--selector", "abc"]);
    assert.deepEqual(tokenizeCommand(`--sel "[data-id='x']"`), ["--sel", "[data-id='x']"]);
  });

  it("reports an unterminated quote rather than truncating silently", () => {
    assert.throws(() => tokenizeCommand('check copy --manifest "unclosed.txt'), /Unterminated " quote/);
  });
});
