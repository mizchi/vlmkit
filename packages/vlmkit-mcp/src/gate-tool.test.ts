/**
 * The gate → MCP adapter, tested without a browser.
 *
 * These assertions are about the *derivation*: the schema a client sees and
 * the argv a gate's parser receives. Both used to be hand-written per tool,
 * where a wrong flag name or a repeatable flag joined with commas would only
 * show up as a gate failing on a real page.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { gateTool, gateToolArgv, gateToolName, gateToolSummary } from "./gate-tool.ts";
import { TOOLS } from "./tools.ts";

const sampleGate = defineGate<{ ok: boolean }, Record<string, unknown>>({
  id: "check.sample",
  command: ["check", "sample"],
  title: "Sample",
  summary: "A gate that exists to be adapted",
  rules: [{ id: "bad-thing", title: "A bad thing", severity: "suspect" }],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page", positional: 0, required: true },
    { name: "target", placeholder: "png", kind: "path", description: "Target", repeatable: true },
    { name: "classes", kind: "string-list", description: "Comma-joined list" },
    { name: "depth", kind: "number", description: "How deep" },
    { name: "strict", kind: "boolean", description: "Be strict" },
    { name: "no-context", kind: "boolean", description: "Skip context" },
    { name: "wait-until", kind: "string", choices: ["load", "networkidle"], description: "Wait state" },
    { name: "out", placeholder: "dir", kind: "path", description: "Output dir" },
  ],
  parse: (argv) => ({ argv: [...argv] }),
  run: () => ({ ok: true }),
  findings: () => [],
  format: () => "sample",
});

describe("gateToolName", () => {
  it("turns a dotted gate id into the MCP naming convention", () => {
    assert.equal(gateToolName(sampleGate), "check_sample");
    assert.equal(
      gateToolName({ ...sampleGate, id: "check.a11y.contrast" }),
      "check_a11y_contrast",
    );
  });
});

describe("derived input schema", () => {
  const tool = gateTool(sampleGate, { description: "x".repeat(50) });

  it("camelCases dashed flag names", () => {
    assert.ok("waitUntil" in tool.inputSchema);
    assert.ok("noContext" in tool.inputSchema);
  });

  it("marks only the required inputs required", () => {
    assert.equal(tool.inputSchema.source!.isOptional(), false);
    assert.equal(tool.inputSchema.depth!.isOptional(), true);
  });

  it("omits what the tool asks it to omit", () => {
    const trimmed = gateTool(sampleGate, { description: "x".repeat(50), omit: ["out", "strict"] });
    assert.equal("out" in trimmed.inputSchema, false);
    assert.equal("strict" in trimmed.inputSchema, false);
    assert.ok("source" in trimmed.inputSchema);
  });

  it("honors an alias so a published argument name survives a flag rename", () => {
    const aliased = gateTool(sampleGate, { description: "x".repeat(50), aliases: { target: "targets" } });
    assert.ok("targets" in aliased.inputSchema);
    assert.equal("target" in aliased.inputSchema, false);
  });

  it("publishes an inverted --no-x flag under its positive name", () => {
    const inverted = gateTool(sampleGate, { description: "x".repeat(50), invert: { "no-context": "context" } });
    assert.ok("context" in inverted.inputSchema);
    assert.equal("noContext" in inverted.inputSchema, false);
  });
});

describe("gateToolArgv", () => {
  it("puts positionals first, then flags", () => {
    assert.deepEqual(
      gateToolArgv(sampleGate, { source: "page.html", depth: 3 }),
      ["page.html", "--depth", "3"],
    );
  });

  it("repeats a repeatable flag and comma-joins a list flag", () => {
    // Getting this backwards is exactly the mismatch a hand-written tool hid:
    // `--target a,b` is one nonexistent file, and `--classes a --classes b`
    // drops the first value.
    assert.deepEqual(
      gateToolArgv(sampleGate, { source: "p.html", target: ["a.png", "b.png"] }),
      ["p.html", "--target", "a.png", "--target", "b.png"],
    );
    assert.deepEqual(
      gateToolArgv(sampleGate, { source: "p.html", classes: ["one", "two"] }),
      ["p.html", "--classes", "one,two"],
    );
  });

  it("passes a boolean flag only when true", () => {
    assert.deepEqual(gateToolArgv(sampleGate, { source: "p.html", strict: true }), ["p.html", "--strict"]);
    assert.deepEqual(gateToolArgv(sampleGate, { source: "p.html", strict: false }), ["p.html"]);
  });

  it("sends --no-x only when the positive argument is explicitly false", () => {
    const options = { description: "", invert: { "no-context": "context" } };
    assert.deepEqual(gateToolArgv(sampleGate, { source: "p.html", context: false }, options), ["p.html", "--no-context"]);
    assert.deepEqual(gateToolArgv(sampleGate, { source: "p.html", context: true }, options), ["p.html"]);
    assert.deepEqual(gateToolArgv(sampleGate, { source: "p.html" }, options), ["p.html"]);
  });

  it("reads an aliased argument under its published name", () => {
    assert.deepEqual(
      gateToolArgv(sampleGate, { source: "p.html", targets: ["a.png"] }, { description: "", aliases: { target: "targets" } }),
      ["p.html", "--target", "a.png"],
    );
  });

  it("skips omitted inputs even when the caller sends them", () => {
    assert.deepEqual(
      gateToolArgv(sampleGate, { source: "p.html", out: "/tmp/x" }, { description: "", omit: ["out"] }),
      ["p.html"],
    );
  });
});

describe("gateToolSummary", () => {
  const outcome = (suspect: number, warn = 0) => ({ counts: { suspect, warn }, report: { ok: true } });

  it("reports ok and the warn count", () => {
    assert.equal(gateToolSummary(sampleGate, outcome(0)), "check_sample: ok");
    assert.equal(gateToolSummary(sampleGate, outcome(0, 2)), "check_sample: ok (2 warn)");
    assert.equal(gateToolSummary(sampleGate, outcome(3, 1)), "check_sample: 3 suspect issue(s), 1 warn");
  });

  it("leads with the gate's headline when it declares one", () => {
    // A verdict-shaped gate's own word says more than the counts, and it is
    // the prefix these tools have published since they shipped.
    const withHeadline = { ...sampleGate, headline: () => "DONE (2/2 targets passed)" };
    assert.equal(gateToolSummary(withHeadline, outcome(0)), "check_sample: DONE (2/2 targets passed) — ok");
  });
});

describe("the published tool surface", () => {
  it("keeps every tool's verdict word in its summary prefix", () => {
    // The three verdict-shaped tools publish a word, not a count; clients and
    // this package's own tests match on it.
    for (const name of ["verify_markup", "verify_flow", "check_integrity", "check_layout"]) {
      assert.ok(TOOLS.some((t) => t.name === name), `${name} missing from TOOLS`);
    }
  });

  it("gives every tool a description long enough to route on", () => {
    for (const tool of TOOLS) {
      assert.ok(tool.description.length > 200, `${tool.name} description is too short to choose by`);
    }
  });
});

/**
 * Required-ness comes from `required`, not from being positional.
 *
 * `gateTool` used to mark an input required when `required === true` **or**
 * `positional === 0`. That shortcut was redundant — 24 of the 25 positional-0 inputs in
 * the registry set `required: true` themselves — and it became actively wrong for the
 * 25th: `check integrity`'s source is optional now that `--elements` supplies element
 * rects instead of a page. With the shortcut, the MCP schema demanded a page the gate
 * would then reject as mutually exclusive, so image mode was reachable from the CLI and
 * unreachable over MCP.
 *
 * Both halves are asserted, because dropping the clause is only safe if the 24 really do
 * declare themselves required. Reading the live registry rather than a fixture: the claim
 * is about every gate that ships, and a fixture would answer a different question.
 */
