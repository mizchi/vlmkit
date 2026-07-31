# S15 — zero-shot real-world patterns: e-commerce product detail page (2026-07-31)

## Question

The creative (zero-reference) legs so far (S14a, S14a-stress) were
landing pages. Can the brief-only loop handle the patterns an agent
actually meets on real-world pages — breadcrumbs, sale pricing,
variant pickers, steppers, tabs, closed accordions, sticky mobile
bars, data tables — with the deterministic gates as the only referee?
Secondary question: does the new `check copy` disclosure-state sweep
(2026-07-31) remove the open-by-default incentive in a live run?

## Setup

- Brief: `fixtures/auto-markup-proof/creative/s15-brief-product.md`
  ("Alpenrad Tourer X" product page). No reference image. Copy
  manifest deliberately places 11 of 30 lines inside hidden tab
  panels (Specifications, Reviews) and closed `<details>`.
- Agent: Haiku subagent, brief-only, 8-round budget.
- Done condition (5 gates, all key-free): `check integrity` CLEAN,
  `check copy --manifest` 0 missing / 0 placeholders, `scan scroll`
  no page-overflow-x, `scan handlers` no pointer-only controls,
  `check interactions` no suspects.
- Output: `fixtures/auto-markup-proof/creative/attempt-s15-haiku.html`.

## Result — DONE, independently verified

| KPI | value |
|---|---|
| Rounds (agent-claimed) | 2 |
| Fix-verify iterations (ledger-audited) | 5 integrity runs: 2 fails → 3 → 3 → 2 → clean |
| Tokens | 49,704 |
| Wall time | 188 s |
| Tool calls | 28 |
| Final gates | integrity CLEAN (0/0/3 exempted) · copy 0 missing (11 revealed-only) · scroll ok · handlers 0 suspects (16 reg / 13 el) · interactions 0 suspects (16 el, 6 warns) |

Verification by a different reader (this driver, not the authoring
agent): all 5 gates re-run and confirmed; screenshots at 1280/768/375
read with own vision; behavioral probes — exactly one `[role=tabpanel]`
visible after switching tabs, both `<details>` closed in source
(0 `open`), variant picker is 3 native radios, sticky cart bar pinned
to the 375px viewport bottom while content scrolls beneath.

**Gate-silent defects found: 0.** One candidate — the mobile cart bar
overlapping the variant picker in the full-page screenshot — turned
out to be a capture artifact (a viewport-pinned sticky element paints
at its scroll-0 position in fullPage captures); the scrolled viewport
capture shows correct behavior. The Layer B demand gate stays at zero
observed gate-silent defects across four creative verification passes.

## Finding 1 — the disclosure-state sweep works in the wild

First live run through the 2026-07-31 sweep: `check copy` reported
`missing 0, 11 revealed-only` from the very first draft — the agent
shipped tabs and FAQ collapsed (as the brief specs) and never had a
reason to open them. Contrast S14a (pre-sweep), where the copy gate
was the only fix driver and induced the `<details open>` that still
sits in `attempt-haiku.html`. The incentive is measurably gone; the
provenance lines (`revealed: "Frame" ← tab "Specifications"`) also
double as a free structural sanity check of which state carries which
copy.

## Finding 2 — agent round accounting under-reports; the ledger is the record

The agent reported "2 of 8 rounds". The run ledger shows 5
integrity-check invocations with strictly evolving results — i.e. at
least 4 edit-and-recheck micro-iterations inside what the agent
called round 2 (container-protrusion in the FAQ answers, then
low-contrast warns, resolved over ~80 s). Not a false-done — the
final state is genuinely clean — but KPI rows must come from
`.vlmkit/run-ledger.jsonl`, not the agent's self-report. This matches
the standing Goodhart guard: rounds are audited, never self-declared.

## Finding 3 — real-world pattern coverage held

Every pattern the brief packed in came out behaviorally correct on
first independent probing: breadcrumb with `›`, strikethrough sale
price, radio-based variant picker (keyboard operable per
`check interactions`), real-button stepper (`scan handlers` 0
pointer-only), ARIA tabs with single visible panel, closed-by-default
FAQ, 375-only sticky cart bar, `<table>` specs. The 6 interaction
warns are the known benign class (click-handler buttons with no
distinct Enter response — native buttons fire click on Enter).

## Verdict

Zero-shot creative mode extends from landing pages to
real-world-pattern pages at Haiku grade with no new tooling: the
existing five-gate done condition was sufficient, convergence took
~3 minutes / ~50k tokens, and the sweep closed the one incentive bug
the previous leg exposed. Next candidates if this axis continues:
dashboard/table-heavy UI (sortable columns, virtual scrollports) and
a form-dense checkout (validation states — would exercise
required-state contracts).
