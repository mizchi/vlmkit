# agent-g log

## R1 — mobile 18.6%, desktop 2.6%, wide 2.3%
- STRUCTURAL fired (parent: `body[0]`). HIGH-IMPACT MAG-DIVERGENT: avatar +132px mobile / +12px desktop. `[cascades to siblings]` on .container & .hero. Predictive overshoot: "applying 40px globally would overshoot desktop by 28px".
- I did NOT act on STRUCTURAL in R1 directly (I had a grid+row-gap container already). Decided the issue was per-viewport gap size, not structure. Plan: tighter mobile gaps, slightly tighter desktop gaps.

## R2 — mobile 15.4% (↓3.2pp), desktop 4.8% (↑2.2pp), wide 4.3% (↑1.9pp)
- I tightened both container row-gap and per-section gaps to `md` everywhere, kept desktop padding-top `md`. Mobile improved a bit; desktop/wide regressed.
- New MAG-DIVERGENT inverted sign: now NEED to ADD 56-72px on desktop. Candidate said `.container padding-top: 24px → 64px (target)`. Golden uses xl (64px) padding-top.
- Zero-crossing on desktop/wide (.container went from +12 too tall to -72 too short).

## R3 — mobile 18.6% (↑3.2pp, back to R1), desktop 3.8% (↓0.9pp), wide 3.4% (↓0.9pp)
- Restored container row-gap to `lg`, set desktop padding-top/bottom to `xl` (64px), desktop row-gap `md`. Reverted hero/profile gaps to `md`. Mobile regressed because mobile gaps went back to lg.
- STRUCTURAL still firing (`body[0]>main[0]`). Avatar still +132px on mobile.
- Suspect: mobile headline wraps differently than golden (3 lines vs 2). MAG-DIVERGENT can't see text-wrap; it just sees position delta and proposes spacing fixes. The +132px mobile / +20px desktop signature suggests text-wrap not gap (would be same magnitude across viewports if gap).

## Negative feedback
- `[STRUCTURAL]` magenta meta-row was loud but ambiguous: my `body>main` IS grid+row-gap. The hint pointed at parent layout strategy but the real issue (R3 floor) was almost certainly text wrapping on mobile, which the suggestion engine has no signal for. Following STRUCTURAL literally would mean removing the wrapping main, which wouldn't change layout if both have same grid semantics.
- `[cascades to siblings]` was correct-but-circular: `.container (height: now → target)` told me the container needed to grow 72px on desktop, which is true, but didn't disambiguate "padding vs gap vs missing child." I had to guess padding-top from the candidate's height delta math.
- Predictive overshoot ("applying 40px globally would overshoot desktop by 28px") DID fire and I respected it — but I still overshot in R2 because I conflated three different per-element gap reductions. The warning is per-suggestion, not aggregated across multiple suggestions touching the same .container.
- The MAG-DIVERGENT diagnosis was misleading for the mobile-only +132px avatar drift: it kept proposing "reduce 132px mobile" as a spacing token, but no single token = 132px. The real cause (likely 1-line vs multi-line headline wrap, which depends on font availability) wasn't surfaced anywhere in the suggestions.
