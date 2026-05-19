# Agent skills validation v3: confirm v2 + evaluate markup-synth + css-fix-loop (2026-05-19)

## Question

After v2 (commits `f219914` + `282b6cc`):

1. Does the v2 fix to `vrt-regression-watch` still hold under a fresh
   subagent + a CI-snippet construction sub-task?
2. Are `vrt-markup-synth` and `vrt-css-fix-loop` — the two
   not-yet-validated skills — accurate?

## Setup

Three parallel general-purpose subagents in sequence (C2 first to
free the writer for the next two; D + E in parallel after).

| Subagent | Skill | Scenario |
|---|---|---|
| C2 | `vrt-regression-watch` | v2 confirm. No-op 2-run + assemble CI snippet from "Pick one of these three modes" guide. |
| D | `vrt-markup-synth` | Audit `fixtures/element-compare/before.html` via `check tokens`. Note any API-key claim accuracy gap. |
| E | `vrt-css-fix-loop` | Run fix-loop on `page` fixture, seed 11, selector mode, default model, 2 rounds. |

## Result

| Subagent | Outcome | Confidence | Severity of new friction |
|---|---|---|---|
| C2 | **Completed**, CI snippet correct, mode pick correct, no-history trap avoided | high | minor (1 nit — copy-paste convenience) |
| D | **Completed**, 9 violations detected correctly | high | **MAJOR — skill was a fabrication on its core claim** |
| E | **FIXED on round 1** (diff 4.1% → 0.0%) | high (on outcome) / low (on pipeline mental model) | major (pipeline-shape descriptive bug) |

The v2 fix stuck (C2 confidence high vs C medium). The two new
evaluations exposed something I had been afraid of: my v1 SKILL.md
authoring contained material factual errors that no v1/v2 round
could have caught, because they were about skills that hadn't yet
been exercised.

## What worked

### C2: skill guides built the CI snippet without trap

> "Mode picked: 'Compare against fixed reference, leave it untouched' =
> `--previous X --persist-summary <pr-specific-path>`. This satisfies
> (e) by routing the PR's persist write to a throwaway tmp path so
> the cached `.vrt/main-baseline.json` is never overwritten.
> `--no-history` would skip the load too, killing regression
> detection — explicitly warned against in the skill."
>     — subagent C2

The v2 "Pick one of these three modes" table + the warning anchored
the right combination on first read.

### D: token-conformance audit accurate without API

> "Audit verdict: Violations found (9 total) — `main>div.sidebar
> margin-top 10.00px → nearest 8`, `main>div.sidebar padding 15.00px
> → nearest 16`, `footer padding 15.00px → nearest 16`."
>     — subagent D

Verdict matches ground truth — the fixture's sidebar/footer use
hardcoded `10px` / `15px` against the default `0,2,4,8,12,16,...`
scale.

### E: pipeline converged + Quickstart copy-pasteable

> "The Quickstart selector-mode example was copy-pasteable verbatim
> […] Zero guessing."
>     — subagent E

## What didn't / new gaps

### Gap F — vrt-markup-synth was a fabrication (D found, source-verified)

The skill's frontmatter described all five sub-tools as "VLM-driven;
requires API keys." Subagent D ran `check tokens` with no API key in
env and got a clean report in ~1s, ruling out the blanket claim:

> "I ran the command with zero `OPENROUTER_API_KEY` /
> `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `VRT_*` variables in the
> environment […] The command produced a complete report in ~1s
> with no API call."
>     — subagent D

I then grep'd the source: **all five sub-tools** (`build component`,
`scan component`, `check tokens`, `check theme`, `stress i18n`)
import zero VLM/LLM client code. Each is pure Playwright + pixel /
DOM computation. The original SKILL.md was a fabrication I shipped
without checking.

**Fixed in `67b4f97`** — full rewrite. The agent is the VLM; tools
surface signal. Frontmatter, sub-tools table, Environment, Costs,
Failure-modes all aligned with the actual behaviour. Default token
scales documented (`0,2,4,8,12,16,…`). The `vrt check tokens` ↔
`vrt design-tokens` dispatcher alias is now noted (subagent D hit a
small confusion from the banner reading `design-tokens`).

This is the most important lesson of the run: **a fresh subagent
caught what no amount of self-review by the author could**.

### Gap G — fix-loop is 2-stage, not 1-stage (E found)

