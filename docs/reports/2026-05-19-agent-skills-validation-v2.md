# Agent skills validation v2: confirm v1 + evaluate regression-watch (2026-05-19)

## Question

After v1 (commits `9597aec` + `56e4cb3`):

1. Does `vrt-visual-diff` now complete on the same scenario subagent A failed on?
2. Can a fresh agent assemble a 2-run regression-watch workflow from `vrt-regression-watch` alone?

## Setup

Two parallel general-purpose subagents, same agent-validation-loop
discipline as v1. Each forbidden from reading the other four skills,
the fixture HTML source, or prior subagent reports.

| Subagent | Skill | Scenario |
|---|---|---|
| A2 | `vrt-visual-diff` | Same as A v1: diff `fixtures/element-compare/before.html` vs `after.html`. Confirm fix. |
| C | `vrt-regression-watch` | Assemble 2-run workflow on identical inputs; verify no false-positive banner. |

## Result

| Subagent | Outcome | Confidence | Fix delta |
|---|---|---|---|
| A2 | **Completed**, verdict matches ground truth | high | v1 friction Gaps 1-3 closed; one new wording trap surfaced |
| C | **Completed**, no false-positive banner | medium | Four new friction points, one of which was a real bug in the v1 CI gate snippet |

A2 → A delta: from "could not reach a verdict / confidence low" to
"verdict correct / confidence high". v1 invocation + Quickstart
fixes stuck.

## What worked

### A2: pipeline mental model + correct verdict

