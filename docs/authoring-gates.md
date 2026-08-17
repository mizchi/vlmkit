# Adding your own metric

vlmkit's checks are called **gates**. A gate is one question about a page that
can be answered deterministically — "does any text collide", "is contrast below
WCAG AA", "is the DOM over our node budget" — plus the rules a project can tune
or switch off.

Everything vlmkit ships is a gate, and nothing about the bundled ones is
privileged. If your project has a rule of its own — a house font allowlist, a
DOM budget, a naming convention, a "no inline styles in components" policy — you
declare it the same way vlmkit declares `check integrity`, and it arrives as a
first-class command with the same `--json` envelope, the same exit-code
contract, the same `--rule` tuning, the same run-ledger entry and the same
`vlmkit.gates.json` validation.

This page is the how-to. For *why* the architecture is shaped this way, see
[`docs/design/gate-plugin-architecture.md`](./design/gate-plugin-architecture.md).

- [The 30-line version](#the-30-line-version)
- [The two imports](#the-two-imports)
- [Reusing vlmkit's own rules](#reusing-vlmkits-own-rules)
- [What you get for free](#what-you-get-for-free)
- [The definition, field by field](#the-definition-field-by-field)
- [Choosing severities](#choosing-severities)
- [Choosing a category](#choosing-a-category)
- [Reading configuration](#reading-configuration)
- [Measuring in a browser](#measuring-in-a-browser)
- [Knowing what your gate costs](#knowing-what-your-gate-costs)
- [Testing your gate](#testing-your-gate)
- [Shipping it to other projects](#shipping-it-to-other-projects)
- [Worked examples](#worked-examples)
- [Checklist](#checklist)

## The 30-line version

Write a module that default-exports a plugin:

```ts
// tools/house-gates.ts
import { defineGate, definePlugin, readPositionals, UsageError } from "@mizchi/vlmkit-core/plugin";
import type { Finding } from "@mizchi/vlmkit-core/plugin";
import { readFile } from "node:fs/promises";

const inlineStyleGate = defineGate<{ source: string; count: number }, { source: string }>({
  id: "check.inline-style",
  command: ["check", "inline-style"],
  title: "No inline styles",
  summary: "Flags style=\"\" attributes, which bypass the design system",
  category: "design-system",
  rules: [{ id: "inline-style", title: "Inline style attribute", severity: "suspect" }],
  inputs: [
    { name: "source", placeholder: "html", kind: "path", description: "File to scan",
      positional: 0, required: true },
  ],
  parse: (argv) => {
    const source = readPositionals(argv)[0];
    if (!source) throw new UsageError("usage: vlmkit check inline-style <html>");
    return { source };
  },
  run: async ({ source }) => ({
    source,
    count: ((await readFile(source, "utf-8")).match(/\sstyle="/g) ?? []).length,
  }),
  findings: (report): Finding[] =>
    report.count === 0 ? [] : [{
      rule: "inline-style",
      severity: "suspect",
      message: `${report.count} inline style attribute(s)`,
    }],
  format: (report) => `${report.count} inline style attribute(s) in ${report.source}`,
});

export default definePlugin({ name: "house-gates", gates: [inlineStyleGate] });
```

Point your project's `vlmkit.config.json` at it:

```jsonc
{ "plugins": ["./tools/house-gates.ts"] }
```

That is the whole integration. Now:

```bash
vlmkit rules                                 # your gate is in the catalog
vlmkit rules check inline-style               # its rule table
vlmkit check inline-style page.html           # run it (exit 1 on a suspect)
vlmkit check inline-style page.html --json    # the shared envelope
vlmkit check inline-style page.html --advisory                     # report, never fail
vlmkit check inline-style page.html --rule check.inline-style/inline-style=warn
```

Relative plugin paths resolve **against the config file's directory**, not the
process cwd — a path that only works when you run from the repo root is a CI
trap. Bare specifiers (`"@acme/vlmkit-brand-gates"`) resolve as normal module
imports.

## The two imports

Everything a gate needs comes from **one** module:

```ts
import { defineGate, definePlugin, firstPositional, readInt,
         PAGE_LOAD_INPUTS, parsePageLoad, UsageError, DIM, RESET } from "@mizchi/vlmkit-core/plugin";
```

That set was sized from what the 27 bundled gates actually import, not from
taste: 40 imports of the contract, 18 of the page-load flags, 15 of the argv
readers, 11 of `UsageError`, 1 of the colours. **If your gate needs something
that is not there, that is a gap in that module worth reporting** — not a reason
to deep-import past it. A deep import (`@mizchi/vlmkit-core/page-load.ts`) still
resolves, for this repo's own use and for consumers already on it, but only the
named subpaths are a promise.

If your gate drives a browser, that is a **second** import:

```ts
import { withBrowser, openSource } from "@mizchi/vlmkit-core/plugin/browser";
```

Separate on measurement, not taste: the main entry loads in ~25ms and adding the
browser chain costs ~441ms even though Playwright itself stays lazy. A gate that
only reads a file should not pay it. `examples/gate-plugin/` uses exactly these
two and a test fails if it ever reaches past them.

`PLUGIN_API_VERSION` is exported so a published plugin can refuse a version it
was not built for, with its own message rather than a `TypeError` inside the
registry. It is `1`, and only a change that breaks an existing plugin bumps it.

## Reusing vlmkit's own rules

A house gate rarely needs a metric from scratch. The deterministic half of every
bundled gate is importable on its own:

```ts
import { COLLECT_DESIGN_SAMPLES, judgeDesignPolicy } from "@mizchi/vlmkit-markup/rules";

const samples = await page.evaluate(COLLECT_DESIGN_SAMPLES);
const report = judgeDesignPolicy(samples, { minReuse: 4, allow: ["button#export;deliberate"] });
```

Every gate here is two halves — a `COLLECT_*` string you evaluate in a page, and
a pure judge over the plain-JSON samples it returns. 33 judges and 14 collectors
are exported, so you can:

- **reuse a rule** rather than reimplementing an average nobody would get
  identical;
- **run one from your own harness** — any driver that can evaluate a string in a
  page works, not just this toolkit's;
- **test yours without a browser**, since the judges are pure. A test asserts
  that: importing `@mizchi/vlmkit-markup/rules` and loading anything
  browser-shaped fails the build.

Not exported there, deliberately: the `run*` functions (they own a browser and a
filesystem — import those from their own modules) and the `format*` functions
(prose belongs to the gate; a library consumer wants findings).

## What you get for free

The runner owns everything that is not your measurement. You never write any of
it, and you cannot disagree with it:

| Concern | Who owns it |
|---|---|
| `--help` (usage, flag table, rule table) | runner, from `usage` + `inputs` + `rules` |
| `--json` envelope (`gate`, `command`, `verdict`, `counts`, `findings`, `suppressed`, `retuned`, `report`) | runner |
| Exit code: a suspect fails (1), warn/info do not (0) | runner |
| `--advisory` (verdict stands, exit code drops to 0) | runner |
| `--rule <gateId>/<ruleId>=off\|suspect\|warn\|info`, and reporting what it silenced | runner |
| `--fail-on-suspect` accepted as a no-op (it is already the default) | runner |
| Run-ledger append, `VLMKIT_NO_LEDGER` | runner, from your `ledger` |
| Config validation of `vlmkit.gates.json` gate strings and rule references | registry |
| "did you mean" on a misspelled command | registry |
| MCP tool derivation | `gateTool(gate)` |

Two consequences worth internalizing:

- **Never call `process.exit`.** Throw `UsageError` for bad input; return a
  report for everything else. `process.exit` truncates buffered stdout, which is
  the class of bug the shared runner exists to prevent.
- **`format` must be pure prose.** It is not called under `--json`, so anything
  it computes is work a JSON consumer silently loses. If a number matters, it
  belongs in the report or in a finding's `evidence`.

## The definition, field by field

```ts
defineGate<Report, Options>({ ... })
```

`Report` is whatever your measurement returns and `Options` is whatever your
parser produces. Both are yours; the contract never inspects them.

### Identity

| Field | Notes |
|---|---|
| `id` | Stable machine id, `<group>.<leaf>` — `check.dom-budget`. Appears in configs, ledger entries and `--rule` references, so renaming it is a breaking change for your users. Must be unique across every loaded plugin. |
| `command` | CLI path tokens: `["check", "dom-budget"]`. Also the key `vlmkit.gates.json` matches. Resolution is longest-prefix, so `["check","a11y","contrast"]` and `["check","a11y"]` can coexist. |
| `title` | Short human name. |
| `summary` | One line. Shown in group help (`vlmkit check --help`) and used as the MCP tool description. |
| `category` | What kind of question this answers — see [below](#choosing-a-category). |
| `usage` | The `--help` body. Write the *domain*: what is measured, what the thresholds mean, what a failure implies. The runner appends the shared flags and the rule table, so do not restate those. |

Pick an existing group verb (`check`, `scan`, `diff`, `inspect`, `stress`,
`verify`) unless your gate genuinely does not fit one. A new top-level verb
works, but it costs your readers a new place to look.

### Rules

```ts
rules: [
  { id: "nodes-over-budget", title: "Element count above the node budget",
    severity: "suspect",
    docs: "Large DOMs cost layout and memory on every interaction, not just at load." },
]
```

The rule table is the tunable surface, declared up front. Declaring it is what
makes `"nodes-over-budget": "off"` distinguishable from a typo — a `--rule` that
names a rule your gate does not have **fails the run** and lists the ids you do
have.

Every `Finding.rule` you emit must appear here. One rule per distinct reason a
reader would want to tune separately: if two findings would always be switched
off together, they are one rule.

`docs` is where you say what tuning it means. Users read it in
`vlmkit rules <gate>` while deciding, so "promote this if your project treats
depth as a hard rule" is more useful than a restatement of the title.

### Inputs

```ts
inputs: [
  { name: "source", placeholder: "html-or-url", kind: "path-or-url",
    description: "Page to measure", positional: 0, required: true },
  { name: "max-nodes", placeholder: "n", kind: "number",
    description: "Element-count budget", defaultDescription: "1500" },
  { name: "font", kind: "string", description: "Allowed font, repeatable", repeatable: true },
]
```

`inputs` is the *machine-readable summary* of what `parse` accepts — it drives
the help table and the MCP JSON schema. It does not parse anything; `parse`
still owns that, because several real gates have argument shapes no generic
schema expresses well.

Set `placeholder` whenever the help prompt should differ from the option key
(`<html-or-url>` reads better than `<source>`). `defaultDescription` is help
text only — put the actual default in `parse`.

**If your gate opens a page, spread the shared page-load inputs.** Twenty gates take
`--timeout`, `--wait-until` and `--har`, and they come from one declaration so they cannot
drift apart:

```ts
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/plugin";

inputs: [
  { name: "source", placeholder: "html-or-url", kind: "path-or-url", positional: 0, required: true },
  ...PAGE_LOAD_INPUTS,
],
parse: (argv) => ({ source: firstPositional(argv, "..."), ...parsePageLoad(argv) }),
```

`parsePageLoad` returns **absent keys**, never `undefined` values, so spreading it cannot
clobber a default your gate sets itself. `src/cli/gate-page-load.test.ts` walks the live
registry and fails a navigating gate that skips this — and it also fails a gate that *declares*
a flag and forgets it in `parse`, because a flag that parses and is then dropped is worse than
no flag. If your gate genuinely cannot honour one of the three, leave that one out and say why
in its `usage`; the test's exception table requires the stated reason to appear in the gate's
own prose.

### `parse`

```ts
parse: (argv, ctx) => Options
```

`argv` is everything after your command tokens, with the shared flags
(`--json`, `--advisory`, `--rule …`) already stripped. `ctx` carries `cwd`, the
raw `argv`, and `json` (true when the caller asked for JSON, so you can skip
building anything only prose needs).

Use the helpers from `@mizchi/vlmkit-core/plugin` rather than hand-rolling:

| Helper | Behavior |
|---|---|
| `hasFlag(argv, "deep")` | boolean flag |
| `readFlag(argv, "out")` | last `--out <value>`, or `undefined` |
| `readAll(argv, "font")` | every occurrence, for `repeatable` flags |
| `readInt(argv, "max-nodes", { min: 1 })` | rejects a missing value, a non-number, and a value that is itself a flag |
| `readNumber(argv, "threshold", { min: 0, max: 1 })` | as above, floats |
| `readChoice(argv, "wait-until", ["load", "networkidle"])` | closed value set |
| `readPositionals(argv, ["--max-nodes"])` | positionals, told which flags take values so it does not eat them |

`readPositionals` needs the list of value-taking flags. Forgetting one is the
most common authoring bug: `--max-nodes 800 page.html` then returns `800` as
your source.

Throw `UsageError` for anything the user got wrong. The runner turns it into a
single `error: …` line plus exit 1 — no stack trace, no usage dump the reader has
to scroll past.

### `run`

```ts
run: (options, ctx) => Promise<Report> | Report
```

Measurement only. No printing, no exit codes, no severity decisions. Returning
a report that describes the page — including the *inputs* you resolved, like the
budgets you settled on — is what lets `--json` be self-describing and lets
`format` stay pure.

### `findings`

```ts
findings: (report, options) => readonly Finding[]
```

The projection onto the normal form:

```ts
interface Finding {
  rule: string;            // must exist in your rule table
  severity: "suspect" | "warn" | "info";
  message: string;
  selector?: string;       // only when you really have a queryable selector
  viewport?: number;       // for multi-viewport gates
  evidence?: Record<string, unknown>;  // structured, passed through to --json verbatim
}
```

A clean run returns `[]`. That is a `pass` — do not invent an "all good"
finding.

`options` is passed because a flag can legitimately decide a severity:
`check crater --require` promotes an unreachable backend from `info` to
`suspect`. Most gates ignore the second argument.

Two habits that pay off:

- **Put the numbers in `evidence`, not only in the message.** An agent reading
  `--json` should not have to parse prose to learn how far over a budget you
  are. `evidence: { value, budget, over }` is worth the three keys.
- **Only set `selector` when it is queryable.** If you identify things by DOM
  path or by role, that belongs in `evidence`. A `selector` nothing can
  `querySelector` is worse than no selector.

You may emit a *lower* severity than the rule declares when your evidence is
weaker — `check integrity` downgrades a `js-error` to `warn` when it fired after
load. The runner preserves that judgment; only an explicit rule setting
overrides it. The declared `severity` is the worst case.

### `format`, `headline`, `ledger`

```ts
format:   (report, rules?) => string         // prose; not called under --json
headline: (report) => string                 // optional, one line: what was MEASURED
ledger:   (report, options) => entry | null  // optional
```

**Take the second parameter.** Suppression happens on the runner's normalized
finding list, while your prose renders from the raw report — so a one-parameter
formatter prints findings the project turned off, counts them on its own status
line, and sits above a verdict and an exit code that disagree. The runner detects
this from your formatter's arity and appends a disclaimer, which is a warning
label on a screen that contradicts itself rather than a fix. All 27 built-in
gates take it; the shortest correct shape is:

```ts
import { applyRuleTiers, hiddenByRuleNote } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";

format: (report, rules) => {
  const { shown, hiddenByRule } = applyRuleTiers(
    report.issues,
    (issue) => ({ rule: issue.kind, emitted: issue.severity }),
    rules,
  );
  const lines = shown.map(({ row, tier }) =>
    `${tier === "suspect" ? "✗" : "!"} ${row.kind}: ${row.message}`);
  const note = hiddenByRuleNote(hiddenByRule);   // "2 finding(s) not shown — rule turned off (…)"
  if (note) lines.push(note);
  return lines.join("\n");
}
```

Three rules the built-ins learned the hard way:

- **Read `tier`, not your row's own severity**, once tiered. A rule re-tuned to
  `warn` that still prints a red ✗ is the same contradiction one layer down.
- **Never `rules.effective(id)`** — use `rules.setting(id)` or `ruleTier`. The
  difference is below.
- **Keep the measurement, drop the claim.** A number your gate measured does not
  stop being true because nobody wants to be told about it: keep the count, the
  percentage and the row, change the marker, and print the note so a shorter
  screen is not mistaken for a cleaner page.

`headline` says what was measured, not what was wrong — `"312 nodes, depth 9"`,
not `"1 warning"`. The findings already say what was wrong, and a clean run has
none. Two consumers need exactly this and cannot get it elsewhere: `verify
markup`, which folds gates into its verdict and names them in its kickback, and
the MCP server's one-line verdict.

`ledger` returns a run-ledger entry (`{ tool, source, headline }`) or `null` to
opt out. The runner does the appending, so `VLMKIT_NO_LEDGER` handling stays in
one place.

Terminal colors, if you want them, are in
`@mizchi/vlmkit-core/plugin` (`DIM`, `RESET`, `GREEN`, `RED`,
`YELLOW`, `CYAN`, `BOLD`). Respect `NO_COLOR` by using those constants rather
than raw escapes.

## Choosing severities

The declared severity decides whether your gate can fail someone's CI, so the
repo follows a stated rule rather than a per-gate mood:

- **`suspect`** — a violation of an external standard, or of an agreement two
  sides are supposed to keep. WCAG contrast, touch-target size, i18n overflow, a
  component that renders differently in two places, a dead disclosure. Fails the
  command (exit 1).
- **`warn`** — conformance to a preference the caller declared, or drift that is
  information rather than breakage. Token-scale adherence, dark-mode parity,
  house-style smells. Never fails the command.
- **`info`** — something worth reporting that must never affect a verdict. An
  optional backend being unavailable, a skipped variant.

Default to `warn` when in doubt. Every `warn` is one config line from being
enforced:

```jsonc
{ "defaults": { "rules": { "check.dom-budget/depth-over-budget": "suspect" } } }
```

Say so in the rule's `docs`, and the reader will find it exactly when they are
deciding.

## Choosing a category

`vlmkit rules` groups gates by what kind of question they answer, because
`check`/`scan`/`stress` says how a command is *spelled*, not what a failure
*means*.

| Category | The question |
|---|---|
| `correctness` | Is the page broken, on its own terms? No reference needed. |
| `behavior` | Does it respond correctly to size, scroll, motion and input? |
| `design-system` | Does it conform to the design language the project declares? |
| `verdict` | Is this attempt done? Aggregates other signals into one answer. |
| `infrastructure` | Is the measurement toolchain itself working? |

Most house gates are `design-system` — a project rule about how its own pages
should look or be built. Reach for `correctness` only if the page would be
broken for a user who had never seen your design system.

`category` is optional; uncategorized gates list under `other`. It is
deliberately independent of which plugin a gate ships in: a plugin is a unit of
distribution, a category is a unit of meaning. One plugin can hold gates in
several categories, and one category spans plugins.

## Reading configuration

Budgets and allowlists belong in the repo, not in everyone's shell history. A
gate may read whatever it likes from `vlmkit.config.json` under its own key —
the loader only reads `"plugins"` from that file and reserves nothing else:

```jsonc
// vlmkit.config.json
{
  "plugins": ["./tools/house-gates.ts"],
  "domBudget": { "maxNodes": 900, "maxDepth": 14 }
}
```

```ts
parse: (argv, ctx) => {
  const config = budgetFromConfig(ctx.cwd);   // resolve against ctx.cwd, not process.cwd()
  const flag = readInt(argv, "max-nodes", { min: 1 });
  return { maxNodes: flag ?? config.maxNodes ?? DEFAULT_MAX_NODES };
}
```

Two rules learned the hard way:

1. **A missing or unreadable config is not an error.** Fall back to defaults. A
   gate that fails because a project declined to configure it is a gate nobody
   pilots.
2. **Record where each number came from** and surface it in the report. `(config)`
   versus `(default)` next to a budget is what ends the argument about whether it
   was ever configured. `examples/gate-plugin/dom-budget.gate.ts` does this with
   an `origin` field.

Resolution order should be flag > config > default, in that order, always.

## Measuring in a browser

Import Playwright **inside `run`**, never at module scope:

```ts
run: async ({ source }) => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const url = /^(https?|file):\/\//.test(source) ? source : pathToFileURL(resolve(source)).href;
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    return await page.evaluate(MEASURE);
  } finally {
    await browser.close();   // finally, so a throw still closes the browser
  }
}
```

Declaring a plugin must stay cheap: `vlmkit rules` loads every gate definition,
and a module-scope Playwright import makes listing the catalog pay for a browser
nobody launched.

Accept both a path and a URL for the positional if the measurement can work
either way — every bundled gate does, and readers expect it.

## Knowing what your gate costs

Your `run` *is* your gate's cost. Measured across the 18 bundled gates that take
a bare page, `run` is ~100% of wall clock and everything else — parse,
projection, prose — totals under a millisecond. So:

```bash
vlmkit check my-gate page.html --timing     # parse / run / findings / rules / format / ledger
vlmkit bench gates page.html --gate "check my-gate"   # ranked against the built-ins, with yield
```

Two things this changes about how you write a gate:

- **One measurement, many rules.** Launch the browser once and derive every rule
  from one report. A gate that navigates per rule pays the navigation per rule,
  and nothing in the contract will stop you.
- **Adding a rule is free; adding a gate is not.** Rules are a projection over a
  report you already have, so a gate with eighteen rules costs the same as one
  with two. If a new check can read the report you already collect, it is a rule
  on an existing gate, not a new gate.

And one thing it changes about what you tell users: `--rule x=off` does not make
runs faster. Suppression is applied to the findings after the measurement, by
design, so a silenced finding can still be reported as silenced. If your gate's
`usage` implies otherwise, fix the wording.

`vlmkit bench gates` will pick your gate up automatically if its positional input
is a page (`kind: "path-or-url"`) and nothing else is required; otherwise name it
with `--gate "check my-gate <args>"`.

## Testing your gate

Extract the judgment from the I/O and unit-test the judgment. In the worked
example, `analyzeHouseBrand(source, css, allowedFonts)` is exported precisely so
a test can cover it without touching the disk or launching a browser.

For the integration, spawn the real CLI against a temp project — that is what
`src/cli/plugin-e2e.test.ts` does, and it is the only way to check the claims
you actually care about:

```ts
const dir = mkdtempSync(join(tmpdir(), "my-gate-"));
writeFileSync(join(dir, "vlmkit.config.json"), JSON.stringify({ plugins: [PLUGIN] }));
writeFileSync(join(dir, "page.html"), "<!doctype html>…");
const r = spawnSync(process.execPath, ["--experimental-strip-types", CLI,
  "check", "inline-style", "page.html", "--json"],
  { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
```

Worth asserting at least once, because each has broken in practice:

- the gate appears in `vlmkit rules` and in its group help;
- exit 1 on a suspect, exit 0 on a clean page, exit 0 under `--advisory` with
  the verdict still `fail`;
- `--rule <id>/<rule>=off` suppresses **and reports** the suppression;
- a misspelled `--rule` fails with your rule ids listed;
- a repeatable flag arrives as repeated occurrences — assert both a passing and
  a failing case, or a comma-joined single flag would pass your test;
- the ledger entry landed, with the headline you expect.

## Shipping it to other projects

A plugin is one module, one `definePlugin`, any number of gates:

```ts
export default definePlugin({
  name: "@acme/vlmkit-brand-gates",   // unique; named in conflict errors
  version: "1.0.0",
  gates: [houseBrandGate, domBudgetGate],
});
```

Publish it as an ordinary package with `@mizchi/vlmkit-core` as a dependency
(and `playwright` as a peer dependency if you launch a browser). Consumers add
the bare specifier to `"plugins"`. Nothing else changes: the registry composes
`[markup, capture, app, ...yours]` through the same `createGateRegistry` call,
and gate-id collisions are a hard error naming both plugins rather than a silent
last-one-wins.

Once loaded, your gate participates everywhere a bundled gate does — including
batch runs:

```jsonc
// vlmkit.gates.json
{
  "defaults": {
    "gates": ["check integrity", "check dom-budget"],
    "rules": { "check.dom-budget/depth-over-budget": "suspect" }
  },
  "pages": [{ "id": "docs", "source": "routes/docs/**/*.html" }]
}
```

`vlmkit gates list` validates both the command strings and the rule references
against your rule table before running anything.

## Worked examples

`examples/gate-plugin/` is a self-contained project — it has its own
`vlmkit.config.json`, so you can run it as-is:

```bash
cd examples/gate-plugin

vlmkit rules                                    # both example gates, under design-system
vlmkit check house-brand page.html              # passes
vlmkit check house-brand page-broken.html       # suspect → exit 1
vlmkit check dom-budget  page.html              # passes, budgets from the config
vlmkit check dom-budget  page-broken.html       # depth warn → exit 0
vlmkit check dom-budget  page-broken.html --rule check.dom-budget/depth-over-budget=suspect
```

| File | What it is for |
|---|---|
| [`house-gates.ts`](../examples/gate-plugin/house-gates.ts) | The smallest useful gate: read a file, match strings, no browser. Start here to see the boundary. |
| [`dom-budget.gate.ts`](../examples/gate-plugin/dom-budget.gate.ts) | The shape most real house gates take: render, measure numbers, compare against budgets from flag/config/default. Start here to write your own. |
| [`index.ts`](../examples/gate-plugin/index.ts) | Both gates in one plugin — the distribution unit. |
| [`vlmkit.config.json`](../examples/gate-plugin/vlmkit.config.json) | Declares the plugin and a `domBudget` block. |

For real gates at full size, read
`packages/vlmkit-markup/src/gates/*.gate.ts` — 24 of them, all built on this
same contract.

## Checklist

- [ ] `id` is `<group>.<leaf>` and stable
- [ ] `command` uses an existing group verb unless there is a reason not to
- [ ] `category` set
- [ ] one rule per independently-tunable reason, each with useful `docs`
- [ ] severities follow [the rule above](#choosing-severities); `warn` when unsure
- [ ] `inputs` covers every flag, with `placeholder` where the key reads badly
- [ ] `parse` throws `UsageError` and never calls `process.exit`
- [ ] `readPositionals` knows every value-taking flag
- [ ] `run` does no printing; Playwright imported inside it
- [ ] one measurement shared by every rule — check the split with `--timing`
- [ ] every `Finding.rule` exists in the rule table
- [ ] numbers are in `evidence`, not only in the message
- [ ] `format` is pure prose and computes nothing that matters
- [ ] `headline` says what was measured
- [ ] a unit test on the judgment, and one spawned-CLI test on the envelope
