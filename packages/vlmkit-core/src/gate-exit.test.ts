import assert from "node:assert/strict";
import { test } from "node:test";
import { gateExitCode, parseGateExitFlags } from "./gate-exit.ts";

test("a suspect fails by default — the contract the audit demanded", () => {
  assert.equal(gateExitCode(true, { advisory: false }), 1);
  assert.equal(gateExitCode(false, { advisory: false }), 0);
});

test("--advisory opts back into print-and-succeed for pilots", () => {
  assert.equal(gateExitCode(true, { advisory: true }), 0);
  assert.equal(gateExitCode(false, { advisory: true }), 0);
});

test("--fail-on-suspect stays accepted as a no-op so existing scripts keep working", () => {
  const flags = parseGateExitFlags(["page.html", "--fail-on-suspect"]);
  assert.equal(flags.advisory, false);
  assert.equal(gateExitCode(true, flags), 1); // same as without the flag
});

test("flag parsing", () => {
  assert.deepEqual(parseGateExitFlags(["a.html"]), { advisory: false });
  assert.deepEqual(parseGateExitFlags(["a.html", "--advisory"]), { advisory: true });
});
