# Gate plugin architecture — core runner + rule definitions

Status: **landed**. All 26 gates are registry-driven.
Date: 2026-08-05.

## The problem this solved

vlmkit is a static ruleset plus skills that know how to drive it. The ruleset
grew one gate at a time, and each gate ended up carrying its own copy of
everything that is *not* the measurement. Counted on `main` before this change:

| Duplicated concern | Modules carrying their own copy |
|---|---|
| `parseArgs` | 20 |
| `printUsage` | 22 |
| `appendRunLedger` call | 22 |
| CLI entry guard (`__VLMKIT_DISPATCHER_LEAF__`) | 64 |
| `applyGateExit` (the *shared* exit contract) | **6** |

The last row is the tell: the shared contract was the least-adopted part of it.
The concrete defects that followed:

1. **The exit-code contract had drifted.** `gate-exit.ts` documents "a suspect
   fails the command", with `--fail-on-suspect` an accepted no-op and
   `--advisory` the opt-out. But `check motion` and `check animation` failed
   *only* with `--fail-on-suspect` — the dangerous default the docstring warns
   about. `check a11y touch`, `check a11y focus`, `check theme`, `check drift *`
   and `stress *` had **no exit logic at all**. `check integrity` had no
   `--advisory`, so the gate most likely to be piloted before it gates CI was
   the one gate that could not be. `check breakpoints` called
   `process.exit(1)`, which truncates buffered stdout — the bug `applyGateExit`
   exists to prevent. `check perf` used exit code **2** for a third outcome.

2. **Gate identity was stated in four places that could not be cross-checked.**
   `src/cli/cli.ts`'s `GROUPS`/`SPECS` tables, the MCP tool definitions,
   `markup-verify`'s hardcoded `gate: "breakpoints" | ...` union, and free-form
   gate strings in `vlmkit.gates.json`. `check integrit` in a config parsed fine
   and surfaced later as a child process exiting non-zero, which reads like a
   page defect.

3. **Suppression could only be whole-gate.** A project that accepts one
   intentional `text-collision` pattern had to choose between an ad-hoc per-gate
   flag — if the gate's author had thought to add one — and disabling an
   eighteen-rule gate. Rule *ids* existed (`IntegrityFindingKind`,
   `BreakpointCheckIssueKind`) but only as TypeScript unions, invisible to
   config.

4. **Severity vocabulary diverged.** Most gates emitted `"suspect" | "warn"`;
   `check integrity` emitted `"fail" | "warn"`; `stress media` had a
   four-value `verdict`. Aggregate runners hand-rolled the translation.

5. **Measurement functions printed.** Eight gates `console.log`-ed from inside
   their `run*` function, four of them gated on a `quiet` option threaded
   through for the purpose. That made them unusable from the MCP server or a
   test without capturing stdout, and it is why `--json` had shipped broken
   once already (JSON printed *after* the human block).

6. **Argument parsing repeated its own bugs.** `Number.parseInt(argv[++i] ??
   "12", 10)` appears throughout: `--max-findings --json` silently becomes
   `NaN`, and `NaN` does not fail loudly. `arg-reader.ts` was written to fix
   exactly this, and the hand-rolled loops predate or ignore it.

## The shape

Four layers, strictly ordered by dependency:

```
packages/vlmkit-core/src/plugin/
  contract.ts   types + defineGate/definePlugin      (zero deps)
  rules.ts      rule tables, settings, findings normal form
  registry.ts   composition, resolution, validation
  runner.ts     the runner: help/--json/--advisory/ledger/exit code
  load.ts       third-party plugin loading

packages/vlmkit-markup/src/gates/   24 gates + the built-in plugin
packages/vlmkit-capture/src/gates/  check crater
src/gates/                          check perf (app-side)
src/cli/gate-registry.ts            composes all of the above + user plugins
```

**Core never imports a gate.** Gate definitions live in the package that owns
their measurement code and are handed to core as data. That is what keeps
`@mizchi/vlmkit-core` importable without Playwright — and why there are three
built-in plugins rather than one catalog: no location is privileged.

