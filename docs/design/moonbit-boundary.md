# The TypeScript ↔ MoonBit boundary

Status: **JSON boundary landed alongside the positional one, and every command that
carried swap risk is migrated — 32 of 61.** All 61 positional arms still exist and still
work; the 29 that remain the only caller of are single-argument or all-distinct-type, so
a struct would buy them nothing.

## Which commands were migrated, and why not all of them

A blanket sweep would have been work without benefit, so the set was chosen by
measurement. Two positional arguments can only be confused when they have the same
type, so the risk a command carries is how many mutually swappable positions it has:

| | commands |
|---|--:|
| ≥2 mutually swappable positions | **32** |
| 0–1 arguments, or all argument types distinct | 29 |

The 29 gain nothing from a struct: `is-component-probe-state(value)` takes one
`String`, and there is no wiring bug available to make. They stay positional, and
`src/markup-core-dispatch.test.ts` covers the duplication concern that applies to
them.

**All 32 are migrated** — `goal-status` (36 arguments), the 12
`ui-contract-*-issue-ids` with swappable positions, `layout-policy-issue-ids`, and the
final 18 (landscape, visual/semantic, a11y, grid, shift and quality policies).
`interaction-issues` is new logic with no positional twin. What each of the last 18
bought beyond a rename is under "Not done".

**Deleting the positional dispatch entirely is a separate goal** and would require
all 61, including the 29 with nothing to gain. Worth doing for the 1,487 lines and
the empty-argument sentinel it would remove — but that is a uniformity argument, not
a risk one, and it should be made explicitly rather than arrived at by drift.

## What the positional boundary costs

Measured before changing anything:

| | |
|---|--:|
| commands | 61 |
| positional string arguments, total | 233 |
| worst single command (`component-goal-status`) | 36 |
| dispatch tables that must agree | 2 |
| ...of which a legal value needs escaping (`""`) | 1 sentinel |
| lines of hand-written parsing across them | 1,487 |
| commands using JSON | 0 |

The shape is `run_markup_core("cmd", "a\tb\tc")`, dispatched by
`match args { ["cmd", a, b, c, …] }` in **both** `markup-core-api/main.mbt` (the
direct-JS entry point) and `markup-core-cli/main.mbt` (the spawned one). The two
tables carry the same 61 commands. Nothing checked that they stayed in step until
`src/markup-core-dispatch.test.ts`, which compares them — see "Not done" for what
that test does and does not cover.

Three costs follow, all structural:

1. **No type checking crosses the boundary.** Every argument is a positional
   string parsed on arrival. Swapping two arguments of the same type is a silent
   behaviour change neither compiler can see — and one command takes 36 of them.
2. **Records and arrays are inexpressible.** Logic shaped like "a list of
   components, each with a box and some class names" has no encoding, so it stays
   in TypeScript whether or not it belongs in MoonBit. This, not any individual
   function, is what capped how much pure logic could move.
3. **Absence and zero are the same wire value.** The encoders send `0` for a
   missing number, so a handler cannot distinguish "no width declared" from
   "width: 0". The `*Present` boolean arguments exist to work around exactly this,
   at two arguments per optional field.

## The JSON boundary

```
run_markup_core_json(command, payload_json) -> result_json     # direct JS
markup-core-cli --json <command> <payload_json>                # spawned
```

Both call **one** dispatch, `@core.run_json`, in the shared `markup-core`
package. That is the point: `markup-core-api` and `markup-core-cli` both already
import it, so the two backends cannot drift, and
`src/markup-core-json.test.ts` asserts they answer identically rather than
leaving it as a claim.

A handler declares a struct with `derive(FromJson, ToJson)` and the compiler
generates the codec:

```moonbit
pub struct LayoutPolicyInput {
  width_kind : String
  width_min : Double?          // absent is absent, not 0
  display_columns_count : Int
} derive(FromJson, ToJson)
```

From TypeScript:

```ts
const issues = callMarkupCoreJson<string[]>("layout-policy-issue-ids", {
  width_kind: "fluid",
  display_columns_count: 0,
});
```

### Adding a command

1. Declare the input struct next to the logic it feeds, in `markup-core`.
2. Add one arm to `run_json`, and the name to `json_commands()`.
3. Call it with `callMarkupCoreJson`.

No encoder, no second dispatch table, no `*Present` companion arguments. Three
places became one; the TypeScript side is the call itself.

### Two details that will bite otherwise

**Absent means omitted, not `null`.** MoonBit decodes an `Option` field from a
*missing* key and fails on explicit `null` with "expected number".
`JSON.stringify` already drops `undefined`, but plenty of TypeScript spells
absence as `null`, so `callMarkupCoreJson` strips nulls recursively before
serializing. A null for a *required* field still fails, as a missing one would.

**Malformed input raises; it does not return a value.** An unknown command or a
payload that does not match the struct is a boundary programming error, not a
result. Returning `[]` for either would let a typo'd command name read as "this
rule found no issues" — the same distinction `check story`'s rule table draws
between `story-drift` (a finding) and `mount-failed` (nothing was measured).

