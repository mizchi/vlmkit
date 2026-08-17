/**
 * Fixtures are the *shapes the built module actually produces*, captured by
 * calling the generated API and printing constructor names — not invented. That
 * matters because the mangled names are the only thing identifying an error kind,
 * and a guessed name would make these tests pass while the real path stayed
 * broken.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { describeMoonBitError } from "./markup-core-error.ts";

/** Builds an object whose constructor name is `name`, as the MoonBit output does. */
function tagged(name: string, fields: Record<string, unknown>): object {
  const ctor = { [name]: class {} }[name] as new () => Record<string, unknown>;
  return Object.assign(new ctor(), fields);
}

const root = () => tagged("_M0DTPC14json8JsonPath4Root", {});
const key = (parent: object, name: string) =>
  tagged("_M0DTPC14json8JsonPath3Key", { _0: parent, _1: name });
const index = (parent: object, at: number) =>
  tagged("_M0DTPC14json8JsonPath5Index", { _0: parent, _1: at });

describe("describeMoonBitError", () => {
  it("names the field for a decode error", () => {
    // The message the JSON boundary exists to produce. Before this it was
    // `[object Object]`.
    const error = tagged(
      "_M0DTPC15error5Error61moonbitlang_2fcore_2fjson_2eJsonDecodeError_2eJsonDecodeError",
      { _0: { _0: key(root(), "width_value"), _1: "Double::from_json: expected number" } },
    );
    assert.equal(
      describeMoonBitError(error),
      "Double::from_json: expected number (at /width_value)",
    );
  });

  it("renders a nested path through arrays", () => {
    const error = tagged(
      "_M0DTPC15error5Error61moonbitlang_2fcore_2fjson_2eJsonDecodeError_2eJsonDecodeError",
      { _0: { _0: key(index(key(root(), "items"), 2), "name"), _1: "expected string" } },
    );
    assert.equal(describeMoonBitError(error), "expected string (at /items[2]/name)");
  });

  it("passes a Failure message through unchanged", () => {
    const error = tagged(
      "_M0DTPC15error5Error48moonbitlang_2fcore_2fbuiltin_2eFailure_2eFailure",
      { _0: "unknown markup-core JSON command: nope" },
    );
    assert.equal(describeMoonBitError(error), "unknown markup-core JSON command: nope");
  });

  it("locates a parse error", () => {
    // `{line, column}` is the one nested record worth special-casing; printed as
    // two bare numbers it reads as nothing.
    const error = tagged(
      "_M0DTPC15error5Error52moonbitlang_2fcore_2fjson_2eParseError_2eInvalidChar",
      { _0: tagged("_M0TPC14json8Position", { line: 1, column: 1 }), _1: 110 },
    );
    assert.equal(describeMoonBitError(error), "line 1, column 1: 110");
  });

  it("falls back to the error kind when there is no payload", () => {
    const error = tagged("_M0DTPC15error5Error20SomethingWentWrong", {});
    assert.equal(describeMoonBitError(error), "SomethingWentWrong");
  });

  it("returns undefined for values that are not MoonBit errors, so the caller can fall back", () => {
    // Guessing a description for an unrecognised value would print a confident
    // wrong answer in place of the real one.
    assert.equal(describeMoonBitError({}), undefined);
    assert.equal(describeMoonBitError(undefined), undefined);
    assert.equal(describeMoonBitError(42), undefined);
  });

  it("passes a plain string through", () => {
    assert.equal(describeMoonBitError("already a message"), "already a message");
  });

  it("terminates on a self-referential value", () => {
    // The walker follows `_0` chains; a cycle would otherwise hang the process
    // while reporting an error.
    const loop: Record<string, unknown> = {};
    loop._0 = loop;
    const error = tagged("_M0DTPC15error5Error7Looping", { _0: loop });
    assert.equal(typeof describeMoonBitError(error), "string");
  });
});
