import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { numericOrder, parseArgs } from "./strip-cli.ts";

describe("snapshot strip: argument parsing", () => {
  it("takes positional frames and defaults the output", () => {
    const args = parseArgs(["a.png", "b.png"]);
    assert.deepEqual(args.paths, ["a.png", "b.png"]);
    assert.equal(args.out, "strip.png");
    assert.equal(args.columns, undefined);
  });

  it("reads the layout flags", () => {
    const args = parseArgs(["a.png", "--columns", "3", "--gap", "0", "--scale", "2", "--max-width", "900", "--out", "s.png"]);
    assert.equal(args.columns, 3);
    assert.equal(args.gap, 0);
    assert.equal(args.scale, 2);
    assert.equal(args.maxWidth, 900);
    assert.equal(args.out, "s.png");
  });

  it("distinguishes `--gap 0` from an omitted --gap", () => {
    // `0` is falsy, so a truthiness check here would silently substitute the
    // 8px default and produce a sheet with gaps the caller asked to remove.
    assert.equal(parseArgs(["a.png", "--gap", "0"]).gap, 0);
    assert.equal(parseArgs(["a.png"]).gap, undefined);
  });

  it("rejects a non-numeric flag value instead of composing with NaN", () => {
    assert.throws(() => parseArgs(["a.png", "--columns", "three"]), /--columns expects a number, got "three"/);
    assert.throws(() => parseArgs(["a.png", "--gap"]), /--gap expects a number, got nothing/);
  });

  it("rejects an unknown option and an empty frame list", () => {
    assert.throws(() => parseArgs(["a.png", "--rows", "2"]), /unknown option --rows/);
    assert.throws(() => parseArgs([]), /no frames given/);
  });
});

describe("snapshot strip: numeric order detection", () => {
  it("catches the glob order that reads backwards", () => {
    // Exactly what `frames/anim-0-*.png` expands to for this repo's own
    // `check animation --frames` output: the 100% frame lands first.
    const given = ["anim-0-100.png", "anim-0-20.png", "anim-0-40.png", "anim-0-60.png", "anim-0-80.png"];
    assert.deepEqual(numericOrder(given), [
      "anim-0-20.png",
      "anim-0-40.png",
      "anim-0-60.png",
      "anim-0-80.png",
      "anim-0-100.png",
    ]);
  });

  it("stays quiet when the given order is already numeric", () => {
    assert.equal(numericOrder(["f-1.png", "f-2.png", "f-10.png"]), null);
    assert.equal(numericOrder(["f-001.png", "f-002.png", "f-010.png"]), null, "zero-padded names sort correctly already");
  });

  it("compares every digit run, so animation 0 sorts before animation 1", () => {
    // A flat "last number wins" comparison would interleave the two animations:
    // 0-100 would sort after 1-20.
    const given = ["anim-1-20.png", "anim-0-100.png"];
    assert.deepEqual(numericOrder(given), ["anim-0-100.png", "anim-1-20.png"]);
  });

  it("reads digits from the filename, not from the directory", () => {
    // The directory this repo's scratchpad lives in contains digits, so scanning
    // the whole path warned about ordering two files that carry no number at all.
    assert.equal(
      numericOrder(["/tmp/claude-0/abc123/rest.png", "/tmp/claude-0/abc123/rest-recheck.png"]),
      null,
    );
    // And a numeric name still sorts even under a digit-laden directory.
    assert.deepEqual(
      numericOrder(["/tmp/x-9/f-10.png", "/tmp/x-9/f-2.png"]),
      ["/tmp/x-9/f-2.png", "/tmp/x-9/f-10.png"],
    );
  });

  it("declines to guess when a filename carries no number", () => {
    // `rest.png` / `rest-recheck.png` are in the same directory as the numbered
    // frames; there is no numeric order to suggest for them.
    assert.equal(numericOrder(["rest.png", "anim-0-20.png"]), null);
  });
});
