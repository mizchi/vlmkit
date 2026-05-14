# Comprehensive toolkit dogfood

**Date**: 2026-05-13
**Branch**: `claude/continue-project-5iM0e`
**Scope**: all 21 vrt commands + 10 markup-assistance CLIs
**Method**: mechanical smoke + one realistic compound-workflow subagent

## TL;DR

- **Smoke**: 11/11 CLIs pass (run + emit expected output).
- **Compound workflow** (subagent Path A: build pricing card from blank
  → verify a11y → verify hover): converged to 2.23% pixel diff in 4
  rounds, then caught a real CTA height bug (43px) via `a11y-touch`
  and a dead-hover via `interact`. Both fixed; re-verified clean.
- **Verdict**: "mostly cohesive, would reach for it in real work."
  Fragmentation lives in CLI signatures and shared output paths, not
  in concepts.

Three actionable issues surfaced; all three fixed in the same
session.

## Smoke test (mechanical)

`scripts/smoke-all-clis.sh` runs every markup-assistance CLI on its
canonical fixture, verifies exit 0 + expected output file. Coverage:

| Command | Fixture | Output |
|---|---|---|
| `component-from-image` | wireframe/pricing-card | report.md ✓ |
| `component-from-image` (typo) | typography/wrong-size-weight | report.md ✓ |
| `multi-page-consistency` | multi-page/footer-drift | report.md ✓ |
| `component-consistency` | component-consistency/inline-leak | report.md ✓ |
| `theme-parity` | theme-parity/card-with-bug | report.md ✓ |
| `i18n-stress` | i18n-stress/button-overflow | report.md ✓ |
| `a11y-contrast` | a11y-contrast/low-contrast | report.md ✓ |
| `a11y-touch` | a11y-touch/small-targets | report.md ✓ |
| `interact` | interact/dropdown-form | report.md ✓ |
| `compare` | migration/shadcn-to-luna | migration-report.json ✓ |
| `png-diff` | self-diff | stdout (no file) ✓ |

**11/11 PASS.** Runtime ~30s. Suitable as pre-push / CI sanity.

## Subagent compound workflow

The subagent was forbidden from reading the reference HTML or prior
dogfood reports. Path A: build a card from scratch using only the
target screenshot, then verify with the a11y + interact suites.

### Convergence (component-from-image, 4 rounds)

| Round | Diff | Notes |
|---|---|---|
| 1 | 2.35% | First write from screenshot + report signals |
| 2 | 3.04% | Regression from over-tightening spacing |
| 3 | 2.19% | Re-loosened |
| 4 | 2.23% | Final (under 3% target) |

Compared to prior dogfood rounds (G v1 / v2 / v3 converged in 3-5
rounds), this matches the established baseline. Diff bounced around
due to sensitivity to small layout deltas — flagged as a friction
point.

### A11y verification

`a11y-contrast`: 0 failures (clean — the agent's color choices passed).
`a11y-touch --level AAA` (default 44×44): **1 failure** — the CTA
button was 43px tall. Subagent: "caught the real 43px CTA height
immediately and printed exactly the selector + dimensions + text
needed." Fix: `min-height: 44px;` → re-verified clean.

### Interaction verification

Subagent wrote a small sequence (default → hover → click) and ran
`interact`. First run showed **0% diff on hover** — the agent's CTA
had no `:hover` rule wired up at all. Quote: "that's the kind of
thing only an interaction-aware tool catches." Added `.cta:hover`
+ `.cta:focus-visible`; re-ran: hover transition now 1.34%.

## Per-command UX (subagent)

| Command | Verdict | Standout |
|---|---|---|
| `component-from-image` | **keep** | Backgrounds row + heatmap Fill + gap-deltas with "reduce preceding by X" hints. The structured report is "exactly what an LLM agent wants." |
| `a11y-touch` | **keep** | Caught real 43px CTA. Defaulting to AAA is "the right call." |
| `a11y-contrast` | keep but blind on clean fixtures | Would benefit from a tiny synthetic-failure sanity test. |
| `interact` | **keep, expand** | "Cleverest tool here." Dead-hover catch was the standout. Missing `focus`/`blur` was friction. |

## Actionable findings (all fixed in this session)

### 1. Palette diff still listed bucket-jitter "missing" entries

> "Misleading: extra/missing palette entries flagged as `nearest: 18`
> (i.e., AA noise) are still listed — the tool knows they're noise
> yet still surfaces them."

**Fix**: `palette-diff.ts` now drops entries whose nearest unconsumed
neighbor is within 12 RGB units. Bucket-boundary jitter no longer
pollutes the missing/extra rows. The `nearest, likely AA` annotation
stays for genuine borderline cases (12-30 RGB).

### 2. `interact` lacked `focus` / `blur` actions

> "`focus` isn't supported (had to drop it from my sequence)."

**Fix**: added `focus`, `blur`, and `press` (key) actions to the
SequenceAction union. Help now lists them with per-action argument
schemas inline.

### 3. Dead transitions only surfaced in "Suggested next step"

> "I had to eyeball the 0.00% to notice."

**Fix**: per-transition table now has a `Note` column that flags rows
with non-snapshot actions but < 0.001 diff as **dead — actions had
no visible effect (selector miss? no-op?)**. Hover-with-no-rule and
typo'd selectors are now visible at a glance.

## Open issues (deferred)

| Issue | Why deferred |
|---|---|
| CLI signature drift (target-first vs html-first positional) | Breaking change — needs `--target` alias path before flipping defaults |
| Shared `report.md` paths across runs | Convention-only; `--output-dir` already supports per-run dirs |
| `--apply` / `--auto-patch` mode for component-from-image | Requires DOM access + selector inference; substantive work |
| Combined `vrt a11y` command (contrast + touch in one pass) | Composition-level UX; clean but no new signal |
| `interact --schema` (JSON Schema dump) | Nice-to-have; help text now lists per-action args inline |

## Verdict

The markup-assistance subset (component-from-image, a11y-*, interact,
theme-parity, i18n-stress, *-consistency) is **a cohesive triangle**
covering fidelity / compliance / state. Each command surfaced
something real on a small fixture in this dogfood:

- background hex distinction (#f5f7fa vs #f6f7fb)
- 1px button height (43 vs 44)
- dead hover state
- typography mismatch (in the typography fixture)
- footer drift across pages
- text overflow under inflation

The smoke script + subagent-driven improvements bring the toolkit to
a state where an LLM markup agent can plausibly use it as their
primary feedback loop. Remaining gaps (cross-browser, focus order)
are substantial new directions, not bug fixes.

## Files

- `scripts/smoke-all-clis.sh` — runs the 11-command sanity check
- `docs/reports/2026-05-13-capability-survey.md` — capability inventory
- `docs/reports/2026-05-13-comprehensive-dogfood.md` — this report
