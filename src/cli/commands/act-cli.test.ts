/**
 * `vlmkit act` (issue #220) on fixtures/act/store.html, with planners that need no key: a step
 * that breaks the layout or clicks a lying toggle is rolled back, and "done" before the
 * postconditions hold is CLAIMED, not VERIFIED.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { parseExpectation } from "@mizchi/vlmkit-judge/act.ts";
import { commandPlanner, runAct, scriptPlanner, type ActOptions } from "./act-cli.ts";

const source = join(import.meta.dirname, "../../../fixtures/act/store.html");
const T = { timeout: 120_000 };
const run = async (o: Omit<ActOptions, "source">) => {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  return withBrowser((browser) => runAct({ source, ...o }, browser));
};

describe("vlmkit act on fixtures/act/store.html", () => {
  it("a step that brings in a layout defect is rolled back; the kept steps reach the goal: VERIFIED", T, async () => {
    const r = await run({
      goal: "put two mugs in the cart",
      expectations: [parseExpectation("text:#count=2")],
      planner: scriptPlanner([
        { action: "click", target: "#promo" },
        { action: "click", target: "#add" },
        { action: "click", target: "#add" },
      ]),
    });
    assert.equal(r.outcome, "verified");
    assert.deepEqual(
      r.steps.map((s) => s.status),
      ["rolled-back", "kept", "kept"],
    );
    assert.match(r.steps[0]!.problems.join(" "), /check integrity: \[(page-overflow-x|container-protrusion)/);
    assert.equal(r.rolledBack, 1);
  });

  it(
    "a toggle whose panel does not follow aria-expanded is rolled back, and done without the panel is CLAIMED",
    T,
    async () => {
      const r = await run({
        goal: "show the specifications",
        expectations: [parseExpectation("visible:#specs")],
        planner: scriptPlanner([{ action: "click", target: "#broken" }]),
      });
      assert.equal(r.outcome, "claimed");
      assert.equal(r.steps[0]!.status, "rolled-back");
      assert.match(r.steps[0]!.problems[0]!, /aria-expanded="true" but its panel #specs is not shown/);
      assert.equal(r.postconditions[0]!.holds, false);
    },
  );

  it("a working disclosure is kept", T, async () => {
    const r = await run({
      goal: "show the details",
      expectations: [parseExpectation("visible:#details")],
      planner: scriptPlanner([{ action: "click", target: "#more" }]),
    });
    assert.equal(r.outcome, "verified");
    assert.deepEqual(r.steps[0]!.problems, []);
  });

  it("--planner-cmd: a program picks a control by its observed id (e3) and the replay uses a selector", T, async () => {
    const pick =
      "node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const c=JSON.parse(s);const t=c.observation.controls.find(x=>x.name==='Add to cart');console.log(JSON.stringify({action:'click',target:t.id,reason:'add one'}))})\"";
    const r = await run({
      goal: "put one mug in the cart",
      expectations: [parseExpectation("text:#count=1")],
      planner: commandPlanner(pick),
    });
    assert.equal(r.outcome, "verified");
    assert.match((r.steps[0]!.action as { target: string }).target, /^e\d+$/);
    assert.equal((r.steps[0]!.replay as { target: string }).target, "#add");
  });

  it("an unusable reply is recorded and the planner is told why", T, async () => {
    let calls = 0;
    let told = "";
    const r = await run({
      goal: "put one mug in the cart",
      expectations: [parseExpectation("text:#count=1")],
      maxSteps: 3,
      planner: {
        name: "fake",
        next: async (ctx) => {
          calls++;
          if (ctx.replyError) told = ctx.replyError;
          return calls === 1 ? "I will click the add button." : '{"action":"click","target":"#add"}';
        },
      },
    });
    assert.equal(r.outcome, "verified");
    assert.equal(r.steps[0]!.status, "invalid");
    assert.match(told, /no JSON object/);
  });
});

describe("vlmkit act --trace", () => {
  it("records only the kept steps, and the trace replays as an @playwright/test spec", T, async () => {
    const { compileTrace } = await import("@mizchi/vlmkit-judge/session-trace.ts");
    const { runSpec } = await import("@mizchi/vlmkit-markup/record/run-spec.ts");
    const r = await run({
      goal: "show the details and put two mugs in the cart",
      expectations: [parseExpectation("text:#count=2"), parseExpectation("visible:#details")],
      trace: true,
      planner: scriptPlanner([
        { action: "click", target: "#promo" },
        { action: "click", target: "#more" },
        { action: "click", target: "#add" },
        { action: "click", target: "#add" },
      ]),
    });
    assert.equal(r.outcome, "verified");
    assert.ok(r.trace);
    assert.equal(r.trace.steps.length, 3, "the rolled-back promo click is not in the trace");
    assert.equal(r.trace.source.recordedBy, "vlmkit act");
    const spec = compileTrace(r.trace);
    assert.match(spec, /getByRole\("button", \{ name: "Details", exact: true \}\)\.click\(\)/);
    assert.match(spec, /toHaveAttribute\("aria-expanded", "true"\)/);
    const replay = runSpec(spec);
    assert.ok(replay.passed, replay.output);
  });
});