### A gate definition

```ts
export const motionGate = defineGate<MotionDetectionReport, MotionDetectionOptions>({
  id: "check.motion",              // stable machine id: rule settings, ledger
  command: ["check", "motion"],    // CLI path AND the vlmkit.gates.json key
  title: "CSS motion detection",
  summary: "...",                  // group help + MCP tool description
  usage: "...",                    // --help body, minus the shared flags
  rules: [                         // the tunable surface, declared
    { id: "missing-reduced-motion", title: "...", severity: "suspect", docs: "..." },
    { id: "running-animation",      title: "...", severity: "warn" },
  ],
  inputs: [ /* declarative flags: help table today, MCP schema next */ ],
  parse:    (argv) => options,          // throws UsageError; no process.exit
  run:      (options) => report,        // measurement only, no printing
  findings: (report, options) => [],    // projection onto the normal form
  format:   (report) => string,         // prose only
  ledger:   (report, options) => entry, // or null to opt out
});
```

A gate contributes measurement, projection, and prose. What it **cannot** do is
disagree with the contract — the runner owns the envelope.

`findings` receives the parsed options because a flag can legitimately decide a
severity: `check crater --require` promotes an unreachable backend from `info`
to `suspect`, and `check tokens --strict` promotes its two `warn` rules. Most
gates ignore the second argument.

### The findings normal form

```ts
type FindingSeverity = "suspect" | "warn" | "info";
interface Finding { rule, severity, message, selector?, viewport?, evidence? }
```

`"suspect"` is the normal form because `gate-exit.ts` states the contract in
those terms. Two translations remain, each in one visible line: integrity's
`"fail"` → `"suspect"`, and `stress media`'s `verdict` (which also has `"ok"`
and `"skip"`, neither of which is a finding).

`RuleDefinition.severity` is the *declared* (worst-case) severity. A gate may
emit lower on weaker evidence — integrity downgrades a post-load `js-error` to
`warn`, and a cross-origin `failed-stylesheet` likewise — and the runner
preserves that judgment. Only an explicit setting overrides it.

Attribution note: `selector` is only set when the gate really has a selector.
Gates that identify by DOM path (`check interactions`, `scan handlers`) or by
role (`check design`) put that in `evidence` instead, rather than filling
`selector` with a string nothing can query.

### Rule settings

eslint-shaped, and validated against the declared table:

```jsonc
// vlmkit.gates.json
{
  "defaults": {
    "gates": ["check integrity", "check breakpoints --sweep"],
    "rules": { "check.breakpoints/overflow-at-boundary": "suspect" }
  },
  "pages": [
    { "id": "docs", "source": "routes/docs/**/*.html",
      "rules": { "check.integrity/near-misalignment": "off" } }
  ]
}
```

Keys resolve most-specific-first: `<gateId>/<ruleId>` → bare `<ruleId>` (inside
a gate-scoped block) → `<gateId>/*` → `<gateId>`. Specificity beats declaration
order, so narrowing after a broad downgrade means the narrow line.

`resolveGatePlan` appends them to each job as `--rule <ref>=<setting>` flags, so
a spawned gate needs no config access and `vlmkit gates list` shows the real
command line. `--rule` on the command line wins over the config.

Two inherited decisions still hold, both from `gate-config.ts`: a suppression
must be enumerable (`vlmkit rules`, `vlmkit gates suppressions`), and a silenced
finding is *reported as silenced* rather than dropped — the runner prints
`N finding(s) suppressed by rule settings (text-collision x3)` next to the
verdict.

### Rule settings vs. `--allow` vs. suppressions

Three instruments, deliberately kept distinct:

| Instrument | Granularity | Where |
|---|---|---|
| `rules` | one rule of one gate, everywhere it fires | `vlmkit.gates.json`, `--rule` |
| `--allow` (integrity), `--allow-invisible` (copy) | one *pattern* or one *reason class*, with a justification | gate-specific flag |
| `suppressions` | appends a flag to a gate for a page, with owner + expiry | `vlmkit.gates.json` |

