# log — order-events.d2 (writer e)

- **Round 1** — wrote the sheet's 11 boxes, 3 containers and 11 edges from scratch; cross-container
  connections at the root (`browser -> edge.cdn`, `edge.gateway -> cluster.orders`,
  `cluster.billing -> outside.stripe`), intra-cluster ones inside `cluster`; `direction: right` at the
  root. `fmt --check` 0, `validate` 0, facts: all 32 box/edge/container assertions ✓, single error
  `✗ the terminal render is 196 columns, the sheet allows 100`. Width after round: **196**.
- **Round 2** — the only thing left to fix was width, so I took the skill's first width lever
  ("the **own `direction` of the container holding the most boxes** — that is the first thing to try,
  not the last") and added `direction: down` inside `cluster` (7 of the 11 boxes). Nothing else changed.
  Facts: `✓ width 95 ≤ 100 columns`, `33 ok, 0 warning(s), 0 error(s) · 95 columns · 11 edges drawn`
  → exit 0. Rendered the PNG and read it: labels, the `queue` broker, both `cylinder` stores and the
  `cloud` Stripe all read correctly, no crowding. Width after round: **95**.
- **Round 3** — probe, not a fix. The terminal render puts the `HTTPS` label of
  `billing -> stripe` *on the cluster's bottom border* (`└───────HTTPS────────┘`), the exact defect the
  skill names ("An edge label can land on a box or container border … shorten the label or move the
  connection to the root"). The connection was already at the root, so I tested the other half of the
  advice by lengthening the label to `charges card over HTTPS`: it landed on the same border row and
  ate 21 border characters instead of 5, and the width did not move (95 → 95). So label length does not
  move a container-crossing label off the border — the placement is positional. Width after round: **95**.
- **Round 4** — reverted the label to `HTTPS` (same collision, less border consumed) with a comment
  recording the probe, and regenerated all four renders. `fmt --check` 0, `validate` 0,
  `d2-facts --expect` 0 (`33 ok, 0 warning(s), 0 error(s) · 95 columns`), `.txt` / `.ascii.txt` /
  `.svg` / `.png` all exit 0, `LC_ALL=C.UTF-8 wc -L` = 95 on both text renders. Width after round: **95**.

Round 5 not used.
