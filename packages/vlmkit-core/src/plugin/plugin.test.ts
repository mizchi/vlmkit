import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { UsageError } from "../cli-error.ts";
import { defineGate, definePlugin, ruleRef } from "./contract.ts";
import type { Finding, GateDefinition } from "./contract.ts";
import { asPlugin, loadPlugins, readPluginSpecifiers } from "./load.ts";
import {
  createGateRegistry,
  editDistance,
  validateGateCommands,
  validateRuleSettings,
} from "./registry.ts";
import {
  applyRuleSettings,
  countFindings,
  parseRuleSettings,
  resolveRules,
  validateGateDefinition,
} from "./rules.ts";
import {
  formatGateHelp,
  formatRuleTable,
  newOutputNotice,
  parseSharedFlags,
  runGate,
  runGateCli,
  stripSharedFlags,
  unpinnedLiveInput,
  withExitIntent,
} from "./runner.ts";

interface FakeReport {
  source: string;
  hits: Finding[];
}

interface FakeOptions {
  source: string;
  strict: boolean;
}

/** A gate with two rules, one of each severity, so re-tuning is observable. */
function fakeGate(overrides: Partial<GateDefinition<FakeReport, FakeOptions>> = {}) {
  return defineGate<FakeReport, FakeOptions>({
    id: "check.fake",
    command: ["check", "fake"],
    title: "Fake gate",
    summary: "A gate that reports whatever the test hands it",
    rules: [
      { id: "bad-thing", title: "A bad thing", severity: "suspect" },
      { id: "odd-thing", title: "An odd thing", severity: "warn" },
    ],
    inputs: [
      { name: "source", kind: "path-or-url", description: "Page", positional: 0, required: true },
      { name: "strict", kind: "boolean", description: "Be strict" },
    ],
    parse: (argv) => {
      const source = argv.find((a) => !a.startsWith("-"));
      if (!source) throw new UsageError("missing <source>");
      return { source, strict: argv.includes("--strict") };
    },
    run: (options) => ({
      source: options.source,
      hits: options.strict
        ? [
          { rule: "bad-thing", severity: "suspect", message: "boom", selector: ".a" },
          { rule: "odd-thing", severity: "warn", message: "hmm" },
        ]
        : [],
    }),
    findings: (report) => report.hits,
    format: (report) => `fake: ${report.hits.length} hit(s) on ${report.source}`,
    ...overrides,
  });
}

describe("validateGateDefinition", () => {
  it("accepts a well-formed definition", () => {
    assert.deepEqual(validateGateDefinition(fakeGate()), []);
  });

  it("rejects a duplicate rule id — a setting for it would be ambiguous", () => {
    const gate = fakeGate({
      rules: [
        { id: "dup", title: "One", severity: "warn" },
        { id: "dup", title: "Two", severity: "suspect" },
      ],
    });
    assert.match(validateGateDefinition(gate).join("\n"), /duplicate rule id "dup"/);
  });

  it("rejects an empty rule table", () => {
    assert.match(validateGateDefinition(fakeGate({ rules: [] })).join("\n"), /rules table is empty/);
  });

  it("rejects non-slug ids, which would break config keys", () => {
    assert.match(validateGateDefinition(fakeGate({ id: "Check_Fake" })).join("\n"), /must be lowercase/);
    assert.match(
      validateGateDefinition(fakeGate({ rules: [{ id: "badThing", title: "x", severity: "warn" }] })).join("\n"),
      /rule id "badThing" must be a lowercase slug/,
    );
  });
});

