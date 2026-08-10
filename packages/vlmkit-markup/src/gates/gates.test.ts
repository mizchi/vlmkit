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
      [
        "check a11y contrast",
        "check a11y focus",
        "check a11y touch",
        "check animation",
        "check asset",
        "check breakpoints",
        "check copy",
        "check design",
        "check drift component",
        "check drift pages",
        "check equivalence",
        "check integrity",
        "check interactions",
        "check layout",
        "check motion",
        "check scroll",
        "check story",
        "check theme",
        "check tokens",
        "scan handlers",
        "scan scroll",
        "stress i18n",
        "stress media",
        "verify flow",
        "verify markup",
      ],
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

  it("declares inputs and a real summary for every gate", () => {
    for (const gate of markupGatesPlugin.gates) {
      assert.ok(gate.summary.length > 20, `${gate.id} needs a real summary`);
      assert.ok((gate.inputs ?? []).length > 0, `${gate.id} declares no inputs`);
      const positional = (gate.inputs ?? []).find((i) => i.positional === 0);
      // `check drift pages` genuinely has no positional — its pages arrive via
      // repeatable --urls / --files — so a positional is not universal. When
      // there is one it must carry a placeholder, because the usage line reads
      // `<html-or-url>` rather than the option key `<source>`.
      if (positional) {
        assert.ok(positional.placeholder, `${gate.id} should declare a positional placeholder`);
      }
      for (const input of gate.inputs ?? []) {
        assert.ok(input.description.length > 3, `${gate.id}/${input.name} needs a description`);
      }
    }
  });

  it("documents the shared contract in every gate's help", () => {
    for (const gate of markupGatesPlugin.gates) {
      const help = formatGateHelp(gate);
      assert.match(help, /--advisory/, `${gate.id} help omits --advisory`);
      assert.match(help, /--rule <ref>=<setting>/, `${gate.id} help omits --rule`);
      const positional = (gate.inputs ?? []).find((i) => i.positional === 0);
      const expected = positional
        ? `Usage: vlmkit ${gate.command.join(" ")} <${escapeRegExp(positional.placeholder!)}>`
        : `Usage: vlmkit ${gate.command.join(" ")} \\[options\\]`;
      assert.match(help, new RegExp(expected));
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

  /**
   * `check copy --elements` (vlmkit#118). The parse-time rules are the ones that decide
   * whether a caller can trust the verdict, so they are asserted without a browser:
   *
   *  - a page source AND `--elements` is refused, not silently resolved. The two modes
   *    evaluate different rule sets; picking one quietly makes the verdict ambiguous.
   *  - flags that only mean something to the browser path are refused too. Accepting
   *    `--target` and reviewing nothing is the exact failure the coverage reporting exists to
   *    prevent, and swallowing the flag would undo it before the run even starts.
   */
  it("check copy takes element rects instead of a page", () => {
    const parsed = gateFor("check copy").parse(
      ["--elements", "e.json", "--image", "f.png", "--manifest", "copy.txt"],
      ctx,
    ) as { source: string; imageMode: Record<string, unknown> };
    assert.equal(parsed.source, "f.png");
    assert.deepEqual(parsed.imageMode, {
      elementsPath: "e.json",
      imagePath: "f.png",
      manifestPath: "copy.txt",
    });
  });

  it("check copy refuses a page source alongside --elements", () => {
    assert.throws(
      () => gateFor("check copy").parse(["page.html", "--elements", "e.json"], ctx),
      /either a page source or --elements, not both/,
    );
    assert.throws(
      () => gateFor("check copy").parse(["--image", "f.png", "--manifest", "copy.txt"], ctx),
      /--image needs --elements/,
    );
  });

  it("check copy refuses browser-only flags in --elements mode", () => {
    for (const [flag, value] of [["--target", "t.png"], ["--out", "sheets"], ["--storage-state", "s.json"]]) {
      assert.throws(
        () => gateFor("check copy").parse(["--elements", "e.json", flag!, value!], ctx),
        new RegExp(`\\${flag} does not apply with --elements`),
      );
    }
    assert.throws(
      () => gateFor("check copy").parse(["--elements", "e.json", "--vlm"], ctx),
      /--vlm does not apply with --elements/,
    );
  });

  it("check copy validates --allow-invisible in element-rect mode too", () => {
    const parsed = gateFor("check copy").parse(
      ["--elements", "e.json", "--allow-invisible", "unpainted"],
      ctx,
    ) as { imageMode: { allowInvisible: string[] } };
    assert.deepEqual(parsed.imageMode.allowInvisible, ["unpainted"]);
    assert.throws(
      () => gateFor("check copy").parse(["--elements", "e.json", "--allow-invisible", "nope"], ctx),
      /unknown class\(es\) "nope"/,
    );
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
    }, { source: "page.html" });
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
    }, { source: "page.html", contractPath: "c.json" });
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
    }, { source: "https://app.example.com/dash", contractPath: "c.json" });
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

