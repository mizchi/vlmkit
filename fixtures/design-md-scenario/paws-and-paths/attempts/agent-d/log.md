# agent-d log

## Round 1 — 21.7% / 1.3% / 1.2% (mobile/desktop/wide)
Initial scaffold (container max-width:720, padding md, .hero with margin-bottom lg,
display:block sections, profile flex wrap on mobile with badge margin-left hack,
stat-card bg surface-variant, gap 16).

Wireframe fixes fired: 5x `[SUBSET]` tags, all on mobile (rank=2,3,4 components Δtop +24/+16),
plus desktop+wide subset for -24px shifts. Tags correctly indicated these were per-viewport
deltas, not global ones. They steered me away from a tempting "shift everything up 24px"
global edit.

## Round 2 — 16.2% / 5.1% / 4.6%
Restructured: `.page` as grid (gap lg, padding gutter), `.hero` as grid (gap sm),
`.profile` as 3-col grid, `.profile-text` as grid, `.stats` gap sm, `.stat-card` bg
surface-container-high. Mobile media query: profile becomes 2-col with badge in row 2.

Made a global mistake: dropped `.page` padding to `gutter` (16px) on **all** viewports.
Wireframe fixes called this out — 5x `[SUBSET]` "mobile -60/-36/-24px"
on every component. The SUBSET tags were the signal: top-padding diff appeared only on
mobile in the per-viewport report (and large +xl on desktop). Acted on that.

Also flagged: `.stat-card` padding wrong (sm not md), `.hero__body` needs max-width.

## Round 3 — 3.1% / 0.1% / 0.1%
Added media query: `.page` mobile padding `lg gutter` (40 16) / >=640 `xl margin` (64 24).
`.stat-card` padding md, `.hero__actions` flex-wrap wrap, `.badge` letter-spacing normal,
`.hero__body` max-width 40rem. Removed unwanted box-shadow.

Wireframe fixes now only mobile [low]: 3x `Δtop -12px on mobile`. These untagged
suggestions still implied a mobile-only fix (the suggestion text said "on mobile").
The profile mobile gap was `12px 24px` instead of `24px 24px`.

## Round 4 — 0.2% / 0.1% / 0.1%
Bumped mobile profile row-gap to md (24px). All viewports below 1%.

Residual: `.hero__body` max-width 641.32px vs my 640px (40rem) — a 1.32px sub-pixel
artifact. Could be golden uses 40em on inherited font-size that resolves to 16.033, or
a hardcoded pixel value. Not actionable from the diff data alone.

## Round 5 — 0.2% / 0.1% / 0.1%
Removed `min-width: 0` from `.profile-text` (baseline had auto). No real change.
Stopped — remaining delta is sub-pixel and the wireframe suggestion engine produced
no further actionable hints.
