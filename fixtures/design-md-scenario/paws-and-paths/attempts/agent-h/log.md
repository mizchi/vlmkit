# Agent-h log

## Round 1 (mobile 20.5%, desktop 2.1%, wide 1.9%)
- Scope tags fired: [STRUCTURAL] (body>main parent-layout); [HIGH-IMPACT][SUBSET] (avatar Δtop +180px mobile); [SUBSET]
- [REFLOW] did NOT fire (despite mobile being ~10x desktop magnitude — text-row count likely matched between baseline & variant so the heuristic skipped)
- Converging warning fired strongly on mobile: 2 suggestions converge on .hero / .eyebrow / .display / .lede each cumulative 48px → "consolidate" rather than apply each margin-bottom 24→0 individually
- Edits planned:
  1. Drop `.cta-row { margin-top: 24px }` (one consolidated 24px reduction in hero stacking instead of 3 separate margin-bottom zeroes — heeded converging warning)
  2. Bump container padding-top/bottom from lg(40) → xl(64) on desktop/wide (suggestion's container candidate)
  3. Restructure profile so badge wraps below text on mobile

## Round 2 (mobile 13.4%, desktop 4.0%, wide 3.6%)
- Mobile improved 7pp. Desktop/wide regressed ~2pp.
- Round-delta showed new [DIVERGENT] / [MAG-DIVERGENT] tags for profile (mobile +136, desktop +24, wide +24)
- Diagnosis: container padding 64 overshot desktop. Profile-body wrapper made mobile badge nest inside text column instead of wrapping under the full card.
- Plan R3 (consolidated): revert desktop padding to 40 (single edit fixes BOTH desktop +24 and wide +24 — converging signal acted on); restructure profile back to direct children of `.profile`.

## Round 3 (mobile 12.4%, desktop 2.1%, wide 1.9%) — final
- Switched mobile `.profile` to `display: grid; grid-template-columns: 64px 1fr` with badge `grid-column: 1 / -1` so avatar+text occupy row 1 and badge spans full width on row 2 (proper structural fix matching baseline layout).
- Reverted desktop container padding back to lg (40px) — fixed the +24 desktop/wide overshoot in one edit (converging signal acted on consistently across both viewports).
- Kept .cta-row margin-top: 0 removal from R2.
- Net: mobile 20.5 → 12.4 (-8pp from R1, -1pp from R2's 13.4 best); desktop/wide back to R1 baseline 2.1/1.9.

## Notes on tag usefulness
- [REFLOW]: never fired this scenario. The mobile diff was magnitude-divergent (~10x desktop) but text-row counts apparently matched, so it didn't fire — would have been useful if it had.
- Converging warning: useful for steering away from per-margin 24→0 application on hero — without it I'd have applied 3 independent edits and overshot by 48px.
- [STRUCTURAL]: pointed correctly to parent layout (body>main) but didn't tell me WHICH child arrangement was wrong; required reading the triptych.