/**
 * Flag order. Every one of these was a real regression from the migration:
 * the hand-written parsers consumed their value-taking flags before collecting
 * positionals, and `firstPositional` only skips the flags it is told about.
 * Forgetting one does not fail loudly — the gate opens a flag's value as the
 * page, which surfaces as "no such file" or, worse, as a comparison of the
 * target against itself.
 */
describe("value-taking flags before the positional", () => {
  const gate = (id: string) => markupGatesPlugin.gates.find((g) => g.id === id)!;
  const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };

  it("check copy: a --vlm model id is not the source", () => {
    const options = gate("check.copy").parse(
      ["--vlm", "bytedance/ui-tars-1.5-7b", "page.html", "--target", "t.png"],
      ctx,
    ) as { source: string; vlm: string | true };
    assert.equal(options.source, "page.html");
    assert.equal(options.vlm, "bytedance/ui-tars-1.5-7b");
  });

  it("check copy: a bare --vlm before the source is an error, not a silent swap", () => {
    // `--vlm page.html` is genuinely ambiguous — `vlmFlag` reads page.html as
    // the model id, so there is no source left. Failing with the usage line is
    // the honest outcome; parsing page.html as both was not.
    assert.throws(
      () => gate("check.copy").parse(["--vlm", "page.html", "--target", "t.png"], ctx),
      (e: unknown) => e instanceof UsageError && /missing required argument/.test((e as Error).message),
    );
  });

  it("check copy: --vlm after the source still resolves both", () => {
    const options = gate("check.copy").parse(
      ["page.html", "--target", "t.png", "--vlm", "some/model"],
      ctx,
    ) as { source: string; vlm: string | true };
    assert.equal(options.source, "page.html");
    assert.equal(options.vlm, "some/model");
  });

  it("check equivalence: --target / --region / --out before the source", () => {
    // Before the fix this returned `t.png` as the attempt and compared the
    // target with itself — a gate reporting "same" for the wrong reason.
    for (const argv of [
      ["--target", "t.png", "--region", "0,0,10x10", "attempt.html"],
      ["--out", "pairs", "--target", "t.png", "--region", "0,0,10x10", "attempt.html"],
      ["--vlm", "some/model", "--target", "t.png", "--region", "0,0,10x10", "attempt.html"],
      ["attempt.html", "--target", "t.png", "--region", "0,0,10x10"],
    ]) {
      const options = gate("check.equivalence").parse(argv, ctx) as { source: string; targetPath: string };
      assert.equal(options.source, "attempt.html", `argv: ${argv.join(" ")}`);
      assert.equal(options.targetPath, "t.png", `argv: ${argv.join(" ")}`);
    }
  });
});

/**
 * The run ledger has exactly one owner per gate.
 *
 * `runIntegrityCheck` and `runScrollBehavior` called `appendRunLedger`
 * themselves *and* their gates declared a `ledger`, so one `check integrity`
 * run wrote two rows and one `check scroll` run wrote two rows under the same
 * `tool` name — doubling any count taken over the ledger. It also bypassed both
 * `VLMKIT_NO_LEDGER` and the runner's `ledger: false`, which is how
 * `verify markup` keeps its folded-in gates out of the ledger.
 *
 * Static, because the alternative is launching a browser per gate. Six gates
 * legitimately opt out with `ledger: () => null` and leave the append in their
 * measurement module — their row carries values the report does not expose —
 * so what is forbidden is *both* at once, not the module append itself.
 */