describe("createGateRegistry", () => {
  it("registers and resolves by command and id", () => {
    const registry = createGateRegistry([definePlugin({ name: "test", gates: [fakeGate()] })]);
    assert.equal(registry.byId("check.fake")?.title, "Fake gate");
    assert.equal(registry.byCommand("check fake")?.id, "check.fake");
    assert.equal(registry.byCommand(["check", "fake"])?.id, "check.fake");
    assert.equal(registry.list().length, 1);
    assert.equal(registry.list()[0]!.plugin, "test");
  });

  it("resolves the longest matching prefix and returns the remaining argv", () => {
    const two = fakeGate();
    const three = fakeGate({ id: "check.fake.deep", command: ["check", "fake", "deep"] });
    const registry = createGateRegistry([definePlugin({ name: "test", gates: [two, three] })]);
    const resolved = registry.resolve(["check", "fake", "deep", "page.html", "--json"]);
    assert.equal(resolved?.gate.id, "check.fake.deep");
    assert.deepEqual(resolved?.rest, ["page.html", "--json"]);
    const shallow = registry.resolve(["check", "fake", "page.html"]);
    assert.equal(shallow?.gate.id, "check.fake");
    assert.deepEqual(shallow?.rest, ["page.html"]);
  });

  it("refuses two plugins claiming the same id or command", () => {
    const a = definePlugin({ name: "a", gates: [fakeGate()] });
    const b = definePlugin({ name: "b", gates: [fakeGate()] });
    assert.throws(() => createGateRegistry([a, b]), /registered by both a and b/);
    const c = definePlugin({ name: "c", gates: [fakeGate({ id: "check.other" })] });
    assert.throws(() => createGateRegistry([a, c]), /command "check fake" is registered by both/);
  });

  it("groups leaves by their first command token", () => {
    const registry = createGateRegistry([
      definePlugin({ name: "test", gates: [fakeGate(), fakeGate({ id: "scan.fake", command: ["scan", "fake"] })] }),
    ]);
    assert.deepEqual([...registry.groups().keys()].sort(), ["check", "scan"]);
    assert.equal(registry.groups().get("check")!.length, 1);
  });

  it("suggests near misses so a typo is not reported as an unknown gate", () => {
    const registry = createGateRegistry([definePlugin({ name: "test", gates: [fakeGate()] })]);
    assert.deepEqual(registry.suggest("check fak"), ["check fake"]);
    assert.deepEqual(registry.suggest("diff png"), []);
  });

  it("stays quiet for a merely different command in the same group", () => {
    // Regression: with a length-proportional edit budget, `check design` (a
    // real gate awaiting migration) suggested `check motion`, which made
    // `vlmkit gates` warn about a valid config.
    const registry = createGateRegistry([
      definePlugin({ name: "test", gates: [fakeGate({ id: "check.motion", command: ["check", "motion"] })] }),
    ]);
    assert.deepEqual(registry.suggest("check design"), []);
    assert.deepEqual(registry.suggest("check motin"), ["check motion"]);
  });

  it("measures edit distance", () => {
    assert.equal(editDistance("check fake", "check fake"), 0);
    assert.equal(editDistance("check fak", "check fake"), 1);
  });
});

describe("validateGateCommands", () => {
  const registry = createGateRegistry([definePlugin({ name: "test", gates: [fakeGate()] })]);

  it("accepts a command with trailing flags", () => {
    assert.deepEqual(validateGateCommands(registry, ["check fake page.html --json"]), []);
  });

  it("reports an unknown command with a suggestion", () => {
    const problems = validateGateCommands(registry, ["check fak"]);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!.message, /unknown gate "check fak" — did you mean "check fake"\?/);
  });

  it("reports every bad entry, not just the first", () => {
    assert.equal(validateGateCommands(registry, ["nope one", "nope two"]).length, 2);
  });
});

describe("validateRuleSettings", () => {
  const gate = fakeGate();
  const registry = createGateRegistry([definePlugin({ name: "test", gates: [gate] })]);

  it("accepts qualified references and gate-wide keys", () => {
    assert.deepEqual(
      validateRuleSettings(registry, { "check.fake/bad-thing": "off", "check.fake/*": "warn", "check.fake": "warn" }),
      [],
    );
  });

  it("rejects an unknown rule id — the typo config settings exist to catch", () => {
    const problems = validateRuleSettings(registry, { "check.fake/bad-thng": "off" });
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /has no rule "bad-thng"/);
    assert.match(problems[0]!, /known: bad-thing, odd-thing/);
  });

  it("rejects an unknown gate id", () => {
    assert.match(validateRuleSettings(registry, { "check.nope/x": "off" })[0]!, /unknown gate id "check.nope"/);
  });

  it("resolves a bare rule id only inside a gate scope", () => {
    assert.deepEqual(validateRuleSettings(registry, { "bad-thing": "off" }, gate), []);
    assert.match(
      validateRuleSettings(registry, { "bad-thing": "off" })[0]!,
      /neither a gate id nor a rule reference/,
    );
  });
});

describe("parseRuleSettings", () => {
  it("accepts the four settings", () => {
    assert.deepEqual(parseRuleSettings({ a: "off", b: "suspect", c: "warn", d: "info" }, "x"), {
      a: "off",
      b: "suspect",
      c: "warn",
      d: "info",
    });
  });

  it("names the path and the bad value", () => {
    assert.throws(() => parseRuleSettings({ a: "disabled" }, "defaults.rules"), /defaults\.rules\["a"\]/);
    assert.throws(() => parseRuleSettings({ a: true }, "defaults.rules"), /must be one of off, suspect, warn, info/);
    assert.throws(() => parseRuleSettings([], "defaults.rules"), /must be an object/);
  });
});

describe("resolveRules", () => {
  const gate = fakeGate();

  it("defaults to each rule's declared severity", () => {
    const resolved = resolveRules(gate);
    assert.equal(resolved.decisions.get("bad-thing")!.effective, "suspect");
    assert.equal(resolved.decisions.get("odd-thing")!.effective, "warn");
    assert.deepEqual(resolved.unmatched, []);
  });

  it("prefers the most specific key regardless of declaration order", () => {
    const resolved = resolveRules(gate, { "check.fake": "warn", "check.fake/bad-thing": "off" });
    assert.equal(resolved.decisions.get("bad-thing")!.effective, "off");
    assert.equal(resolved.decisions.get("bad-thing")!.via, "check.fake/bad-thing");
    assert.equal(resolved.decisions.get("odd-thing")!.effective, "warn");
    assert.equal(resolved.decisions.get("odd-thing")!.via, "check.fake");
  });

  it("reports a key that matched nothing", () => {
    assert.deepEqual(resolveRules(gate, { "check.fake/nope": "off" }).unmatched, ["check.fake/nope"]);
  });
});