> "`node --experimental-strip-types src/cli/vrt.ts diff html ...
> --output reports/` then `vrt diff agent
> reports/migration-report.json --out reports/diff.md` ran cleanly
> first try; both the JSON and Markdown landed where the skill said
> they would."
>     — subagent A2

> "Two elements have larger box metrics in `after.html`, on **every**
> viewport (universal, not breakpoint-gated): `body > header` —
> `padding-top` `20px → 60px`, `padding-bottom` `20px → 60px` … `body
> > header > h1` — `font-size` `24px → 32px`."
>     — subagent A2's verdict

Ground truth confirmed: header padding 20px→60px, h1 24px→32px,
subtitle element added. A2 nailed the first two by computed-style;
the subtitle showed up in section-level diffRatio (#3 row).

### C: workflow assembled from Quickstart alone

> "The Quickstart block (lines 63-74) was sufficient on its own — a
> copy-pasteable two-step. The trailing paragraph clarified the
> *why*: 'the example uses an explicit `.vrt/baseline.json` to show
> how to keep a stable reference (e.g. \"diff against main's last
> good run, not against the PR's previous run\")'."
>     — subagent C

The persist/previous model came through; identical-input second run
correctly produced no `⚠ REGRESSION` banner.

## What didn't / new gaps

### Gap A — Triage-order misdirection (A2 found)

The skill says: "Triage order: universal pairs > breakpoint-gated >
per-section > raw per-viewport. The first non-empty row is almost
always the actual change to inspect."

But in the emitted Markdown, the Universal pairs table sits **near
the bottom** (section ~13 of ~16), after eight intermediate sections.

> "A first-time reader scrolling top-down has to know to jump to the
> bottom. Either reorder, or replace 'first non-empty row' with
> 'scroll to the *Universal pairs* table.'"
>     — subagent A2

**Fixed in `f219914`** — "Triage order" rewritten as scroll-to-bottom
instruction; explicit position context ("section ~13 of ~16") added.
Plus glossary for `Shift bands` and `Dominant category` (separate
A2 nit).

### Gap B — `--output reports/diff.json` systematic miss (C found)

v1 fix only touched `vrt-visual-diff`. The same misuse remained in
`vrt-regression-watch` (3 occurrences) and `vrt-migration-eval`
(2 occurrences).

> "The Quickstart's `--output reports/diff.json` is wrong /
> misleading. In practice that creates a *directory*
> `reports/diff.json/` whose actual report file is
> `migration-report.json`. The next line `vrt diff agent
> reports/diff.json ...` then fails with `EISDIR: illegal operation
> on a directory, read`."
>     — subagent C

**Fixed in `282b6cc`** — all 5 occurrences fixed across both skills.

Lesson: when a fix applies to a vocabulary used across skills,
grep for it before declaring done. The v1 fix sequence was "one
skill, one commit" — should have been "one fix, all skills".

### Gap C — Real bug in v1 CI gate pattern (C found, source-verified)

> "What I'm only medium on: whether `--persist-summary` is
> independent of `--no-history` or supersedes it (the CI snippet
> implies independent, but the flag table doesn't say so)."
>     — subagent C

Source check (`src/cli/commands/diff-for-agent-cli.ts:177-180`):
`--no-history` skips BOTH load AND write. So the v1 CI snippet —
which passed `--previous .vrt/baseline.json` plus `--no-history` —
**silently skips the load**, never compares, and never fails on
regression. The gate would never fire.

**Fixed in `282b6cc`** — CI snippet now uses `--persist-summary
/tmp/pr-summary.json` (PR-specific throwaway). Flag-reference table
gains a "Pick one of these three modes" guide explicitly listing
the four configurations.

### Gap D — Local-rolling idiom not exemplified (C found)

> "The skill says `--persist-summary` 'Override destination for this
> run's summary' but doesn't show that passing the *same* file to
> `--previous` and `--persist-summary` is the local-rolling idiom."
>     — subagent C

**Fixed in `282b6cc`** — Quickstart comment now reads "same baseline
file for read AND write … passing the same path to `--previous` and
`--persist-summary` means 'compare against last run, then overwrite'".

### Gap E — Three Verified-deltas tables look redundant (A2 found, deferred)

> "Minor redundancy: three tables ('Verified deltas by DOM position
> × viewport', 'Verified deltas by DOM position', 'Verified deltas
> (computed-style)') and a fourth '× viewport' table all carry the
> same five rows. Not friction exactly, but on first read I kept
> asking 'is this saying something new?'"
>     — subagent A2

Out of scope for skills — this is `diff-for-agent.ts` output
ordering / dedup. Deferred to a follow-up vrt PR.

## What's fixed vs deferred

| Gap | Status | Commit |
|---|---|---|
| A. Triage order misdirection | Fixed | `f219914` |
| B. `--output` systematic miss | Fixed | `282b6cc` |
| C. CI gate pattern bug (`--previous`+`--no-history`) | Fixed | `282b6cc` |
| D. Local-rolling idiom example | Fixed | `282b6cc` |
| E. Verified-deltas table redundancy | Deferred — vrt internals | — |
| (v1 deferred) stale `dist/vrt.mjs` | Deferred — vrt publication | — |

## Versus v1

| Metric | v1 | v2 |
|---|---|---|
| Workflows completed | 0 / 1 | 2 / 2 |
| Verdicts correct | n/a | 1 / 1 (A2; C scenario had no verdict to reach) |
| Confidence | low (A) / n/a (B) | high (A2) / medium (C) |
| Real bugs found in shipped skills | 0 | 1 (CI gate pattern was unfireable) |
| Skill-level frictions surfaced | 4 (A: 3, B: 1) | 4 (A2: 1, C: 3) |

The v2 round is more valuable than v1 because:
1. It confirmed v1's fix landed.
2. It caught a **real semantic bug** in the v1 CI snippet that
   reading the skill in isolation surfaced (an agent following the
   v1 instructions would have shipped a non-functional CI gate).
3. The systematic-miss lesson (Gap B) is generalizable: future
   skill-level fixes need a grep sweep before declaring complete.

## Next round candidates

- **C2**: Re-run subagent on `vrt-regression-watch` (same scenario)
  after `282b6cc` to confirm the dir-semantics + CI fix sticks.
- **E**: First evaluation of `vrt-css-fix-loop`. Requires VLM API key
  (OPENROUTER or claude). Scenario: CSS-challenge fixture, seed 11,
  selector mode, `bytedance/ui-tars-1.5-7b`.
- **D**: First evaluation of `vrt-markup-synth`. Requires image input
  + VLM. Deferred — needs a curated fixture.

## Files

- Skills modified: `.claude/skills/vrt-visual-diff/`,
  `.claude/skills/vrt-migration-eval/`, `.claude/skills/vrt-regression-watch/`.
- Source consulted (for Gap C): `src/cli/commands/diff-for-agent-cli.ts:177-180`.
- Fixture: `fixtures/element-compare/{before,after}.html`.
- Commits on `feat/agent-skills`: `f219914`, `282b6cc`.
