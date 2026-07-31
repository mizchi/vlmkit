# Creative brief — "Alpenrad Tourer X" product detail page (S15, zero-shot)

There is NO reference design. Layout, palette, and typography are yours
— but the page must satisfy every requirement below and pass the
deterministic gates. All copy is quoted verbatim in this brief;
`s15-copy-manifest.txt` carries the same lines for
`check copy --manifest`.

This is an e-commerce product detail page — the patterns below are the
ones real product pages carry, and the gates verify them behaviorally.

## Page structure (top to bottom)

1. **Breadcrumb**: `Home › Bikes › Alpenrad Tourer X` (the `›`
   separators matter; "Home" and "Bikes" are links, the last crumb is
   plain text).
2. **Product block**: two columns at ≥768px (gallery left, info
   right), stacked at 375px.
   - **Gallery**: a main visual panel plus 3 thumbnail swatches
     (CSS-only: gradients/solids, no external images). Clicking a
     thumbnail swaps the main panel's look (JS must run without
     errors).
   - **Info column**, top to bottom:
     - Product title "Alpenrad Tourer X"
     - Price row: current price "€1,299" next to the crossed-out
       original "€1,499" (must render with strikethrough), and a
       stock badge "In stock — ships in 2 days".
     - **Variant picker**: label "Colour" with three selectable
       options: "Glacier White", "Slate Grey", "Signal Orange".
       Exactly one is selected at a time; the selection must be
       operable by keyboard (native radios are the easy path).
     - **Quantity stepper**: label "Quantity", a decrement button, a
       numeric value, an increment button. The buttons must be real
       `<button>`s with accessible names (no clickable `<div>`s).
     - Primary button "Add to cart".
3. **Detail tabs**: three tabs "Description", "Specifications",
   "Reviews" (`role="tablist"` / `role="tab"` / `aria-selected`,
   panels with `role="tabpanel"`). Exactly ONE panel visible at a
   time; "Description" is the initial tab. Tabs must be keyboard
   operable and JS must run without errors.
   - **Description** panel body: "Built for loaded touring: a
     triple-butted steel frame, 45mm tyre clearance, and mounts for
     everything you can bolt on."
   - **Specifications** panel: a real `<table>` with three rows —
     "Frame" → "Triple-butted chromoly steel", "Weight" → "12.4 kg
     (size M)", "Gearing" → "2×11 Shimano GRX".
   - **Reviews** panel: rating line "4.6 out of 5 — 218 reviews" and
     one quote: "Crossed the Alps twice. The rack mounts alone are
     worth it." attributed to "— Jonas K."
4. **Shipping FAQ**: two disclosure items (native `<details>` is the
   easy path). **Both start CLOSED** — that is the spec'd default
   state, and the copy gate verifies collapsed copy without opening
   anything by default.
   - Q1 "How long does delivery take?" → A1 "Assembled bikes ship in
     a wooden crate within 5 working days across the EU."
   - Q2 "Can I return the bike?" → A2 "30 days, free pickup, full
     refund — as long as the frame is unmarked."
5. **Mobile cart bar**: at 375px a bar with "€1,299" and an
   "Add to cart" button stays pinned to the bottom of the viewport
   while the page scrolls (`position: sticky` or `fixed`). At ≥768px
   the bar is not shown (duplicate copy across the bar and the info
   column is fine).
6. **Footer**: "© 2026 Alpenrad GmbH · Imprint · Shipping · Returns"
   in one line (the `·` separators matter).

## Hard requirements

- Self-contained single HTML file (inline CSS/JS, no external
  requests).
- No horizontal scrolling at 1280, 768, or 375px width.
- No text may collide with or be cut off by other elements at any of
  the three widths.
- Use every copy line above EXACTLY as written (spelling, casing,
  `€1,299`, `2×11`, `›`, `·`).
- Tabs: non-active panels are genuinely hidden (not stacked below),
  and the FAQ items are genuinely closed by default. The copy gate
  sweeps disclosure states — do NOT ship tabs/details open to satisfy
  it.

## Done condition (deterministic)

- `check integrity <attempt.html>` → verdict CLEAN (default 3
  viewports).
- `check copy <attempt.html> --manifest s15-copy-manifest.txt` →
  0 missing, 0 placeholders (collapsed copy passes via the
  disclosure-state sweep).
- `scan scroll <attempt.html>` → no `page-overflow-x` suspect.
- `scan handlers <attempt.html>` → no pointer-only-control suspects.
- `check interactions <attempt.html>` → tab/variant/stepper controls
  respond to their canonical keyboard events; no suspect issues.
