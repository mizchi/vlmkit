import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { createGateRegistry } from "@mizchi/vlmkit-core/plugin/registry.ts";
import { validateGateDefinition } from "@mizchi/vlmkit-core/plugin/rules.ts";
import { formatGateHelp } from "@mizchi/vlmkit-core/plugin/runner.ts";
import { markupGatesPlugin } from "./index.ts";

/**
 * These assertions are about the *declarations*, not the measurements: they
 * run without a browser, which is the point — a malformed rule table or a
 * clashing command used to be discoverable only by running the gate against
 * a real page.
 */
describe("markup gate plugin", () => {
  it("registers without conflicts", () => {
    const registry = createGateRegistry([markupGatesPlugin]);
    assert.deepEqual(
      registry.list().map(({ gate }) => gate.command.join(" ")).sort(),
      ["check breakpoints", "check integrity", "check layout", "check motion", "check scroll"],
    );
  });

  it("passes definition validation for every gate", () => {
    for (const gate of markupGatesPlugin.gates) {
      assert.deepEqual(validateGateDefinition(gate), [], `${gate.id} failed validation`);
    }
  });

  it("keeps gate ids aligned with their commands", () => {
    for (const gate of markupGatesPlugin.gates) {
      assert.equal(gate.id, gate.command.join("."), `${gate.id} does not match its command`);
    }
  });

  it("declares a source positional and a summary for every gate", () => {
    for (const gate of markupGatesPlugin.gates) {
      assert.ok(gate.summary.length > 20, `${gate.id} needs a real summary`);
      const positional = (gate.inputs ?? []).find((i) => i.positional === 0);
      assert.ok(positional, `${gate.id} declares no primary positional`);
      assert.equal(positional!.placeholder, "html-or-url", `${gate.id} should use the documented placeholder`);
    }
  });

  it("documents the shared contract in every gate's help", () => {
    for (const gate of markupGatesPlugin.gates) {
      const help = formatGateHelp(gate);
      assert.match(help, /--advisory/, `${gate.id} help omits --advisory`);
      assert.match(help, /--rule <ref>=<setting>/, `${gate.id} help omits --rule`);
      assert.match(help, new RegExp(`Usage: vlmkit ${gate.command.join(" ")} <html-or-url>`));
    }
  });

  it("rejects a missing source before doing any work", () => {
    for (const gate of markupGatesPlugin.gates) {
      assert.throws(
        () => gate.parse([], { cwd: process.cwd(), argv: [], json: false }),
        UsageError,
        `${gate.id} should reject an empty argv with a UsageError`,
      );
    }
  });
});

describe("gate argument parsing", () => {
  const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };
  const gateFor = (command: string) =>
    markupGatesPlugin.gates.find((g) => g.command.join(" ") === command)!;

  it("check breakpoints reads its numeric flags", () => {
    const parsed = gateFor("check breakpoints").parse(
      ["page.html", "--breakpoints", "768,1024", "--height", "700", "--sweep", "--sweep-step", "50"],
      ctx,
    ) as Record<string, unknown>;
    assert.equal(parsed.source, "page.html");
    assert.deepEqual(parsed.breakpoints, [768, 1024]);
    assert.equal(parsed.height, 700);
    assert.equal(parsed.sweep, true);
    assert.equal(parsed.sweepStep, 50);
  });

  it("check breakpoints refuses a flag value that is another flag", () => {
    // The hand-rolled `Number.parseInt(argv[++i] ?? "900", 10)` this replaced
    // silently produced NaN here.
    assert.throws(() => gateFor("check breakpoints").parse(["page.html", "--height", "--json"], ctx), UsageError);
    assert.throws(() => gateFor("check breakpoints").parse(["page.html", "--breakpoints", "abc"], ctx), /not a number/);
  });

  it("check scroll parses a viewport and rejects a malformed one", () => {
    const parsed = gateFor("check scroll").parse(["page.html", "--viewport", "375x812"], ctx) as Record<string, unknown>;
    assert.deepEqual(parsed.viewport, { width: 375, height: 812 });
    assert.throws(() => gateFor("check scroll").parse(["page.html", "--viewport", "375"], ctx), /expects <width>x<height>/);
  });

  it("check integrity maps sweep widths to their documented heights", () => {
    const parsed = gateFor("check integrity").parse(["page.html", "--viewports", "1280,768,375"], ctx) as Record<string, unknown>;
    assert.deepEqual(parsed.viewports, [
      { width: 1280, height: 800 },
      { width: 768, height: 900 },
      { width: 375, height: 700 },
    ]);
  });

  it("check integrity still parses --allow before any browser starts", () => {
    const parsed = gateFor("check integrity").parse(
      ["page.html", "--allow", "text-clipped@.badge@1280;marquee clips on purpose"],
      ctx,
    ) as Record<string, unknown>;
    assert.equal(Array.isArray(parsed.allow), true);
    // The exemption DSL keeps its own rules — an exemption with no stated
    // reason is unreviewable, and that check still fires during parse.
    assert.throws(() => gateFor("check integrity").parse(["page.html", "--allow", "text-clipped@1280"], ctx), /needs a reason/);
    assert.throws(() => gateFor("check integrity").parse(["page.html", "--allow", "no-such-kind;why"], ctx));
  });

  it("check layout requires a contract", () => {
    assert.throws(() => gateFor("check layout").parse(["page.html"], ctx), /--contract <contract\.json> is required/);
    const parsed = gateFor("check layout").parse(["page.html", "--contract", "c.json"], ctx) as Record<string, unknown>;
    assert.equal(parsed.contractPath, "c.json");
  });
});

