# Creative brief — "Kompass Analytics" orders dashboard (S16, zero-shot)

There is NO reference design. Layout, palette, and typography are
yours — but the page must satisfy every requirement below and pass
the deterministic gates. All copy is quoted verbatim in this brief;
`s16-copy-manifest.txt` carries the same lines for
`check copy --manifest`.

This is an admin dashboard — table-heavy, stateful controls. The
gates verify the behavior, not just the pixels.

## Page structure

1. **Sidebar** (at ≥768px): brand "Kompass" on top, then nav links
   "Overview", "Orders", "Customers", "Settings". "Orders" is marked
   as the current page (`aria-current="page"`).
   At 375px the sidebar is replaced by a header bar with the brand
   and a menu button labeled "Menu" carrying `aria-expanded`
   (**closed by default**); activating it shows the same nav links.
   JS must run without errors.
2. **Main area**, top to bottom:
   - Page title "Orders" and the toolbar line
     "Data refreshed 5 minutes ago".
   - **Filter chips**: four toggle buttons "All", "Paid", "Pending",
     "Refunded" (`aria-pressed`; "All" starts pressed). Activating a
     chip filters the table rows by status. Keyboard operable.
   - **Stat tiles**: four cards side by side at ≥768px, 2×2 at 375px:
     - "Revenue (30d)" → "€48,210"
     - "Orders (30d)" → "1,284"
     - "Refund rate" → "1.8%"
     - "Avg. order" → "€37.55"
   - **Orders table**: a real `<table>` with header columns "Order",
     "Customer", "Date", "Status", "Total" and these five rows,
     exactly:
     | #10412 | Mara Lindqvist | 2026-07-28 | Paid | €129.00 |
     | #10411 | Jonas Weber | 2026-07-28 | Pending | €54.90 |
     | #10410 | Aiko Tanaka | 2026-07-27 | Paid | €312.40 |
     | #10409 | Priya Nair | 2026-07-26 | Refunded | €89.00 |
     | #10408 | Tom Okafor | 2026-07-25 | Paid | €22.10 |
     - The "Date" and "Total" column headers are **sortable**: the
       header contains a real `<button>`; activating it toggles the
       sort direction, sets `aria-sort` on the `<th>`
       (`ascending`/`descending`), and actually reorders the rows.
       Keyboard operable (Enter/Space on the header button).
     - Status cells render as badges (visually distinct per status),
       text exactly "Paid" / "Pending" / "Refunded".
     - At 375px the table scrolls **horizontally inside its own
       container** (`overflow-x: auto` wrapper). The page itself must
       never scroll horizontally.
   - **Pagination**: the line "Showing 1–5 of 1,284" (en dash) plus
     buttons "Previous" and "Next". "Previous" is a real `disabled`
     button (page 1).

## Hard requirements

- Self-contained single HTML file (inline CSS/JS, no external
  requests).
- No page-level horizontal scrolling at 1280, 768, or 375px width —
  the table wrapper is the only thing allowed to scroll horizontally.
- No text may collide with or be cut off by other elements at any of
  the three widths.
- Use every copy line EXACTLY as written (spelling, casing, `€`,
  `–` in "1–5", "2026-07-28" date format).
- Sortable headers and filter chips must be reachable and operable by
  keyboard (real buttons — no clickable `<div>`/`<th>` without a
  focusable control).

## Done condition (deterministic)

- `check integrity <attempt.html>` → verdict CLEAN (default 3
  viewports).
- `check copy <attempt.html> --manifest s16-copy-manifest.txt` →
  0 missing, 0 placeholders.
- `scan scroll <attempt.html>` → no `page-overflow-x` suspect (the
  table wrapper appearing as a scroll container is expected).
- `scan handlers <attempt.html>` → no pointer-only-control suspects.
- `check interactions <attempt.html>` → no suspect issues.
