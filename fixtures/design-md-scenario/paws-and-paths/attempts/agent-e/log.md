# agent-e log

## Round 1
- Initial draft. page padding `s-lg s-margin` everywhere, hero gap `s-md`, cta-row margin-top `s-sm`, mobile profile stacks badge below.
- Diff: mobile **17.4%**, desktop **2.6%**, wide **2.3%**.
- Scope tags: 1 DIVERGENT-ish + 4 MAG-DIVERGENT (all on hero descendants), 1 SUBSET (text rows -24px desktop/wide).
- Candidate flagged: `.page (padding-top: 64px→40px; padding-bottom: 64px→40px)` and `.hero (height: 352px→388px; 244px→280px)`.
- Acted on: `.page` candidate — changed mobile padding to `s-gutter`, desktop to `s-xl`. **MISREAD the candidate notation.** Notation appears to be `golden→mine` for height pairs but `mine→golden` for some others, or the report flips between viewports. Was never able to verify which direction was authoritative.

## Round 2
- Diff: mobile **12.6%** (better), desktop **4.2%** (worse), wide **3.7%** (worse).
- I over-corrected desktop by bumping padding to `s-xl`.
- Reverted desktop padding to `s-lg`.
- New MAG-DIVERGENT suggestion: "reducing 36px on desktop". Acted on hero gap (24→12 on desktop) and removed cta-row margin-top. Same `.hero` candidate name but no property delta on the cta-row offered.

## Round 3
- Diff: mobile **10.8%**, desktop **4.6%**, wide **4.1%**.
- MAG-DIVERGENT now says "**adding** 36px on desktop, **adding** 12px on mobile" — sign FLIPPED from round 2.
- Candidate now correctly names: `.hero (gap: 12px→24px)` and `.cta-row (margin-top: 12px→0px)` — both indicating I should reverse my round-2 edits.
- Budget exhausted before I could revert.

## Verdict
- Best desktop/wide diff was in round 1 (2.6 / 2.3). My subsequent "improvements" regressed both.
- Best mobile diff was round 3 (10.8) — still high. Mobile residual is dominated by font-family fallback (Plus Jakarta Sans CSS 404) which the render-sanity gate flags as symmetric, but row heights still drift on the long lede paragraph.

## What helped vs not
- `candidate:` selectors: NAMED the right rules (`.hero`, `.cta-row`, `.page`) but the `prop: A→B` direction was inconsistent across rounds. Hard to act on without a second source of truth.
- MAG-DIVERGENT tag: useful as a flag ("don't fix this globally"). The +36/+12 magnitudes were directionally correct but flipping signs between rounds without clear indication that I had crossed zero made me chase the gradient instead of damping it.
- Manifest `--from-run`: did NOT apply — diffs never reached "tiny/low-confidence" territory. No sub-pixel jitter to approve away.
