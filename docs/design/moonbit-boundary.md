# The TypeScript ↔ MoonBit boundary

Status: **JSON boundary landed alongside the positional one.** New logic should
use the JSON path; the 61 positional commands are untouched and keep working.

## What the positional boundary costs

Measured before changing anything:

| | |
|---|--:|
| commands | 61 |
| positional string arguments, total | 233 |
| worst single command (`component-goal-status`) | 36 |
| dispatch tables that must agree | 2 |
| lines of hand-written parsing across them | 1,487 |
| commands using JSON | 0 |

The shape is `run_markup_core("cmd", "a\tb\tc")`, dispatched by
`match args { ["cmd", a, b, c, …] }` in **both** `markup-core-api/main.mbt` (the
direct-JS entry point) and `markup-core-cli/main.mbt` (the spawned one). The two
tables carry the same 61 commands and nothing checked that they stayed in step.

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

Related: `loadMarkupCoreApi` rebuilt a narrow object holding only
`run_markup_core`, silently dropping every other export — so the JSON entry
points were invisible and every JSON call fell through to spawning a node
process while appearing to work. A boundary built to make MoonBit cheap to call
had become the expensive path. `markup-core-json.test.ts` asserts
`getMarkupCoreRuntimeBackend() === "direct-js"`, which is what would have caught
it.

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

- **The 61 positional commands are not migrated.** Deliberate: it is a separate
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
