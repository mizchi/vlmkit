# log — shop-schema (attempt f)

- **Round 1** — wrote `shop-schema.d2` from scratch: five `shape: sql_table` boxes, every
  column from the brief with `{constraint: primary_key}` / `{constraint: foreign_key}`, the
  four edges written column-to-column (`orders.customer_id -> customers.id` …), root
  `direction: right`, `vars.d2-config.layout-engine: tala`. Told to write it this way by the
  skill's route table row *"Draw the data model / tables | `shape: sql_table` with `id: int
  {constraint: primary_key}` … connect the columns (`orders.customer_id -> customers.id`)"*.
  `d2 fmt --check` 0, `d2 validate` 0, facts: all 5 boxes and all 4 edges ✓, one error —
  `✗ the terminal render is 152 columns, the sheet allows 100`. **Width: 152.**
