# Design-md scenario v9: agent-i validates #35/#36, surfaces V9a/V9b (2026-05-15)

## Question

#35 (STRUCTURAL parent layout-strategy) + #36 (cross-edit interaction
warning) shipped after agent-h v8. Does agent-i converge faster than
agent-h on a 3-round budget?

## Result — mobile worse, desktop/wide same; new failure mode surfaced

| viewport | f (v6) | g (v7) | h (v8) | **i (v9)** |
|---|---|---|---|---|
| wide    | 0.58% | 3.4%  | 1.9%  | **2.0%** |
| desktop | 0.65% | 3.8%  | 2.1%  | **2.2%** |
| mobile  | 3.45% | 18.6% | 12.4% | **16.4%** |
| tool calls | 24 | 20 | 14 | **~10** |

Agent-i used the fewest tool calls of any 3-round run but mobile
regressed vs agent-h. **The negative result is informative**: the
new affordances DID accelerate the structural fix (agent-i's
direct quote: "decisive") but exposed a different class of bug
neither structural nor cross-edit covers.

## What worked — agent-i's own words

### #35 STRUCTURAL with specific parent properties — "decisive"

> "Round 1 wrote `display: block (now) → grid (target); gap: normal
> (now) → 12px (target)` on `body>main>section[0]`. I applied that
> one edit verbatim and never opened the round-1 triptych. Concretely:
> it eliminated the need to inspect children individually — the
> candidate list became confirmation rather than diagnosis."

Direct validation. STRUCTURAL+parent-property is **why agent-i
needed fewer tool calls than agent-h** (no triptych inspection).

### #36 cross-edit warning — "apply one, re-measure" protocol worked

> "Round 1 fired `⚠ cross-edit: .hero + .eyebrow + .profile-card all
> cascade-affect`. I applied ONLY the parent (.hero grid+gap) and
> re-measured. That single edit consolidated 3 candidate-list rows.
> Desktop/wide cleanly dropped 3.4→2.2 and 3.0→2.0 with no overshoot
> — the warning's 'apply one, re-measure' protocol worked exactly
> as advertised."

Direct validation. The warning prevented compound overshoot on
desktop/wide.

## What didn't work — two new gaps

### V9a — STRUCTURAL parent gap edit doesn't clear pre-existing child margins

> "STRUCTURAL on `.container` (gap=40px) collided with my still-
> present `margin-top: spacing.lg` on `.profile-card` / `.stats`,
> so applying the parent edit alone caused a +5pp mobile regression
> (R1→R2). The warning text didn't tell me 'also remove existing
> per-child margin-tops' — it listed those as separate candidates,
> which I deprioritized per the 'parent fixes children together'
> guidance."

**Fixed in this commit:** when STRUCTURAL's parent deltas include
a gap-style property (`gap` / `row-gap` / `column-gap`), the
suggestion now additionally lists any non-zero pre-existing child
margins from DP entries:

  STRUCTURAL ... parent layout deltas: gap: 0px (now) → 16px (target)
    → change `<parent>`'s layout to match: gap: ... ⚠ ALSO clear
      non-zero child margins that will compound with the new gap:
      .card-1.margin-top: 24px, .card-2.margin-top: 40px.

Only fires on gap introductions (display/align-items deltas don't
trigger — those may legitimately want existing margins preserved).

### V9b — intrinsic-height mismatch looks like spacing

> "MAG-DIVERGENT per-viewport tokens (`adding 42px on mobile`)
> flagged a vertical displacement, but the ROOT CAUSE was undersized
> card padding, not a missing margin. The suggested 'add 42px'
> would have masked the symptom and broken desktop. The framework
> lacks a signal for 'child intrinsic height is smaller than target'
> — it sees missing pixels and recommends spacing."

**Fixed in this commit:** when the example bbox's variant height
differs from baseline by ≥ 8px, the suggestion appends:

  ⚠ component height differs intrinsically: 60px (now) → 100px
    (target). The shift may NOT be a spacing-token issue — check
    this component's own padding / min-height / font-size before
    adding margin upstream.

Steers the agent toward inspecting the component itself rather
than blindly applying a spacing magnitude.

## Tests

4 new wireframe-fix-candidates cases:

- STRUCTURAL with parent gap + non-zero child margins → warns
- STRUCTURAL with align-items delta only → does NOT warn (gap not introduced)
- Intrinsic-height: |Δheight| ≥ 8px → hint appended
- Intrinsic-height: |Δheight| < 8px → no hint (subpixel)

41/41 wireframe-fix-candidates tests pass; 177 total.

## Convergence summary (8 agent runs)

| budget | agent | mobile | starting state | notes |
|---|---|---|---|---|
| 5-round | d | 0.2% | clean grid | gold standard, all signals |
| 3-round | f | 3.45% | clean | post-v6 |
| 3-round | h | 12.4% | weak | converging warning #34 caught overshoot |
| 3-round | i | 16.4% | weak | STRUCTURAL got the layout right; mobile regressed on V9a |
| 3-round | g | 18.6% | weak | pre-#34 compound bug |

Agent runs are increasingly testing the **agent-side initial-state
ceiling**. The tool's signals are working; the failure mode keeps
shifting to "agent picked wrong structure / dimensions to start
with."

## Files

- `fixtures/design-md-scenario/paws-and-paths/attempts/agent-i/{page,style,log}`
- `src/wireframe-fix-candidates.ts`:
  - `conflictingChildMargins` helper + wiring (V9a)
  - intrinsic-height hint in suggestion text (V9b)
- `src/wireframe-fix-candidates.test.ts` — 4 new cases