## Error messages, and one bug worth knowing about

A MoonBit `raise` reaches the direct-JS caller as a tagged runtime value, not an
`Error`. The handling was `String(value._0)`, which renders `[object Object]` for
every error the standard library raises — so the JSON boundary's main advantage,
a decode error that names the field, was invisible on the backend used by
default. `src/markup-core-error.ts` renders these values now, for the positional
path as well:

```
markup-core direct call failed: Double::from_json: expected number (at /width_value)
markup-core direct call failed: unknown markup-core JSON command: nope
```

### The same bug, twice, in two places

**First:** `loadMarkupCoreApi` rebuilt a narrow object holding only `run_markup_core`,
silently dropping every other export — so the JSON entry points were invisible and every
JSON call fell through to spawning a node process while appearing to work. A boundary
built to make MoonBit cheap to call had become the expensive path.
`markup-core-json.test.ts` asserts `getMarkupCoreRuntimeBackend() === "direct-js"`,
which is what would have caught it.

**Then again, in the shipped CLI.** `scripts/vlmkit-bundled.mjs` injects the generated
bridge through a global so npm consumers need no MoonBit toolchain — and it listed
`run_markup_core` by hand, from before the JSON boundary existed. Adding the boundary did
not update it. In `dist/`, `loadMarkupCoreApi` found the global, `run_markup_core_json`
read as `undefined`, and every JSON command fell through to `ensureMarkupCoreCli()`,
which shells out to `moon build` — the one thing an npm consumer is guaranteed not to
have. **Positional commands kept working, so the CLI looked healthy.**

It survived because nothing tests that layout. The suite runs from source, where the
runtime resolves the bridge through `apiPath` and never reads the global at all; the
`direct-js` assertion above is true from source for the same reason; and type checking
cannot help, because the global is assigned in a `.mjs` file to a
`Partial<DirectMarkupCoreModule>`, where absent is legal.

Both instances are one mistake: **a hand-written list of entry points that has to agree
with an interface, with nothing checking it.** `tests/markup-core-injection.test.mjs`
compares the two lists as text now. The lesson generalises past this file — it is the
same shape as the two duplicated positional dispatch tables, and the same shape as the
`build page` defect, where source and bundle disagreed and only the bundle was wrong.

## What belongs in MoonBit — and what does not

Purity is necessary and **not** sufficient. The criterion is the shape of the
data at the boundary.

**Good fits.** Scalar or small-record input, enum / id-list output: rule tables,
thresholds, verdict decisions. Exhaustive matching earns its keep where a silent
TypeScript mistake is most expensive, and these are cheap to pass. Every existing
`compute*IssueIds` is this shape.

Also good, and only reachable now: rules over an **array of records**.
`interaction-issues` is eleven keyboard-a11y rules over the probe's element list
with its optional nested activation record — a shape the positional encoding had
no way to express, so those rules stayed in TypeScript regardless of where they
belonged. It is the concrete demonstration that the boundary changed what can
move, not just how it is spelled.

Three habits that keep such a handler honest:

- **Return ids, not prose.** `interaction_issues` returns the issue id, the
  severity, the element's position and the two or three values the wording
  interpolates. The sentences live in a TypeScript table, so rewording a
  diagnostic is not a MoonBit rebuild. Rules and wording change for different
  reasons and at different rates.
- **Send what the rules read, not the whole structure.** The probe's `ariaDelta`
  is a `Record<string, [string | null, string | null]>`; the rules only ask
  whether it is empty and whether it mentions `expanded`, so those two booleans
  cross the boundary. Mirroring the type because it exists would make every future
  change to it a change in MoonBit too.
- **Identify elements by position, not by a field they carry.** Reporting the
  element's own `index` looked equivalent and was not: it is a discovery index a
  caller may legitimately repeat, and a test that did labelled every finding with
  the last element sharing the value.

**Poor fits, stated so the obvious targets are not attempted first:**

- **String formatting.** `renderReportMarkdown` (now in
  `component-report-format.ts`) is 485 lines and the largest pure block in the
  repo — and among the worst candidates. Marshalling the whole report across the boundary costs more than
  the logic, and the wording is presentation, which is why handlers return issue
  *ids* and TypeScript owns the messages.
- **Pixel loops.** `analyzeAssetPng`, `extractTextRowsFromRgba`,
  `measureChangeMagnitude` are pure, and passing megabytes of RGBA through a
  JSON string is not the way to run them. These need a typed-array boundary,
  which this is not.

## Not done

- **`component-goal-status` is migrated**, the 36-argument worst case. The rules
  were not rewritten: the JSON handler unpacks a typed record and calls the same
  `component_goal_status`, so a differential test can compare the two decoders over
  a deterministic sweep and any disagreement is a wiring bug rather than a
  behaviour change to argue about.

  Three arguments disappeared with the nesting: `landing_present`,
  `expressive_present` and the canvas hook's presence flag each existed to say
  whether the *following* arguments meant anything, which `Option` says already.

  **Writing that test was harder than the migration, and the lesson generalises.**
  A field swap behind a `> 0` guard is invisible unless a case straddles the guard
  AND reaches it. Three rounds of fixtures were needed: equal values made swaps
  no-ops; distinct-but-both-non-zero let the first guard fire either way; and the
  first straddling variants carried an `expected` sub-record, which
  `app_shell_status` short-circuits on before reading the fields under test. The
  test now records which swaps it catches and which are genuinely undetectable
  because the rule reads the pair symmetrically — "the test missed it" and "there is
  nothing to miss" look identical from outside, and only the first is a defect.

