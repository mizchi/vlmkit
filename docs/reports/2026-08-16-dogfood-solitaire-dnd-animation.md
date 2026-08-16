# Dogfood: building a solitaire to test the DnD and animation gates

Date: 2026-08-16
Target: `examples/solitaire/` — Klondike, the Windows `sol.exe` layout, written for this purpose
Ask: verify the toolkit can handle drag-and-drop and animation, by building something that has both.

## Why a game, and why this one

The previous rounds pointed gates at other people's pages (vite.dev, Bootstrap's dashboard).
Those are static documents: a pixel diff sees almost everything that matters about them. **Drag
and drop and animation are the two things a screenshot cannot see at all** — a still frame says
nothing about whether a card can be dragged onto a legal pile, and a frame taken during a deal
is different every run.

Klondike is the right shape for it. Fifty-two elements that are created and destroyed on every
move, a drop target whose legality depends on game rules rather than on a CSS class, four
distinct animations, and — being solitaire — a well-known correct behaviour to compare against.

The build is `rules.js` (pure, 31 tests, no browser) + `game.js` (DOM/DnD/animation, 19 tests in
Chromium). Full detail in `examples/solitaire/README.md`; this report is about what the toolkit
did with it.

## Result: two gates work well, three findings are false positives

| gate | verdict |
|---|---|
| `check animation` | **works well.** Found all 8 deal animations, `settle: 962ms`, `reduced-motion: honored`, no issues |
| `check interactions` | **works well.** Probed 13 controls, found 1 true positive (`inert-control`) |
| `check a11y focus` / `check a11y touch` | clean, correctly |
| `scan handlers --probe-drag` | **3 of 4 issues are false positives** — event delegation |
| `check a11y contrast` | **9 false positives** — assumes white behind a gradient |
| `check integrity` | **1 false positive** — measured a frame mid-animation |

So the answer to "can it handle DnD and animation" splits: **animation, yes** — `check animation`
is the strongest gate in this round, and its settle measurement is the thing the other gates
turn out to need. **Drag and drop, not yet** — the drag rules assume a shape that a real board
does not have.

## Finding 1 — the drag probe cannot see event delegation

Three issues, all wrong:

```
suspect [dragover-not-prevented]      main#table has a dragover handler that does not call preventDefault()
suspect [drag-source-not-draggable]   main#table has a dragstart handler but is not draggable
warn    [dragstart-transfers-nothing] ran its dragstart handler and left the DataTransfer empty
```

The page attaches `dragstart` / `dragover` / `drop` / `dragend` once, to the container, and
addresses cards through `event.target.closest(...)`. That is not an exotic choice — with 52
children replaced on every move, per-element listeners would mean re-binding the board each
time. Every one of the three rules reads **the element the handler sits on** instead of the
elements it delegates for:

- **`drag-source-not-draggable`** is a pure category error under delegation: the container is
  never draggable and never needs to be.
- **`dragstart-transfers-nothing`** dispatched a synthetic dragstart at the container, where the
  handler's `closest('.card[draggable="true"]')` guard correctly returns early — so the probe
  measured a dragstart that was not for a card and concluded the payload was empty. A real
  dragstart calls `setData`; `game.test.mjs` asserts the payload contains `"zone":"tableau"`.
- **`dragover-not-prevented`** is the subtle one and the most interesting. The handler *does*
  `preventDefault`, but **only when the rules accept the move** — which is the entire mechanism,
  and the only way for a drop target to refuse honestly. The probe's route shows it dragged the
  card onto its own pile:

  ```
  dragstart@…div.card → dragover@…div.card>span.center-pip x7 (NOT prevented — the drop is refused here)
  ```

  Refusing that is correct. The rule cannot distinguish "never prevents" from "correctly refused
  *this* target", because it only ever tries one.

**The fix is not one rule.** `dragover-not-prevented` needs to try a target the page would
accept before concluding anything, and the other two need to resolve a delegated handler to the
elements it serves (the gate already computes a delegation container — it prints
`(delegation container)` in the inventory — so the information is there and unused).

Evidence the page is right: 19 browser tests, including `page.dragAndDrop` moving the J♥ onto
the Q♠, uncovering the 6♣, and incrementing the move counter; an illegal drop that changes
nothing; and dispatched `DragEvent`s showing the legal target lighting green while the illegal
one lights red.

## Finding 2 — `check a11y contrast` reports the opposite of the truth on a gradient

```
✗ 9 contrast failure(s)
  header.toolbar>h1 — 1.08:1 (need 4.5) — `#f2f7f2` on `#ffffff` — "Klondike Solitaire"
