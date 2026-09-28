# Zoom accuracy v2: the bench fixed, and zoom now measurably helps

v1 (`2026-09-28-zoom-accuracy-agent-v1.md`) scored the single look and zoom alike (35/36 each) at the
default budget, and named four ways the bench made them alike. v2 fixes those four and measures again,
with the same reader (the coding agent's own vision through the bench's agent mode) and the same
default budget (1568px / 1.15MP).

**Result: zoom 58/58, single look 48/58.** Zoom fixed 10 cases and broke none; on 58 paired cases
that is p = 0.002. The whole gain is in **exact values** — how many pixels something moved, which
colour it became. Noticing a change, reading a changed digit and saying "nothing changed" were
already perfect with one look.

## What changed in the bench

| v1 defect | v2 |
|---|---|
| Planted colour was the farthest of five Tailwind 600s; `#ea580c` named exactly in 14/18 answers — recall, not reading | A seeded hue at mid saturation / lightness, ≥96 off the old colour on some channel |
| Shifts from a fixed four (±4,0 / 0,4 / 3,0), ±1px tolerance — "4 in the direction it looked" passed | 1–6px in any of four directions, scored **exactly** (a 2x capture holds each CSS px as two device px, so an exact read is possible from a crop) |
| The one miss in every arm was text under a blurred modal — unreadable, measured nothing | A target must be topmost at its own centre (`elementFromPoint`) with no filtered or faded ancestor |
| 36 cases, one per fixture and kind | `--variants 2`: two per fixture and kind (one `none` per fixture); text ≤13px (was 14) |

Tests hold each fix: distinct planted colours and 1–6px shifts across variants, and a page whose small text
is all under a blur but one line — the planter picks that line every time.

58 cases were built (63 planned): four text cases were skipped on `landing-product` and
`stacking-context`, whose only small digit text is now correctly excluded as obstructed, and one shift was
clipped by its container. Self-check: oracle 58/58, always-"unchanged" 9/58.

## Results

| arm | correct | text | colour | offset | none | located | zooms/case |
|---|---:|---:|---:|---:|---:|---:|---:|
| single look | 48/58 (83%) | 14/14 | 15/18 | 10/17 | 9/9 | 85% | 0 |
| zoom | 58/58 (100%) | 14/14 | 18/18 | 17/17 | 9/9 | 86% | 2.5 |

| pairs | fixed by zoom | broken by zoom | both right | both wrong | sign test p |
|---:|---:|---:|---:|---:|---:|
| 58 | 10 | 0 | 48 | 0 | 0.002 |

The single look's ten misses, every one fixed by zoom:

- **Seven shifts read off by one or two pixels**, the direction always right: 0,3 read as 0,4; 0,-2 as
  0,-3; 0,-6 as 0,-5 and 0,-4; -5,0 as -4,0 (twice); and one 1px shift not seen at all (`form-app-offset`,
  0,-1 — under one view pixel at that page's 0.57 scale). The single-look agents said as much: "a 3–4px
  shift is only 2–3 image pixels."
- **Three colours outside the 48 tolerance**, each the right hue family snapped to a nearby palette value:
  `#512591` read `#6d28d9` (72 off), `#6ab516` read `#16a34a` (84), `#59b431` read `#22c55e` (55). The
  zoom arm's reads were closer, though several zoom agents also said they snapped to "the nearest palette
  value by eye".

**Cost** (subagent usage per ~12-task chunk): single look ~112–121k tokens and ~2 minutes; zoom
~143–186k tokens and 5–7 minutes — about 1.4x the tokens and 3x the time, as in v1.

## What it says about zoom

- **Turn it on when the answer is a measurement.** A shift in pixels and a colour value are what one look
  at a 0.6–0.9x view cannot give exactly and a magnified crop can. On this reader that took the offset
  kind from 10/17 to 17/17.
- **It buys nothing for detection or for reading text at this budget.** Text (≤13px digits) and the `none`
  controls were 14/14 and 9/9 in both arms. v1 saw the same at 1568px; at 768px it saw zoom recover one
  missed shift, so detection is where a smaller view would start to need it.
- **The cost is time more than tokens**: 2.5 zooms a case, most of them a matched pair (the same box in
  both images), which is how every zoom agent measured a shift.

## Caveats

- **One reader**, the model serving this session, through subagents using the zoom helper by hand from a
  written brief — the loop's images, budget, crops and prompt, not its turn-taking. A provider model's
  run is what `vlm-bench`'s key path is for.
- **Two text variants duplicated their first case** (same element, same digit: `form-app-text`,
  `page-text`). Both arms got all four right, so they add no discordant pair; the planter should avoid
  re-picking an element within a fixture.
- **Colour tolerance is still generous for a stated hex** (48 per channel). The three single-look colour
  misses were 55–84 off; a tighter tolerance would move more colour cases into the zoom column, not out.
- **Honesty**: the agents have a shell and the originals are on the same disk; round 2's brief allowed no
  shell but the bare zoom helper, and every agent reported keeping to the packet.