The skill described fix-loop as a single VLM call per round
("Send the diff overlay to the VLM... Parse the VLM's CHANGE list...
Re-run"). Real harness output:

> "VLM=bytedance/ui-tars-1.5-7b | LLM=claude-sonnet-4-20250514 […]
> Real output has a two-stage pipeline (`VLM: 5 changes → LLM: 6
> fixes proposed`) that the skill never mentions."
>     — subagent E

Worse, this changes the semantics of FIXED. The VLM proposed
selectors unrelated to the removed block (`.main / .sidebar /
.header-nav` while the removed block was `.readme-body pre`), and
the LLM compensated — pipeline hit FIXED but the VLM did *not*
recover the regression on its own:

> "Mismatch between proposed selectors and removed block […] The
> FIXED verdict feels suspicious — either the diff overlay made
> non-removed elements look changed, or the Stage-2 LLM
> compensated."
>     — subagent E

This matters because the skill's stated purpose is "measuring
whether a VLM model can recover a known regression." FIXED, taken
alone, doesn't answer that question.

**Fixed in `29accff`** — pipeline steps now name VLM and LLM
stages explicitly with banner format. Added a "Pipeline divergence
warning" calling out the LLM-rescue case and pointing to selector /
property recall as the correct VLM-isolation metric. Quickstart
opens with a one-line direnv / `.env.local` hint (separate small
nit from E).

### Gap H — \$REPORT var in regression-watch Quickstart (C2 minor)

> "a reader has to stitch two snippets to learn the filename."
>     — subagent C2

**Fixed in `cf9cfe5`** — `REPORT=reports/migration-report.json`
factored out at the top of the Quickstart.

## What's fixed vs deferred

| Gap | Status | Commit |
|---|---|---|
| F. markup-synth fabrication | Fixed | `67b4f97` |
| G. fix-loop 2-stage pipeline + FIXED semantics | Fixed | `29accff` |
| H. \$REPORT var convenience | Fixed | `cf9cfe5` |

## Versus prior rounds

| Metric | v1 | v2 | v3 |
|---|---|---|---|
| Workflows completed | 0 / 1 | 2 / 2 | 3 / 3 |
| Skills exercised | 2 (visual-diff, migration-eval) | 1 confirm + 1 new (visual-diff conf., regression-watch) | 1 confirm + 2 new (regression-watch conf., markup-synth, css-fix-loop) |
| **Real factual bugs found** | 0 | 1 (CI gate pattern unfireable) | **1 (markup-synth fabrication)** + 1 (fix-loop 1-stage misdesc) |
| Skill-level frictions surfaced | 4 | 4 | 3 (1 minor + 2 major) |

The v3 round did something v2 couldn't: it surfaced **fabrication-
class errors** — claims in SKILL.md that didn't match the
implementation, not just unclear wording. These can only be caught
by exercising the skill against the real tool.

## Lesson — calibration

I authored five SKILL.md files in commit `003efd8` based on my
mental model of what each command did. The mental model was
**materially wrong for at least two of the five skills** (the two
that weren't validated until v3). The visual-diff / migration /
regression-watch skills also had errors, but their errors were
incremental ("wrong shape of `--output`", "missing precondition")
rather than fabrications. The wider gap appeared exactly where my
prior knowledge was thinner.

**Takeaway**: never ship a SKILL.md without (a) at least one fresh
subagent exercising it, or (b) the author having recently run the
underlying command and read its output. I had done neither for
markup-synth's audit sub-tools, and the fabrication followed
predictably.

## Next round candidates

- **D2**: Confirm subagent on the rewritten `vrt-markup-synth`.
  Same check-tokens scenario; assess whether the new frontmatter
  routes the right agent in.
- **E2**: Confirm subagent on `vrt-css-fix-loop`. Same scenario but
  check whether the agent now correctly distinguishes "pipeline
  FIXED" from "VLM recovered the regression."

Both are low-cost (~$0 / ~$1e-7) and high info value.

## Files

- Skills modified: `.claude/skills/vrt-regression-watch/`,
  `.claude/skills/vrt-markup-synth/`,
  `.claude/skills/vrt-css-fix-loop/`.
- Source consulted: `packages/vrt-markup/src/*` (zero VLM imports
  confirmed across all five sub-tools).
- Fixtures used: `fixtures/element-compare/before.html` (D),
  CSS-challenge `page` fixture (E).
- Commits on `feat/agent-skills`: `cf9cfe5`, `67b4f97`, `29accff`.
