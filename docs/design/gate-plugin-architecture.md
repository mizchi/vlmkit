# Gate plugin architecture — core runner + rule definitions

Status: **partially landed** (core runtime + 5 of ~60 gates migrated).
Date: 2026-08-05.

## The problem this solves

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
The concrete defects that follow from this shape:

1. **The exit-code contract drifted.** `gate-exit.ts` documents "a suspect
   fails the command", with `--fail-on-suspect` an accepted no-op and
   `--advisory` the opt-out. But `check motion` failed *only* with
   `--fail-on-suspect` — the dangerous default the docstring warns about.
   `check integrity` had no `--advisory` at all, so the gate most likely to be
   piloted before it gates CI was the one gate that could not be piloted.
   `check breakpoints` called `process.exit(1)`, which truncates buffered
   stdout — exactly the bug `applyGateExit` exists to prevent.

2. **Gate identity was stated in four places that could not be cross-checked.**
   `src/cli/cli.ts`'s `GROUPS`/`SPECS` tables, the MCP tool definitions,
   `markup-verify`'s hardcoded `gate: "breakpoints" | "scroll" | ...` union, and
   free-form gate strings in `vlmkit.gates.json`. Adding a gate meant editing
   all four; `check integrit` in a config parsed fine and surfaced later as a
   child process exiting non-zero, which reads like a page defect.

3. **Suppression could only be whole-gate.** A project that accepts one
   intentional `text-collision` pattern had to choose between an ad-hoc
   per-gate flag — if the gate's author had thought to add one — and disabling
   an eighteen-rule gate. Rule *ids* existed (`IntegrityFindingKind`,
   `BreakpointCheckIssueKind`) but only as TypeScript unions, invisible to
   config.

4. **Severity vocabulary diverged.** Most gates emit `"suspect" | "warn"`;
   `check integrity` emits `"fail" | "warn"`. Aggregate runners hand-rolled the
   translation.

5. **Argument parsing repeated its own bugs.** `Number.parseInt(argv[++i] ??
   "12", 10)` appears throughout: `--max-findings --json` silently becomes
   `NaN`, and `NaN` does not fail loudly. `arg-reader.ts` was written to fix
   precisely this, and the hand-rolled loops predate or ignore it.

## The shape

Four layers, strictly ordered by dependency:

```
packages/vlmkit-core/src/plugin/
  contract.ts   types + defineGate/definePlugin      (zero deps)
  rules.ts      rule tables, settings, findings normal form
  registry.ts   composition, resolution, validation
  runner.ts     the runner: help/--json/--advisory/ledger/exit code
  load.ts       third-party plugin loading

packages/vlmkit-markup/src/gates/
  *.gate.ts     one definition per gate, wrapping existing measurement code
  index.ts      definePlugin({ name, gates })  ← an ordinary plugin

src/cli/
  gate-registry.ts   composes built-ins + vlmkit.config.json "plugins"
  gate-rules.ts      project rule settings for a direct invocation
```

