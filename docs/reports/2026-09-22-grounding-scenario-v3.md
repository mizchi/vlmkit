# grounding-scenario v3: the turn after the click, and a container the gate could not see (2026-09-22)

## Question

v1 and v2 measured one frame and one coordinate each. v2's report named the two
things that shape cannot reach, and v3 asks both:

- can an agent tell, from the **next** picture, that its click did what it meant?
- what happens to a target cut by an **inner scroll container** rather than by
  the page fold?

So v3 measures a loop. `act.mjs` takes a click or a wheel at a screenshot-px
point and returns the next screenshot; `score-flow.mjs` replays the session and
reads the DOM the actions produced — deliberately not the attempt's account of
them, since "did my click work" is the claim under test. The job: archive the
ticket titled *Payment webhook retries*, the 9th of 12 in a 218px scrollport,
with `Archive` between `Reply` and `Delete`.

Three arms: `f` (sonnet + tool), `g` (haiku + tool), `h` (control — pictures and
the harness, no tool).

## Result

| agent | arm | actions | goal | wrong ticket | deleted |
|---|---|---|---|---|---|
| f | sonnet + tool | 4 | ✓ | — | — |
| g | haiku + tool | 4 | ✓ | — | — |
| h | **control** | 4 | ✓ | — | — |

**All three identical.** On a flow task the gate's measurable contribution was
zero, where on v1's single-frame task it decided one task in each direction. The
optimum is 3; all three spent 4 because the list needed two wheels.

That is the honest headline, and the round's value is not in the column that did
not move. It is in what the three agents said about the one place the tool spoke
up — where it was wrong — and in what the arm **without** the tool said it had
been missing.

## G7 — a scroll-clipped target was reported as occluded by `html`

The gate called seven of the twelve tickets — the task's own target among them —

> `occluded-target: … a click there goes to html — and no point inside the box
> routes here, so nothing can click it until html moves or drops pointer-events.`

They were not occluded. They were scrolled out of their list. `inFrame` was
`true` because their boxes sit inside the 720px **viewport**, `visibleBox`
equalled `box`, and `elementFromPoint` answered `html` because that is what is
painted where the row is not. Visibility was computed against the frame and never
against the clipping ancestors.

`f` refused the line outright:

> "Nothing on this page ever moves `html` or drops its pointer-events — the
> actual fix is scrolling the list, which the harness supports (`wheel`) and the
> tool never names as an option. I acted on the screenshot instead, not that
> sentence."

`h`, which had no tool at all, wrote the specification for what should have been
there:

> "I had no way to know a ticket list even existed below the fold except by
> noticing 'Seat count mismatch' was visually clipped at the panel's bottom
> border in shot-00 — a layout inference, not a stated fact. And I had no count
> of total tickets or scroll position … A DOM-aware tool would have told me
> directly '12 tickets, scrolled to 4/12' instead of me inferring clipping from
> pixels."

And `g` is the one worth keeping for the file, because it looks like a success:

> "Critical warnings about occluded targets below the fold … This was invaluable
> for understanding that scrolling was needed before I could click the target
> ticket."

The sentence it read says nothing about scrolling. It says to move `html`. `g`
reached the right action from a message that states a different, impossible one —
the tool taking credit for a conclusion the agent supplied. A round that only
counted outcomes would have scored that as the tool working.

**Fixed in this commit.** The collector walks every clipping ancestor and
intersects, so `inFrame` now means *painted*, not *inside the viewport*:

- a target hidden by a container is **not a finding** — a list with more rows
  than fit is ordinary markup, and the hit test's answer there is meaningless;
- it carries `clippedBy` — the container, whether it **scrolls**, and how far
  (`dy` / `dx`, in screenshot px like every other number here);
- the report gains an *Out of the frame — scroll first, then re-run* block,
  grouped by container, which is `h`'s ask almost verbatim;
- a target only half inside its container is aimed at the half that is painted,
  which falls out of the same intersection.

`inbox.html` goes from `status: suspect` with seven false suspects to `status:
ok` with:

```
Out of the frame (8) — scroll first, then re-run:
  #list: hides 8 target(s) — scroll it (nearest needs 44px)
    t6 button "Cannot remove teammate Soylent · 8h" (dy 44px)
    …
    t10 button "Payment webhook retries Wayne Enterprises · 14h" (dy 166px)
```

A container that cannot scroll says so instead: `#locked: hides 1 target(s) — it
does not scroll — this content cannot be reached by scrolling`.

## G8 — the whole second half of the job is invisible to the map

Named, not fixed, because the fix is not small and the boundary should be stated
before it is crossed.

> "it measures the page as first loaded only, so Reply/Archive/Delete never
> appear anywhere in its output (grepped `--json` for all three, zero hits) even
> though they're the only way to finish the job — I had to locate the Archive
> button myself by sampling screenshot pixel colors (button borders at x229–264
> vs Delete's x270–301, 6px apart at the gap) with no tool support at all." (f)

> "after scrolling changes the page, the grounding map becomes stale." (g)

Both agents found `Archive` by eye, six pixels from `Delete` — exactly the
`crowded-target` risk the gate exists to name, on a control it could not see.
A gate that loads a URL cannot measure a screen that only exists after an
interaction. The two honest routes are re-running it after each action (which the
brief offers and no agent chose — worth knowing) or giving it a flow to drive
first, which is `verify flow`'s shape and a different change. Neither belongs in
this commit.

## What this round did not establish

The fix is correct and the false verdict is gone, but **no score moved**, because
every arm completed the job from pixels alone. This scenario's ceiling is four
actions and everyone reached it. A task that discriminates would have to make the
pixels insufficient — a list whose rows are visually alike, or a target whose
label is only in the a11y tree, so that knowing *which* row is 166px down is
worth something the picture cannot supply. That is what a v4 on this page should
change before running more agents against it.

## Files

- `fixtures/grounding-scenario/` — `inbox.html`, `act.mjs`, `score-flow.mjs`, `attempts/{f,g,h}/`
- `fixtures/grounding/scrolled-list.html` — the fix's own fixture, one scrollable container and one that is not
- `packages/vlmkit-markup/src/inspect/grounding-scan.ts`
- v1 / v2: `docs/reports/2026-09-21-grounding-scenario-v{1,2}.md`
