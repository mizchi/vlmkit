# Design-md scenario v8: agent-h validates #33 + #34, surfaces a #33 gate-too-strict (2026-05-15)

## Question

#33 (REFLOW) + #34 (cross-suggestion overshoot aggregation) shipped
in response to agent-g v7. Does agent-h converge better than agent-g
(18.6% mobile / 20 calls), and do the new signals actually steer
their edits?

## Result — converging warning works; REFLOW gate too strict (then fixed)

| viewport | a (v1) | b (v1) | c (v2) | d (v3) | e (v5) | f (v6) | g (v7) | **h (v8)** |
|---|---|---|---|---|---|---|---|---|
| wide    | 1.8%  | 0.5%  | 2.9% | 0.1%  | 4.1%  | 0.58% | 3.4%  | **1.9%** |
| desktop | 2.0%  | 0.6%  | 3.3% | 0.1%  | 4.6%  | 0.65% | 3.8%  | **2.1%** |
| mobile  | 10.3% | 2.8%  | 9.7% | 0.2%  | 10.8% | 3.45% | 18.6% | **12.4%** |
| tool calls | 60 | 146 | 45 | 46 | 18 | 24 | 20 | **14** |

Agent-h beat agent-g on every viewport (mobile 12.4% < 18.6%) and
used the fewest tool calls of any non-A run. Still didn't catch
agent-f's 3.45% mobile — but their initial state was closer to G's
than F's, so the floor improvement is the right comparison.

## Converging warning ✓ — agent-h's own words

> "R1 surfaced '2 suggestions converge on `.hero` / `.eyebrow` /
> `.display` / `.lede` cumulative 48px'. Each candidate said
> 'margin-bottom 24→0'. Without the warning I'd have zeroed all
> three and overshot the hero by ~48px. Instead I consolidated:
> removed the single redundant `.cta-row { margin-top: 24px }` and
> got the correct -24px in one edit."

This is a direct validation. The warning prevented a compound
overshoot that bit agent-g.

## REFLOW ✗ then ✓ — gate was too strict

Agent-h:

> "REFLOW heuristic gating on 'more text rows than baseline'
> missed an obvious mobile-cascade case (mobile diff 10× larger
> than desktop). The '3× magnitude' half of the rule was clearly
> met; the text-row gate might be too strict."

Root cause: `text-rows.ts` detects dark luminance bands at the
page level, not text-line boundaries. A single wrapped headline
may not change the band count if it just elongates an existing
band rather than producing a new one.

**Fixed in this commit:** REFLOW now fires when EITHER:

- (a) the existing wrap-confirmed gate: variant row-count > baseline
  on the dominant viewport (high-confidence text-wrap detection)
- (b) NEW: magnitude on the dominant viewport ≥ 60px (too large to
  plausibly be a spacing token on a single component)

When (b) fires alone, the suggestion text uses **cascade flavor**
instead of typography flavor:

  before (wrap-confirmed):
    "typography cascade on mobile: inspect headline/paragraph
     max-width, font-size at that breakpoint, and text content length."

  new (large-magnitude only):
    "upstream cascade — the shift originates above this component
     on mobile. Look at: previous siblings' heights / line-counts /
     max-widths at this breakpoint. Applying a 132px spacing token
     to THIS element will not close the delta and will probably
     break other viewports."

Both flavors point upstream; neither claims spacing tokens are the
fix. The threshold (60px) is conservative — small spacing-divergent
deltas still fall through to MAG-DIVERGENT.

Re-running agent-g's stuck attempt against the relaxed gate now
fires REFLOW on rank=4 (+132px mobile, 64×64 bbox) with the cascade
flavor — exactly what agent-h asked for.

## Other negative findings agent-h surfaced (deferred)

### V8a — STRUCTURAL names the parent but not the layout-strategy mismatch

> "[STRUCTURAL] on `body[0]>main[0]` correctly named the parent
> but didn't tell me WHICH child arrangement was wrong (flex-wrap
> vs grid). I still had to read the triptych to discover that the
> mobile profile needed a row-then-row layout with a full-width
> badge — that required the visual diff, not the suggestion text."

Closing this needs DOM tree inspection (compare baseline & variant
display / flex-direction / grid-template at the parent level).
Material work; recorded as a follow-up.

### V8b — cross-edit interactions across DIFFERENT selectors

> "The R1 suggestion 'container padding-top 40→64 (desktop)' was
> technically a correct local fit, but it ignored that my hero
> margin removal would itself reduce hero height; applying both
> compounded to +24 desktop."

#34 covers same-selector compound overshoot. This is the
DIFFERENT-selector case (.hero margin AND .container padding both
affect downstream). Detecting requires a layout-impact graph (which
properties on which elements move which siblings). Bigger lift.

### V8c — Δtop +180 on a 64×64 bbox is misleading

> "The Δtop +180 on the avatar in R1 was misleading — it conflated
> all the upstream shifts into one giant number on a 64×64 bbox,
> suggesting 'reduce top spacing by 180px' which is not actionable
> as a single edit."

This is exactly the case the REFLOW relaxation now catches
(magnitude / bbox.height > 2 implies upstream cascade). The
post-#33 V8 fix in this commit should mitigate.

## Files

- `fixtures/design-md-scenario/paws-and-paths/attempts/agent-h/{page,style,log}`
- `src/wireframe-fix-candidates.ts` — REFLOW gate now `wrapConfirmed
  || cascadeLikely` (cascadeLikely = mag ≥ 60px)
- `src/wireframe-fix-candidates.test.ts` — relaxed-gate cases, one
  pre-existing test rewritten to reflect new semantics

## Cumulative

Agent runs A → H. Three convergence levels in the 3-round budget
class:

- F: 3.45% mobile (24 calls) — well-formed initial implementation
- H: 12.4% mobile (14 calls) — converging warning + REFLOW directives
- G: 18.6% mobile (20 calls) — compound-overshoot bug (pre-#34)

The loop's signal quality is real, but agent-side **initial state**
dominates the remaining variance. The tool's job is to prevent
bad-direction edits (overshoot, wrong category, structural confusion)
rather than to magically close a 20% diff in 3 rounds.

Total tests: 173.