describe("run-ledger ownership", () => {
  it("no gate that owns a ledger row imports a module that appends its own", async () => {
    const { readFile, readdir } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));

    /**
     * Probed rather than read off the source: an opt-out ignores its arguments
     * and returns null, while a real implementation reads report fields and
     * throws on an empty object. The throw is the signal, not a failure.
     */
    const ownsLedger = (gate: typeof markupGatesPlugin.gates[number]) => {
      if (!gate.ledger) return false;
      try {
        return gate.ledger({} as never, {} as never) !== null;
      } catch {
        return true;
      }
    };
    const owners = new Set(markupGatesPlugin.gates.filter(ownsLedger).map((g) => g.id));
    // Guard on the probe itself. If it classified every gate as an opt-out this
    // test would pass while checking nothing — the exact failure mode it exists
    // to catch elsewhere.
    assert.ok(owners.size >= 3, `expected several ledger-owning gates, found ${[...owners]}`);

    const offenders: string[] = [];
    // Keyed off what each file *declares*, not off its name: `scan scroll` lives
    // in scroll-scan.gate.ts and `check a11y contrast` shares a11y.gate.ts with
    // two siblings, so deriving a filename from a command silently reads the
    // wrong file.
    for (const entry of await readdir(here)) {
      if (!entry.endsWith(".gate.ts")) continue;
      const source = await readFile(join(here, entry), "utf8");
      const declared = [...source.matchAll(/^  id: "([^"]+)"/gm)].map((m) => m[1]!);
      if (!declared.some((id) => owners.has(id))) continue;
      for (const match of source.matchAll(/from "(\.\.?\/[^"]+\.ts)"/g)) {
        let body: string;
        try {
          body = await readFile(resolve(here, match[1]!), "utf8");
        } catch {
          continue;
        }
        if (/\bappendRunLedger\(/.test(body)) {
          offenders.push(`${entry} (${declared.filter((id) => owners.has(id)).join(", ")}) -> ${match[1]}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "each of these records twice per run — remove the module's append, or give"
      + ` the gate \`ledger: () => null\`: ${offenders.join("; ")}`,
    );
  });
});

/**
 * `check story`'s parser carries more validation than most, because every one of
 * its inputs has a wrong form that would otherwise fail deep inside a browser:
 * a missing gallery, a `--props` that is not an object, a malformed viewport.
 */
describe("check story argument parsing", () => {
  const gate = markupGatesPlugin.gates.find((g) => g.id === "check.story")!;
  const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };

  it("takes every positional as a story id", () => {
    // Several stories per run is the efficient shape: the gallery is one page
    // and the browser launch is nearly all of the cost.
    const parsed = gate.parse(
      ["components/Button/Primary", "Card/Default", "--gallery", "http://localhost:5173/g/"],
      ctx,
    ) as Record<string, unknown>;
    assert.deepEqual(parsed.stories, ["components/Button/Primary", "Card/Default"]);
    assert.equal(parsed.gallery, "http://localhost:5173/g/");
  });

  it("requires a gallery, and says what a gallery is", () => {
    assert.throws(
      () => gate.parse(["components/Button/Primary"], ctx),
      /--gallery <url> is required.*baseURL/s,
    );
  });

  it("does not read a flag value as a story id", () => {
    const parsed = gate.parse(
      ["--gallery", "http://x/", "--viewport", "400x300", "--threshold", "0.02", "Button/Primary"],
      ctx,
    ) as Record<string, unknown>;
    assert.deepEqual(parsed.stories, ["Button/Primary"]);
    assert.deepEqual(parsed.viewport, { width: 400, height: 300 });
    assert.equal(parsed.threshold, 0.02);
  });

  it("rejects props that are not a JSON object", () => {
    const base = ["Button/Primary", "--gallery", "http://x/"];
    // The contract requires "plain serializable data" for props, and an array or
    // a bare scalar would reach `window.mount` as something the gallery cannot
    // spread onto a component.
    for (const bad of ["title=1", "[1,2]", '"a string"', "null"]) {
      assert.throws(
        () => gate.parse([...base, "--props", bad], ctx),
        /--props must be a JSON object/,
        `--props ${bad} should have been rejected`,
      );
    }
    const parsed = gate.parse([...base, "--props", '{"title":"Hi"}'], ctx) as Record<string, unknown>;
    assert.deepEqual(parsed.props, { title: "Hi" });
  });

  it("rejects a malformed viewport", () => {
    assert.throws(
      () => gate.parse(["Button/Primary", "--gallery", "http://x/", "--viewport", "400"], ctx),
      /expects <width>x<height>/,
    );
  });

  it("defaults to a component-sized threshold, not a page-sized one", () => {
    // Component shots are small, so a handful of stray pixels is a much larger
    // ratio than it would be on a full page.
    const parsed = gate.parse(["Button/Primary", "--gallery", "http://x/"], ctx) as Record<string, unknown>;
    assert.equal(parsed.threshold, 0.005);
    assert.equal(parsed.root, "#root");
    assert.equal(parsed.updateBaseline, false);
  });
});
