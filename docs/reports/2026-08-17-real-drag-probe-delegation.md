# The real-drag probe called a working board inert — 2026-08-17

Follow-up to [2026-08-16](./2026-08-16-dogfood-solitaire-dnd-animation.md), which fixed the three
drag rules on `examples/solitaire` and concluded "the answer to *can vlmkit handle drag and drop*
is now yes". That was true of the **dispatched** probe. The **driven** one — `--probe-drag`'s real
mouse gesture, 0.11's headline feature — was still delegation-blind, and it said the opposite about
the same page.

## The contradiction

```
$ vlmkit scan handlers "file://…/examples/solitaire/index.html?seed=1&animate=0" --probe-drag

HTML5 drag gesture (real mouse input):
  - main#table: no dragstart, tried 1 target(s) — started no drag
      route: dragstart@main#table>div#tableau>div.slot>div.card → dragenter@…>span.center-pip
             dragover@…>span.center-pip x7 (NOT prevented — the drop is refused here)
             dragleave@… → dragend@main#table>div#tableau>div.slot>div.card
```

The verdict says no dragstart. The route printed under it, from the same log, opens with a
dragstart. And the page's own harness wins a game through real `page.dragAndDrop` calls:

```
$ node examples/solitaire/playthrough.mjs --solve --seed 7 --gestures
1 seed(s), draw 1, real gestures
  won    1
```

Three statements about one page, two of which cannot both be right.

## Root cause

`probeRealDrags` pressed the element that HOLDS the `dragstart` handler and credited the drag only
when the recorded dragstart's path **equalled** that element's path
(`handler-map.ts`, `if (r.path === src.path) row.dragstartFired = true`).

Neither half survives delegation, which is how every drag board is written — one handler on the
container, `event.target.closest(".card")` inside it, because the container rebuilds its children
on every move:

- The container is **not draggable and never needs to be**, so the browser starts a drag only on
  one of its descendants. The recorded dragstart therefore never carries the container's path, and
  an exact check files it under `startedOn` ("some other element was picked up instead").
- The container is also the **only entry with `dragover`/`drop`**, so the declared-target list aims
  the gesture back at the card it just picked up. Every board refuses a card onto its own pile —
  correctly — and the refusal reads as a broken drop target. Measured: the press point and the aim
  point were the same coordinate, i.e. a drag in place.

`PROBE_DRAG_SCRIPT` had already been taught all of this on 2026-08-16 (`sourceFor` / `sourcesFor` /
`targetsFor`, with comments naming this page). The driven probe had not, and nothing in the suite
covered source-side delegation: every fixture put `dragstart` on the draggable element itself.

**The false verdict was the visible part; the silent part was worse.** Everything gated on
`dragstartFired` was skipped for every delegated page — the drop (`droppedOn`), the remaining
destinations, and the Escape-cancel gesture. So `drag-source-detached-mid-drag` and the
cancel-restore finding could not fire on a board at all, and a second gesture was spent retrying
a press that could never work.

No rule *reported* the board: `drag-source-inert` is suppressed for `draggable === false` and
`drag-source-not-draggable` has the delegation exemption from the last round. The failure mode was
a red row in the report plus a hole in the coverage, not a false finding.

## The fix

`DRAG_PLAN_SCRIPT` resolves, per source entry, **where to press and where to aim** — the same
policy as the dispatched probe, for coordinates instead of dispatch targets:

- press candidates: the entry itself when it is draggable, otherwise its first 3 draggable
  descendants. Three because which card has a legal destination is page state the probe cannot
  read; solitaire's first draggable in a given deal is regularly a card with nowhere to go.