describe("applyRuleSettings", () => {
  const gate = fakeGate();
  const findings: Finding[] = [
    { rule: "bad-thing", severity: "suspect", message: "boom" },
    { rule: "odd-thing", severity: "warn", message: "hmm" },
  ];

  it("passes findings through untouched with no settings", () => {
    const applied = applyRuleSettings(gate, findings);
    assert.equal(applied.findings.length, 2);
    assert.deepEqual(applied.suppressed, []);
    assert.deepEqual(applied.retuned, []);
  });

  it("suppresses instead of dropping silently", () => {
    const applied = applyRuleSettings(gate, findings, { "check.fake/bad-thing": "off" });
    assert.deepEqual(applied.findings.map((f) => f.rule), ["odd-thing"]);
    assert.equal(applied.suppressed.length, 1);
    assert.equal(applied.suppressed[0]!.via, "check.fake/bad-thing");
  });

  it("re-tunes severity and records the change", () => {
    const applied = applyRuleSettings(gate, findings, { "check.fake/bad-thing": "warn" });
    assert.equal(applied.findings.find((f) => f.rule === "bad-thing")!.severity, "warn");
    assert.deepEqual(applied.retuned.map((r) => [r.from, r.to]), [["suspect", "warn"]]);
  });

  it("keeps a gate's own severity judgment when no setting applies", () => {
    // The gate emitted `warn` for a rule whose default is `suspect` — an
    // evidence-based downgrade that must survive.
    const applied = applyRuleSettings(gate, [{ rule: "bad-thing", severity: "warn", message: "maybe" }]);
    assert.equal(applied.findings[0]!.severity, "warn");
    assert.deepEqual(applied.retuned, []);
  });

  it("reports an undeclared rule id as a gate bug and keeps the finding", () => {
    const applied = applyRuleSettings(gate, [{ rule: "surprise", severity: "suspect", message: "?" }]);
    assert.deepEqual(applied.undeclared, ["surprise"]);
    assert.equal(applied.findings.length, 1);
  });
});

describe("countFindings", () => {
  it("counts by severity", () => {
    assert.deepEqual(
      countFindings([
        { rule: "a", severity: "suspect", message: "" },
        { rule: "b", severity: "warn", message: "" },
        { rule: "c", severity: "warn", message: "" },
        { rule: "d", severity: "info", message: "" },
      ]),
      { suspect: 1, warn: 2, info: 1 },
    );
  });
});

describe("shared flags", () => {
  it("parses the runner-owned flags", () => {
    const flags = parseSharedFlags(["page.html", "--json", "--advisory", "--rule", "check.fake/bad-thing=off"]);
    assert.equal(flags.json, true);
    assert.equal(flags.advisory, true);
    assert.deepEqual(flags.ruleOverrides, { "check.fake/bad-thing": "off" });
  });

  it("rejects a malformed --rule", () => {
    assert.throws(() => parseSharedFlags(["--rule", "check.fake/bad-thing"]), /expects <ruleRef>=<setting>/);
    assert.throws(() => parseSharedFlags(["--rule", "check.fake/bad-thing=nope"]), /must be one of/);
    assert.throws(() => parseSharedFlags(["--rule"]), /needs <ruleRef>=/);
  });

  it("hides them from the gate's own parser", () => {
    assert.deepEqual(
      stripSharedFlags(["page.html", "--json", "--rule", "a=off", "--strict", "--fail-on-suspect"]),
      ["page.html", "--strict"],
    );
  });
});

