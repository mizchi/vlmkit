# Gate plugin architecture — core runner + rule definitions

Status: **landed**. All 27 gates are registry-driven; the MCP tools,
`verify markup`'s folded-in gates and `vlmkit gates` validation all read from
the registry.
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

packages/vlmkit-markup/src/gates/   25 gates + the built-in plugin
packages/vlmkit-capture/src/gates/  check crater
src/gates/                          check perf (app-side)
src/cli/gate-registry.ts            composes all of the above + user plugins
packages/vlmkit-mcp/src/gate-tool.ts  turns a gate into an MCP tool
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
  headline: (report) => string,         // one line: what was measured
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

### The public surface

The contract above is only usable if an author can find it. Two subpaths are the
API; everything else in these packages is internal and may move.

| Subpath | Contains | Costs |
|---|---|---|
| `@mizchi/vlmkit-core/plugin` | `defineGate` / `definePlugin`, the types, the page-load inputs, argv helpers, `UsageError`, colours, project paths, `PLUGIN_API_VERSION` | ~25ms to import |
| `@mizchi/vlmkit-core/plugin/browser` | `withBrowser`, `openSource`, `applyHar`, auth state, the run ledger | ~441ms more |
| `@mizchi/vlmkit-markup/rules` | 33 pure judges + 14 `COLLECT_*` scripts + both exemption forms | no browser, ever |

Three decisions worth keeping:

**The first entry's contents were counted, not chosen.** They are exactly what
the 27 bundled gates import — 40 of the contract, 18 of `page-load`, 15 of
`arg-reader`, 11 of `cli-error`, 1 of `terminal-colors`. A surface picked by
taste drifts from what gates need; one derived from what they import cannot. A
plugin that needs something absent is evidence of a gap in the entry rather than
a licence to reach past it, and `examples/gate-plugin/` is guarded to prove the
entry stays sufficient.

**The browser half is separate because it is 17x the cost.** Measured: the entry
loads in ~25ms, adding `browser-launch` costs ~441ms, and Playwright itself is
not even loaded — that is the capture chain alone. A gate that reads a file (the
house-brand example) would pay it for nothing.

**`@mizchi/vlmkit-markup/rules` declares a split that already existed.** Every
gate is `COLLECT_*` (a string evaluated in a page) → samples (plain JSON) → a
pure judge → findings. Making both halves importable means a project can run a
rule from any driver, test one without a browser, or reuse one inside its own
gate. Purity is enforced by a test that inspects `process.moduleLoadList` after
importing the barrel, not by convention — and it was verified to fail by
injecting a browser import into a judge.

The `./*.ts` export pattern still resolves every internal module. Removing it
would break this repo's own deep imports and any consumer already using them, so
it stays — as a capability, not a promise.

## Rule settings

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

A `--rule` that names a gate and a rule that gate does not have fails the run,
with the known ids listed. A typo that silences nothing is the failure mode
this layer exists to remove, so it cannot be silent. Only that exact shape is
checked at run time: a key naming *another* gate, or a bare rule id, passes
quietly, because `vlmkit gates` appends every `--rule` from `defaults.rules` to
every job and a gate legitimately receives references meant for its
neighbours. Registry-wide validation is `validateRuleSettings`'s job, where the
whole catalog is in view.

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

`examples/gate-plugin/` is a runnable project — its own `vlmkit.config.json`,
two fixtures, two gates. `house-gates.ts` is the smallest useful gate (read a
file, match strings, no browser) and stays the one-gate plugin the docs point a
first config at; `dom-budget.gate.ts` is the shape a real house metric takes
(render, measure numbers, compare against budgets that resolve flag > config >
default, reporting the *source* of each number). `index.ts` bundles both, which
is what the example's own config loads.

Verified end to end: they appear in `vlmkit rules` under `design-system`,
dispatch as `vlmkit check house-brand` / `vlmkit check dom-budget`, honour
`--json` / `--advisory` / `--rule`, read `"domBudget"` out of the project config,
and write ledger entries — with no change to vlmkit itself.

The user-facing how-to is `docs/authoring-gates.md`. This document is the record
of *why* the architecture is shaped this way; that one is the field-by-field
guide for someone adding a metric, and it is what `vlmkit rules` points at.

