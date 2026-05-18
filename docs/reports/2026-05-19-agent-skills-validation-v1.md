# Agent skills validation v1: bootstrap five skills + subagent eval (2026-05-19)

## Question

The PR #47 branch adds five coding-agent skills under
`.claude/skills/` (`vrt-visual-diff`, `vrt-migration-eval`,
`vrt-css-fix-loop`, `vrt-markup-synth`, `vrt-regression-watch`).
Are they usable by a fresh agent reading the skill in isolation? Are
the When-NOT-to-use sections strong enough to redirect mis-routed
queries to the right sibling?

## Setup

Two general-purpose subagents, dispatched in parallel via the
`Agent` tool. Each got:

- Read-only access to ONE target SKILL.md + README.md + package.json.
- The two HTML files `fixtures/element-compare/{before,after}.html`
  as the comparison scenario, but **explicitly forbidden from
  reading their source** (the diff has to come through the tool).
- Forbidden from reading the other four SKILL.md files or
  `.claude/CLAUDE.md`.
- A budget of ONE round (skill quality is the variable, not iteration).

| Subagent | Skill under test | Expected outcome |
|---|---|---|
| A | `vrt-visual-diff` | Should complete: this is the right tool for the scenario. |
| B | `vrt-migration-eval` | Should bounce: "wrong tool, route to vrt-visual-diff." |

## Result

| Subagent | Outcome | What went right / wrong |
|---|---|---|
| A | **Could not reach a verdict** (Confidence: low) | Skill's `vrt diff html ...` form is rejected by the installed `dist/vrt.mjs`; subagent couldn't discover that the source form exists. |
| B | **Correctly judged "wrong tool"** | Redirected to `vrt-visual-diff` using only `vrt-migration-eval`'s own description + When-NOT-to-use entries. |

The asymmetry is informative: when the skill description carries
enough scope detail (B), an agent can route correctly without
reading siblings. When it doesn't tell you how to actually invoke
the CLI (A), even the right tool fails.

## What worked — direct quotes

### Subagent B: "wrong tool" routing

> "The fixture path `fixtures/element-compare/before.html` /
> `after.html` carries no signal of a toolchain swap; the default
> reading is 'small edit between two snapshots,' which the skill
> itself routes elsewhere."

The skill's description string (≤1024 chars, surfaced by APM) plus
its first paragraph were enough to gate the decision. The
sibling-pointer in "When NOT to use" (`Single CSS file edit: use
vrt-visual-diff.`) was the load-bearing line.

### Subagent A: pipeline framing

> "Knowing the pipeline has two stages and what each stage outputs
> is useful conceptually — but only conceptually, because the
> commands themselves are wrong."

The mental model arrived, but the executable form did not.

## What didn't / new gaps

### Gap 1 — Invocation method left implicit (CRITICAL)

> "The actual binary does not expose a `diff` subcommand at all —
> top-level `vrt` rejects it with `Unknown command: diff`."
>     — subagent A

Root cause: `dist/vrt.mjs` is a 2026-04-09 build that predates the
`vrt diff <leaf>` reorganization in `src/cli/cli.ts`. The skill
wrote `vrt diff html …`, expected an env where `vrt` was on PATH,
and didn't explain that source needs to be invoked via
`node --experimental-strip-types src/cli/vrt.ts …`.

**Fixed in `56e4cb3`** — Invocation block prepended to all five
skills. Each names the source form, warns that dist may lag,
and tells the agent how to verify (`pnpm build` if the dist must
be used).

### Gap 2 — `--output reports/diff.json` is a directory

> "Running `vrt compare … --output /tmp/…/diff.json` produces zero
> stdout, zero stderr, exit 0, and no output file."
>     — subagent A

The migration-compare engine treats the `--output` value as a
directory and writes `migration-report.json` inside it; the Quickstart
spelled it as `reports/diff.json` which reads like a target filename.

**Fixed in `56e4cb3`** — Quickstart uses `--output reports/` and
passes the explicit `reports/migration-report.json` path to
`vrt diff agent`. A one-sentence preface above the code block
explains the directory semantics.

### Gap 3 — No canonical example output to compare against

> "There is a schematic ('How to read the report') but no canonical
> snippet of a real Markdown report, so even on success an agent
> cannot tell whether the output is sane."
>     — subagent A

**Fixed in `56e4cb3`** — schematic replaced with a real excerpt
captured from a live run on `fixtures/element-compare/`, with
sample diff percentages and shift bands.

### Gap 4 — `vrt-migration-eval` Quickstart shape matches any pair

> "[T]he matching `compare baseline.html variant.html` command
> shape sells a fit that the prose disclaims."
>     — subagent B

`migration compare baseline.html variant.html` has the same shape as
`diff html before.html after.html`, so a fresh agent on the wrong
skill could still proceed. Subagent B caught this in time, but the
prose-only disclaimer was the only thing stopping it.

**Fixed in `9597aec`** — `vrt-migration-eval` now opens with a
**Precondition (gate)**: "Name the migration as `<from-stack> →
<to-stack>`. If you can't, stop and use `vrt-visual-diff` instead."
The check is positioned before the Quickstart, forcing an explicit
self-test.

### Gap 5 — `dist/vrt.mjs` is stale (out of scope for this skill PR)

A 2026-04-09 build for a 2026-05-19 source tree is a real
publication/release issue, not a skill bug. Deferred: needs a
separate PR to either rebuild + republish, or to remove the `bin`
entry until the build is stable. Filed mentally; should become an
issue.

## What's fixed vs deferred

| Gap | Status | Commit |
|---|---|---|
| 1. Invocation method | Fixed | `56e4cb3` |
| 2. `--output` dir semantics | Fixed | `56e4cb3` |
| 3. No canonical output snippet | Fixed | `56e4cb3` |
| 4. Migration Quickstart trap | Fixed | `9597aec` |
| 5. Stale `dist/vrt.mjs` | Deferred (vrt publication issue, not skill issue) | — |

## Versus prior runs

This is v1 — no prior run.

## Next steps

- File the stale-dist issue (Gap 5) so the publish loop catches up.
- Run a v2 subagent on `vrt-visual-diff` after this PR lands to
  confirm the Invocation block resolves Gap 1. (Other three skills
  not exercised here; opportunistic re-eval when reasoning about
  them.)
- Open question: should `vrt-css-fix-loop` get a similar gate to
  the one we added to `vrt-migration-eval`? Its scope is narrow
  (CSS-challenge fixtures only) and the When-NOT-to-use already
  covers "production self-repair on an arbitrary user repo." Not
  exercised by a subagent yet — defer until there's signal.

## Files

- Skills: `.claude/skills/vrt-{visual-diff,migration-eval,css-fix-loop,markup-synth,regression-watch}/SKILL.md`
- Manifest: `apm.yml`
- Fixture used: `fixtures/element-compare/{before,after}.html`
- Commits on `feat/agent-skills`: `003efd8` (initial), `9597aec`
  (B fix), `56e4cb3` (A fix).
