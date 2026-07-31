# S16 — zero-shot real-world patterns: orders dashboard (2026-07-31)

Second leg of the zero-shot real-world-pattern axis (after S15,
`2026-07-31-s15-zero-shot-product-page.md`). Same protocol: Haiku,
brief-only, no reference, five key-free gates as the done condition,
independent verification by a second reader.

## Scenario

`fixtures/auto-markup-proof/creative/s16-brief-dashboard.md` —
"Kompass Analytics" orders dashboard. Pattern payload: sidebar nav
with `aria-current` (hamburger + `aria-expanded` drawer at 375px),
`aria-pressed` filter chips that actually filter rows, four stat
tiles, a sortable data table (real header buttons, `aria-sort`,
actual row reordering), status badges, container-scoped horizontal
table scroll at 375px (page overflow is a fail), and a genuinely
`disabled` Previous button. Copy manifest: 45 lines including
`Showing 1–5 of 1,284` (en dash) and ISO dates.

## Result — DONE, independently verified

| KPI | value |
|---|---|
| Write rounds (ledger-audited) | 2 (draft; copy fix 7→0) |
| Tokens | 56,226 |
| Wall time | 266 s |
| Tool calls | 20 |
| Final gates | integrity CLEAN (0/0/3) · copy 0 missing (45 lines) · scroll ok (sidebar + table-wrapper as intended containers, page overflow 0) · handlers 0 suspects (17 reg / 11 el) · interactions 0 suspects (12 el, 6 warns) |

Integrity was clean from the first draft; the only fix round was
copy (7 missing → 0). Behavioral probes by the verifier, all pass:

- **Sort is real**: Total click → `aria-sort=ascending`, first row
  becomes #10408 (€22.10, the cheapest); second click →
  `descending`, #10410 (€312.40). Keyboard leg: focus Date button +
  Enter → reorders to oldest-first. The rows genuinely reorder — not
  just the attribute.
- **Filter is real**: "Paid" chip → 3 visible rows, `aria-pressed`
  moves exclusively; "All" restores 5.
- **375px**: hamburger `aria-expanded` false → true reveals nav;
  table wrapper scrolls internally (scrollWidth 438 > clientWidth
  341) with page overflow 0 — the real-world table pattern the
  brief demanded.
- **Previous** is a real `disabled` button.
- Screenshots at 1280 and 375 (default + drawer-open) read by the
  verifier: coherent visual design, color-coded badges, no
  collisions. **Gate-silent defects: 0** (fifth consecutive clean
  verification pass for the Layer B demand gate).

## Findings

1. **Interaction warns need verifier interpretation, not gate
   changes.** `check interactions` warned "no observable response to
   Enter" on the sort buttons; the agent's explanation (probe can't
   see the change) was wrong — the reorder IS observable, and my
   probes confirmed sorting works. The warns are benign for a
   different reason (the probe's layout-delta observation window).
   Verdict unchanged, but agent rationales about tool internals
   should not be taken at face value — re-probe.
2. **Round accounting again**: agent said "1 round"; the ledger
   shows draft + copy-fix (2 writes, 4 full gate passes). Smaller
   drift than S15's, same lesson: the ledger is the record.
3. **The dashboard pattern class is inside Haiku's zero-shot range**:
   stateful table interactions (sort/filter), drawer nav, and
   container-scroll discipline all came out behaviorally correct
   with no reference and no escalation — 266 s, ~56k tokens.

## Axis status

S15 (product page) + S16 (dashboard) both DONE at Haiku grade.
Remaining planned leg: S17 form-dense checkout (validation states,
label association, disabled-until-consent submit).