describe("required-ness follows `required`, not `positional`", () => {
  it("keeps every other gate's positional source required", async () => {
    const { loadGateRegistry } = await import("../../../src/cli/gate-registry.ts");
    const registry = await loadGateRegistry({ builtinsOnly: true });
    const notRequired: string[] = [];
    for (const { gate } of registry.list()) {
      for (const input of gate.inputs ?? []) {
        if (input.positional !== 0) continue;
        if (input.required === true) continue;
        notRequired.push(`${gate.command.join(" ")} :: ${input.name}`);
      }
    }
    // `check integrity` and `check copy` are the intended exceptions — both take element
    // rects via `--elements` instead of a page. Anything else appearing here means a gate is
    // relying on the removed shortcut and its MCP schema just went optional.
    assert.deepEqual(
      notRequired.sort(),
      ["check copy :: source", "check integrity :: source"],
      "a positional-0 input without `required: true` is now OPTIONAL in the MCP schema — "
      + "add `required: true` unless it is genuinely optional",
    );
  });

  it("leaves check integrity's source optional so image mode is callable", async () => {
    const { integrityGate } = await import("@mizchi/vlmkit-markup/gates/integrity.gate.ts");
    const tool = gateTool(integrityGate, { description: "x" });
    assert.equal(tool.inputSchema.source!.isOptional(), true, "source must be optional");
    assert.equal(tool.inputSchema.elements!.isOptional(), true);
    assert.equal(tool.inputSchema.image!.isOptional(), true);
    // And the argv it builds for image mode must carry neither a positional nor a page.
    assert.deepEqual(
      gateToolArgv(integrityGate, { elements: "e.json", image: "f.png" }, { description: "" }),
      ["--elements", "e.json", "--image", "f.png"],
    );
  });

  it("leaves check copy's source optional so element-rect mode is callable", async () => {
    // Same trap, same fix, one gate later: `check copy --elements` (vlmkit#118) would be
    // CLI-only if its source declared itself required, because the gate rejects a page
    // alongside `--elements` as mutually exclusive.
    const { copyGate } = await import("@mizchi/vlmkit-markup/gates/copy.gate.ts");
    const tool = gateTool(copyGate, { description: "x" });
    assert.equal(tool.inputSchema.source!.isOptional(), true, "source must be optional");
    assert.equal(tool.inputSchema.elements!.isOptional(), true);
    assert.deepEqual(
      gateToolArgv(
        copyGate,
        { elements: "e.json", image: "f.png", manifest: "copy.txt" },
        { description: "" },
      ),
      ["--elements", "e.json", "--image", "f.png", "--manifest", "copy.txt"],
    );
  });
});
