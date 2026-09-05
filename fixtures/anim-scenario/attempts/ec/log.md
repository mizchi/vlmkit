# Re-edit log — agent `ec` — vector-clock-relate (v11)

## Expectations, written before the first `check`

A's vector after receiving C's `[0,0,1]`: elementwise max of A's current
`[1,0,0]` and C's `[0,0,1]` gives `[1,0,1]` (only column `c` changes, since
C's row is zero everywhere except `c`), then A increments its own slot
(column `a`) → **`[2,0,1]`**. This is what the README already states as the
requirement, so this was a sanity check on my own arithmetic before touching
the file, not a prediction of tool behavior.

Plan: mirror B's existing receive pattern exactly — one `set` with `from`
copying the one cell that actually changes (not a rewrite of the whole row),
plus (since the requirement explicitly wants the self-increment *visible* in
the final cells, unlike B's row where the "+1" in the caption is never
actually reflected in B's cells) a second, separate `set` for A's own-slot
increment. Then update the `vA` value in place with `ms: 0` so its caption
joins the increment beat. Then add a new `relate` op with the *same default
id* as the existing `A ∥ C` relate (both omit `id`, so they collide on
`"main"`) so it replaces the old line rather than sitting beside it. Kept the
trailing `text` code block last — no reason to move it.

## First `check` — exact output

```
✓ scene.json (matrix): 0 error(s), 0 warning(s)
  7200ms · 13 steps (12 captioned) · 40 nodes · 29 tracks / 77 keyframes
  scene 1200 B → timeline 10675 B (×8.9)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/ec/scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/ec/scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/ec/scene.json --out page.html
```

**0 ✗, 0 ⚠ — green on the first run.** No iteration was needed.

## Rounds to green

1 (the first edit + first check already passed).

## Final `explain` output

```
Vector clocks — 13 steps, 7200ms, 40 nodes
 1. [    0ms] Vector clocks
 2. [  360ms] A: local event · A = [1,0,0]
 3. [  960ms] C before
 4. [ 1560ms] B receives: max, then +1
 5. [ 2160ms] copied from A
 6. [ 2760ms] C: local event, no message from anyone
 7. [ 3360ms] A and C never exchanged a message: concurrent
 8. [ 3960ms] ordered
 9. [ 4560ms] C sends [0,0,1] to A: max(A, C), c: 0 → 1
10. [ 5160ms] A increments its own slot: a: 1 → 2 · A = [2,0,1]
11. [ 5760ms] C's event happened-before A's receive: C ≤ A
12. [ 6360ms]   clock = max(clock, v)
13. [ 6960ms] (end)
```

`A = [2,0,1]` appears at step 10 (joined via the `ms:0` value update), and a
caption containing `≤` appears at step 11 — both matching the README's
success criteria verbatim.

## How I verified the final-frame criteria

Ran `vlmkit-anim render scene.json --step 13 --out final.svg` (step 13 is the
last step / `(end)`) and read the SVG text directly:

- `grep`'d for `∥` and `≤` in the output. Both strings are present as text
  nodes — but the `∥` one (`id="relate-main-2-label"`) carries
  `opacity="0"`, while the `≤` one (`id="relate-main-4-label"`) has no
  opacity attribute (i.e. fully visible). So the old relation is in the DOM
  (as the compiler keeps a fade-out track) but **not visible** at this frame
  — satisfies "no `∥` line" as a rendered/visual criterion.
- Read the three `cell-0-*` groups for row A: `cell-0-0` → `2`, `cell-0-1` →
  `0`, `cell-0-2` → `1`. Matches `2, 0, 1`.
- Read `value-vA` → `[2,0,1]`, matching the readout requirement (updated in
  place, same id, confirmed by there being exactly one `id="value-vA"` node
  rather than a second `vA`-suffixed one).
- Confirmed exactly one visible relate arrow (`relate-main-4`, full opacity,
  label `C ≤ A`) and the `ordered` `group-main-3` outline around A/B is
  still present and unaffected.

## Friction (verbatim, unsoftened)

- **The guide never says what the *default* `id` is for `callout` / `group`
  / `relate` when you omit it**, only that "one per id" and gives the string
  `"main"` once, in an example (`callout: {"id": "main"}` used explicitly, not
  as a stated default). I had to *infer*, by reading the compiled SVG output
  after my edit, that omitting `id` on `relate` resolves to `"main"` and that
  two relate ops with both omitted ids collide and the second one wins. This
  worked out for me and produced exactly the effect the README wanted (silent
  in-place replacement), but I was not at all sure it would before running
  `check` — the guide's "One per id, like callout" line assumes the reader
  already knows callout's default, which itself is never spelled out as a
  rule ("the default id, when omitted, is `\"main\"`"), only demonstrated in
  one example. This is a *guess I got lucky on*, not something the doc let me
  verify ahead of time by reading alone.

- **Whether the old, now-invisible `A ∥ C` relate would actually satisfy "no
  `∥` line" was not something I could determine from the guide at all.** The
  annotation section describes `relate: null` as removing every relation and
  a same-id op as replacing it, but never says *how* a replaced/removed
  annotation is rendered at previous vs. current steps — is it deleted from
  the frame, or faded to invisible and left in the DOM? I only found out by
  rendering the SVG and noticing the `opacity="0"` attribute on the old
  label. If the README's grading were done by literal text search over the
  SVG (rather than by opacity-aware rendering), a naive check for "no ∥
  string anywhere in the frame" would have failed my scene even though it is
  visually correct. The guide should say explicitly that a replaced/removed
  annotation is faded out and remains in markup, not deleted, so a writer
  knows what "gone" means for the success criteria and doesn't have to
  reverse-engineer it from the SVG.

- **The B-receive pattern I was told to imitate is inconsistent with real
  vector-clock semantics, and the guide doesn't warn about that.** B's
  existing `set` op is captioned "B receives: max, then +1" but its cells
  never actually show a `+1` on B's own slot (`cell-1-1` stays `0` in the
  original file) — the caption promises something the data doesn't do. The
  README's own change request for A explicitly *does* require the increment
  to show up in the final cells (`2, 0, 1`, not `1, 0, 1`), which is only
  consistent with the *caption* of B's receive, not with what B's cells
  actually contain. I had to notice this contradiction myself by tracing the
  existing `cells`/`ops` by hand; the guide's `matrix` section doesn't warn
  that a `set`'s caption is free text disconnected from what the op actually
  writes, so a caption can silently lie about what happened. That's worth a
  line in the matrix section: "the caption is not checked against the op's
  effect; write one only for what this beat's `value`/`from` actually
  changes."

- **Minor:** the guide states `ms` for `matrix` ops as "each may carry
  caption, ms" without repeating, in the matrix section itself, which ops
  the free "no step of its own" merge rule from the top-of-doc list (`value`,
  `callout`, `snapshot`, `group`, `text`, `relate`, i.e. annotation ops) 
  actually applies to for *this* kind. I had to go back to the shared
  preamble (line ~51) to confirm `set` was *not* on that list and would
  always be its own beat, which was correct, but the matrix-specific table
  doesn't repeat or link that fact locally — a reader skimming just the
  `kind: matrix` section could easily assume `ms: 0` merges a `set` for free
  the same way it does for `highlight`/`mark`.

- Everything else — anchors (`row:C`, `row:A`), the `from` token-flight
  semantics for `set`, the `value` id-based update-in-place, and the
  `relate` `label`/`style` fields — matched the guide's description exactly
  and needed no guessing. `check` passing cleanly on the very first attempt
  is the strongest evidence of that.
