import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { actVerdict, newFindings, parseActAction, parseExpectation, postconditionHolds } from "./act.ts";

describe("parseExpectation", () => {
  it("reads every form, and refuses the rest by name", () => {
    assert.deepEqual(parseExpectation("url:/thanks/"), { kind: "url", pattern: "/thanks/" });
    assert.deepEqual(parseExpectation("visible:#toast"), { kind: "visible", selector: "#toast" });
    assert.deepEqual(parseExpectation("text:#cart-count=2"), { kind: "text", selector: "#cart-count", text: "2" });
    assert.deepEqual(parseExpectation("text:Total=¥3,300"), { kind: "text", text: "Total=¥3,300" });
    assert.deepEqual(parseExpectation("count:.cart li>=3"), { kind: "count", selector: ".cart li", op: ">=", n: 3 });
    assert.deepEqual(parseExpectation("value:#qty=2"), { kind: "value", selector: "#qty", value: "2" });
    assert.throws(() => parseExpectation("shown:#x"), /unknown kind "shown"/);
    assert.throws(() => parseExpectation("count:.x"), /count needs/);
    assert.throws(() => parseExpectation("url:("), /not a regular expression/);
  });
  it("judges what the page showed", () => {
    assert.equal(postconditionHolds(parseExpectation("text:#c=2"), { text: " 2 " }).holds, true);
    assert.equal(postconditionHolds(parseExpectation("hidden:.modal"), { matched: 1, onScreen: 0 }).holds, true);
    assert.equal(postconditionHolds(parseExpectation("count:li=3"), { matched: 2 }).holds, false);
  });
});

describe("parseActAction", () => {
  it("takes the first JSON object of a reply and checks it", () => {
    assert.deepEqual(parseActAction('Sure! {"action":"click","target":"e3","reason":"add"} ok'), {
      action: "click",
      target: "e3",
      reason: "add",
    });
    assert.throws(() => parseActAction("no json"), /no JSON object/);
    assert.throws(() => parseActAction('{"action":"fill","target":"#q"}'), /string value/);
    assert.throws(() => parseActAction('{"action":"hover","target":"#q"}'), /must be one of/);
  });
});

describe("actVerdict and newFindings", () => {
  it("only postconditions make a run verified; done without them is claimed", () => {
    assert.equal(actVerdict({ postconditionsHold: true, plannerSaidDone: true, plannerGaveUp: false }), "verified");
    assert.equal(actVerdict({ postconditionsHold: false, plannerSaidDone: true, plannerGaveUp: false }), "claimed");
    assert.equal(
      actVerdict({ postconditionsHold: false, plannerSaidDone: false, plannerGaveUp: false }),
      "out-of-steps",
    );
  });
  it("a finding the page already had is not the step's, even when its group's selector moved", () => {
    const before = [{ kind: "contrast", selector: "ul>li:nth-of-type(1)", message: '6 elements: "Sale" 2.1:1' }];
    const after = [
      { kind: "contrast", selector: "ul>li", message: '1 element: "Sale" 2.1:1' },
      { kind: "page-overflow-x", message: "the page scrolls sideways by 900px" },
    ];
    assert.deepEqual(
      newFindings(before, after).map((f) => f.kind),
      ["page-overflow-x"],
    );
  });
});