### Categories: what a gate answers, vs. where it ships

`vlmkit rules` groups by `GateDefinition.category`, one of five:

| Category | The question | Built-ins |
|---|---|---|
| `correctness` | Is the page broken, on its own terms? No reference needed. | 6 |
| `behavior` | Does it respond correctly to size, scroll, motion and input? | 9 |
| `design-system` | Does it conform to the design language the project declares? | 7 |
| `verdict` | Is this attempt done? Aggregates other signals into one answer. | 3 |
| `infrastructure` | Is the measurement toolchain itself working? | 2 |

The CLI verb was the obvious axis and is the wrong one: `check`/`scan`/`stress`
says how a command is *spelled*, and `scan scroll` and `check breakpoints` are
spelled differently while answering the same kind of question. A reader deciding
what to adopt is asking "what can go wrong with my page", so the listing answers
that and `groups()` (by verb) stays for help output, where the reader is typing a
command instead.

Category is deliberately **not** derived from the plugin. A plugin is a unit of
distribution — `check crater` ships in `vlmkit-capture` because that is where the
Crater client lives — and a category is a unit of meaning. Both directions are
many-to-many in the built-ins already (`infrastructure` spans `vlmkit-capture`
and the app; `vlmkit-markup` spans four categories), so collapsing the axes would
force a wrong answer on the next person adding a gate. `gate-registry.test.ts`
asserts that many-to-many-ness precisely so nobody "simplifies" it away.

The taxonomy is small on purpose — a bucket per gate classifies nothing — and
`category` is optional, listing under `other`, because a project's first house
gate should not have to pick a taxonomy before it can run. Built-ins have no such
excuse and a test requires all of them to declare one.

`vlmkit rules --json` emits the glossary alongside the catalog
(`{ categories, gates: [...] }`) so a consumer can label a bucket without
hardcoding the descriptions.

The built-ins load through the same `createGateRegistry([...])` call. If the
contract were not sufficient for them it would not be sufficient for anyone
else, and making them its first consumer is the only way to keep that honest.

## The 27 gates (165 tunable rules)

| Gate | Rules | Plugin |
|---|---|---|
| `check integrity` | 19 | markup |
| `check layout` | 12 | markup |
| `check copy` | 6 | markup |
| `check interactions` | 36 | markup |<!-- 15 of its own + the 21 shared HANDLER_SURFACE_RULES it emits under --handlers -->
| `check a11y contrast` | 1 | markup |
| `check a11y touch` | 1 | markup |
| `check a11y focus` | 3 | markup |
| `check breakpoints` | 5 | markup |
| `check scroll` | 4 | markup |
| `scan scroll` | 4 | markup |
| `scan handlers` | 21 | markup |
| `check motion` | 3 | markup |
| `check animation` | 5 | markup |
| `stress i18n` | 3 | markup |
| `stress media` | 2 | markup |
| `check tokens` | 2 | markup |
| `check design` | 4 | markup |
| `check story` | 4 | markup |
| `check theme` | 2 | markup |
| `check asset` | 7 | markup |
| `check drift component` | 2 | markup |
| `check drift pages` | 2 | markup |
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

  This was applied to the gates and missed the non-gate leaves, so for a while
  exit 2 survived in two places with *incompatible* meanings: `diff browsers`
  used it for "fewer engines than intended" and `png-diff` uses it for a
  malformed flag value — and `skill run` read any 2 as "warned", so a bad value
  in a skill file was reported as a warning. `diff browsers` now exits 1 and
  `skill run` treats every non-zero from a check that ran as a failure.
  `png-diff` keeps 2 for usage errors: on its own that is a coherent
  convention, it is simply not this contract, and nothing now reads it as a
  warning.
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

## A constraint the registry imposes on everything else

**No gate may statically import a CLI-entry module.** `src/cli/gate-entry-isolation.test.ts`
enforces it; here is why it is not a style preference.

The legacy leaf commands — `build page`, `diff html`, `scan component`, the 22 in
`GROUPS` with a `spec` — have no handler the router calls. `delegate` sets
`__VLMKIT_DISPATCHER_LEAF__` and imports the leaf's module, whose top-level guard reads
that variable and calls `main()`. **The command is the module's evaluation.**