describe("finding projection", () => {
  it("normalizes check integrity's fail severity to suspect", () => {
    const gate = markupGatesPlugin.gates.find((g) => g.id === "check.integrity")!;
    const findings = gate.findings({
      source: "page.html",
      verdict: "defects",
      findings: [
        { kind: "text-collision", severity: "fail", viewport: 1280, message: "overlap", selector: ".a" },
        { kind: "broken-font", severity: "warn", viewport: 768, message: "font" },
      ],
      exempted: [],
      viewports: [],
      kickback: [],
    });
    assert.deepEqual(findings.map((f) => [f.rule, f.severity]), [
      ["text-collision", "suspect"],
      ["broken-font", "warn"],
    ]);
    assert.equal(findings[0]!.selector, ".a");
    assert.equal(findings[0]!.viewport, 1280);
  });

  it("turns each failed layout check into a rule-attributed finding", () => {
    const gate = markupGatesPlugin.gates.find((g) => g.id === "check.layout")!;
    const findings = gate.findings({
      source: "page.html",
      passed: 0,
      total: 1,
      done: false,
      results: [
        {
          rule: { selector: ".sidebar", at: 1280, width: 260 },
          viewport: 1280,
          passed: false,
          checks: [
            { name: "width", expected: "260±1px", measured: "300px", passed: false },
            { name: "perRow", expected: "3", measured: "2", passed: false },
            { name: "visible", expected: "true", measured: "true", passed: true },
          ],
        },
      ],
    });
    assert.deepEqual(findings.map((f) => f.rule), ["width", "per-row"]);
    assert.equal(findings[0]!.selector, ".sidebar");
    assert.equal(findings[0]!.viewport, 1280);
  });

  it("reports a layout redirect as its own rule, ahead of the assertions", () => {
    const gate = markupGatesPlugin.gates.find((g) => g.id === "check.layout")!;
    const findings = gate.findings({
      source: "https://app.example.com/dash",
      passed: 0,
      total: 0,
      done: false,
      results: [],
      redirected: "requested /dash, landed on /login",
    });
    assert.deepEqual(findings.map((f) => f.rule), ["redirected"]);
  });

  it("declares every rule the layout check-name map can produce", () => {
    const gate = markupGatesPlugin.gates.find((g) => g.id === "check.layout")!;
    const declared = new Set(gate.rules.map((r) => r.id));
    for (const id of ["visible", "count", "width", "min-width", "max-width", "min-height", "full-width", "per-row", "above", "no-assertion"]) {
      assert.ok(declared.has(id), `check.layout is missing rule "${id}"`);
    }
  });
});
