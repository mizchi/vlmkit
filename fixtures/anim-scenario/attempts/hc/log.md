# log: depgraph-import-cycle (attempt hc)

## Round 1

`scene.json`: 11 modules, 17 deps transcribed from the brief's import list, one
`sequence` step combining `highlight` (the three cycle edges) and `callout`
(naming the cut) in a single object.

```
pnpm exec vlmkit-anim check ... --expect ...
✗ sequence[0]: a step needs exactly one action key, found "highlight", "callout"
    → one of "show", "hide", "highlight", "unhighlight", "flow", "note", "relabel", "value", "callout", "snapshot", "group", "text", "relate", plus optional "caption" and "ms"
✗ 1 error(s): fix these before the semantic checks can run
```
`layout` gave the identical error (never reached the geometry pass).

Changed: split the one step into two — `{"highlight": [...], "caption": "..."}`
then `{"callout": {...}, "ms": 0}` so the callout folds into the same beat as
the highlight instead of sharing its object.

## Round 2

```
✓ scene.json (modules): 0 error(s), 8 warning(s)
⚠ nodes(callout-main-0-text): "...events should notify, not call back into handlers" runs 18px past the canvas edge at step 3
⚠ nodes(callout-main-0-text): "..." has a line through it (edge-1, 16px) / (edge-10,17px) / (edge-12,25px) / (edge-13,25px) / (edge-14,25px) / (edge-16,25px)
⚠ deps: dependency cycle: handlers → services → events → handlers
    → the layout cuts it at "events → handlers" ... keep it if the cycle is the point, else break it, or mark "forbidden"
facts depgraph-import-cycle.expect.json: 11 module(s) · 17 dependencies · 3 highlighted — all as drawn
```
`layout` (separate run): same 6 `crossed` + 1 `clipped`, `1 of 3 frames with layout issues`.

The `--expect` comparison already passed (0 errors on the facts) — the
remaining problems were all the callout's placement, not the graph's content.
Changed: shortened the callout text from "Cut events→handlers: events should
notify, not call back into handlers" to "Cut here: events should notify, not
call back", and set `"side": "right"` (was defaulting to `above`, which the
warning's own suggestion list offered first).

## Round 3

```
pnpm exec vlmkit-anim layout ...
0 of 3 frames with layout issues · 0 overlap(s) · 0 clipped · 0 crossed

pnpm exec vlmkit-anim check ... --expect ...
⚠ deps: dependency cycle: handlers → services → events → handlers
    → the layout cuts it at "events → handlers" ...
✓ scene.json (modules): 0 error(s), 1 warning(s)
facts depgraph-import-cycle.expect.json: 11 module(s) · 17 dependencies · 3 highlighted — all as drawn
```
Kept the cycle warning deliberately — the brief's whole point is the cycle;
"break it" or "forbidden" would remove the thing being shown. No changes made
this round beyond confirming; rendered `cycle.svg` with `still`.

```
pnpm exec vlmkit-anim still scene.json --out cycle.svg
still t=1260 → cycle.svg
```

3 rounds used of the 5-round budget.

---

## Summary

**1.** First `check --expect` run: **1 ✗, 0 ⚠**, and it never reached the
facts at all — a schema error ("a step needs exactly one action key")
aborted before the `--expect` comparison ran, so nothing in that first output
mentioned "the facts."

**2.** Rounds: (1) schema error — one sequence step had two action keys, fixed
by splitting into two steps; (2) facts matched (0 errors) but the callout was
clipped and crossed six edges, fixed by shortening the text and setting
`side: right`; (3) clean on both `check` and `layout`, rendered `cycle.svg`.

**3.** The facts told me nothing I hadn't already encoded from the brief's own
import list and its own naming of the three cycle edges — the line `facts
...: 11 module(s) · 17 dependencies · 3 highlighted — all as drawn` only
*confirmed* what I'd transcribed. I would still not have shipped without
running it: with 17 hand-transcribed edges from prose, `--expect` is the only
check that a digit or arrow direction wasn't flipped somewhere.

**4.** Confusing: nothing in `docs/anim-ir.md` states "one action key per
step" outright — the `array` example mixes `pointers` + `caption` in one op,
which reads as license to mix a step verb with an annotation op too. The
error message itself was clear and immediately actionable, though.

**5.** No hand-typed coordinates, colours, or canvas size — the layout and
default theme sized everything. The tool named the cycle
(`handlers → services → events → handlers`, cut at `events → handlers`)
*after* I had already picked those same three edges from the brief and fact
sheet — a confirmation, not a discovery, but it matched my own back-edge
choice exactly. Wanted but couldn't express: a visually louder callout
(bigger font / banner style) for "this is the problem" — `callout` is a
fixed-style text box, no emphasis knob beyond `side`.