describe("runGate", () => {
  it("passes with no findings", async () => {
    const outcome = await runGate(fakeGate(), ["page.html"], { ledger: false });
    assert.equal(outcome.verdict, "pass");
    assert.equal(outcome.exitCode, 0);
    assert.match(outcome.text, /fake: 0 hit\(s\) on page\.html/);
  });

  it("fails on a suspect", async () => {
    const outcome = await runGate(fakeGate(), ["page.html", "--strict"], { ledger: false });
    assert.equal(outcome.verdict, "fail");
    assert.equal(outcome.exitCode, 1);
    assert.deepEqual(outcome.counts, { suspect: 1, warn: 1, info: 0 });
  });

  it("--advisory keeps the verdict but zeroes the exit code", async () => {
    const outcome = await runGate(fakeGate(), ["page.html", "--strict", "--advisory"], { ledger: false });
    assert.equal(outcome.verdict, "fail");
    assert.equal(outcome.exitCode, 0);
  });

  it("a warn never fails the command", async () => {
    const gate = fakeGate({
      run: (options) => ({ source: options.source, hits: [{ rule: "odd-thing", severity: "warn", message: "hmm" }] }),
    });
    const outcome = await runGate(gate, ["page.html"], { ledger: false });
    assert.equal(outcome.verdict, "pass");
    assert.equal(outcome.exitCode, 0);
  });

  it("--rule off can turn a failing run green, and says so", async () => {
    const outcome = await runGate(
      fakeGate(),
      ["page.html", "--strict", "--rule", "check.fake/bad-thing=off"],
      { ledger: false },
    );
    assert.equal(outcome.verdict, "pass");
    assert.equal(outcome.exitCode, 0);
    assert.match(outcome.text, /1 finding\(s\) suppressed by rule settings/);
    assert.match(outcome.text, /bad-thing x1/);
  });

  it("rejects a --rule naming this gate and a rule it does not have", async () => {
    // A typo that silences nothing is the exact failure mode rule settings
    // exist to remove, so it fails the run rather than being ignored.
    await assert.rejects(
      () => runGate(fakeGate(), ["page.html", "--rule", "check.fake/bad-thng=off"], { ledger: false }),
      /--rule check\.fake\/bad-thng: check\.fake has no rule "bad-thng"\. Known: bad-thing, odd-thing/,
    );
  });

  it("accepts a --rule for another gate, and a bare rule id", async () => {
    // `vlmkit gates` appends every `--rule` from `defaults.rules` to every job,
    // so a gate legitimately receives references meant for its neighbours.
    // Erroring on those would make a shared default impossible to express.
    const other = await runGate(fakeGate(), ["page.html", "--rule", "check.other/whatever=off"], { ledger: false });
    assert.equal(other.verdict, "pass");
    const bare = await runGate(fakeGate(), ["page.html", "--strict", "--rule", "bad-thing=off"], { ledger: false });
    assert.equal(bare.verdict, "pass");
  });

  it("accepts a gate-wide wildcard reference", async () => {
    const outcome = await runGate(fakeGate(), ["page.html", "--strict", "--rule", "check.fake/*=off"], { ledger: false });
    assert.equal(outcome.verdict, "pass");
    assert.equal(outcome.rules.suppressed.length, 2);
  });

  it("--rule beats a project setting for the same reference", async () => {
    const outcome = await runGate(fakeGate(), ["page.html", "--strict", "--rule", "check.fake/bad-thing=suspect"], {
      ledger: false,
      rules: { "check.fake/bad-thing": "off" },
    });
    assert.equal(outcome.verdict, "fail");
  });

  it("applies project rule settings", async () => {
    const outcome = await runGate(fakeGate(), ["page.html", "--strict"], {
      ledger: false,
      rules: { "check.fake/bad-thing": "warn" },
    });
    assert.equal(outcome.verdict, "pass");
    assert.deepEqual(outcome.counts, { suspect: 0, warn: 2, info: 0 });
    assert.match(outcome.text, /re-tuned: bad-thing suspect->warn/);
  });

  it("--json emits one envelope shape for every gate", async () => {
    const outcome = await runGate(fakeGate(), ["page.html", "--strict", "--json"], { ledger: false });
    const parsed = JSON.parse(outcome.text) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed), [
      "gate",
      "command",
      "verdict",
      "counts",
      "findings",
      "suppressed",
      "retuned",
      "report",
    ]);
    assert.equal(parsed.gate, "check.fake");
    assert.equal(parsed.command, "check fake");
    assert.equal(parsed.verdict, "fail");
  });

  it("surfaces an undeclared rule id in the output", async () => {
    const gate = fakeGate({
      run: (options) => ({ source: options.source, hits: [{ rule: "surprise", severity: "suspect", message: "?" }] }),
    });
    const outcome = await runGate(gate, ["page.html"], { ledger: false });
    assert.match(outcome.text, /emitted undeclared rule id\(s\): surprise/);
  });

  it("lets a UsageError out so the CLI error handler can print one line", async () => {
    await assert.rejects(() => runGate(fakeGate(), ["--strict"], { ledger: false }), /missing <source>/);
  });

  it("appends the ledger entry the definition declares", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "vlmkit-plugin-"));
    try {
      const gate = fakeGate({
        ledger: (report) => ({ tool: "check-fake", source: report.source, headline: { hits: report.hits.length } }),
      });
      await runGate(gate, ["page.html", "--strict"], { cwd });
      const line = readFileSync(join(cwd, ".vlmkit", "run-ledger.jsonl"), "utf-8").trim();
      const entry = JSON.parse(line) as Record<string, unknown>;
      assert.equal(entry.tool, "check-fake");
      assert.deepEqual(entry.headline, { hits: 2 });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("honors a definition that opts out of the ledger", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "vlmkit-plugin-"));
    try {
      await runGate(fakeGate({ ledger: () => null }), ["page.html"], { cwd });
      assert.equal(existsSync(join(cwd, ".vlmkit", "run-ledger.jsonl")), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * The phase split exists so `vlmkit bench gates` can say where a gate's time
 * goes, and so the claim "rules are not separately executed" is measured rather
 * than asserted. These check the accounting, not the durations.
 */
describe("runGate timing", () => {
  it("reports every phase, and they account for the total", async () => {
    const outcome = await runGate(fakeGate(), ["page.html", "--strict"], { ledger: false });
    const t = outcome.timing;
    for (const [phase, ms] of Object.entries(t)) {
      assert.equal(typeof ms, "number", `${phase} is not a number`);
      assert.ok(Number.isFinite(ms) && ms >= 0, `${phase} is ${ms}`);
    }
    const parts = t.parseMs + t.runMs + t.findingsMs + t.rulesMs + t.formatMs + t.ledgerMs;
    // The parts cannot exceed the total; the slack is the runner's own overhead.
    assert.ok(parts <= t.totalMs + 1, `parts ${parts} exceed total ${t.totalMs}`);
  });

  it("charges a slow measurement to run, not to the projection", async () => {
    // The property `bench gates` depends on. A gate whose `run` sleeps must show
    // that time under `runMs` — if it leaked into `findingsMs` the report would
    // claim per-rule work costs something.
    const slow = fakeGate({
      run: async (options) => {
        await new Promise((r) => setTimeout(r, 30));
        return { source: options.source, hits: [] };
      },
    });
    const { timing } = await runGate(slow, ["page.html"], { ledger: false });
    assert.ok(timing.runMs >= 25, `runMs was ${timing.runMs}`);
    assert.ok(timing.findingsMs < 5, `findingsMs was ${timing.findingsMs}`);
  });

  it("keeps timing out of the --json envelope unless asked", async () => {
    // The envelope is a published contract that clients diff and cache against.
    // A field that changes every run would make equal inputs produce unequal
    // output, so `--timing` is opt-in even here.
    const plain = await runGate(fakeGate(), ["page.html", "--json"], { ledger: false });
    const parsed = JSON.parse(plain.text) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed), [
      "gate", "command", "verdict", "counts", "findings", "suppressed", "retuned", "report",
    ]);
    assert.ok(plain.timing.totalMs > 0, "the outcome still carries timing in-process");

    const asked = await runGate(fakeGate(), ["page.html", "--json", "--timing"], { ledger: false });
    const withTiming = JSON.parse(asked.text) as { timing: Record<string, number> };
    assert.equal(typeof withTiming.timing.runMs, "number");
    assert.ok(withTiming.timing.totalMs > 0, "serialized totalMs must not be a placeholder zero");
  });

  it("does not let --timing reach the gate's own parser", async () => {
    const seen: string[][] = [];
    const gate = fakeGate({
      parse: (argv) => {
        seen.push([...argv]);
        return { source: "page.html", strict: false };
      },
    });
    await runGate(gate, ["page.html", "--timing"], { ledger: false });
    assert.deepEqual(seen, [["page.html"]]);
  });
});