The gate-specific flags are the precise instruments and stay as they are; rule
settings are the coarse one that now works uniformly on every gate rather than
only where an author remembered to add a flag.

### Default severity: the rule we followed

Migrating a gate that never failed into one that can is a real change to
someone's CI, so the choice needed a stated principle rather than a per-gate
mood:

- **Violation of an external standard, or of an agreement the two sides are
  supposed to keep** → `suspect`. WCAG contrast/touch/focus, i18n overflow, a
  component that renders differently in two places, a broken flow step, a dead
  disclosure.
- **Conformance to a preference the caller declared, or drift that is
  information rather than breakage** → `warn`. `check tokens` (the scale is
  yours), `check design` (reports inconsistency, never which value is right),
  `check theme` (dark-mode parity, previously never failing).

Every `warn` is one config line from being enforced, and `vlmkit rules <gate>`
says so in the rule's `docs`.

### Third-party plugins

```jsonc
// vlmkit.config.json
{ "plugins": ["./tools/house-gates.ts", "@acme/vlmkit-brand-gates"] }
```

The module default-exports `definePlugin({ name, gates })`. Relative specifiers
resolve against the config's directory, not the process cwd — a plugin path that
only works from the repo root is a CI trap.

A worked example lives at `examples/gate-plugin/house-gates.ts`. Verified end
to end: it appears in `vlmkit rules`, dispatches as `vlmkit check house-brand`,
honours `--json` / `--advisory` / `--rule check.house-brand/forbidden-font=off`,
and writes its ledger entry — with no change to vlmkit itself.

The built-ins load through the same `createGateRegistry([...])` call. If the
contract were not sufficient for them it would not be sufficient for anyone
else, and making them its first consumer is the only way to keep that honest.

## The 26 gates (115 tunable rules)

| Gate | Rules | Plugin |
|---|---|---|
| `check integrity` | 18 | markup |
| `check layout` | 11 | markup |
| `check copy` | 5 | markup |
| `check interactions` | 15 | markup |
| `check a11y contrast` | 1 | markup |
| `check a11y touch` | 1 | markup |
| `check a11y focus` | 3 | markup |
| `check breakpoints` | 5 | markup |
| `check scroll` | 4 | markup |
| `scan scroll` | 4 | markup |
| `scan handlers` | 3 | markup |
| `check motion` | 2 | markup |
| `check animation` | 5 | markup |
| `stress i18n` | 3 | markup |
| `stress media` | 2 | markup |
| `check tokens` | 2 | markup |
| `check design` | 3 | markup |
| `check theme` | 2 | markup |
| `check asset` | 7 | markup |
| `check drift component` | 1 | markup |
| `check drift pages` | 1 | markup |
| `verify markup` | 3 | markup |
| `verify flow` | 2 | markup |
| `check equivalence` | 4 | markup |
| `check crater` | 2 | capture |
| `check perf` | 6 | app |

Measurement code is unchanged except for two mechanical edits, both forced by
the contract:

- **Formatters extracted.** Eight modules printed from inside their `run*`
  function; that block became an exported `format*Report(report)`. Three
  reports gained a field the formatter needed and the report did not carry
  (`TouchReport.required`, `PerfReport.observeMs`) — a report that cannot
  describe its own measurement conditions was a latent defect anyway.
- **CLI blocks deleted.** `parseArgs` / `printUsage` / `main` / the entry guard
  are gone from every migrated module. Those modules are measurement code now,
  not commands.

### What is deliberately NOT a gate

`diff *`, `build *`, `contract *`, `scan component`, `scan mock`,
`scan breakpoints`, `inspect *`, `heal *`, `snapshot`, `workflow`, `batch`,
`gates`, `migration`. These produce artifacts — reports, crops, scaffolds,
baselines, repairs — rather than verdicts. They have no findings to normalize
and no pass/fail to gate on, and stretching `Finding` to cover them would make
it meaningless. They keep the `SPECS` path in `src/cli/cli.ts`.

