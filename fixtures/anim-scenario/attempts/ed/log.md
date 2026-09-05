# Log — ed — v11-distributed re-edit

## Expectations written before first `check`

- A's vector when it sends to B: `[2,0,0]` (two local events: `[0,0,0] -> [1,0,0] -> [2,0,0]`)
- B's vector after it receives from A: `max([0,0,0],[2,0,0]) = [2,0,0]`, then +1 own slot -> `[2,1,0]`
- C's final vector: C's own local event stays `[0,0,1]` (frozen readout unchanged), then C receives B's `[2,1,0]`:
  `max([0,0,1],[2,1,0]) = [2,1,1]`, then +1 own slot -> `[2,1,2]`
- Frozen `eventC` readout: unchanged, still `[0,0,1]`

## First `check` output

```
✓ scene.json (distributed): 0 error(s), 0 warning(s)
  5700ms · 11 steps (11 captioned) · 25 nodes · 25 tracks / 56 keyframes
  scene 1837 B → timeline 8204 B (×4.5)
```

**0 ✗, 0 ⚠ on the first run.** No iteration was needed — green in round 1.

## Rounds to green

1 (the first `check` run already passed).

## Final `explain` output

```
Vector clocks: causality without a global clock — 11 steps, 5700ms, 25 nodes
 1. [    0ms] Start: A, B and C each hold a vector [a,b,c] of counters, all zero · A = [0,0,0] · B = [0,0,0] · C = [0,0,0]
 2. [  540ms] A has a local event: it increments its own slot · A: [0,0,0] -> [1,0,0]
 3. [ 1080ms] A has a second local event before sending: it increments its own slot again · A: [1,0,0] -> [2,0,0]
 4. [ 1620ms] A sends its vector to B · B receives [2,0,0]: max([0,0,0],[2,0,0])=[2,0,0], then +1 own slot -> [2,1,0]
 5. [ 2220ms] Meanwhile, C has a local event of its own: it increments its own slot · C: [0,0,0] -> [0,0,1] · C's local event (frozen) = [0,0,1]
 6. [ 2760ms] B sends its vector to C · C receives [2,1,0]: max([0,0,1],[2,1,0])=[2,1,1], then +1 own slot -> [2,1,2]
 7. [ 3360ms] Concurrent: A's vector when it sent to B [2,0,0] and C's local event [0,0,1] - neither is <= the other
 8. [ 3900ms] A ∥ C: concurrent
 9. [ 4440ms] Ordered: A's vector [2,0,0] <= C's final vector [2,1,2] in every slot - A's send happened-before C's receive
10. [ 4980ms] A ≤ C: ordered
11. [ 5520ms] end
```

B ends `[2,1,0]`, C ends `[2,1,2]`, the frozen readout (step 5) stays `[0,0,1]` — matches the README's success line exactly.

## How I verified the final-frame criteria

`explain` alone doesn't prove which of the two `relate` shapes is actually
visible at the end (a replaced annotation is "faded out, not deleted" per
the guide, so it's still present in the DOM). I rendered the last step to
SVG (`vlmkit-anim render scene.json --step 11 --out final.svg`) and grepped
the two `relate-main-*` groups:

```
<g id="relate-main-0" ... opacity="0">      <!-- the ∥ line -->
  <tspan>∥</tspan>
<g id="relate-main-1" ...>                   <!-- no opacity attr = opacity 1 -->
  <path ... marker-end="url(#arrow-f59e0b)"/>
  <tspan>≤</tspan>
```

`relate-main-0` (the line, label `∥`) is `opacity="0"` at the final frame;
`relate-main-1` (the arrow, label `≤`, has an arrowhead marker) carries no
opacity override, i.e. it's fully visible. So the final frame shows the `≤`
arrow and not the `∥` line, as required. Both share the default id
`"main"` (I omitted `id` on both `relate` ops), so the second literally
replaced the first — the guide's own worked example for this exact
situation ("that is how to retire `A ∥ C` for `C ≤ A`").

## Friction (verbatim, unedited)

- Nothing forced a second `check` round, so I don't have failure-mode
  friction to report from the tool's error messages — the first attempt
  compiled clean. That itself is slightly suspicious as a signal: I'd have
  liked *some* confirmation from `check` itself that the two `relate` ops
  really do form a create-then-replace pair on the same anchor pair,
  rather than two independent, coincidentally-overlapping relations. The
  guide states the replace-by-omitted-id rule in prose ("an omitted `id` is
  `"main"` — so two `relate` ops that both omit `id` are the same
  relation, and the second replaces the first"), and I trusted that
  literally, but `check`'s summary line (`0 error(s), 0 warning(s)`) gives
  no positive evidence that this replacement actually happened versus, say,
  silently drawing two overlapping shapes. I had to fall back to reading
  raw SVG opacity attributes by hand to prove it — which is exactly the
  kind of thing `check` seems designed to make unnecessary for everything
  else (sorted order, heap shape, final vector values). A `check --verbose`
  or a stats line like "3 annotation ops → 2 live at end" would have let me
  skip the manual SVG round-trip.

- The guide never says explicitly whether a `note`'s own generated/explicit
  caption "counts" for the ⚠ "steps without captions" warning check when a
  following annotation op is folded into it with `ms: 0` versus given its
  own beat. I originally considered folding the `relate` ops into the
  preceding `note`'s beat with `ms: 0` (so the concurrency claim and its
  picture would appear in exactly the same beat), but the annotations
  section says an `ms: 0` annotation's caption is "joined to that beat's"
  — I couldn't tell from the prose whether an *explicit* caption on the
  folded op fully replaces the joined beat's caption or gets appended with
  " · " the same way two simultaneous messages do. Rather than guess wrong
  and end up with a mangled or duplicated caption, I gave the `relate` ops
  their own beats with their own short captions instead. It would have
  been useful for the guide to give one worked example of an annotation
  op with an *explicit* caption used with `ms: 0`, showing exactly what
  the resulting joined string looks like (the existing example, "best so
  far = 10", relies on the *generated* caption, not an explicit one).

- Minor: the anchors table for `distributed` just says "a node id, a
  message label" — it's never spelled out whether a `relate` between two
  *nodes* (as opposed to two messages, or a node and a message) draws
  between the node boxes at the top of the sequence diagram or between
  their lifelines at the current time position. I guessed "node boxes at
  the top" (matching the rendered SVG, which put the `relate` shapes near
  the top between A and C's header positions) and it happened to be right,
  but I only know that because I opened the SVG — the guide's prose alone
  didn't tell me where on a lifelines-over-time picture a same-instant
  "node to node" relation would land vertically.

- Everything else was unambiguous and worked exactly as documented on the
  first attempt: the `after`/causal timing model needing no changes at all
  for inserting a message-array item in the middle (I only added items,
  never reordered, and nothing downstream needed re-anchoring because
  every message already used `after`-free causal chaining implicitly via
  order); the note+value "existing style" pairing for a local event was
  trivial to mirror; and the one-per-id replace semantics for `relate`
  worked exactly as the guide's own `A ∥ C` → `C ≤ A` example promised.