describe("runGateCli", () => {
  it("prints composed help and exits 0 without measuring", async () => {
    const lines: string[] = [];
    const gate = fakeGate({
      run: () => {
        throw new Error("run must not be called for --help");
      },
    });
    const code = await runGateCli(gate, ["--help"], { out: (t) => lines.push(t), ledger: false });
    assert.equal(code, 0);
    const text = lines.join("\n");
    assert.match(text, /Usage: vlmkit check fake <source> \[options\]/);
    assert.match(text, /--strict {2}/);
    assert.match(text, /Shared options \(every gate\)/);
    assert.match(text, /--advisory {14}Print findings but exit 0/);
  });

  it("says when warns did not fail the command, and names the flag that makes one fail", async () => {
    // A dogfood agent working to a "these gates exit 0" criterion nearly shipped the
    // defect it was sent to fix: "`check animation` exits 0 while printing `settle:
    // never (infinite animation)`. That is verbatim the reported bug […] demoted to
    // `warn`. Had I trusted the success criterion I'd have shipped it broken." The
    // escalation existed — `--rule <id>=suspect` — and was findable only in a document.
    const lines: string[] = [];
    const gate = fakeGate({
      run: () => ({ source: "p.html", hits: [{ rule: "odd-thing", severity: "warn" as const, message: "odd but not fatal" }] }),
      findings: (report) => report.hits,
    });
    const code = await runGateCli(gate, ["p.html"], { out: (t) => lines.push(t), ledger: false });
    assert.equal(code, 0, "a warn does not fail the command");
    const text = lines.join("\n");
    assert.match(text, /1 warn\(s\) did not fail this command/);
    assert.match(text, /--rule odd-thing=suspect/);
  });

  it("stays quiet about warns when there are none, and under --json", async () => {
    const clean: string[] = [];
    await runGateCli(fakeGate({ run: () => ({ source: "p.html", hits: [] }), findings: () => [] }),
      ["p.html"], { out: (t) => clean.push(t), ledger: false });
    assert.doesNotMatch(clean.join("\n"), /did not fail this command/);

    // Under --json the hint would put prose on a stream a client is parsing.
    const json: string[] = [];
    await runGateCli(
      fakeGate({
        run: () => ({ source: "p.html", hits: [{ rule: "odd-thing", severity: "warn" as const, message: "odd but not fatal" }] }),
        findings: (report) => report.hits,
      }),
      ["p.html", "--json"],
      { out: (t) => json.push(t), ledger: false },
    );
    assert.doesNotMatch(json.join("\n"), /did not fail this command/);
    JSON.parse(json.join("\n"));
  });

  it("prints the rule table for --rules", async () => {
    const lines: string[] = [];
    const code = await runGateCli(fakeGate(), ["--rules"], { out: (t) => lines.push(t), ledger: false });
    assert.equal(code, 0);
    assert.match(lines.join("\n"), /bad-thing/);
    assert.match(lines.join("\n"), /2 rule\(s\)/);
  });

  it("returns the gate's exit code", async () => {
    assert.equal(await runGateCli(fakeGate(), ["page.html", "--strict"], { out: () => {}, ledger: false }), 1);
    assert.equal(await runGateCli(fakeGate(), ["page.html"], { out: () => {}, ledger: false }), 0);
  });
});

