# d2-slides round 2 — "Diagrams that live in the repo"

## Round 1

Wrote `deck.md`: 7 slides (title, problem, what-D2-is with a 3-box figure,
TALA-and-licence with a 3-box engines figure, phantom-box figure with
`api{orders}` / `data{postgres}` / `api.orders -> data.postgres`, the loop as
a numbered list, closing). Built clean (`✓ ... 7 slides, 3 figure(s) laid out
by tala, 28 copy lines`, exit 0, empty stderr).

Ran all four page gates: all CLEAN / 0 failures / missing 0 on the first try.
Then checked the five required verbatim strings against `built/copy.txt`
myself (the brief requires this; no single gate does it), and one was
missing:

```
FOUND: Diagrams that live in the repo
FOUND: MPL-2.0
FOUND: not in the diff
MISSING: creates a new shape
FOUND: whiteboard-style
```

That is the line that made me change something. `grep -n shape built/copy.txt`
showed why:

```
20:shape, so the picture silently gains boxes
```

— the phrase existed but was split. `sed -n '15,22p' built/copy.txt` showed
the actual scramble:

```
A reference to an id that is not in scope does not error — D2 creates a new
The fix is always a full path from the root
shape, so the picture silently gains boxes
```

My source had that bullet's text soft-wrapped across two physical lines with
a 2-space continuation indent (ordinary Markdown style). The builder does not
reflow that continuation back onto its own bullet — it groups all bullets'
*first* physical lines together, then appends all the wrapped *continuation*
lines afterward, in a second pass. Ordinary Markdown readers treat this as
one paragraph; this builder does not.

## Round 2

Changed: rejoined that one bullet onto a single physical line. Rebuilt and
re-grepped — `creates a new shape` now found. But since I now suspected the
line-wrap behavior itself (not just that one instance), I inspected the full
`copy.txt` again rather than only the five target strings, and found the
*same* scramble on two more bullets I had also soft-wrapped (the "What D2 is"
bullet and one of the two TALA bullets) — e.g. before this fix, line 12 read
"...not a strict top-to-bottom" and line 14 (two lines later, after a
different bullet's first line) read "hierarchy". No gate flagged this —
copy/integrity/a11y all already passed with the scrambled text present, since
every individual fragment was still visibly on the page in *some* order, just
not the order I wrote it in. I fixed both by joining them to single lines too,
rebuilt, and reprinted `copy.txt` in full: all 23 lines now read in the order
I wrote them, no split bullets.

Re-ran everything from a clean build:

1. **Build**: exit 0, empty stderr (checked explicitly with stderr redirected
   to a file and `wc -l` = 0).
2. **`check integrity built/index.html`**: `verdict: CLEAN (0 fail, 0 warn, 0
   exempted)` at 1280/768/375.
   **`check integrity built/print.html --viewports 1280`**: `verdict: CLEAN
   (0 fail, 0 warn, 0 exempted)`.
3. **`check copy built/print.html --manifest built/copy.txt
   --allow-invisible unknown`**: `manifest: 23 line(s), missing 0`.
4. **`check a11y contrast built/print.html`**: `inspected 57 text-bearing
   element(s)` / `✓ 0 contrast failure(s)` — 57/7 slides ≈ 8.1 elements per
   slide, in the brief's "roughly ten or more" range (a touch under ten, but
   `index.html` for comparison inspects only 4, so print ≫ index confirms
   every slide was read, per the skill's own signal).
5. Required strings: all five `FOUND` in `built/copy.txt`.
6. **Fact sheets**:
   - `d2-facts.mjs --from-svg built/slide-04.svg --expect
     tala-talk-engines.facts.json` → `✓ box dagre`, `✓ box elk`, `✓ box tala`,
     3 warnings ("nothing connects to X" — expected, the sheet is not
     exhaustive and has no `deps`), **0 errors**, exit 0.
   - `d2-facts.mjs --from-svg built/slide-05.svg --expect
     tala-talk-phantom.facts.json` → all 4 boxes matched, `containers`
     matched (`api` holds `orders`, `data` holds `postgres`), the one edge
     matched with correct direction (`orders->postgres`), **0 errors**, exit
     0 — and since this sheet is `exhaustive: true`, this also proves my
     figure did not accidentally draw a phantom box itself.

Done condition fully met after round 2. Stopping here (2 of 4 rounds used).
