# log — order-events.d2 (attempt a)

- **Round 1** — first write: three containers (`outside` / `edge` / `cluster`), `direction: right`
  at the root per the skill's "Draw the architecture / how the services fit" row, `shape: queue`
  for `broker`, `shape: cylinder` for the two stores, `shape: cloud` for `stripe` (the skill's
  "Draw the deployment / network" row). Async edges marked `style.stroke-dash: 3`.
  `d2 fmt` unchanged, `d2 validate` exit 0, tala render exit 0. **What told me to change it:**
  `wc -L order-events.txt` = **144**, over the brief's 100. The render also showed a real defect:
  the `orders -> inventory: sync call` label is drawn *on the top border of both boxes*
  (`┌───────────────────────sync call──────────────────────────────┐│` then
  `│orders (order records) │──────▶│inventory (stock reservation) ││`), so `orders` and
  `inventory` read as one merged outer box instead of two boxes with an arrow between them.
  Width after: **144**.

- **Round 2** — changed root `direction: right` → `direction: down`, the first lever the skill
  names: "**Width is the layout's, not yours.** The workspace map rendered at 120 columns with
  TALA `direction: right`, 94 with `direction: down` … The levers are `direction`, splitting a
  container into its own file, and shorter labels." **What told me to change it:** round 1's 144.
  **Result: it did not work.** 144 → **145**, and `diff` of the two renders showed the same
  arrangement with one extra column of padding. The skill's headline width lever is a no-op on
  this file. Width after: **145**.

- **Round 3** — shortened every node label (`orders (order records)` → `orders (records)`,
  `inventory (stock reservation)` → `inventory (stock)`, `CDN (static + cache)` → `CDN (cache)`,
  etc.) and every edge label to one word (`sync call` → `sync`, `publishes` → `publish`,
  `consumes` → `consume`); reverted the direction to `right`. This is the skill's third named
  lever, "shorter labels". **What told me to change it:** round 2's 145 with an unchanged
  arrangement — if direction does nothing, labels were the only lever left.
  **Result: it also did not work — it got worse.** 145 → **146**. TALA reflowed completely
  (exactly the skill's failure mode "Every round moves the boxes though you changed one label →
  TALA reflowed") and the new arrangement put *five* boxes in one cluster row —
  `billing | broker | orders | inventory | redis` — where round 1 had four. Shorter labels bought
  box width and lost it again to an extra column in the row. The reflow also introduced two new
  label-on-border defects: `│              consume      │` drawn *inside* the `billing` box, and
  `┌────────────────────reads .-‾‾‾‾-.` drawn on `shipping`'s top border; `REST` was written into
  the `our cluster` container's own top border. Width after: **146**.

  After three rounds and three increases I stopped guessing and probed six variants in a
  scratchpad copy instead of spending rounds on them. Recorded because it is the finding: the
  skill gives three width levers, two of them made this file wider, and it offers no way to tell
  which lever will help before you run it. What the probe found:
  - `direction: down` **on the `cluster` container** (per-container direction): 146 → **113**.
  - the same `direction: down` on the `outside` and `edge` containers: renders **byte-identical**
    to not setting it (`diff -q` clean). TALA honoured per-container direction on one of three
    containers and silently ignored it on the other two.
  - `near: outside.browser` on `stripe`: 113 → 114 (no help).
  - `tala-seeds` inside the file — `vars.d2-config.tala-seeds` — is **rejected**:
    `order-events.d2:10:5: "tala-seeds" is not a valid config`, and with a `[4; 5; 6]` list,
    `"tala-seeds" needs a value`. This contradicts `d2 layout tala`'s own help text, "Diagram
    data under tala-seeds takes precedence over the command-line flag".
  - `--tala-seeds` as a flag does move the width a lot (113 / 113 / 109 / 100 for `1,2,3`,
    `4,5,6`, `7,8,9`, `11,12,13`) but the brief's done condition runs `d2 --layout=tala` with no
    seeds flag, so a seed cannot be the fix.
  - `top` + `left` on `stripe`: **74**. The numbers matter enormously and nothing predicts them —
    `top=200 left=40` → 74, `top=100 left=100` → 80, `top=300 left=300` → 100, `top=0 left=0`
    → 103, `top=400 left=100` → 112.

- **Round 4** — applied the two changes the probe found: `direction: down` on the `cluster`
  container, and `top: 200` / `left: 40` on `outside.stripe` with a comment saying the why is
  the column budget and that the numbers are measured rather than meaningful (the skill: "No
  coordinates unless a shape must be pinned; then `top` and `left` together, on that shape only,
  and a comment saying why"). **What told me to change it:** round 3's 146 plus the probe numbers
  above. `d2 fmt` leaves the file byte-identical (md5 equal before/after), `d2 validate` exit 0,
  `.txt` exit 0, `--ascii-mode standard` exit 0, `.svg` exit 0.
  Width after: **74** Unicode / **75** ASCII. Done condition holds; stopped with one round unspent.

  Read-back of the final render without looking at the `.d2` — `Customer browser` --HTTPS-->
  `CDN (cache)` --forwards--> `API gateway` --REST--> `orders (records)`; `orders` --sync-->
  `inventory (stock)` --counts--> `redis (counts)`; `orders` --writes--> `postgres` and
  `shipping (dispatch)` --reads--> `postgres`; `orders` --publish--> `broker (events)`, and the
  broker has **two separate arrows out**, --consume--> `billing (payment)` and --consume-->
  `shipping (dispatch)`, so the fan-out reads as one event to two consumers rather than a chain;
  `billing` --HTTPS--> `Stripe (cards)`. Nothing reaches `billing` or `shipping` from `orders`
  directly. That matches the brief.

## What I could not verify from the terminal render

- **Sync vs async is not visible in the `.txt` or the `.ascii.txt`.** `style.stroke-dash: 3`
  renders as an ordinary solid line in both text modes — I compared the `publish` / `consume`
  lines against the `sync` / `writes` lines character by character and they are identical. The
  only thing carrying the distinction in the terminal version is the edge *labels* I chose
  (`sync` vs `publish` / `consume`). The dashes do show correctly in the PNG/SVG, which is where
  I confirmed them. The skill's "Reading the terminal render" section lists five things the text
  render drops (edge-label spaces, `shape: text`, CJK padding, icons/images) and **not** this one.
- **Two boxes touch in the final render.** `shipping (dispatch)`'s right border and the
  `redis (counts)` cylinder share columns (`│shipping (dispatch) │              │       │` above
  `│                        │                    │redis (counts)│       │`). I cannot tell from
  the text render whether that is an overlap or just adjacency; the PNG shows them as separate,
  non-overlapping boxes, so I am treating it as a text-render artifact. Nothing in D2 reports
  box collisions — `vlmkit-anim layout` does this for the other tool and D2 has no equivalent.
- **The pin costs the SVG.** Optimizing for the 100-column text budget pinned `stripe` to the
  top-left of `outside`, so in the PNG the `outside world` container is a mostly-empty box about
  four times the height of its contents, and the `edge (ours)` container's own label is drawn
  *outside* its box, overflowing to the right. The text render is within budget and the picture
  is correct, but the two deliverables now want different layouts and I optimized only one.
