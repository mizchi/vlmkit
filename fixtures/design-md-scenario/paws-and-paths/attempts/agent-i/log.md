# agent-i log

## Round 1 — measure initial
- diff: mobile **12.1%**, desktop **3.4%**, wide **3.0%**
- tags fired: STRUCTURAL, MAG-DIVERGENT, SUBSET, ⚠ converge, ⚠ cross-edit
- **STRUCTURAL named the parent property explicitly**: `body[0]>main[0]>section[0]` (hero)
  - `display: block (now) → grid (target)`
  - `gap: normal (now) → 12px (target)`
- **cross-edit warning** fired on `.hero + .eyebrow + .profile-card all cascade-affect` rank-2/3 (CTA buttons). Plan: apply ONE parent edit first (hero grid+gap consolidates eyebrow/cta-row margin candidates).
- SUBSET on desktop/wide only: `.container padding-top 40→64px, padding-bottom 40→64px`.

Edits applied: `.hero { display: grid; gap: 12px }` + zero out per-child margins. Bumped desktop container padding to `spacing.xl (64px)` top/bottom.

## Round 2 — measure
- diff: mobile **17.1%**, desktop **2.2%**, wide **2.0%**
- desktop/wide improved (good). **Mobile regressed (+5pp)** — zero-crossing warned my last edit overshot.
- new STRUCTURAL: `body[0]>main[0]` (.container) → `display: grid; gap: 40px (spacing.lg)`. Candidates: `.profile-card margin-top 40→0`, `.stats margin-top 40→0`.

Edits applied: container `display:grid; gap: spacing.lg`, removed `margin-top` from profile-card and stats. Bumped profile-card internal gap to `spacing.md (24px)`. Mobile container L/R padding switched to `gutter (16px)`.

## Round 3 — measure
- diff: mobile **16.4%**, desktop **2.2%**, wide **2.0%**
- Round delta: mobile -0.65pp (still high), desktop/wide flat.
- STRUCTURAL fully resolved on parents. Remaining: MAG-DIVERGENT cascade where mobile components are -42/-30/-29/-28 (variant content sits above baseline because my cards are visually shorter — stat cards need more internal vertical padding; profile-card needs more height).
- Triptych confirms: stat cards in baseline are ~145px tall, mine ~110px (padding=spacing.sm too small visually but matches token spec).

## STRUCTURAL with parent property names — useful?
**Yes, decisive.** Round 1's `display: block → grid; gap: normal → 12px` told me exactly what to do without opening the triptych. Round 2's follow-up (`gap: normal → 40px` on `.container`) was equally specific. I did NOT need to read the desktop/wide triptychs to apply either fix.

## Cross-edit warning — useful?
**Yes.** Round 1 fired `cross-edit: .hero + .eyebrow + .profile-card all cascade-affect`. I followed the apply-then-re-run protocol: applied only the parent .hero grid edit (which subsumed `.eyebrow margin-bottom` and `.cta-row margin-top` candidates), re-measured. Desktop/wide diff cleanly dropped without compound overshoot on those viewports.

## Caveat
On mobile, the parent-grid edit OVERSHOT (zero-crossing on rank=0 bbox 343×112: -12 → +42). The cross-edit warning correctly flagged compounding risk, but it didn't predict that the GRID PARENT REPLACEMENT itself would behave differently per-viewport (12px gap is right for hero on all viewports; 40px gap on container conflicted with the inherited margin-tops only on certain viewports until I removed them in round 3).