`runCli` composes the registry on *every* invocation, to enumerate its verbs for the
command table. So every module a gate statically reaches is evaluated before any leaf
can dispatch — and if that module is a leaf, its guard has already read an unset
variable. `delegate`'s later import is an ESM cache hit that runs nothing. The command
prints nothing and exits **0**.

That happened. `verify.gate.ts` → `markup-verify.ts` → `page-compose.ts` made
`vlmkit build page` a silent no-op for any arguments, `--help` included. It
type-checked, every test of its internals passed, and the command was gone. `runGroupLeaf`
already consults the legacy table before the registry with a comment explaining this
exact hazard — and it was not enough, because the registry is loaded earlier still, at
command registration. The fix was to move the two functions `markup-verify` actually
needed into `page-render.ts`, which has no guard.

Two notes for anyone adding a gate:

- **A dynamic `await import()` of a CLI-entry module is fine** and is what the escape
  hatch is for — nothing is evaluated until the call runs. `region-judge.ts` reaches
  `renderHtmlToPng` that way. The test only walks static edges.
- **Spawning the CLI cannot catch this**, which is why the check is structural. Run
  from source, a leaf's relative import and `delegate`'s package specifier resolve to
  different URLs, so Node holds two module instances and the guard fires on the second;
  the collision exists only after the bundler merges them into one chunk. A spawn test
  passes with the bug present — verified. `src/cli/cli-leaf-help.test.ts` spawns each
  leaf anyway, for the coarser failures (moved file, throwing top-level, unresolvable
  spec), and says so in its header.

## Follow-ups, now closed

The three items this document listed as open have landed.

### `verify markup` drives its sub-gates through the registry

`GateVerdict.gate` was `"breakpoints" | "scroll" | "animation" | "motion"`,
next to four hand-written `runX(...)` calls, four bespoke adapters that
recounted suspects by comparing severity strings, and a
`gate === "scroll" ? "scan scroll" : \`check ${gate}\`` special case to name the
command in the kickback. All four were the same fact stated four times.

Now `DEFAULT_VERIFY_GATES` is a list of gate definitions and each runs through
`runGate`. Three consequences worth stating:

- **A project's rule settings apply to the folded-in gates.** They did not
  before — `verify markup` read raw issue severities, so
  `"check.animation/long-settle": "off"` changed `vlmkit check animation` and
  not the verdict that gate feeds.
- **The kickback names a pasteable command** (`vlmkit scan scroll`) without a
  per-gate string branch.
- **The set is overridable** (`options.gates`). "Which gates does done mean" is
  a project decision, and it stopped being a hardcoded four the moment they
  became definitions.

`--advisory` is deliberately not passed down: a sub-gate's exit code is not
this gate's exit code, it is one input to this gate's verdict.

### MCP tools are derived from the registry

`packages/vlmkit-mcp/src/tools.ts` went from 324 lines to ~150. Seven of the
nine tools are now one `gateTool(gate, { description })` call — name, input
schema, invocation and failure decision all derived — and the adapter builds
argv so the MCP path exercises the *same parser and the same validation* as the
CLI. A malformed argument now fails identically in both.

Two things stayed hand-written, both on purpose:

- **The `description`.** It looks like `gate.summary` and is not: it is a prompt
  for a model choosing between tools, carrying when-to-use-this-instead-of-that,
  what the gate refuses to do, and which silencing tricks it detects. Deriving
  it from `summary` would delete real work.
- **`verify_flow` and `check_layout`.** Both take their flow / contract *inline
  as an object*; the gates take `--flow <path>` / `--contract <path>`, which is
  right for a CLI and wrong for a client that would have to write a temp file.
  They keep their own schema and invocation but take their verdict line from
  the gate's `headline`, so the two surfaces cannot describe one report
  differently. (`build_page` is not a gate at all — it returns a composition
  diff.)

