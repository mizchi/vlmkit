# log — shop-schema (attempt f)

Checks each round, in the skill's order: `d2 fmt --check` → `d2 validate` →
`d2-facts.mjs --expect` → PNG → `.txt`.

- **Round 1 — wrote the file.** Five `shape: sql_table` boxes, every column from the
  brief, `{constraint: primary_key}` / `{constraint: foreign_key}`, the four edges
  written column-to-column, root `direction: right`, `vars.d2-config.layout-engine:
  tala`. Written that way by the skill's route row *"Draw the data model / tables |
  `shape: sql_table` with `id: int {constraint: primary_key}` … connect the columns
  (`orders.customer_id -> customers.id`)"*. fmt 0, validate 0, facts: 5/5 boxes and
  4/4 edges ✓, one error — `✗ the terminal render is 152 columns, the sheet allows
  100`. **Width 152.**

- **Round 2 — root `direction: right` → `down`.** The skill's width table, first
  lever: *"root `direction: right` → `down` | 144 → 145 (worse) | 148 → 109 (the
  win)"*. Facts still 9 ✓, same single width error, now
  `✗ the terminal render is 113 columns`. **Width 113.**

- **Round 3 — `left: 420` / `top: 520` pin on `products`.** The only remaining lever
  in the skill's table for this number: *"`top` / `left` pin on one shape | 113 →
  **74**"*. Facts went green: `✓ width 71 ≤ 100 columns`, `✓ shop-schema.d2: 10 ok,
  0 warning(s), 0 error(s) · 71 columns`, exit 0. **It is a false green.** `wc -l
  shop-schema.txt` = 15 lines, ending mid-box: the ascii render dropped
  `shipments`, `orders` and `customers` entirely and `d2` still exited 0. The SVG
  was *bigger* than before (viewBox 1675×712 against 1290×924, boxes out to
  x=1893), so the picture had got wider, not narrower — the 71 was a measurement of
  a fragment. `d2-facts` reads boxes from the SVG and columns from the `.txt`, so it
  never noticed that two thirds of the diagram is missing from the thing it
  measured. Pin reverted. **Width 71 (of a truncated render); real picture ~147.**

- **Round 4 — dropped the type column** (`id: {constraint: primary_key}`, `email`
  with no value), on the theory that narrower boxes give a narrower picture; the
  brief asks only for the columns and their key markers. fmt 0, validate 0, facts
  `✗ the terminal render is 127 columns` — **worse than 113**, exactly the skill's
  warning *"Shortening labels is as likely to make it wider, because TALA reflows
  the whole picture."* The SVG shows why: boxes fell from 253–289px to 184–213px and
  TALA then laid them out in **four** horizontal bands (x = 0, 363, 711, 1045)
  instead of three. **Width 127.**

- **Round 5 — reverted round 4 and wrapped the five tables in one `shop` container
  with its own `direction: down`.** The skill calls this the first lever to try:
  *"per-container `direction` on the fullest container is the width lever"* /
  *"146 → 113 (the win)"*. All four connections are intra-container so they are
  written inside it; no name out of scope, no phantom box, facts still 9 ✓. Width
  113 → **121** — worse; the container's own padding costs more than its direction
  saves. Reverted.

- **After the budget — restored round 2's file** as the deliverable (the best
  measured state: full render, 34 lines, all five tables, 9 of 10 checks ✓).
  **Width 113, over the sheet's 100.** PNG read: all five tables, every column in
  the brief's order, `PK` on all five `id` rows, `FK` on exactly
  `orders.customer_id`, `order_items.order_id`, `order_items.product_id`,
  `shipments.order_id`, and each of the four arrows leaving a foreign-key row and
  entering the referenced `id` row.