- **The differential harness had two blind spots, and both were found by review
  rather than by a failing test.** Worth recording because both are the same mistake:
  a test that exempts the case it exists to check.

  1. **An `=absent` exemption skipped every disagreement on an omitted optional**, on
     the stated grounds that the positional form "cannot say absent and sends the zero
     value". That is false for every migrated command — each carries an explicit
     `*_present` argument (`core.mbt:439`, `:676`, `:718`, `:838`, `:901`, `:928`) and
     the harness already sent it. So the two sides *should* agree on absence, and the
     skip exempted the migration's only genuinely new logic: the `is Some(_)` /
     `unwrap_or` reconstruction. Mutating `viewport`'s reconstruction to a constant
     `true` was caught by nothing until the skip came out.
  2. **The number set was `[0, 2.5]`**, chosen for the `> 0` guard — but
     `min_overflow < 0`, `duration_ms < 0` and `min_change_ratio < 0 || > 1` reject
     values that set never produces. Inverting `expected-scrollport`'s presence
     reconstruction was undetectable until `-1` joined the set.

  The general form: a value set is only as good as the guards it straddles, and a
  justified-looking `continue` in a differential test is where a migration's real
  logic goes to hide. Both fixes are mutation-verified — each mutation now fails, and
  failed nothing before.

  One related defect the same review caught: `layout_policy_issue_ids` was **written
  out inline** rather than delegating to `ui_contract_layout_issue_ids`. It was the
  first command through the boundary, before the pattern existed, and the copy read as
  equivalent. But with two copies of the rules a disagreement is no longer necessarily
  a wiring bug, which is the entire property the differential test rests on. It
  delegates now, like every other handler.

- **All 32 risky commands are migrated.** The last 18 went over together, because by
  then the harness made each one a struct, a dispatch arm and a spec row. Three of them
  were worth more than their argument count suggested:

  - **`landscape-diff-summary` carried a second positional encoding inside a positional
    argument.** `baseline_stats` was a `String` holding `"r,g,b,l,ink|r,g,b,l,ink|…"`:
    five positional fields per cell, comma-delimited, inside a pipe-delimited list,
    inside a tab-delimited argument list, parsed by a hand-written
    `idx == 0 / 1 / 2 / 3 / 4` chain. No value at any level could contain a comma or a
    pipe and nothing enforced it. It also returned `"mismatch|<total>|<base>|<curr>"` on
    a cell-count error — an error in the same shape as a result, with a comment saying it
    did that "rather than raising, so the FFI surface stays string-only". It raises now.
    On the TypeScript side `parseSummary` was 36 lines and six throw sites; none of it
    survives.

  - **`semantic-drilldown-select-index` took three index-correlated parallel arrays** —
    `flows`, `priority_scores`, `orders` — with nothing tying them together. Filter one
    and not the others and you get a well-typed call that scores the wrong candidate. One
    `Array[DrilldownCandidate]` makes that unrepresentable, the same reason
    `interaction-issues` went over as an array of records.

  - **`landscape-cell-score` and `a11y-contrast-evaluate` were the swap-risk worst
    cases** (10 of 10 and 6 of 8 positions mutually swappable) and both were *pairs of
    samples*: two 5-field cells, two RGB triples. Nesting removes the class outright
    rather than renaming it.

  Four commands also stopped returning composites as strings. `"cols|rows"`,
  `"ratio|required|level"`, `"flow|priority|reason_id"` and the diff summary each had a
  TypeScript reader that split, coerced and hand-validated against a literal union.
  `derive(ToJson)` over a record deletes both halves of that.

- **The 29 zero-risk commands are deliberately not migrated.** See above.

- ~~The other 60 positional commands are not migrated.~~ Superseded: it is a separate
  change with its own risk, and the two paths coexist without interacting. The two
  tables are now checked for drift (`src/markup-core-dispatch.test.ts`): command
  names in full, behaviour on a sample chosen for shape. Full behavioural
  equivalence across 61 commands would need a fixture corpus, not a test.

  That test also documented a cost the design doc had missed: the direct entry
  point takes one tab-joined string, so an **empty argument is unrepresentable** —
  `["cmd", ""]` and `["cmd"]` encode identically. Production substitutes
  `__VLMKIT_EMPTY_ARG__` and MoonBit substitutes it back. A legal value that has to
  be escaped because the encoding has no room for it.
- **No typed-array boundary**, so pixel work stays in TypeScript.
- `component-goal-status` still takes 36 positional arguments. It is the most
  valuable migration and the one most likely to break something quietly, so it
  wants its own change, with a test comparing old and new against the same inputs.
