# log — checkout-calls (attempt g)

- **r1** Wrote `checkout-calls.d2` as a root `shape: sequence_diagram`, 5 actors in the
  brief's order, 7 messages, returns/async carried in the label as `(ret)` / `(async)` —
  from the skill's route-by-task row: "D2 has no return or async arrow, and the terminal
  render drops arrowheads and dash styles, so **say it in the label** (`reserved (ret)`,
  `order.placed (async)`)". `fmt --check` 0, `validate` 0, `d2-facts --expect` **0 on the
  first run**: `✓ 7 messages drawn in the sheet's order`, `✓ width 76 ≤ 80 columns`.
  What made me change anything was loop step 6, not the checker: two return arrows came out
  with **no arrowhead at all** (`│reserved (ret)│`, `│201─Created (ret)│` — the label fills
  the lane exactly; the skill's "Arrowheads are unreliable on long labels. A label long
  enough to fill the lane can leave the arrow with no head at all"), and the async label's
  parentheses were **eaten into line characters**: `│────order.placed──async─────▶│`.
  Width after r1: **76**.

- **r2** Dropped the parentheses and moved the markers to bare leading words —
  `ret reserved`, `async order.placed`, `ret 201`, `ret order-id` — to buy back the cells the
  arrowhead needs. Told to by the r1 render above. All seven arrows got a head
  (`│◀ret─reserved─│`, `│◀───ret 201────│`, `│◀─ret─order-id──│`). New defect the render
  showed: `async order─placed` — the **`.` in `order.placed` had been replaced by `─`**,
  so the event name read as `order-placed`. (In r1 the dot survived and the space was eaten;
  which character the line overwrites is not stable, so the skill's "probe the spelling you
  land on" is the only way to know.) `facts --expect` 0. Width after r2: **74**.

- **r3** Probed the spelling: moved the marker to the end, `order.placed async`, and restored
  the brief's wording on message 6, `ret 201 Created`. Told to by r2's mangled dot. Render is
  now `│──────order.placed─async─────▶│` (dot intact, one head) and
  `│◀ret─201 Created│` (head present, flush against the lifeline). `facts --expect` 0.
  Width after r3: **75**.

- **r4** No edit. Verification round: `d2-facts` with no sheet to confirm no phantom box
  (5 boxes, 7 deps, `containers: {}` — the scoping trap cannot bite a flat sequence diagram),
  rendered twice and `cmp`'d (byte-identical, so TALA's seeds are reproducible here), rendered
  the `standard` ASCII variant and checked its heads independently (`|<ret-reserved-|`,
  `|<ret-201 Created|`, `|<-ret-order-id--|`, `|------order.placed-async----->|`), and read the
  PNG (all 7 messages, directions and top-to-bottom order confirmed by eye). Also probed the
  skill's caveat that the in-file `layout-engine: tala` is ignored for `.txt`: with no
  `--layout` flag the render was **byte-identical** to the tala one here — a sequence diagram
  has its own layout, so the caveat did not bite. Width after r4: **75**.
