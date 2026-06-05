# A/B external-repo validation: synthesis (v1–v3, 2026-06-05/06)

## The question, and the answer

**Does vlmkit make a coding agent better at visual repair than the
same agent without it?** Three controlled runs — same external repo
(`startbootstrap/startbootstrap-agency`, never seen by vlmkit), same
fixed scorer, same 5-round budget, fresh agents per run, control arm
allowed playwright/pngjs/pixelmatch but not vlmkit.

Short answer: **not on wall-clock, yes on repair quality and
reliability — and only via the deterministic signal path.** The VLM
path was net-negative in every run it was tried.

## The trajectory

| run | seed class | control | treatment | cost delta | repaired (C/T) |
|---|---|---|---|---|---|
| v1 | block deletion (sibling copyable) | 0.000%, r1 | 0.000%, r1 | **vlmkit 1.8× slower** | 1/1 vs 1/1 |
| v2 | 3 value mutations | 0.000%, r1 | 0.000%, r1 | parity | 2/3 vs 2/3 |
| v3 | 5 subtle mutations | 0.000%, r2 | 0.000%, r2 | parity | **2/5 vs 3/5** |

Between runs, treatment's friction became fixes (one commit per
complaint): v1 → drafts 01–03 (tall-image crash, token truncation,
missing Δheight) closed the 1.8× cost gap; v2 → drafts 04+07
(translation estimates, deterministic region→selector) produced v3's
quality edge — treatment localized every regression without opening a
screenshot and additionally repaired a scorer-invisible Firefox-only
rule.

## What three independent agents agreed on

Every control agent, unprompted, specified the same missing tool:

- v1: "a region-localizing pixel diff (...) and a computed-style
  differ"
- v2: "report 'region at (555,3488) matches region at (591,3488),
  offset +36,0'" / "map a pixel coordinate → DOM element"
- v3: "a 'diff region → CSS rule' mapper: given a y-band (...) name
  the covering element + matched rules"

That is `vlmkit diff png --elements-html` plus the shift estimate —
both now shipped. Demand for the deterministic signals is empirically
established; v3's treatment used them as designed ("I never opened a
screenshot before knowing where to look").

## Standing conclusions

1. **vlmkit's value is the deterministic signal layer** — measured
   colorSamples, region bboxes, translation offsets, Δheight,
   selector candidates. Every piece of agent praise across three runs
   attaches to this layer.
2. **The VLM region path (`diff region`) is currently net-negative
   for agent-driven repair**: wrong selector attribution, fabricated
   property/color deltas, Delta-0 rows (drafts 06, 09). Treatment
   agents abandoned it after one call in v2 and never invoked it in
   v3. Until 06/09 land, agent-facing docs should steer to `diff png`.
3. **A script-literate agent is the honest baseline.** Control
   matched treatment's wall-clock in all three runs by hand-rolling
   pixel tooling — but described its own localization as "grep luck"
   and spent 40–50% of each run rebuilding the same scripts. vlmkit's
   edge is pre-verified, zero-setup, classified signal — which shows
   up as repair completeness (3/5 vs 2/5) and reliability, not speed,
   at this task size.
4. **Static-capture scoring has a blind-spot catalogue**: JS
   state classes (v2 navbar-shrink), engine-specific rules (v3
   `:-moz-placeholder`), sub-threshold deltas (v3 arrow width / gold
   border). "Pixel-perfect" is not "fully repaired" — state-aware and
   cross-engine capture is the strongest feature argument to come out
   of the series.

## Loop accounting

- 6 agent runs (3 control, 3 treatment), all fresh, all on isolated
  workspaces with answer keys hidden and prior runs forbidden.
- 12 issue drafts filed from agent quotes; 5 shipped as fixes
  (01, 02, 03, 04, 07), 7 open (05, 06, 08, 09, 10, 11, 12).
- Open next-highest-value item: **draft 10** — colorSample must
  sample differing pixels only; it caused ~40% of v3 treatment's
  remaining hand-rolling.
- Stopping rationale (per agent-validation-loop criteria): new gaps
  regressed from missing-feature to statistic-level; per-fix size
  shrinking; agent-side variance dominates outcomes.

## Harness (reusable)

`fixtures/ab-external/harness/` — seeded selector-block deletion and
value mutation (`--mutate N [--subtle]`), deterministic 3-viewport
capture, fixed pixelmatch scorer. Verified 0.000% capture noise on
this target. Briefs: `fixtures/ab-external/brief-{control,treatment}.md`.
Adding a new run = new seed dir + two `npx serve` ports + two agents.

## Run index

| report | scenario |
|---|---|
| `2026-06-05-ab-external-v1.md` | block deletion, pre-fix build |
| `2026-06-06-ab-external-v2.md` | 3 value mutations, post-01–03 |
| `2026-06-06-ab-external-v3.md` | 5 subtle mutations, post-04+07 |