- aims: the containers of the *other* draggables (a board's sibling piles), then childless,
  textless, ≥16px descendants (an empty pile holds no draggable to be found by). Never the entry
  itself, never the source's own container.

Two details that were not optional:

- **Identity, not paths, decides whether a drag is this entry's.** `describe()` stops at four
  segments and carries no positional index, so a card moved from one pile to another comes back
  under a different path — and the probe's own drop handler does exactly that. The first version
  compared paths and filed the second gesture's dragstart as a foreign drag. The recorder now marks
  each `dragstart` with `fromEntry`, computed in the page as
  `window.__vlmkitDragEntry.contains(event.target)`: the condition under which the entry's listener
  actually receives it. `dragstartFired` means that, and its doc comment now says so.
- **Each candidate against each of its destinations**, not one destination per candidate. On the
  seed-1 deal the only legal move among the first three cards is the SECOND card onto the FOURTH
  pile; one aim per card reported a board that refuses everything. Attempts re-read the press box
  each time, because a landed drop moves the card.

`fixtures/handlers/drag-delegated.html` is the shape the suite was missing. Two boards, because the
defect has two faces and one geometry cannot show both: `#board`'s centre falls in the gutter
between its rows (pressing the container starts nothing at all) and `#lucky`'s centre falls on a
card (the press starts a drag that gets credited to the wrong element — the face solitaire shows).
Both must end with the card on a different pile.

### Before / after, same page and seed

| | before | after |
|---|---|---|
| `dragstartFired` | `false` | `true` |
| `pressedOn` | — | `main#table>…>div.card` |
| destinations tried | 1 (the container itself) | 8 |
| `droppedOn` | absent | a real drop, `text/plain={"zone":"tableau","index":1,"cardIndex":1}` |
| Escape-cancel | never measured | measured — reverted cleanly |
| gestures | 2 (one of them a wasted retry) | 9 |

## What the fix exposed: a capped search reported as an exhausted one

With the drop now landing for real, the page the **dispatched** probe measures afterwards is a
board a few moves in — `probeRealDrags` deliberately runs first, on the least-perturbed page, and
it now perturbs it. In that position `dragover-not-prevented` fired on `main#table`.

That finding was unearned, and not only because of the mutation: `dragoverPairsTried: 40`,
`dragoverCapped: true`. The rule's claim is about *every* source/target pair, and a handler that
cancels only for a legal move — every board's — is exactly what hides in the untried remainder. The
page had been passing because a legal pair happened to sit inside the first 40 pairs of a fresh
deal. A lucky measurement, which is the same class of unearned verdict this codebase already
refuses for a zero-gesture drag row.

Two changes, both about the premise rather than the symptom:

- the pair cap is **96 = 8 sources × 12 targets**, the product of the two per-side caps, so within
  them the search is exhaustive;
- `dragover-not-prevented` **stands down when `dragoverCapped` is set**. Dead code at the current
  caps and load-bearing the moment either moves; a unit test pins both directions.

## Verified across six deals, not one

Fixing the page you were staring at is not evidence, so the probe was run on solitaire seeds 1-6.
The legal moves per deal come from `rules.js` itself, which is how "the probe missed one" is told
apart from "there was nothing to find".

| seed | drag starts | drop lands | destinations tried | legal move reachable from the pressed cards |
|---|---|---|---|---|
| 1 | yes | **yes** | 10 | `t1→t4` |
| 2 | yes | no | 18 | none — the deal's only move is `t6→foundation`, and t6 is the 7th card |
| 3 | yes | no | 18 | none — its moves start at t3 and t4 |
| 4 | yes | **yes** | 6 | `t0→foundation`, an Ace onto an empty pile |
| 5 | yes | no | 18 | `t1→t5` — **reachable and missed**, see below |
| 6 | yes | **yes** | 2 | `t0→t2` |

**`dragstartFired` is true on all six**, which is the defect this started from: it was false on all
six before. No seed produces a false finding; every one reports the single legitimate
`unprobed-handler-types` warn, as on 2026-08-16.

**The drop lands on three of six**, up from zero. Two of the three misses are the honest answer —
those deals have no legal move from any of the three cards the probe presses, and the row says "no
target accepted it", which is printed and deliberately not graded. Seed 5's is a real miss: the
destination it needs is the fifth sibling pile, and the aim list holds six entries of which two are
reserved for empty piles. Widening either cap far enough to catch it spends the 24-gesture per-page
budget, and seeds 2 and 3 stay out of reach at any cap because their legal source is the fourth card
or later. **Blind search with a gesture budget cannot be made complete here**; the cheap way past it
is to pick the pair with a dispatch-only dragover sweep (in-page, no mutation, ~100 pairs for the
cost of one `evaluate`) and then drive one real gesture at the pair that cancelled. Not built.

Numbers behind the caps, since all three were arrived at by measurement rather than taste:

| aims per press | reserved for empty piles | seeds landing a drop | worst-case gestures |
|---|---|---|---|
| 4 | 0 | 2 | 13 |
| 6 | 0 | 3 (1, 5, 6) | 19 |
| 6 | 2, first version | 2 | 19 |
| 6 | 2, shape-matched | **3 (1, 4, 6)** | 19 |

### A face-down card is not an empty pile

The row above that got *worse* is the finding worth keeping. Reserving two aim slots for empty piles
was right; recognising them as "childless, textless, at least 16px" was not — **a face-down card
satisfies every clause**. On solitaire the stock's backs come first in document order, so both
reserved slots went to a card back and the empty waste, and the four foundations — where seed 4's
only legal move goes — were never aimed at.

An empty pile is recognised by *looking like the occupied piles* instead (same tag + first class as
the holders of the draggables). The shape set is learned from every holder including the source's
own, which the first version excluded: a board with one card then had nothing to learn from and lost
its only destination. `fixtures/handlers/drag-delegated.html` carries a `#pile-back` holding a
face-down card for exactly this, and the test asserts every destination aimed at is pile-shaped.

## Verified

- `packages/vlmkit-markup`: 1150 tests pass, including the new delegation E2E and the capped-search
  unit test.
- `fixtures/handlers/drag-and-drop.html` reports the same issues as before (the direct-source path
  is byte-identical: one press candidate, aims = the declared targets).
- Whole repo: 267 files / 3393 tests. Two tests in `vlmkit-ai/src/vlm-client.test.ts` fail on a
  machine that has `OPENROUTER_API_KEY` exported — they assert the missing-key rejection and the
  client finds the ambient key. Pre-existing, environmental, green in CI and under `env -u`.

## Also fixed: a test that failed on how deep the clone sits

`E2E: the drop payload is read at the drop` asserted the dropped `text/plain` matched
`/^file:.*drag-and-drop\.html#x$/`. The recorder truncates every received value at 80 characters,
and `file://` + this checkout's absolute path + `#x` is 84 — so the test failed on a clean tree
here, and passes in a shallower directory. It asserts a prefix now. Pre-existing, unrelated to the
above, and worth naming: a test whose result depends on the checkout path is not measuring the
thing it claims to.

## Carried forward

**A probe that drives real input mutates the page, and every measurement after it sees the
mutation.** The ordering comment in `buildHandlerSurface` already knew this about the surface
inventory ("after the surface, so a probe that mutates the page cannot change what was
inventoried") but not about the probes' own inputs — the dispatched drag probe reads a board the
driven one has already played. Raising the pair cap makes the current pages exhaustive, and the
`dragoverCapped` guard makes the failure honest rather than silent, but the coupling is still
there. If a third drag probe lands, the answer is a fresh page per probe, the way `probeTouches`
already takes one.
