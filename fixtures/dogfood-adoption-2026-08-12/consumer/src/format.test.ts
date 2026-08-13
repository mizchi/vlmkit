import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCents, orderState } from "./format.ts";

describe("formatCents", () => {
  it("pads the minor unit", () => {
    assert.equal(formatCents(1205), "$12.05");
    assert.equal(formatCents(1250), "$12.50");
    assert.equal(formatCents(7), "$0.07");
  });
  it("keeps the sign outside the symbol", () => {
    assert.equal(formatCents(-1205), "-$12.05");
  });
});

describe("orderState", () => {
  it("cancelled wins over shipped", () => {
    assert.equal(orderState(true, true), "cancelled");
    assert.equal(orderState(true, false), "shipped");
    assert.equal(orderState(false, false), "open");
  });
});
