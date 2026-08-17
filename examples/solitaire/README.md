# Klondike Solitaire — a DnD + animation dogfood target

Windows' `sol.exe`, rebuilt in plain HTML/CSS/JS: seven tableau piles, four foundations, stock
and waste, full Klondike rules, HTML5 drag and drop, keyboard play, and the bouncing victory
cascade.

It exists because **drag-and-drop and animation are the two things a pixel diff cannot see**.
A screenshot of this page proves nothing about whether a card can be dragged onto a legal pile,
and a screenshot taken *during* the deal is different every run. So this is the page the
interaction and motion gates get pointed at.

**Play it: <https://mizchi.github.io/vlmkit/solitaire/>** — it is published as part of this
repo's Pages site, next to the intro page at `/`. The section list lives in
`scripts/build-pages.mjs`; `deploy-pages.yml` runs the 50 tests below plus `check integrity`,
`check a11y focus` and `check a11y touch --level AAA` against this page before the artifact is
built, so a red gate blocks the deploy rather than shipping past it.

```bash
# Play it locally — no server, no build step
open examples/solitaire/index.html          # or: xdg-open / start

# The gates
vlmkit check integrity   "file://$PWD/examples/solitaire/index.html?animate=0"
vlmkit scan handlers     "file://$PWD/examples/solitaire/index.html?animate=0" --probe-drag
vlmkit check animation   "file://$PWD/examples/solitaire/index.html?seed=1"
vlmkit check interactions "file://$PWD/examples/solitaire/index.html?animate=0"

# Its own tests: 31 rules cases with no browser, 19 view cases in Chromium
pnpm vitest run examples/solitaire/
```

| file | what it is |
|---|---|
| `rules.js` | the rules, pure and DOM-free — a classic script assigning `globalThis.Klondike` |
| `rules.test.mjs` | 31 cases, no browser. Loads `rules.js` the way the page does, via `runInThisContext` |
| `solitaire.css` | layout, drawn card faces, and the four animations |
| `game.js` | DOM, HTML5 drag and drop, keyboard, animation wiring |
| `game.test.mjs` | 19 cases in Chromium: real `dragAndDrop`, keyboard, stock, all four animations |

## URL parameters, which exist for the gates as much as for players

| | |
|---|---|
| `?seed=N` | fixes the deal. The shuffle is a seeded PRNG, so seed 1 is the same game everywhere — without it a screenshot differs every run and a VRT baseline means nothing |
| `?draw=1\|3` | Windows' "Draw one" / "Draw three" |
| `?animate=0` | skip every animation. The deal runs ~960ms; a gate that screenshots on load otherwise catches the table mid-air |

`document.body[data-deal-complete="true"]` is the alternative to `?animate=0`: wait for it and
the table is still with the animation intact.

## Why the page is built the way it is

- **Cards are drawn, not images.** No sprite sheet, no external requests, so it renders
  identically from `file://` and the faces are real text — legible to `check copy` and to a
  screen reader instead of being pixels.
- **Classic scripts, not ES modules.** `type="module"` is CORS-blocked on `file://`, and every
  gate here runs straight off the filesystem.
- **The rules are asked, never re-derived.** `dragover` calls `Klondike.canMove` to decide
  whether to `preventDefault`. A drop target that highlights for a move the rules will reject is
  a lie the player acts on.
- **Keyboard play is complete.** Tab to a card, Enter to lift, Tab to a pile, Enter to place,
  Escape to put it back; double-click sends to a foundation. A drag-only game is unusable
  without a mouse.
- **`prefers-reduced-motion` is honoured in CSS *and* JS.** The deal stagger and the bounce
  delays are set in script, where a media query cannot reach them.

## What the gates found

Run against this page, four gates were clean or right and three findings were false positives.
Both halves are the point.

### Right: `check animation`, `check a11y focus`, `check a11y touch`, `check interactions`

`check animation` found all eight deal animations, measured `settle: 962ms`, confirmed
`reduced-motion: honored`, and reported no issues. `check a11y focus` and `check a11y touch`:
zero findings. `check interactions` probed all 13 controls and found one **true positive** —

```
warn [inert-control] button "Restart this deal" shows no observable response to Enter
```

— which was correct and is now fixed. Restarting the opening position renders *identically*
(same seed, no moves made) and the announcement was word-for-word the one already in the live
region, so the button genuinely had no observable effect. It now says which deal it restarted.

## The three false positives — all now fixed

> Each is described below as it was first measured, because **this page is the reproduction**:
> every one fires again if its fix regresses. `handler-map.test.ts`, `a11y-contrast.test.ts` and
> `page-open.test.ts` pin them against this page and against
> `fixtures/handlers/drag-and-drop.html`, which must keep reporting its real defects.

### False positive 1 — `scan handlers --probe-drag` cannot see event delegation

