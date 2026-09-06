# log — modules-request-walk (agent fd)

## Kind chosen

`kind: modules`. The guide's own description matched the brief exactly:
"A module map for when the picture, not the motion, is the explanation...
Without a `sequence` it is a still figure... With a `sequence` it is walked
in beats like a `diagram`." One `scene.json` carries both deliverables:
`still` renders the final frame (map.svg) and `video` renders the walked
beats (walk.gif). **I did not want two files** — the still is simply the
animation's own last frame, which is also where the brief wants the async
hops marked ("End on the module map with the two asynchronous hops pointed
out"), so rendering `still` at its default (final frame, no `--step`) gives
exactly the annotated map the onboarding doc wants.

## First `check` (before any edits) — verbatim

```
✗ sequence[9].highlight[0]: unknown node "payments->queue"
    → did you mean "payments"? known nodes: "web", "gateway", "checkout", "inventory", "payments", "orders", "db", "queue", "frontend", "domain", "platform"
✗ sequence[9].highlight[1]: unknown node "orders->queue"
    → did you mean "orders"? known nodes: "web", "gateway", "checkout", "inventory", "payments", "orders", "db", "queue", "frontend", "domain", "platform"
✗ 2 error(s): fix these before the semantic checks can run
```

2 errors, 0 warnings on the first attempt.

## Rounds

- **Round 1** (above): `{"highlight": ["payments->queue", "orders->queue"]}`
  failed — `highlight` (the plain diagram/modules sequence op, not an
  annotation op) only resolves node/group ids, not edge anchors, even
  though edges are a documented anchor for this kind. See Friction below.
  Fix: dropped the `highlight` op entirely and let the two `callout`s
  (which *do* accept edge anchors) carry the marking, each getting its own
  caption instead of one shared with a folded highlight.
- **Round 2**: `vlmkit-anim check scene.json` → green:
  ```
  ✓ scene.json (modules): 0 error(s), 0 warning(s)
    7560ms · 12 steps (11 captioned) · 31 nodes · 17 tracks / 61 keyframes · annotations: 2 drawn, 2 on screen at the end
    scene 1843 B → timeline 9829 B (×5.3)
    next: vlmkit-anim explain scene.json · vlmkit-anim render scene.json --step N · vlmkit-anim html scene.json --out page.html
  ```

2 rounds to green (1 round of edits after the first failing check).

## `layout` result

```
0 of 12 frames with layout issues · 0 overlap(s) · 0 clipped
```

## Final `explain` output

```
Checkout request walk — 12 steps, 7560ms, 31 nodes
 1. [    0ms] Checkout request walk
 2. [  350ms] The request arrives at web and is routed to the gateway.
 3. [ 1050ms] The gateway forwards it to checkout, which orchestrates the rest.
 4. [ 1750ms] Checkout asks inventory to reserve stock.
 5. [ 2450ms] Inventory reserves the stock in db.
 6. [ 3150ms] Checkout asks payments to charge the card.
 7. [ 3850ms] Payments charges the card, then hands off to the queue asynchronously — checkout does not wait for this to land.
 8. [ 4550ms] Checkout asks orders to record the order.
 9. [ 5250ms] Orders writes the order to db.
10. [ 5950ms] Orders also enqueues an order-placed event, asynchronously.
11. [ 6650ms] Two hops run through the queue — the charge confirmation and the order event — both asynchronous. · These two async hops are what make checkout eventually — not immediately — consistent.
12. [ 7350ms] (end)
```

## Deliverables

- `still scene.json --out map.svg` → `still t=7560 → map.svg` (no browser
  needed for SVG).
- `video scene.json --out walk.gif --width 480` → `gif (153 frames, 12850ms,
  480×430, 1691 KB) → walk.gif` — ran with `PLAYWRIGHT_BROWSERS_PATH` set as
  instructed, though the in-process GIF encoder turned out not to need a
  browser at all (no Chromium-download step happened; still set the env var
  per the task instructions in case it did).
- Read `map.svg` back: 8 module rects (web, gateway, checkout, inventory,
  payments, orders, db, queue), 3 group rects (frontend, domain, platform),
  9 edge arrows, and both `callout-async-*` groups (box + text + arrow) with
  no visible overlap of the callout boxes with any node or group rect —
  confirms the `layout` command's "0 overlap(s)" by eye.

## Every coordinate / colour / canvas size written by hand

**None.** No `pos`, no `canvas`, no `theme`/colour override anywhere in
`scene.json` — the whole file is ids, dep pairs, group membership, and
caption strings. `modules` lays itself out from the dependency graph
(layers) and group membership (bands), which is precisely the point of the
kind: I never had to reason about where anything sits on the canvas.

## Anything wanted in the figure and could not express

- **Per-edge visual styling for "this hop is async."** `deps` (and
  `edges`-as-drawn) only take `style: "arrow" | "line"` — there is no dashed
  / async / weight variant. I wanted the two async edges (`payments→queue`,
  `orders→queue`) to simply *look* different (e.g. a dashed stroke) the way
  a sequence diagram distinguishes sync/async arrows. Instead I had to
  attach a `callout` pointing at each edge and say "async" in text, which
  works but is a label glued on rather than a property of the edge itself.
- Related to the point above: I would have liked to `group` the two async
  edges together with one shared label ("eventually consistent") instead of
  two separate callouts with near-duplicate text, but `group`'s anchor is a
  bounding box around the anchors, and the two edges (`payments→queue`,
  `orders→queue`) are not adjacent in the final layout — a box around both
  would have enclosed `orders→db` and the `orders`/`payments`/`db` nodes as
  bystanders, which the guide explicitly says `group` must not do ("never
  encloses a bystander"). Used two `callout`s instead, per the guide's own
  suggestion ("Where `group` would enclose a bystander, `relate` names the
  pair") — though `relate` draws a line *between* two anchors, which isn't
  quite "this whole edge is async" either; there's no clean single-id
  annotation for "these two, plus a shared caption" as would be enclosed
  by `group`. Two `callout`s was the closest fit and is fine.

## Friction (verbatim, most important)

1. **The "Anchors by kind" table is ambiguous about which ops it governs,
   and I paid for the ambiguity with a failed `check` round.** The table
   says `diagram | a node id, an edge "a->b"` and the `modules` section
   says its `sequence` reuses "the `diagram` steps — `show`, `hide`,
   `highlight`, `unhighlight`, `flow "a->b"`, `note`, `relabel` — **and every
   annotation op**." Reading that, I assumed `highlight` — a step explicitly
   named right there in the same sentence as the annotation ops, right next
   to the anchors table that lists edges for this kind — could target an
   edge. It cannot: `{"highlight": ["payments->queue", "orders->queue"]}`
   failed with `unknown node "payments->queue"` — treating it as a **node**
   lookup, not the more general "anchor" lookup that `callout`/`group`/
   `relate` use. The guide never states outright "`highlight`/`unhighlight`
   on `diagram`/`modules` only accept node or group ids; only the six
   *annotation* ops accept the full anchor set including edges" — that
   sentence would have saved the round. As written, the prose reads as if
   `highlight` and the annotation ops share one anchor vocabulary for this
   kind, and they don't.
2. Smaller: the error message itself was good (`did you mean "payments"?`)
   but it silently narrowed my two-token edge string down to its first
   token and matched *that*, which is a reasonable heuristic but on first
   read I misparsed it as "your edge string has a typo" rather than "this
   op doesn't accept edges at all" — a message like `highlight targets a
   node or group, not an edge — use callout/group/relate for edges` would
   have named the actual constraint instead of the closest string match.
3. Everything else was smooth: `check`'s stats line, `layout`'s single
   summary line, and `explain`'s numbered narration all matched the guide's
   description exactly, and the `modules` auto-layout (layers from deps,
   bands from groups) produced a clean, non-overlapping picture on the
   first structurally-valid attempt with zero hand-placed coordinates.

## Brief-vs-input note (not tool friction, just recording it)

The brief's success section says "the still shows all eight modules, all
**ten** dependencies and the three groups," but the "Dependencies:" list
just above it enumerates exactly **nine** pairs (`web→gateway`,
`gateway→checkout`, `checkout→inventory`, `checkout→payments`,
`checkout→orders`, `inventory→db`, `orders→db`, `orders→queue`,
`payments→queue`). I implemented the nine pairs as literally listed (and
`map.svg` has 9 edge arrows) rather than inventing a tenth dependency to
match the "ten" count, since the explicit list is the more specific and
unambiguous of the two sources.
