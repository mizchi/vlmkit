/**
 * `check crater`'s prose under rule settings.
 *
 * Its own package, because the gate lives here rather than in `vlmkit-markup` where the other
 * twenty-five are — `packages/vlmkit-markup/src/gates/rule-aware-prose.test.ts` covers those.
 *
 * `unavailable` is the rule this gate exists to have turned off: a repo that runs Crater in one
 * CI job wants the other jobs to print `skip` in grey, not a yellow warning under an exit 0.
 * `--require` is the opposite request, and it raises the severity in `findings` rather than in
 * the rule table — which is why the formatter reads back the EMITTED severity (`info`) and not
 * the table's, the same distinction that produced `ruleTier`.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ruleViewFrom } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { formatCraterSmokeReport } from "./crater-smoke.ts";

/** `\x1b` explicitly: a pattern that drops it leaves the escape byte behind and every match misses. */
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("check crater", () => {
  const skipped = {
    url: "http://127.0.0.1:9999", status: "skip", elapsedMs: 12,
    checks: [{ name: "reachable", status: "skip", elapsedMs: 12, message: "connection refused" }],
  };
  const failed = {
    url: "http://127.0.0.1:7000", status: "fail", elapsedMs: 240,
    checks: [
      { name: "reachable", status: "pass", elapsedMs: 10, message: "ok" },
      { name: "render-css", status: "fail", elapsedMs: 230, message: "flex column ignored" },
    ],
  };

  it("unavailable off prints the skip without colouring it a warning", () => {
    const off = plain(formatCraterSmokeReport(skipped as never, ruleViewFrom({ unavailable: "off" })));
    assert.match(off, /status: skip/, "still says what happened");
    assert.match(off, /SKIP reachable/, "and the check row stays");
  });

  it("check-failed off says the failures below are measured, not reported", () => {
    const off = plain(formatCraterSmokeReport(failed as never, ruleViewFrom({ "check-failed": "off" })));
    assert.match(off, /status: fail \(check-failed off — the failures below are measured, not reported\)/);
    assert.match(off, /FAIL render-css/, "the row keeps its message — that is the measurement");
  });

  it("unset is unchanged", () => {
    const bare = plain(formatCraterSmokeReport(failed as never));
    assert.equal(plain(formatCraterSmokeReport(failed as never, ruleViewFrom({}))), bare);
    assert.match(bare, /status: fail$/m);
    assert.doesNotMatch(bare, /not reported/);
  });
});
