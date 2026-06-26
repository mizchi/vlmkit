import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createModelRouter, type Budget } from "./router.ts";
import type { ModelTier } from "./types.ts";

const tiers: ModelTier[] = [
  { provider: "gemini", model: "flash-lite", vision: false },
  { provider: "gemini", model: "flash", vision: false },
  { provider: "anthropic", model: "sonnet", vision: false },
];

function budget(cap: number): Budget {
  let total = 0;
  return { budgetUsd: cap, add: (n) => (total += n), total: () => total };
}

describe("ModelRouter", () => {
  it("starts at the cheapest tier", () => {
    const r = createModelRouter({ tiers }, budget(1));
    assert.equal(r.current().model, "flash-lite");
  });

  it("escalates after escalateAfter failures", () => {
    const r = createModelRouter({ tiers, escalateAfter: 2 }, budget(1));
    r.escalate();
    assert.equal(r.current().model, "flash-lite");
    r.escalate();
    assert.equal(r.current().model, "flash");
  });

  it("stays at the last tier", () => {
    const r = createModelRouter({ tiers }, budget(1));
    r.escalate();
    r.escalate();
    r.escalate();
    r.escalate();
    assert.equal(r.current().model, "sonnet");
  });

  it("records cost and reports exhausted when shared budget exceeded", () => {
    const b = budget(0.5);
    const r = createModelRouter({ tiers }, b);
    assert.equal(r.exhausted(), false);
    r.record({ costUsd: 0.6 });
    assert.equal(r.spentUsd(), 0.6);
    assert.equal(r.exhausted(), true);
  });

  it("shares one budget across two routers", () => {
    const b = budget(1);
    const observe = createModelRouter({ tiers }, b);
    const codegen = createModelRouter({ tiers }, b);
    observe.record({ costUsd: 0.4 });
    codegen.record({ costUsd: 0.7 });
    assert.equal(codegen.spentUsd(), 1.1);
    assert.equal(observe.exhausted(), true);
  });
});
