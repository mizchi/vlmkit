# Agent-f log

## Round 1 — baseline build
- Diff: mobile **10.7%**, desktop **4.4%**, wide **3.9%**
- HIGH-IMPACT: did not fire. Five [DIVERGENT]/[MAG-DIVERGENT] candidates of comparable magnitude.
- Candidate annotation reading: `.profile-text height: 52px (now) → 80px (target)`. Treated (now)→(target) as "I have 52, want 80" — needed to grow profile-text from 52 to 80px → sub-line should wrap to 2 lines on mobile.
- Acted on: rewrote mobile profile layout as a 2-row grid (avatar+text row, badge row) with `max-width: 14ch` on sub-line to force wrap.

## Round 2 — overshoot
- Diff: mobile **12.4%** (↑1.67pp), desktop **4.4%** (=), wide **3.9%** (=)
- Round delta caught regression on mobile. Newly-introduced rank=0,1 with mobile Δtop -20/-44 (above target).
- Diagnosis: profile card grew vertically as planned, BUT the cumulative gap to stats was now too small (or stat positions overshot). Read JSON computedStyleDiff: discovered `.hero` baseline is `display: grid` with `gap: 12px`; `.stats` baseline is `display: grid` with `margin-top: 0`. Golden's vertical rhythm is grid-row-gap-based at the container level, not margin-based. Also `.hero` baseline width 343 on mobile (vs my 327) → container side-padding is `gutter` (16px), not `md` (24px). Body top padding: 40px mobile, 64px desktop, not 24.
- Did NOT use the per-viewport "add 20px on mobile / 28px on desktop" suggestions — they were treating the symptom. Instead used the JSON to find the structural root cause.

## Round 3 — structural rewrite
- Diff: mobile **3.45%**, desktop **0.65%**, wide **0.58%**
- Changes:
  - `.container` → CSS grid with `row-gap: lg`, padding `lg gutter` mobile / `xl md` desktop
  - `.hero` → CSS grid `row-gap: sm`
  - `.stats` → grid (1col mobile, 2col desktop) with `gap: md`, no margin-top
  - `.stat` padding bumped `sm`→`md`
- Zero-crossing fired (2 components): rank=0 `+28 → -16`, rank=4 `+28 → -8`. Both overshot by ~50%; suggested damp -14px. I did not have a 4th round to apply the damp. The biggest residual error is ~16px on mobile profile card (candidate `.profile-text height 76 (now) → 80 (target)` — last 4px of sub-line wrap difference).
- HIGH-IMPACT: still did not fire in any round. Residual suggestions are all within `1.5×` of each other.
