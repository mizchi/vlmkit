# Agent skills validation v4: confirm v3 rewrites (2026-05-19)

## Question

After v3 (commits `cf9cfe5` + `67b4f97` + `29accff`):

1. Does the `vrt-markup-synth` rewrite let an agent predict
   "no API key needed" from the SKILL.md alone?
2. Does the `vrt-css-fix-loop` rewrite let an agent correctly
   diagnose whether the VLM (Stage 1) or the LLM (Stage 2) drove a
   FIXED verdict?

## Setup

Two parallel general-purpose subagents — same agent-validation-loop
discipline.

| Subagent | Skill | Task |
|---|---|---|
| D2 | `vrt-markup-synth` (post-`67b4f97`) | Audit `fixtures/element-compare/before.html` via `check tokens`. **Predict API-key need from skill before running.** |
| E2 | `vrt-css-fix-loop` (post-`29accff`) | Run fix-loop on `page` fixture seed 11 selector mode. **Diagnose: did the VLM recover the regression itself?** |

## Result

| Subagent | Outcome | Confidence | New friction |
|---|---|---|---|
| D2 | **Prediction correct (No)**; run clean; verdict matched ground truth | high | 1 minor (CLI banner still uses legacy `vrt design-tokens` name) |
| E2 | **Diagnosis correct (LLM compensated)**; mental model anchored on skill quotes | high | nothing surfaced (1 suggestion only) |

Both subagents quoted the v3 fixes as the load-bearing lines that
anchored their answers — i.e. the fixes weren't just present, they
were the thing that worked.

## What worked — direct quotes

### D2: skill-only prediction

> "API-key prediction from SKILL.md alone: No. Load-bearing line
> (frontmatter): 'All five are pure DOM + Playwright + pixel
> processing — no VLM / no API key required.' Reinforced under
> Environment: 'No API keys are required for any sub-tool in this
> skill.'"
>     — subagent D2

The rewrite carries the same message in three places (frontmatter,
Environment section, sub-tool table). The redundancy is intentional
and earned a "match — prediction confirmed" on first run.

### D2: over-correction check

> "Over-correction check: skill says 'The VLM / VRT_VLM_MODEL env
> vars listed in other VRT skills do not apply here.' That's
> correct and does not obscure that other skills need keys — it
> explicitly points outward."
>     — subagent D2

The rewrite didn't swing the pendulum too far. Good.

### E2: diagnostic anchored on quoted skill text

> "The LLM (Stage 2) compensated — the VLM did not recover the
> regression itself. Evidence: Removed: `.readme-body pre { 6 props }`
> is the ground-truth missing block, but the VLM's 5-row CHANGE list
> mentions `.main`, `.sidebar`, `.header-nav`, `.header-search`,
> `.tabs` — none reference `.readme-body pre`. The pipeline still
> hit FIXED because the LLM emitted 11 fixes (≥ VLM's 5, with high
> confidence) that restored the deleted block."
>     — subagent E2

E2 reached the diagnosis E couldn't reach in v3 (E v3 flagged the
mismatch as "suspicious" but had no framework for it). The "Pipeline
divergence warning" added in `29accff` did its job verbatim.

## What didn't / new gaps

### Gap I — Legacy `vrt design-tokens` banner (D2 minor)

> "the CLI header literally prints `vrt design-tokens` even when
> invoked as `vrt check tokens`, and the report's 'Suggested next
> step' says 'Re-run `vrt design-tokens`' — not the documented
> `vrt check tokens`. The skill warns about this in one direction
> (dispatcher routes both); it doesn't warn the agent that the CLI's
> own output will use the *other* name."
>     — subagent D2

**Fixed in `6b663b4`** — sub-tools table's check-tokens row now
explicitly calls out the legacy banner so the agent doesn't second-
guess which command they ran.

### Gap J — Summary-table columns (E2 suggestion)

> "The harness prints this final table but the skill doesn't show
> or label it; a future agent comparing runs across models would
> benefit from knowing `Escalated=false` means Stage-2 LLM stayed on
> the default tier (no fallback ladder triggered)."
>     — subagent E2

**Fixed in `ba1986e`** — "Reading the output" section gains a
glossary table for `Round / Diff / Changes / Fixes / Escalated`.

## Stop signs

All three of agent-validation-loop's stop-the-loop signals:

- ✓ **"Each new agent run surfaces fewer new gaps than the last"**:
  v1=4, v2=4, v3=3 (2 major + 1 minor), v4=2 (1 minor + 1 suggestion).
- ✓ **"Per-fix commit size is shrinking"**: v3 had a ~120-line
  rewrite (markup-synth); v4 commits are 1-11 lines each.
- ✓ **"Remaining variance is agent-side initial-state, not tool
  signal quality"**: v4's two friction points are both about
  decorations (legacy CLI banner + column labels), not about
  whether the agent can use the skill.

**Decision: stop the validation loop here.** Five rounds (a, b, a2,
c, c2, d, e, d2, e2 = 9 agent runs counted as eval invocations),
all 5 skills exercised, all major fabrications surfaced and
corrected.

## Cumulative tally

| Round | Agents | Workflows completed | Real bugs found | Friction landed |
|---|---|---|---|---|
| v1 | A, B | 1/2 (B routed correctly; A blocked) | 0 | 4 fixes |
| v2 | A2, C | 2/2 | 1 (CI gate unfireable) | 4 fixes |
| v3 | C2, D, E | 3/3 | **2 (markup-synth fabrication + fix-loop 1-stage misdesc)** | 3 fixes |
| v4 | D2, E2 | 2/2 | 0 | 2 fixes (minor) |
| **Total** | **9 agent runs** | **8/9** | **3** | **13 fixes** |

The v3 round was the highest-yield: it caught factual errors that
no v1/v2 round could have surfaced (the two skills weren't yet
exercised), and the fixes were large.

## Deferred (out of scope for this PR — file as separate issues)

- **Stale `dist/vrt.mjs`** (v1 finding): the published binary is a
  2026-04-09 build for a 2026-05-19 source tree. Skill-level
  workaround landed via the Invocation block, but the real fix is
  to rebuild + republish (or drop the `bin` entry until cadence
  catches up).
- **`diff-for-agent.ts` Verified-deltas table redundancy** (v2 A2
  finding): three near-identical "Verified deltas" tables emit
  similar rows; ordering / dedup is a `diff-for-agent.ts` question.

## Lessons (carried forward)

1. **A SKILL.md is a fabrication risk if the author hasn't recently
   run the underlying command.** Confirmed in v3 with markup-synth
   and fix-loop. Mitigation: never ship a new SKILL.md without (a)
   one fresh subagent exercising it, or (b) a recent transcript of
   running the command and reading its output.

2. **When a fix applies to a vocabulary used across skills, grep
   first.** v2 caught this: v1's `--output reports/diff.json` fix
   only touched one skill; the same misuse remained in two others.

3. **"How to read the output" benefits from a real excerpt with
   real numbers, not a schematic.** v1's schematic looked plausible
   but didn't help A debug a failed run; v2's real excerpt helped
   A2 immediately recognize where Universal pairs sits in the
   actual output.

4. **Stop signs work.** The loop converged in 4 rounds because each
   round had explicit success criteria and the friction list was
   shrinking by both count and severity.

## Files

- Skills modified: `.claude/skills/vrt-markup-synth/`,
  `.claude/skills/vrt-css-fix-loop/`.
- Fixtures used: `fixtures/element-compare/before.html` (D2),
  CSS-challenge `page` fixture (E2).
- Commits on `feat/agent-skills`: `6b663b4`, `ba1986e`.
