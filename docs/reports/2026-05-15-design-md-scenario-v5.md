# Design-md scenario v5: agent-e validation (2026-05-15)

## Question

After landing #30 (candidate selectors) / #31 (MAG-DIVERGENT) / #32
(symmetric-sanity downgrade), can a fresh agent reach agent-d's floor
in **fewer** rounds? Budget was tightened to 3 (vs agent-d's 5) to
test whether the new annotations make the loop faster — or whether
they introduce new failure modes.

## Result — negative

| viewport | a (v1) | b (v1) | c (v2) | d (v3) | **e (v5)** |
|---|---|---|---|---|---|
| wide    | 1.8%  | 0.5%  | 2.9% | **0.1%** | 4.1% |
| desktop | 2.0%  | 0.6%  | 3.3% | **0.1%** | 4.6% |
| mobile  | 10.3% | 2.8%  | 9.7% | **0.2%** | 10.8% |
| tool calls | 60 | 146 | 45 | 46 | 18 |

**Worse on every viewport than agent-d.** Used only 18 tool calls,
which means agent-e bailed early. But it's not just "didn't iterate":
agent-e specifically reported they **regressed on rounds 2-3** by
acting on signals that gave them the wrong direction.

## Root cause: candidate notation was misread

Agent-e quoted:

> "the candidate selectors (`.hero`, `.cta-row`, `.page`) were correct,
> but the `prop: A→B` notation appeared inconsistent: r1 showed
> `.page padding-top: 64px→40px` when my computed value was 40px,
> suggesting `golden→mine`; r3 showed `.hero gap: 12px→24px` matching
> `mine→golden`. With direction ambiguous I trusted the textual
> suggestion ('reducing X on viewport Y') instead — and that
> suggestion flipped sign once I crossed zero in r3 without warning
> that I had overshot."

The notation IS consistent (always `baselineValue → variantValue`),
but reading the arrow left-to-right naturally interprets as "change
from left to right" — which is the OPPOSITE of the agent's correct
action (they should converge variant → baseline, i.e. right → left).

Re-rendered in this commit as **`current → target`** with explicit
"(now) / (target)" labels:

  before: `padding-top: 24px→0px`           (ambiguous)
  after:  `padding-top: 24px (now) → 0px (target)`  (action-aligned)

The fix lands on the same commit as this report. Future runs against
the same scenario should not hit this gap.

## Remaining gaps agent-e surfaced (not addressed yet)

### G1 — Sign-flip detection across rounds

> "MAG-DIVERGENT magnitudes should annotate signed-residual-after-
> last-change so the agent knows when it has crossed zero and is
> now overshooting. Currently r2 says 'reduce 36' and r3 says 'add
> 36' with no callout that 'you reversed direction last round'."

`vrt watch` already does this via its `newlyIntroduced` /
`resolved` round-vs-round delta. But `vrt compare` is stateless
single-shot. Adding `vrt compare --against-previous <dir>` that
loads the prior run's `migration-report.json` and surfaces a brief
"since previous run:" section would close this gap for one-shot
agents. Follow-up.

### G2 — Tag-attention bias toward divergent / subset cases

> "The tag system encouraged me to apply per-viewport changes, but
> the biggest win in r1 was already a non-divergent fix (page
> padding on mobile). Globally-correct fixes were available and the
> divergent tag drew attention away."

Loud red `[DIVERGENT]` tags out-attention-grab the silent default-
scope rows. Possible fix: surface "this fix is global; high-impact"
explicitly when a single non-divergent suggestion accounts for
>50% of the remaining diff. Not addressed.

### G3 — Budget calibration

> "3 rounds is too few when each round's signal can flip the sign
> of the next round's advice. The tooling needs a 'damping'
> annotation ('you crossed zero; revert ~50%') for tight budgets."

Linked to G1 — damping requires cross-round state.

## Direction fix landed

`WireframeFixSuggestion.candidates[].baselineValue` / `variantValue`
renamed to `current` / `target`. Renderer in migration-compare uses
"(now) / (target)" suffixes so the action ("change from current to
target") matches the visual left-to-right read.

Tests updated: 16/16 wireframe-fix tests still pass.

## Net for this scenario

The dev-loop story is correct in capability (agent-d proved
convergence is possible) but the v5 polish work (candidate
annotations + MAG-DIVERGENT) introduced a UX trap that a fresh agent
walked into. **The annotations were strictly net-negative for
agent-e** until this commit's notation fix.

This is the right kind of validation result: it confirms the
annotations matter (agent-e read them) and uncovered a bug only
visible at agent-level fidelity. Counterfactual: had we shipped #30
without running agent-e, the next user adoption of the tool would
have hit this. Catching it pre-adoption is the v5 deliverable.

## Files

- `fixtures/design-md-scenario/paws-and-paths/attempts/agent-e/{page,style,log}`
- `src/wireframe-fix-candidates.ts` — candidate shape change
- `src/migration-compare.ts` — renderer
- `src/wireframe-fix-candidates.test.ts` — test rename