describe("help and rule-table rendering", () => {
  it("marks an optional positional and a repeatable flag", () => {
    const gate = fakeGate({
      inputs: [
        { name: "source", kind: "path-or-url", description: "Page", positional: 0, required: true },
        { name: "target", kind: "path", description: "Target", positional: 1, required: false },
        { name: "allow", kind: "string", description: "Exempt a pattern", repeatable: true },
      ],
    });
    const help = formatGateHelp(gate);
    assert.match(help, /vlmkit check fake <source> \[target\]/);
    assert.match(help, /--allow <value> \(repeatable\)/);
  });

  it("documents how to tune each rule", () => {
    assert.match(formatRuleTable(fakeGate()), /--rule check\.fake\/<id>=<off\|suspect\|warn\|info>/);
  });
});

describe("ruleRef", () => {
  it("qualifies a rule with its gate", () => {
    assert.equal(ruleRef("check.fake", "bad-thing"), "check.fake/bad-thing");
  });
});

describe("asPlugin", () => {
  it("accepts a default export", () => {
    const plugin = asPlugin({ default: definePlugin({ name: "acme", gates: [fakeGate()] }) }, "./x.ts");
    assert.equal(plugin.name, "acme");
  });

  it("accepts a named `plugin` export", () => {
    assert.equal(asPlugin({ plugin: definePlugin({ name: "acme", gates: [fakeGate()] }) }, "./x.ts").name, "acme");
  });

  it("names the specifier and the missing member", () => {
    assert.throws(() => asPlugin({}, "./x.ts"), /\.\/x\.ts: expected a default export/);
    assert.throws(() => asPlugin({ default: { gates: [fakeGate()] } }, "./x.ts"), /plugin\.name is required/);
    assert.throws(() => asPlugin({ default: { name: "a", gates: [] } }, "./x.ts"), /non-empty array/);
    assert.throws(
      () => asPlugin({ default: { name: "a", gates: [{ id: "nope" }] } }, "./x.ts"),
      /gates\[0\] is not a gate definition/,
    );
  });
});

describe("loadPlugins", () => {
  it("resolves a relative specifier against the config directory, not the cwd", async () => {
    const seen: string[] = [];
    const loaded = await loadPlugins(["./tools/house.ts"], {
      baseDir: "/repo",
      importer: async (spec) => {
        seen.push(spec);
        return { default: definePlugin({ name: "house", gates: [fakeGate()] }) };
      },
    });
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0]!.specifier, "./tools/house.ts");
    assert.match(seen[0]!, /^file:\/\/\/repo\/tools\/house\.ts$/);
  });

  it("passes a bare specifier through to the resolver untouched", async () => {
    const seen: string[] = [];
    await loadPlugins(["@acme/gates"], {
      importer: async (spec) => {
        seen.push(spec);
        return { default: definePlugin({ name: "acme", gates: [fakeGate()] }) };
      },
    });
    assert.deepEqual(seen, ["@acme/gates"]);
  });

  it("wraps an import failure with the specifier that caused it", async () => {
    await assert.rejects(
      () => loadPlugins(["./missing.ts"], { baseDir: "/repo", importer: () => Promise.reject(new Error("nope")) }),
      /failed to load gate plugin "\.\/missing\.ts" \(resolved to file:\/\/\/repo\/missing\.ts\): nope/,
    );
  });
});

