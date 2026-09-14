# Brief: the shop's tables, as a data model diagram

Draw the schema below as a D2 file. It is described here and nowhere else in
this repository.

## The tables, as described

- **customers** — `id` (primary key), `email`, `created_at`.
- **orders** — `id` (primary key), `customer_id` (foreign key → `customers.id`),
  `status`, `placed_at`.
- **order_items** — `id` (primary key), `order_id` (foreign key → `orders.id`),
  `product_id` (foreign key → `products.id`), `quantity`.
- **products** — `id` (primary key), `sku`, `price_cents`.
- **shipments** — `id` (primary key), `order_id` (foreign key → `orders.id`),
  `carrier`, `tracking_code`.

Four relationships in all: `orders` → `customers`, `order_items` → `orders`,
`order_items` → `products`, `shipments` → `orders`. Each arrow points from the
table holding the foreign key to the table holding the key it references.

`order_items` is the only table with two foreign keys, and that is the point of
the picture: a reader should see immediately that it joins orders to products.

## What the diagram has to show

- All five tables, every column named above, and which columns are primary or
  foreign keys.
- The four relationships, each drawn between the two columns involved, not
  merely between the two tables.
- No relationship that is not in the list — five tables and four arrows, no
  more.

## From v2 on: the fact sheet is yours

`briefs/facts/shop-schema.expect.json` says what the diagram has to draw, in the
schema `.claude/skills/d2-diagram/assets/d2-facts.mjs` reads. Hold your picture
to it:

```sh
node .claude/skills/d2-diagram/assets/d2-facts.mjs shop-schema.d2 \
  --expect ../../briefs/facts/shop-schema.expect.json
```

The sheet wins over the picture, and over your reading of this brief. Two things
it cannot check are listed in its `_byEye` and are still required: the columns
and their key constraints, and that each arrow is drawn between the two
**columns** rather than the two tables. Check those on the PNG.

## Done when

1. `d2 validate` exits 0, and `d2 fmt --check` exits 0.
2. `d2-facts.mjs --expect` exits 0 against the sheet above.
3. The TALA terminal render exits 0 and its widest line is **100 columns or
   fewer** (`LC_ALL=C.UTF-8 wc -L`, or the `columns` the facts check prints).
4. Reading only your render, you can name which table each arrow leaves and
   which it enters.

## Deliver in your working directory

- `shop-schema.d2`
- `shop-schema.txt`
- `shop-schema.svg`
- `log.md` — one line per round: what you changed, what told you to change it,
  and the width after that round.