```

The toolbar is `rgba(0,0,0,0.28)` over a green radial gradient. The text is near-white on
near-black. The gate could not resolve the composite background, fell back to `#ffffff`, and
reported 1.08:1 — not a near-miss but an inversion.

`check integrity` gets the same page right, and prints its reasoning:

```
- [low-contrast-text] (page): 17 text block(s) skipped: background-image/gradient in the stack
  — composite-background contrast is not deterministically measurable (Layer B territory)
```

**The exemption exists in the toolkit. The gate whose whole subject is contrast does not have
it.** This is the third time in this session that two gates have disagreed about one page with
the specialist being wrong — the same shape as the dedup defect fixed in 0.11.0, where
`check a11y contrast` reported 0 failures on a page with 11 while `check integrity` reported
them correctly. The lesson is not about contrast; it is that `check integrity` has accumulated
judgement its single-purpose siblings do not share.

## Finding 3 — `check integrity` measures whatever frame it happens to catch

Pointed at the page as a player would load it:

```
verdict: NO DEFECTS, 1 WARN
! [low-contrast-text] …>span @1280: rgb(213,75,97) on rgb(253,253,251) is contrast 4.12:1 — below the 4.5:1 floor
```

The card red is `#c8102e`, which is **5.8:1** on the card face and passes. `rgb(213,75,97)` is
that red at `opacity: 0.2` composited onto felt — a card **in mid-flight during the deal**. With
the animation off the same gate says `verdict: CLEAN`.

The gate's settle is network-idle + `fonts.ready` + 250ms. The deal is ~960ms. So the reading is
not marginal, it is a different page — and the finding arrives with a selector, so a reader goes
looking for a colour bug that does not exist.

Worth noting precisely because the toolkit already solves this: `check animation` **measured the
settle at 962ms**. The capability is one module away from the gate that needs it. Candidate
fixes, in increasing order of ambition: a `--wait-for <selector>` on the measurement gates; the
gates injecting `animation: none` while measuring (as `check a11y touch` already injects
`transition: none`); or reusing `check animation`'s settle detector so any gate can wait for the
page to stop moving.

That last one is the one worth doing. "Measure the page once it has stopped changing" is what
every one of these gates means to do.

## What building it also found

Nine defects in the page, none of them visible in a screenshot, which is the other half of the
point. Full table in `examples/solitaire/README.md`; the two that generalise:

- **The documented keyboard flow was unreachable.** The hint says "Tab to a pile" and the piles
  had no `tabindex` at all. Caught by a browser test, invisible to every gate — including
  `check a11y focus`, which walks the tab order and reported 0 findings because the *cards* were
  reachable. A gate that checks the tab order it finds cannot check the tab order the page
  claims to have.
- **The table's `keydown` swallowed a native button's activation.** `preventDefault` on Enter
  over any descendant meant the keyboard could pick cards up but could not deal. `check
  interactions` probes Enter per control and would have caught it — it was fixed by a test first.

## Fixed since

**Finding 3 is fixed.** `settlePage` — already the single definition of "the page has settled",
with a guard test enforcing that — grew a fourth part: after network idle and `fonts.ready`, it
awaits `Animation.finished` over `document.getAnimations()`. `check integrity` on this page with
the deal running now says `verdict: CLEAN`, matching the `?animate=0` result it used to disagree
with.

Two properties make it safe in a shared settle. **Infinite animations are excluded**, not awaited
— a spinner never finishes and awaiting one would hang every gate on every page that has one.
And the wait is **capped** (2s by default, `animationCapMs` on `openSource`), because a page with
a 30-second intro should be measured at the cap rather than stall a run. Measured cost:
`check integrity` on the animating page 2329ms → 2850ms, and **unchanged on static pages**
(a fixture with no running animation: 2297ms). Full suite 321s → 328s, within noise.

This turned out not to need `check animation`'s settle detector: `getAnimations()` covers CSS
animations, transitions and Web Animations without any sampling, so it needs no cooperation from
the page and no marker convention.

**Finding 2 is fixed.** The background resolution is now one shared browser-script fragment,
`CONTRAST_BACKGROUND_JS`, interpolated into both `check a11y contrast` and `check integrity`. It
blends translucent layers over white and **refuses** on a `background-image` instead of guessing.
On this page the contrast gate went from 9 false failures to `0 contrast failure(s)` with
`24 not measurable` stated on the coverage line; `check integrity` is unchanged; and the real
failures on the low-contrast fixture (4), `css-challenge/page.html` (2) and `dashboard.html` (7)
are all still reported.

## Recorded, not fixed

1. `scan handlers`' three drag rules need delegation awareness; `dragover-not-prevented`
   additionally needs to probe a target the page would accept. This is the one substantive gap
   left, and it is what "can vlmkit handle drag and drop" turns on.