describe("readPluginSpecifiers", () => {
  it("returns nothing when the project declares no config", () => {
    const cwd = mkdtempSync(join(tmpdir(), "vlmkit-plugin-"));
    try {
      assert.deepEqual(readPluginSpecifiers(cwd), { specifiers: [], configPath: null });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reads and trims the plugins array", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "vlmkit-plugin-"));
    try {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(cwd, "vlmkit.config.json"), JSON.stringify({ plugins: [" ./a.ts ", "@acme/b"] }));
      assert.deepEqual(readPluginSpecifiers(cwd).specifiers, ["./a.ts", "@acme/b"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects a non-string entry rather than importing undefined", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "vlmkit-plugin-"));
    try {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(cwd, "vlmkit.config.json"), JSON.stringify({ plugins: [1] }));
      assert.throws(() => readPluginSpecifiers(cwd), /"plugins" must be an array of module specifier strings/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("withExitIntent", () => {
  it("puts the line directly under the verdict, not at the bottom", () => {
    // Appending was not enough. One agent nearly shipped a bug because a warn passed
    // the gate silently; the fix appended a notice. A later agent hit the same
    // ambiguity from the other side: "`verdict: DRIFT` (yellow) + exit 0 is a
    // coin-flip in CI. The only line that resolves it [...] is the last line, below
    // the findings." The distance was the defect.
    const text = [
      "vlmkit check design",
      "source: page.html",
      "",
      "verdict: DRIFT (2 finding(s))",
      "  roles judged: 3",
      "Findings",
      "  ! [component-drift] ...",
    ].join("\n");
    const out = withExitIntent(text, "  exits 0 — 1 warn(s) did not fail this command.");
    const lines = out.split("\n");
    assert.equal(lines[3], "verdict: DRIFT (2 finding(s))");
    assert.equal(lines[4], "  exits 0 — 1 warn(s) did not fail this command.");
    // Nothing else moved or was dropped.
    assert.equal(lines.length, text.split("\n").length + 1);
    assert.equal(lines[lines.length - 1], "  ! [component-drift] ...");
  });

  it("anchors on `status:` too, which is what half the gates print", () => {
    const out = withExitIntent("vlmkit check breakpoints\n\nstatus: warn\nbreakpoints checked: 767px", "  exits 0");
    assert.deepEqual(out.split("\n"), [
      "vlmkit check breakpoints",
      "",
      "status: warn",
      "  exits 0",
      "breakpoints checked: 767px",
    ]);
  });

  it("sees through the colour codes a gate wraps its verdict in", () => {
    // The verdict is coloured in real output, so a naive `^verdict:` never matches.
    const out = withExitIntent("\u001B[1mverdict:\u001B[0m CLEAN\nrest", "  exits 0");
    assert.equal(out.split("\n")[1], "  exits 0");
  });

  it("appends when a gate has no verdict line, rather than losing the annotation", () => {
    // A gate that does not follow the convention keeps the previous behaviour.
    const out = withExitIntent("some gate\nwith no headline", "  exits 0");
    assert.equal(out.split("\n").at(-1), "  exits 0");
  });

  it("annotates only the first verdict line", () => {
    // A findings body can legitimately quote the word; only the headline is the anchor.
    const out = withExitIntent("verdict: A\nbody\nverdict: B", "  exits 0");
    assert.deepEqual(out.split("\n"), ["verdict: A", "  exits 0", "body", "verdict: B"]);
  });
});

describe("the run ledger as a declared output", () => {
  // v6's adopting agent: "adopting the tool dirtied the repo silently. `--output`
  // covers stdout logs; `test-results/` and `.vlmkit/run-ledger.jsonl` have no flag
  // and nothing announces them. The agent found them with `ls` and wrote the
  // `.gitignore` itself." The gates that write reports print `report: <path>`
  // already; the ledger was the one genuinely silent write.
  const ledgerGate = () => fakeGate({ ledger: (report) => ({ tool: "fake", source: report.source, headline: {} }) });
  const work = (): string => mkdtempSync(join(tmpdir(), "vlmkit-runner-ledger-"));

  it("--ledger <path> moves the write, and the outcome reports where it went", async () => {
    const cwd = work();
    const outcome = await runGate(ledgerGate(), ["page.html", "--ledger", "runs/gates.jsonl"], { cwd });
    assert.equal(outcome.ledgerWrite?.path, join(cwd, "runs", "gates.jsonl"));
    assert.equal(outcome.ledgerWrite?.created, true);
  });

  it("--no-ledger writes nothing, without needing an env var", async () => {
    const cwd = work();
    const outcome = await runGate(ledgerGate(), ["page.html", "--no-ledger"], { cwd });
    assert.equal(outcome.ledgerWrite, null);
    assert.equal(existsSync(join(cwd, ".vlmkit")), false);
  });

  it("keeps both flags away from the gate's own parser", () => {
    assert.deepEqual(
      stripSharedFlags(["page.html", "--ledger", "runs.jsonl", "--no-ledger", "--strict"]),
      ["page.html", "--strict"],
    );
  });

  it("refuses --ledger with no path rather than swallowing the next flag", () => {
    assert.throws(() => parseSharedFlags(["--ledger", "--json"]), /--ledger needs a path/);
    assert.throws(() => parseSharedFlags(["page.html", "--ledger"]), /--ledger needs a path/);
  });

  it("announces the file it created, and what to ignore, exactly once", () => {
    const cwd = work();
    mkdirSync(join(cwd, ".git"));
    const created = newOutputNotice({ path: join(cwd, ".vlmkit", "run-ledger.jsonl"), created: true }, cwd);
    assert.ok(created);
    assert.match(created!, /created \.vlmkit\/run-ledger\.jsonl/);
    assert.match(created!, /append-only record of every gate run/);
    assert.match(created!, /test-results\//);
    assert.match(created!, /--ledger <path>/);
    assert.match(created!, /--no-ledger/);
    // An append is not news: one line per gate run would be noise.
    assert.equal(newOutputNotice({ path: join(cwd, ".vlmkit", "run-ledger.jsonl"), created: false }, cwd), null);
  });

  it("advises on the relocated path itself, not the two directories it did not write", () => {
    const cwd = work();
    mkdirSync(join(cwd, ".git"));
    const note = newOutputNotice({ path: join(cwd, "runs", "x.jsonl"), created: true }, cwd);
    assert.ok(note);
    assert.match(note!, /created runs\/x\.jsonl/);
    assert.match(note!.replace(/\[[0-9;]*m/g, ""), /^\s*runs\/x\.jsonl$/m);
    assert.doesNotMatch(note!, /test-results\//);
    assert.doesNotMatch(note!, /gates init/);
  });

  it("stays silent once the path is ignored — the advice has been taken", () => {
    const cwd = work();
    mkdirSync(join(cwd, ".git"));
    writeFileSync(join(cwd, ".gitignore"), ".vlmkit/\ntest-results/\n");
    assert.equal(newOutputNotice({ path: join(cwd, ".vlmkit", "run-ledger.jsonl"), created: true }, cwd), null);
  });

  it("stays silent outside a git repo, where .gitignore advice would be noise", () => {
    const cwd = work();
    assert.equal(newOutputNotice({ path: join(cwd, ".vlmkit", "run-ledger.jsonl"), created: true }, cwd), null);
  });
});

describe("unpinnedLiveInput", () => {
  const harGate = { inputs: [{ name: "source" }, { name: "har" }] } as never;
  const noHarGate = { inputs: [{ name: "source" }] } as never;

  it("says a live URL is unpinned, and how to pin it", () => {
    // v5's CI agent was asked whether a run was reproducible and had to answer it by
    // writing a jitter server and diffing outputs: "No gate says its input was
    // unpinned. Four gates hit a live URL and returned verdicts with nothing
    // indicating a re-run could differ."
    const note = unpinnedLiveInput(harGate, ["http://localhost:5173/", "--wait-until", "load"]);
    assert.ok(note);
    assert.match(note!, /http:\/\/localhost:5173\/ is live and not pinned/);
    assert.match(note!, /record-har/);
  });

  it("stays silent once the input is pinned", () => {
    assert.equal(unpinnedLiveInput(harGate, ["http://localhost:5173/", "--har", "app.har"]), null);
  });

  it("stays silent for a local file, which has nothing to pin", () => {
    assert.equal(unpinnedLiveInput(harGate, ["page.html"]), null);
  });

  it("stays silent for a gate that cannot replay a HAR, rather than advising a flag it lacks", () => {
    // `check perf` and `check drift component` deliberately have no `--har`; telling
    // them to pass one would be advice that fails.
    assert.equal(unpinnedLiveInput(noHarGate, ["http://localhost:5173/"]), null);
  });

  it("finds the URL wherever it sits in argv", () => {
    assert.ok(unpinnedLiveInput(harGate, ["--viewports", "375", "https://example.com/a"]));
  });
});

describe("parseRuleSettings comments", () => {
  it("accepts a //-prefixed key as a comment, the convention the config already uses", () => {
    // `examples/vlmkit.gates.json` carries `"//rules"` at the top level; inside the map
    // it was rejected. v6's adoption agent, told to make the diff self-explanatory:
    // "the only mechanism for 'the tool is wrong about this rule' is the one mechanism
    // with no audit trail" — so the reason could not sit next to the decision.
    const settings = parseRuleSettings({
      "//check.design/component-drift": "3 buttons with one primary IS the design",
      "check.design/component-drift": "info",
    }, "defaults.rules");
    assert.deepEqual(settings, { "check.design/component-drift": "info" });
  });

  it("still rejects a real rule reference with a bad setting", () => {
    // The comment escape must not become a way to smuggle a typo past validation.
    assert.throws(
      () => parseRuleSettings({ "check.design/component-drift": "quiet" }, "defaults.rules"),
      /must be one of off, suspect, warn, info/,
    );
  });
});
