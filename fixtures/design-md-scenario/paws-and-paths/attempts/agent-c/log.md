# Agent C round log

## Round 1 — mobile 14.3%, desktop 1.5%, wide 1.4%
Initial implementation: container padding s-lg/margin, hero mb=lg, profile mb=lg, body-lg mb=md, cta-row mt=md, eyebrow mb=md. Profile card flex with badge inline.
Suggestions: rank=4 (avatar) Δtop +60px mobile, rank=1 (profile-card whole) Δtop +28px mobile.
Triptych showed mobile badge wrapping awkwardly (flex-wrap pushed badge next to avatar), and 4-line body wrap vs baseline 3-line wrap — mobile padding too wide (24 vs intended 16 gutter).
Changes: restructured profile card so badge sits on its own row on mobile; switched mobile horizontal padding to gutter (16px); marked name as h2.

## Round 2 — mobile 14.5%, desktop 1.7%, wide 1.5%
Almost no improvement; even slight regression. Persistent suggestion: rank=0 profile card Δtop +25 desktop/wide; rank=2,3 stats +24 mobile.
Triptych: profile card structurally now matches baseline on mobile. Remaining diff is a uniform Δtop ~25px push of every element below hero.
Hypothesis: my hero internal spacing (eyebrow mb=md + display mb=md + body mb=md + cta mt=md + hero mb=lg) stacks too tall.
Change: dropped cta-row margin-top, kept body-lg mb=md.

## Round 3 — mobile 9.7%, desktop 3.3%, wide 2.9%  ← BEST
Reduced eyebrow mb from md (24) to sm (12). Mobile dropped from 14.5% to 9.7%. But desktop went UP (1.7%→3.3%) because the 12px removal overshot for desktop while only half-fixing mobile. Shift hints flipped: mobile +12px (still too high), desktop −12px (now too low).
This is a per-viewport divergence I could not resolve with any single token: mobile wants ~12px MORE eyebrow spacing than desktop (or equivalent), but the brief gives no MQ-aware token.

## Round 4 — mobile 12.1%, desktop 2.2%, wide 2.0%
Tried hero mb=md and profile mb=xl per token-snap hints. Mobile got worse; desktop better. Asymmetric. Reverted.

## Round 5 — mobile 14.5%, desktop 1.7%, wide 1.5%
Reverted to round 2 config (eyebrow=md, no cta mt). Confirmed reproducibility.

## Final config = round-3 config: eyebrow mb=sm, body-lg mb=md, no cta mt, hero mb=lg, profile mb=lg.
Final result: mobile 9.7%, desktop 3.3%, wide 2.9%.
