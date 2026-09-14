# shop-schema.d2 — round log

Checks run each round, in the skill's order ("The loop"):
`d2 fmt` + diff → `d2 validate` → `d2 --layout=tala … .txt` + `wc -L` → `.png` read with my own vision.

- **R1 — first write. Width 148.**
  Five `shape: sql_table` blocks, every column from the brief,
  `{constraint: primary_key}` / `{constraint: foreign_key}`, four column-to-column
  connections (`orders.customer_id -> customers.id` …), `direction: right`,
  `vars.d2-config.layout-engine: tala`.
  *What told me to write it this way:* the skill's route table row — "Draw the data
  model / tables → `shape: sql_table` with `id: int {constraint: primary_key}` rows;
  connect columns (`orders.user_id -> users.id`)". The `foreign_key` spelling is
  **not** in the skill; I guessed it from D2 knowledge and confirmed it only by
  grepping the SVG (`grep -o '>FK</text>' | wc -l` → 4, `>PK</text>` → 5).
  fmt: unchanged. validate: exit 0. txt: exit 0. `wc -L` = **148** (done wants ≤100).
  *Also seen:* the `.txt` render prints each row as `name  type` and **drops the
  PK/FK markers entirely** — they exist only in the SVG/PNG. The skill's "Reading the
  terminal render" says "`sql_table` and `class` shapes render, with their rows" and
  does not warn about this.

- **R2 — `direction: right` → `direction: down`. Width 109.**
  *What told me:* "Width is the layout's, not yours… The levers are `direction`,
  splitting a container into its own file, and shorter labels." Measured all four
  values: right 148, down 109, up 109, left 183, no `direction:` 145. Kept `down`.
  Trailing whitespace is not the cause — content width equals raw width at 109.

- **R3 — shorter labels (`text`→`str`, `timestamp`→`ts`). Width 109 → 135. REVERTED.**
  *What told me to try it:* the same "shorter labels" lever. *What told me to revert:*
  `wc -L` went **up** by 26. The narrower boxes let TALA re-cluster into a wider
  4-across arrangement — exactly the "A label change can still cascade into a
  different arrangement" warning, except the skill files that under *randomness*, not
  under its own width-lever list. Levers here are a cliff, not a slope.

- **R4 — reverted R3's labels; swept `--tala-seeds`. Width 109, unchanged.**
  *What told me to try it:* "when a layout is ugly, `--tala-seeds 4,5,6` gives you a
  *different* layout, not a nudged one." Measured `4,5,6`, `7,8,9`, `10,11,12` and each
  single seed 1–9: **every one rendered at 109 columns.** The seed lever did nothing on
  this file. Also probed four more surgical narrowings (`timestamp`→`date` only = 102;
  `date` + `str` in shipments only = 136; `date` + all `str` = 138; types dropped
  altogether = 126). 102 was the floor any label edit could reach; nothing reached 100.

- **R5 — pinned all five tables with `top`/`left`. Width 75. DONE.**
  *What told me:* the only width lever left in the skill — "Pin with `top` / `left`
  (both together, TALA only) when a shape must stay put: the blog's intended hybrid is
  that you choose positions for the few boxes that matter and TALA routes everything
  else." Grid: customers|orders (top 0), products|order_items (top 320), shipments
  (top 640), x at 0 / 420. The px→column ratio I needed is not in the skill; I derived
  it from the SVG canvas (`width="1259"` for a 109-column render ≈ 11.5px/column).
  fmt: unchanged. validate: exit 0. txt: exit 0. **`wc -L` = 75.**
  Comment in the file records why the coordinates exist, per the skill's rule.

## What I can and cannot tell from the render

Readable from the `.txt` alone: five tables; four arrows; each arrowhead lands on the
*referenced* table (`◀` at customers, orders ×2, products), so the direction is right.

Not readable from the `.txt` alone, and I am not claiming it:
1. **Which column** an arrow attaches to. `order_items → products` is drawn leaving the
   `quantity` row, not `product_id`; `orders → customers` enters at the header divider,
   not at the `id` row. The PNG shows all four correctly column-to-column, so the `.d2`
   is right and the text render is the lossy view.
2. **PK/FK** — absent from the `.txt` (see R1). Verified on the PNG: 5 PK badges, 4 FK.
3. The two edges into `orders` (`order_items.order_id`, `shipments.order_id`) **share one
   vertical lane** at the right margin and the junction where the first joins it is drawn
   as a plain `│`, not a `┤`. Following the lane still works, but a reader could plausibly
   mis-split those two. Confirmed correct on the PNG only.