That split is why `runGroupLeaf` still consults `GROUPS` before the registry,
and the order is load-bearing: a `delegate`d leaf does its work in module
*evaluation* (`if (isCliEntry) main()`), so composing the registry — which
imports gate modules, which transitively import other leaves — warmed the
module cache for `scan scroll` and made `vlmkit scan scroll --help` print
nothing at all. Checking `GROUPS` first means a legacy command never triggers
the import. This is exactly the hazard the contract removes for gates: a gate is
data plus functions, not a module whose import has side effects.

## Behavior changes

Deliberate, and each one aligns a straggler with the documented contract:

- **`check motion`, `check animation`** now exit 1 on a suspect. They
  previously required `--fail-on-suspect`, which is the footgun `gate-exit.ts`
  warns about.
- **`check a11y touch`, `check a11y focus`, `check theme`, `check tokens`,
  `check drift component`, `check drift pages`, `stress i18n`, `stress media`,
  `scan scroll`** had no exit logic at all. They now follow the contract; the
  `warn`-by-default gates among them (`theme`, `tokens`) still exit 0.
- **`check integrity` accepts `--advisory`**, and its `--viewports` /
  `--max-findings` / `--timeout` reject a non-numeric or flag-shaped value
  instead of yielding `NaN`. Every gate's numeric flags now do.
- **`check perf` no longer exits 2.** The shared contract has two outcomes. The
  third state survives where it belongs — in the findings: `poor` is a suspect
  (exit 1), `needs-improvement` is a warn (exit 0). **A script branching on
  exit code 2 must read `counts.warn` from `--json` instead.** `--strict` is an
  accepted no-op.
- **`--json` payloads are the shared envelope**: `{ gate, command, verdict,
  counts, findings, suppressed, retuned, report }`. A gate's previous JSON is
  nested under `report` verbatim. Clients that parsed the old top-level shape
  need one `.report` hop; in exchange they gate on `verdict`/`counts` without
  knowing which gate ran.
- **Every gate accepts `--rule`, `--rules`, `--advisory`, `--json`** and writes
  a run-ledger entry. `check scroll` and several others had no ledger entry
  before.
- **`vlmkit rules` / `vlmkit rules <gate>`** are new. Without a way to list rule
  ids, rule settings would be a feature nobody could find.

## Still open

1. **MCP tools.** `packages/vlmkit-mcp/src/tools.ts` re-states each gate's
   description and Zod schema by hand for ten gates. `GateInput` is declarative
   precisely so the schema can be derived; those ten should collapse to a loop
   over `registry.list()`.
2. **`markup-verify`'s gate union.** `GateVerdict.gate` is still a hardcoded
   `"breakpoints" | "scroll" | "animation" | "motion"`, and the CLI command it
   prints in the kickback is built by a string special-case. All four are
   registry gates now, so that union should become a registry lookup — which
   also makes the set of gates `verify markup` folds in configurable.
3. **`vlmkit gates` command validation** currently warns rather than errors on
   an unresolvable gate string, because unmigrated non-gate commands were still
   possible. Every gate is in the registry now, so a `check`/`scan`/`stress`/
   `verify` command that does not resolve could be a hard error.

## Testing

- `packages/vlmkit-core/src/plugin/plugin.test.ts` — 61 cases: contract
  validation, registry composition and conflicts, longest-prefix resolution,
  settings resolution and specificity, the runner's verdict/exit-code/JSON
  envelope behaviour, ledger opt-in and opt-out, plugin loading with an
  injected importer.
- `packages/vlmkit-markup/src/gates/gates.test.ts` — the migrated gates'
  *declarations* and argument parsing, with no browser: a malformed rule table,
  a clashing command, a missing placeholder or a flag that swallows the next
  flag used to be discoverable only by running the gate against a real page.
- `src/cli/json-contract.test.ts` — spawns the real CLI and asserts the
  `--json`/prose mutual exclusion, the envelope shape, the exit code, and that
  `--rule ...=off` takes a failing run green and says so. Moved here from
  `packages/vlmkit-markup/` because the gates it drives are no longer
  executable modules.
