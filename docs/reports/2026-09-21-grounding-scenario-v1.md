# grounding-scenario v1: the map told the smaller model to click the thing on top (2026-09-21)

## Question

`check grounding` claims that an agent seeing only a screenshot can act on a
page. v1 tests the claim directly rather than by reading the code: three fresh
subagents get one 640x360 PNG of a billing console and six things a user asked
for, and must emit a click coordinate for each. The scorer dispatches each
coordinate at the live page and asks the browser who receives it, so a task is
won or lost on the same hit test a real agent's click would go through.

The arms are the experiment. Two agents get `check grounding`; one gets the
screenshot and nothing else. Without the control, "the tool helped" is
unfalsifiable — and, as it turns out, half wrong.

Fixture: `fixtures/grounding-scenario/`. Scored with `score.mjs`.

## Result

| agent | arm | score | the one it lost |
|---|---|---|---|
| **a** | sonnet + tool | **6 / 6** | — |
| **b** | haiku + tool | 5 / 6 | `renew` → activated `#promo` |
| **c** | sonnet, screenshot only | 5 / 6 | `export-csv` → activated `button.refresh` |

The two arms fail on **opposite** tasks, and that is the whole finding. The tool
won `export-csv`, which the image cannot answer. It **lost** `renew` for the
agent that believed it, on a task the control got right by reading pixels. Only
the agent that used the tool *and* disbelieved one of its lines scored 6/6.

A known-good answer set scores 6/6, so every task was winnable.

## What worked — the tool's own contribution, in a's words

Three flat colour chips, no text, at 7x7 screenshot px:

> "the tool named them `button "Refresh invoices"`, `button "Export invoices as
> CSV"`, `button "Delete draft invoice"` in that left-to-right order, so CSV
> export is the *middle* indigo chip, not the green one I'd have guessed."

The control, working the same chips with pixel sampling, reached the opposite
conclusion and said so plainly:

> "three flat, unlabeled 7x7px color swatches (teal/indigo/red) with zero
> internal pixel variation — no icon, no glyph, no text survived … Nothing in
> the image distinguishes which one exports CSV; any answer here is a guess
> about color convention, not a reading."

It guessed the teal one and deleted-adjacent `button.refresh` took the click.
This is the case the gate exists for, and it is worth stating that the accessible
names — invisible in any screenshot — were what decided it. Same for the two
label mismatches: `RM` → `Account menu`, `Send` → `Publish changes`.

## What didn't — three gaps, one of them expensive

### G1 — "no point inside the box routes here at all" was false, and cost a task

The `renew` button is 86% covered by a promo ribbon. The gate reported:

> `occluded-target: #renew-now (button "Renew plan") is painted at (447,96) but
> a click there goes to #promo — no point inside the box routes here at all.`

A 17 CSS px strip on the button's right edge routed to it the whole time. The
hit test samples a 3x3 grid at 25/50/75%, all three columns land under the
ribbon, and `hitFraction: 0` was reported as the much stronger claim that
nothing can reach the element.

Agent b took the tool at its word, emitted the map's point, and activated the
ribbon. Agent a did not:

> "I scanned raw pixels at y=96 across the box (x=417–478): solid, unblended
> button-blue `rgb(29,78,216)` fills x=469–477 right up to the box's own edge,
> with no yellow bleed … I trusted the pixels over this line."

That is the tool being worse than nothing for the model least able to
second-guess it — the failure mode a signal tool must not have.

**Fixed in this commit.** When the centre is intercepted the collector now
*sweeps* the box on a fine grid and returns the middle of the largest clear
pocket, with the room around it. The action map's `point` becomes that
coordinate, because a map whose coordinate does not reach its own target is
worse than no map. The finding stays a suspect — a promo over a CTA is a real
defect — but it now reads:

> `#renew-now (button "Renew plan") is covered at its own centre (447,96): a
> click there goes to #promo. This map aims at (472,91) instead, which does
> reach it, with 4px of room before the nearest thing that is not this element —
> still a defect, because anything aiming at the centre misses.`

An agent following the map verbatim now scores 6/6 where it scored 5/6.

### G2 — no way to check a coordinate

> "no coordinate-hit-test command exists to confirm whether a specific pixel
> actually resolves to a given element short of trusting the report." (a)

The one line a should not have trusted is the one it caught, and it caught it
with a pixel scan it wrote itself. **Fixed in this commit:** `--at x,y`,
repeatable, hit-tests coordinates the caller already has. It reproduces both of
v1's misses in one command:

```
(447,96) = css (894,192) -> #promo (not a target)
(53,292) = css (106,584) -> button.refresh (t10)
```

### G3 — the resolution in every message named a box the frame never had

> "every message says 'at medium (640x480)' though the actual frame is 640x360
> (scale 0.5 of 1280x720) — that parenthetical never matches the real frame
> size, in every single finding line." (a)

Correct: `medium` is a **cap**, and a 16:9 viewport under it comes out 640x360.
**Fixed in this commit:** findings quote the frame (`in the 640x360 frame`), the
header names the cap as a cap, and the header says once that every coordinate
below is in those pixels.

## Found by building the scenario, before any agent ran

A realistic page found two things the synthetic fixture did not. Recorded
because "what the fixture's shape hid" is itself a result.

- `imprecise-target` printed the element's own size beside a verdict computed
  from the part of it inside the frame: `"#publish (button \"Send\") is 34x18
  screenshot px — under the 10px floor"`, which contradicts itself. Fixed before
  v1 so the round would not spend itself on a known lie; the message now quotes
  the measured size and names the fold as the cause when the fold is the cause.
- G1's false line, left in place on purpose. What an agent *does* with a
  "hopeless" verdict decided the fix: b's behaviour is why `point` moves rather
  than the message merely being softened.

## Honest read

The headline is not "the tool helps" — it is that on this page the tool's unique
contribution and its worst failure were the same size, one task each, and which
one you got depended on whether you were willing to contradict it. All three
fixes above are aimed at that: hand over a coordinate that works, make the
coordinate checkable, and stop mis-stating the frame it is denominated in.

## What v2 asks

Whether a model that took the false line at face value now gets `renew`, and
what an agent looking for the *next* wrong coordinate finds once the obvious one
is gone.

## Files

- `fixtures/grounding-scenario/` — page, shot, briefs, answer sheet, scorer, `attempts/{a,b,c}/`
- `fixtures/grounding/partly-covered.html` — the sweep's own fixture
- `packages/vlmkit-markup/src/inspect/grounding-scan.ts`, `src/gates/grounding.gate.ts`