**Core never imports a gate.** Gate definitions live in the package that owns
their measurement code and are handed to core as data. That is what keeps
`@mizchi/vlmkit-core` importable without Playwright.

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
  parse:    (argv) => options,     // throws UsageError; no process.exit
  run:      (options) => report,   // measurement only
  findings: (report) => Finding[], // projection onto the normal form
  format:   (report) => string,    // prose only
  ledger:   (report, options) => RunLedgerEntry | null,
});
```

A gate contributes measurement, projection, and prose. What it **cannot** do is
disagree with the contract — the runner owns the envelope.

### The findings normal form

```ts
type FindingSeverity = "suspect" | "warn" | "info";
interface Finding { rule, severity, message, selector?, viewport?, evidence? }
```

`"suspect"` is the normal form because `gate-exit.ts` states the contract in
those terms. `check integrity`'s `"fail"` maps to `"suspect"` in its adapter —
the single translation left in the codebase, and it lives in one visible line.

`RuleDefinition.severity` is the *declared* (worst-case) severity. A gate may
emit lower on weaker evidence — integrity downgrades a post-load `js-error` to
`warn`, and a cross-origin `failed-stylesheet` likewise — and the runner
preserves that judgment. Only an explicit setting overrides it.

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
| `--allow` (integrity) | one *pattern*: kind + selector + viewport, with a reason | gate-specific flag |
| `suppressions` | appends a flag to a gate for a page, with owner + expiry | `vlmkit.gates.json` |

`--allow` is the precise instrument and stays as it is; rule settings are the
coarse one that now works uniformly on every gate rather than only where an
author remembered to add a flag.

### Third-party plugins

```jsonc
// vlmkit.config.json
{ "plugins": ["./tools/house-gates.ts", "@acme/vlmkit-brand-gates"] }
```

The module default-exports `definePlugin({ name, gates })`. Relative
specifiers resolve against the config's directory, not the process cwd — a
plugin path that only works from the repo root is a CI trap.

A worked example lives at `examples/gate-plugin/house-gates.ts`. Verified
end to end: it appears in `vlmkit rules`, dispatches as
`vlmkit check house-brand`, honours `--json` / `--advisory` /
`--rule check.house-brand/forbidden-font=off`, and writes its ledger entry —
with no change to vlmkit itself.

The built-ins load through the same `createGateRegistry([...])` call. If the
contract were not sufficient for them it would not be sufficient for anyone
else, and making them its first consumer is the only way to keep that honest.

## What landed

Core runtime, plus five gates migrated end to end:

| Gate | Rules | Notable change |
|---|---|---|
| `check integrity` | 18 | gains `--advisory`; `fail` → `suspect` |
| `check layout` | 11 | assertion kinds became the rule table |
| `check breakpoints` | 5 | no more `process.exit(1)` mid-stdout |
| `check scroll` | 4 | gains a ledger entry |
| `check motion` | 2 | **now fails on a suspect** (see below) |

Their measurement code is untouched: each `*.gate.ts` wraps the existing
`run*` / `format*` functions. What was deleted is the per-module `parseArgs`,
`printUsage`, `main`, ledger call, and CLI-entry guard — those modules are
measurement code now, not commands.

New: `vlmkit rules` and `vlmkit rules <gate>`. Without a way to list rule ids,
rule settings would be a feature nobody could find.

### Behavior changes, deliberate

- **`check motion` now exits 1 on a suspect.** It previously required
  `--fail-on-suspect`. This aligns it with `gate-exit.ts`; `--advisory` opts
  out, and `--fail-on-suspect` still parses as a no-op. A CI job relying on
  motion printing findings and exiting 0 will start failing — that is the point.
- **`check integrity` accepts `--advisory`**, and its `--viewports` /
  `--max-findings` / `--timeout` now reject a non-numeric or flag-shaped value
  instead of yielding `NaN`.
- **`check scroll` appends a run-ledger entry.** It was the outlier that did
  not.
- **Every migrated gate accepts `--rule` and `--rules`.**

## Migration order for the rest

The registry is consulted only when the legacy `GROUPS` table misses, so the
two paths coexist and gates move one reviewable commit at a time.

That fallback order is load-bearing for a non-obvious reason worth recording: a
`delegate`d leaf does its work in module *evaluation* (`if (isCliEntry)
main()`), so it runs only on first import. Composing the registry imports the
migrated gates' measurement modules, which transitively import other leaves
(`integrity-check` pulls in `scroll-scan`). Registry-first therefore warmed the
module cache for `scan scroll` and made `vlmkit scan scroll --help` print
nothing at all. This asymmetry disappears with the last migration — and it is
exactly the hazard the contract removes: a gate becomes data plus functions,
not a module whose import has side effects.

Suggested order, cheapest signal first:

1. **Uniform `issues[]` gates** — `check theme`, `check animation`,
   `scan scroll`, `scan handlers`, `check interactions`, `check asset`,
   `check copy`. Mechanical: rule table from the existing `*IssueKind` union,
   `findings` is a one-line map.
2. **`check a11y *` and `check drift *`** — three-token commands. The registry
   already resolves longest-prefix, so the special cases in `runGroupLeaf` can
   go once these are defined.
3. **Aggregate gates** — `verify markup`, `verify flow`, `heal markup`. These
   *consume* other gates; once the registry is complete, `markup-verify`'s
   hardcoded `gate: "breakpoints" | ...` union becomes a registry lookup, which
   is the second consumer that pays for the contract.
4. **MCP tools** — `packages/vlmkit-mcp/src/tools.ts` re-states each gate's
   description and Zod schema. `GateInput` is deliberately declarative so the
   schema can be derived; the ten hand-written tools collapse to a loop over
   `registry.list()`.
5. **Non-gate commands** (`diff *`, `build *`, `contract *`, `snapshot`) are
   *not* gates — they produce artifacts rather than verdicts. They keep the
   `SPECS` path. The contract should not be stretched to cover them.

## Testing

- `packages/vlmkit-core/src/plugin/plugin.test.ts` — 60 cases: contract
  validation, registry composition and conflicts, settings resolution and
  specificity, the runner's verdict/exit-code/JSON-envelope behaviour, ledger
  opt-in and opt-out, plugin loading with an injected importer.
- `packages/vlmkit-markup/src/gates/gates.test.ts` — 16 cases over the five
  migrated gates' *declarations* and argument parsing. No browser needed, which
  is the point: a malformed rule table or a clashing command used to be
  discoverable only by running the gate against a real page.
