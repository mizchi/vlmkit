# Design-md scenario v3: closed-loop converges (validation, 2026-05-15)

## Question

After landing #29 (DIVERGENT / SUBSET scope tags on wireframe fix
suggestions), does an agent given the v1 brief converge below the v1/v2
mobile floors?

## Result

| viewport | agent-a (v1) | agent-b (v1) | agent-c (v2) | **agent-d (v3)** |
|---|---|---|---|---|
| wide    | 1.8%  | 0.5%  | 2.9% | **0.1%** |
| desktop | 2.0%  | 0.6%  | 3.3% | **0.1%** |
| mobile  | 10.3% | 2.8%  | 9.7% | **0.2%** |
| tool calls | 60 | 146 | 45 | **46** |

Agent-d closed the loop. **0.1 / 0.1 / 0.2%** — all viewports under 1%
without writing a single self-probe (agent-b's 146 tool calls were
mostly spent on a Playwright probe that #25 has since obsoleted).

## What worked

Agent-d, verbatim:

> "[SUBSET] yellow tag did demonstrably steer me toward a media-query
> gating decision in round 2. In round 2 the wireframe block listed
> five [SUBSET] mobile-only shifts with the explicit 'subset — gate
> with media query; not seen on desktop, wide' hint. Without that,
> the obvious global edit ('shift hero contents up 24px') would have
> re-broken desktop where my padding was also wrong but in the
> opposite direction. The SUBSET hint made me look at per-viewport
> deltas and converge on the page-padding media query rather than a
> global margin patch."

That's the closed-loop signal #29 was built for.

## What we couldn't validate

> "[DIVERGENT] (red/bold) tag never fired during my run."

Agent-d's structural choices early didn't surface a same-component
opposite-sign-across-viewports delta, so the bigger of the two #29
tags went untested by this run. The agent-c scenario re-run against
post-#29 vrt DID surface 4 [DIVERGENT] rows correctly — see below — so
the detector itself works; agent-d just didn't trigger the case.

Post-#29 re-diff of agent-c's stuck round-3 attempt against the
golden (this is what agent-c would have seen if #29 had been live for
them):

    [high] [DIVERGENT] rank=1 (bbox 343×112): divergent Δtop
      (mobile: -12px, desktop: +13px, wide: +13px)
    [high] [DIVERGENT] rank=2 (bbox 156×68): divergent Δtop
      (mobile: +12px, desktop: -12px, wide: -12px)
    [high] [DIVERGENT] rank=3 (bbox 152×68): divergent Δtop (same)
    [high] [DIVERGENT] rank=4 (bbox 64×64): divergent Δtop (similar)
    [high] [SUBSET]    rank=0 (bbox 343×112): Δtop +13px on desktop,
                       wide (subset — gate with media query; not seen
                       on mobile)

That output, presented before agent-c's round-3 edit, names the
underlying responsive divergence directly. Agent-c wouldn't have
needed to discover it by reverting in round 5.

## Bug agent-d found (fixed in this commit)

> "After round 3 the suggestion engine emitted `[low]` mobile-only
> shifts WITHOUT a `[SUBSET]` tag, even though the suggestion text
> said 'on mobile.' Inconsistent tagging at low confidence."

Root cause: the scope detector was deriving `allViewports` from the
input observations. Once desktop/wide converged (zero meaningful
deltas), they fell out of `bboxByViewport`, so `allViewports` shrank
to `{mobile}` and any mobile-only delta was tagged "scope: all" (safe-
to-go-global) — exactly wrong.

Fix: `WireframeFixInput.allViewports` is now an explicit input from
the compare runner (`VIEWPORTS.map((vp) => vp.label)`). The scope
detector trusts that universe over what observations imply. Regression
test added (`agent-d round-3 regression`).

## Remaining friction (agent-d)

- **Same-sign but different-magnitude responsive divergence is only
  tagged [SUBSET], not [DIVERGENT].** Page-padding `40 16` on mobile
  vs `64 24` on desktop is responsive divergence in spirit (different
  values per viewport) but doesn't satisfy the current opposite-sign
  rule. The [SUBSET] tag plus per-viewport breakdown was enough for
  agent-d to act, but a more explicit "MAGNITUDE-DIVERGENT" classification
  might land faster. (Follow-up issue: TBD.)
- **Symmetric Google Fonts 404 on both baseline + variant.** Render-
  sanity banner fires on both sides even though the symmetric failure
  doesn't affect comparability. Could be auto-suppressed. (Follow-up:
  TBD.)
- **Token snap doesn't cover container widths.** `max-width:
  641.32px` had no nearby DESIGN.md spacing token because spacing
  tokens top out at 64px and DESIGN.md doesn't declare a container-
  width scale. This is a DESIGN.md gap, not a vrt gap — out of scope.

## Bottom line

The scenario's hardest task (mobile under 5%) is closed. Agent-d's
0.2% mobile final is the first time a fresh agent has converged to
near-pixel-perfect on this scenario without writing its own probes.
The [SUBSET] affordance is empirically validated by agent-d's own
words; the [DIVERGENT] affordance is validated by re-running agent-c's
stuck attempt.

## What this branch delivers vs. the original 7 issues

| # | issue | state |
|---|---|---|
| #22 | bare-path false 0% PASS | ✅ shipped + tested |
| #23 | wireframe fix candidates (token snap) | ✅ shipped + tested |
| #24 | triptych PNG (`baseline | variant | heatmap`) | ✅ shipped + agent-d "very useful" |
| #25 | computed-style + dom-position diff default-on | ✅ shipped + tested |
| #26 | hex → DESIGN.md token reverse lookup | ✅ shipped + tested |
| #27 | render-sanity banner + variant probe | ✅ shipped + agent-d confirmed |
| #28 | migration-report.json state-leak | ✅ duplicate-of-#22 |
| #29 | DIVERGENT / SUBSET scope tags | ✅ shipped + agent-d converged |
| #30 | wireframe suggestions name candidate selector | open |

Floor moved from 10.3% mobile (agent-a, original vrt) to 0.2% mobile
(agent-d, post-#22..#29). Tool-call efficiency held at ~45 calls.
