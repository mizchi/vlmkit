# Design-md scenario v7: STRUCTURAL evaluation (agent-g, 2026-05-15)

## Question

F1 / F2 / F3 added STRUCTURAL meta-row, cascade hint, and predictive
overshoot. Agent-f (v6) reached the right structural fix in R2-R3
by reading raw `computedStyleDiff` JSON. Would the STRUCTURAL row let
an agent-g hit the same convergence in R1 instead?

## Result — regression vs agent-f

| viewport | a (v1) | b (v1) | c (v2) | d (v3) | e (v5) | f (v6) | **g (v7)** |
|---|---|---|---|---|---|---|---|
| wide    | 1.8%  | 0.5%  | 2.9% | 0.1%  | 4.1%  | 0.58% | **3.4%** |
| desktop | 2.0%  | 0.6%  | 3.3% | 0.1%  | 4.6%  | 0.65% | **3.8%** |
| mobile  | 10.3% | 2.8%  | 9.7% | 0.2%  | 10.8% | 3.45% | **18.6%** |
| tool calls | 60 | 146 | 45 | 46 | 18 | 24 | 20 |

Agent-g did **worse** than agent-f on mobile (18.6% vs 3.45%).
Negative signal worth taking seriously. Two reasons:

1. **Agent-g's R1 implementation was structurally further from the
   goal** (its mobile already had a 132px avatar drift in R1, vs
   agent-f's 10.7%). The starting state matters more than vrt's
   per-round signal quality.
2. **STRUCTURAL fired in R1 but pointed at the wrong target.** It
   pointed at `body[0]` (the document root), where the layout
   strategy IS already grid+gap — restructuring there changes
   nothing. Agent-g read the row, evaluated it, and correctly
   dismissed it.

## Three genuine gaps agent-g surfaced

### G7a — STRUCTURAL fires too eagerly when the parent is already grid+gap

> "STRUCTURAL is too coarse when the parent IS already grid+gap.
> It keeps firing without telling you what specifically about the
> parent differs."

Root cause: the F1 detector required only that 3+ candidates share
a parent path. It didn't check whether the parent's children had
**heterogeneous** deltas. If every child needs the same +24px shift,
the right answer is per-child tuning — not restructuring.

**Fixed in this commit:**

- STRUCTURAL won't fire on parents shorter than 2 path segments
  (`body[0]` is single-segment — too generic to claim "layout
  strategy mismatch").
- STRUCTURAL requires heterogeneous magnitudes among the clustered
  children (range ≥ 12px OR mixed signs). Homogeneous +24px clusters
  no longer trigger the meta-row.

Two new test cases document the guards (`body[0]`-rooted cluster ⇒
no fire; homogeneous-magnitude cluster ⇒ no fire).

### G7b — Text reflow can't be distinguished from spacing

> "MAG-DIVERGENT with very asymmetric magnitudes (+132px mobile /
> +20px desktop on the same component) almost certainly indicates
> text reflow, not spacing — but the engine offers spacing tokens
> anyway."

A 132px delta on a component is almost never a spacing token; it's
the headline wrapping to one extra line on the narrow viewport,
pushing every subsequent element down by ~50px per wrap.

Detection idea (deferred): when |Δ| / 50px ≈ 1, 2, or 3 (line-
height multiples) AND the delta is per-viewport, flag with
`[REFLOW]` and suggest looking at `max-width`, `font-size`, or
text content length — not spacing tokens.

This needs text-row line count comparison across renders. Material
work; recorded as a follow-up.

### G7c — Cross-suggestion overshoot is per-row, not aggregated

> "Three suggestions all touched `.container` and the compound
> effect blew past target."

F3 emits per-row overshoot predictions — "applying 40px globally
would overshoot mobile by 16px". But when three rows all
recommend changes to the same selector, the agent following each
individually still overshoots the COMBINED magnitude.

Detection idea (deferred): track the cumulative magnitude per
candidate selector across all suggestions. When sum(magnitudes
touching `.selector`) > max(single-suggestion-magnitude), emit a
"⚠ multiple suggestions converge on `.selector`; combined
magnitude X" warning at the top of the affected group.

Recorded as a follow-up.

## Bottom line

| | agent-f | **agent-g** |
|---|---|---|
| tool calls | 24 | 20 |
| mobile floor | 3.45% | 18.6% (worse) |
| where STRUCTURAL fired | n/a | R1 at `body[0]` (false positive) |
| F2 cascade hint | n/a | "partially useful — correct mechanism but didn't disambiguate fix" |
| F3 overshoot | n/a | "respected per-row but compound effect blew past" |

Agent-g's worse outcome **isn't strictly a vrt regression** — their
structural choices in R1 left more ground to cover. But three
specific tooling bugs surfaced:

- **G7a closed in this commit** (STRUCTURAL guards: minimum parent
  depth + heterogeneity requirement).
- **G7b** and **G7c** are deferred — they need new data layers
  (line-count tracking; cross-suggestion aggregation) and aren't
  one-commit fixes.

The validation cadence is still net-positive: every run surfaces
something. Agent-g's negative outcome is the strongest evidence
yet that the suggestion engine has real limits the agent has to
work around. The closed-loop assumption ("vrt tells you what to
do; you do it") holds for cases where the underlying mismatch is
geometric. It breaks for typographic-cascade mismatches like
agent-g's headline-wrap.

## Files

- `fixtures/design-md-scenario/paws-and-paths/attempts/agent-g/{page,style,log}`
- `src/wireframe-fix-candidates.ts` — STRUCTURAL guards
- `src/wireframe-fix-candidates.test.ts` — guard tests (`body[0]`,
  homogeneous magnitudes)