Verified against the published schemas: no argument name was dropped or
renamed. Three needed pinning — `verify_markup`'s `targets` and `fixContext`
(the gate's flags are `--target` and `--no-fix-context`) and the `outDir` of
`check_copy` / `check_equivalence` — which is what `aliases` and `invert` are
for. `check_integrity` gained `timeout` and `waitUntil`, which it always
supported and the hand-written schema had simply never exposed.

This also added `GateDefinition.headline`: one line describing *what was
measured*, which neither `format` (too long) nor the findings (a clean run has
none) can supply. Two consumers needed exactly it.

### `vlmkit gates` rejects an unknown gate command

Was a warning, because the registry did not yet know every gate and rejecting
an unknown string would have rejected working configs. Now a command that does
not resolve inside a group the registry owns (`check`, `scan`, `stress`,
`verify`) is an error, with a did-you-mean. Groups it does not own stay
unvalidated — a config may legitimately list `diff html`.

Config errors also became `UsageError` throughout `gate-config.ts`,
`plugin/rules.ts` and `gates-cli.ts`. They were plain `Error`s, so
`handleCliError` printed a stack trace under a message that had already named
the JSON path and the fix.

## Still open

- **`verify markup`'s composition half** still lives entirely inside
  `markup-verify.ts`. Only the four dynamic gates it folds in are registry
  driven; the per-target composition, gap and pixel-diff logic is not a gate
  and probably should not become one, but the line between "this gate's own
  measurement" and "gates it aggregates" is worth revisiting if a second
  aggregate gate ever appears.
- **`gateTool` cannot express an inline-object input**, which is why two tools
  stay hand-written. A `--flow`-style path input that also accepts an inline
  object (writing a temp file) would close that, at the cost of a side effect
  inside an adapter — not obviously worth it for two call sites.

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
  Two classes of migration bug live here because review found both in this PR:
  **flags placed before the positional** (`firstPositional` only skips the flags
  it is told about, and `check copy` / `check equivalence` lost `--target`,
  `--out` and `--vlm`, so the gate opened a flag's value as the page — or
  compared the target with itself), and **run-ledger double-ownership**
  (a gate declaring `ledger` while its measurement module also appends, which
  wrote two rows per run and bypassed `VLMKIT_NO_LEDGER` and `ledger: false`).
  The ledger check is static and keyed off what each `.gate.ts` *declares*, not
  off its filename: `scan scroll` lives in `scroll-scan.gate.ts` and the three
  `check a11y *` gates share one file, so deriving a path from a command reads
  the wrong file and passes vacuously. Six gates legitimately opt out with
  `ledger: () => null` and keep their module's append — their row carries values
  the report does not expose — so what the test forbids is *both* at once.
- `packages/vlmkit-mcp/src/gate-tool.test.ts` — the derivation, without a
  browser: camelCasing, required-vs-optional, `omit` / `aliases` / `invert`, and
  the argv distinction between a repeatable flag and a comma-joined list. A
  hand-written tool could get that backwards (`--target a,b` is one nonexistent
  file) and only fail on a real page.
- `src/cli/plugin-e2e.test.ts` — spawns the real CLI against
  `examples/gate-plugin/` and asserts what a plugin author
  actually cares about: the gate appears in `vlmkit rules` and in group help,
  dispatches, gets the shared `--json` envelope and exit contract, honours
  `--rule` (and rejects a misspelled one against its own table), writes a
  ledger entry, and is validated by `vlmkit gates`. This was hand-verified
  while building the feature, which is the kind of verification that stops
  being true later — and it means a broken example fails a test rather than a
  reader's first attempt. A second suite runs the example *as its own project*
  (its committed config, its committed fixtures), so every command in its README
  is an assertion — including that a flag beats a config budget and that one
  `--rule` promotes its `warn` to a failure, the claim every warn rule's docs
  make. That suite uses the checkout as cwd rather than a temp copy on purpose:
  a copy would not resolve `@mizchi/vlmkit-core`, so it would only prove the
  plugin loads from a place no reader will put it.
- `src/cli/json-contract.test.ts` — spawns the real CLI and asserts the
  `--json`/prose mutual exclusion, the envelope shape, the exit code, and that
  `--rule ...=off` takes a failing run green and says so. Moved here from
  `packages/vlmkit-markup/` because the gates it drives are no longer
  executable modules.
