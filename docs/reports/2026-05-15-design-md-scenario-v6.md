# Design-md scenario v6: direction-fix validation (agent-f, 2026-05-15)

## Question

The v5 candidate-notation fix (`baselineValue → variantValue` →
`current (now) → target (target)`) was supposed to close agent-e's
direction-confusion gap. Does it actually move the floor on a tight
budget (3 rounds, same as agent-e)?

## Result — meaningful improvement

| viewport | a (v1) | b (v1) | c (v2) | d (v3) | e (v5) | **f (v6)** |
|---|---|---|---|---|---|---|
| wide    | 1.8%  | 0.5%  | 2.9% | **0.1%** | 4.1%  | **0.58%** |
| desktop | 2.0%  | 0.6%  | 3.3% | **0.1%** | 4.6%  | **0.65%** |
| mobile  | 10.3% | 2.8%  | 9.7% | **0.2%** | 10.8% | **3.45%** |
| tool calls | 60 | 146 | 45 | 46 | 18 | 24 |

Agent-f matched agent-e's tool-call budget (≈ 20 calls) but converged
**3× better** on mobile and **6–7× better** on desktop/wide.

Agent-f explicitly attributed the gap to:

> "The `(now) → (target)` annotation was unambiguous on the candidate
> lines — `.profile-text height: 52px (now) → 80px (target)` clearly
> told me to grow from 52 to 80. I never had to second-guess which
> side was mine."

The direction-fix paid for itself.

## What the new affordances did

### `(now) → (target)` notation ✓

Worked. Agent-f reported zero direction-misreads across 3 rounds.
Caveat surfaced: the **palette `swap` line** used the same arrow
notation but lacked the `(now)/(target)` labels, so the consistency
of the new convention wasn't quite total. Fix in this commit:

  before: `swap surface-variant → surface-container-high`
  after:  `swap surface-container-high (now) → surface-variant (target)`

(Agent-f sidestepped the swap line because of this inconsistency
rather than misacting on it — the bug was contained, but the fix
removes the future hazard.)

### `[HIGH-IMPACT]` ✓ (silent — correctly)

> "It never fired across 3 rounds. Informative: the page has many
> roughly-equal-magnitude diffs, no single dominant fix. The 1.5×
> ratio gate is appropriately conservative — I'd rather see it stay
> silent than mislead."

Conservative threshold validated. The tag fires when it should and
stays silent when there's no clear single-win — exactly the
behavior G2 wanted.

### `--against-previous` + zero-crossing ✓

> "Critical. R2 looked plausible from per-viewport diffs alone
> (+1.67pp mobile easy to miss when desktop/wide unchanged), but
> the **'newly introduced'** list flagged that my profile rewrite
> produced fresh MAG-DIVERGENT rows — concrete signal that the edit
> caused new problems, not just failed to fix old ones. R3's
> **zero-crossing** warning (`+28 → -16, damp ~50%, next ≈ -14px`)
> correctly identified that my container-padding bump from 24 to
> 40/64 overshot."

The cross-round delta did exactly what G1 was built for.

## Three new gaps agent-f surfaced

### F1 — MAG-DIVERGENT can encourage local minima

> "The MAG-DIVERGENT 'adding 20px on mobile / 28px on desktop'
> suggestions were treating symptoms. Following them literally in
> R2 would have led me to per-viewport margin patches instead of
> the actual fix (grid structure). The tool surfaces these
> prominently but they're often local minima."

The suggestion engine doesn't know "the right fix is a structural
change," only "the cheapest local patch closes the magnitude
delta." Agent-f noticed and routed around it by reading
`computedStyleDiff` JSON directly. A future "the underlying CSS
might be structurally wrong" signal (e.g. when multiple rank's
suggestions all blame the same parent, suggest restructuring the
parent rather than patching each child) is worth filing.

### F2 — Candidate-selector linking can be confusing

> "The 'candidate: `.profile-text` (height 52px → 80px)' was
> attached to a positional MAG-DIVERGENT for a sibling component.
> Felt like a non-sequitur until I realized the height delta on
> profile-text was what would cascade to fix the position. Linking
> those more explicitly ('growing X resolves position of Y') would
> help."

Candidates today are matched by raw magnitude. When the candidate
is a NEIGHBOR of the suggestion's component (sibling, not parent
or self), the connection isn't obvious. Could be addressed by
detecting the parent-child relationship in the DOM path and
emitting "(neighbor cascade)" in the annotation.

### F3 — Zero-crossing is reactive, not predictive

> "Zero-crossing fired AFTER R3 but I had no budget left. The
> signal is useful but arrives 1 round late by definition — a
> 'predicted overshoot' forewarning (e.g. 'you're about to push
> 28→-16, suggest damping to 28→0') on the *current* round's
> suggestion would prevent this."

Predictive overshoot would require the suggestion engine to model
the agent's likely action. Possible but a much bigger lift than
reactive detection. The current zero-crossing is still net-positive
(it explains what happened); the forewarning is a strict upgrade.

## Bottom line

| | agent-e | **agent-f** |
|---|---|---|
| tool calls | 18 | 24 |
| mobile floor | 10.8% | **3.45%** (3× better) |
| desktop floor | 4.6% | **0.65%** (7× better) |
| direction misreads | yes (regressed mobile in R2-R3) | none |

The v5 → v6 fix (a 16-line rename + renderer change + one notation
update in this commit) yielded ~3× convergence on the same budget
with the same agent harness. That's a clean win attributable to the
specific UX intervention.

Three real follow-ups recorded above. None block the loop — they're
each "the next polish layer." Agent-f's run is the strongest data
point yet that the loop is genuinely usable at agent-budget
fidelity.

## Files

- `fixtures/design-md-scenario/paws-and-paths/attempts/agent-f/{page,style,log}`
- `src/migration-compare.ts` — palette `swap` line aligned with
  candidate notation (`(now) → (target)`)
