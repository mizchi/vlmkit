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

## Done when

1. `d2 validate` exits 0, and `d2 fmt` leaves the file unchanged.
2. The TALA terminal render exits 0 and its widest line is **100 columns or
   fewer** (`wc -L`).
3. Reading only your render, you can name which table each arrow leaves and
   which it enters.

## Deliver in your working directory

- `shop-schema.d2`
- `shop-schema.txt`
- `shop-schema.svg`
- `log.md` — one line per round: what you changed, what told you to change it,
  and the width after that round.