Three of its four issues are artifacts of the handlers living on one delegation container
rather than on each of 52 cards:

```
suspect [dragover-not-prevented]      main#table has a dragover handler that does not call preventDefault()
suspect [drag-source-not-draggable]   main#table has a dragstart handler but is not draggable
warn    [dragstart-transfers-nothing] ran its dragstart handler and left the DataTransfer empty
```

All three are wrong, and `game.test.mjs` is the evidence — a real `page.dragAndDrop` moves the
J♥ onto the Q♠, uncovers the 6♣, and increments the move counter:

- **`dragover-not-prevented`** — the handler *does* `preventDefault`, but only for a legal
  move, which is the whole mechanism. The probe dragged a card onto its own pile, which is not
  legal, so refusing was correct. The rule cannot distinguish "never prevents" from "correctly
  refused this target".
- **`drag-source-not-draggable`** — the container is not draggable; its card children are. The
  rule reads the element the handler sits on rather than the elements it delegates for.
- **`dragstart-transfers-nothing`** — `setData("text/plain", …)` runs on every real dragstart.
  Dispatched at the container, the handler's `closest('.card[draggable="true"]')` guard returns
  early, so the probe measured a dragstart that was never for a card.

Delegation is not an exotic choice here — it is the only sane one for a board whose 52 children
are created and destroyed on every move.

### False positive 2 — `check a11y contrast` assumes white behind a gradient

```
✗ 9 contrast failure(s)
  header.toolbar>h1 — 1.08:1 (need 4.5) — `#f2f7f2` on `#ffffff` — "Klondike Solitaire"
```

The toolbar is `rgba(0,0,0,0.28)` over a green gradient. The text is near-white on near-black —
about as high-contrast as a page gets — and the gate reported the *opposite* because it fell
back to `#ffffff` for a background it could not resolve.

`check integrity` gets this page right, and says why in its own output:

```
- [low-contrast-text] (page): 17 text block(s) skipped: background-image/gradient in the stack
  — composite-background contrast is not deterministically measurable
```

So the exemption exists in the toolkit; the gate whose entire subject is contrast does not have
it. Two gates, one page, opposite answers, and the wrong one is the specialist.

### False positive 3 — `check integrity` measures whatever frame it catches

Pointed at the page without `?animate=0`:

```
verdict: NO DEFECTS, 1 WARN
! [low-contrast-text] … rgb(213,75,97) on rgb(253,253,251) is contrast 4.12:1
```

`#c8102e` on `#fdfdfb` is 5.8:1 and passes. The 4.12:1 was a card at `opacity: 0.2` **in
mid-flight during the deal** — measured, reported with a selector, and gone the moment the
animation lands (`verdict: CLEAN`). The gate's settle is network-idle + fonts + 250ms, which a
960ms entrance animation outlives. `check animation` knows how to wait for a page to stop
moving; `check integrity` has no notion of it.

## Bugs in this page that the tools and its own tests found

Kept as a record of what the loop is worth, because none of these were visible in a screenshot:

| found by | bug |
|---|---|
| screenshot | the stock `<button>` kept its native chrome, and its card sat 60px low — `top: auto` on an absolute child resolves to the *static* position |
| screenshot | empty piles outlined the full fan height instead of one card |
| `game.test.mjs` | **the piles were not focusable at all** — the hint said "Tab to a pile" and the documented keyboard flow was unreachable |
| `game.test.mjs` | the table's `keydown` called `preventDefault` on Enter over *any* descendant, swallowing the stock button's own activation: the keyboard could pick cards up but could not deal |
| `check interactions` | "Restart this deal" had no observable effect |
| `rules.test.mjs` | `autoMoveTarget` offered a lone King a move to *another empty pile* — legal, useless, and it counted a move. Windows' double-click is foundations-only, and the faithful behaviour is the correct one |
| `rules.test.mjs` | `availableFoundationMoves` returned three Aces all targeting foundation 0, so "auto-finish" silently dropped two of every three moves |
| screenshot | the victory animation was a *fall*, not a bounce. It now hits the floor three times with a decaying rebound, with per-keyframe easing — a fall accelerates, a rebound decelerates, and one easing for the whole animation cannot do both |
| `check integrity @375` | **14px of horizontal scroll on a phone.** The narrow-screen card width was a hand-picked `3.3rem` and the comment above it claimed no overflow. It is now derived from the constraint — seven columns, six gaps and the table's padding have to fit — and measures 0px from 320px to 1280px |
| `check integrity @375` | the centre pip was a fixed `1.5rem` on a card that shrinks, so it collided with the corner index at 375px — ten `text-collision` pairs, exempted only because the pip is `aria-hidden`. Card typography is now a fraction of `--card-w`, which is what the file's own "one card size, everything else derived" already claimed |
