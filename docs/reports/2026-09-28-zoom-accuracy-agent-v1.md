# Zoom accuracy, measured with the coding agent's own vision (v1)

**Question.** Does letting a vision model zoom (`runZoomLoop`) make its answers about a
screenshot diff *right* more often than one look (`runSingleLook`)?

**Answer, for this reader.**
- **At the default budget (1568px), no.** Both arms scored 35/36. There were no discordant pairs,
  so the paired test has nothing to work with.
- **At a 768px budget, zoom fixed 2 of the single look's 3 misses and broke none**
  (33/36 → 35/36). The direction is the expected one, but 2-0 is p = 0.5: 36 cases cannot tell it
  from chance.
- **Zoom cost about 1.4× the tokens and 3–4× the wall time in both rounds.**

Keep zoom opt-in. It is worth turning on where a provider shows the model a small image; it is
not worth turning on by default at the full budget.

## Setup

The bench is `src/experiments/benchmark/zoom-accuracy/`, described in `.claude/CLAUDE.md`.

**Cases.** 36 cases, each a full-page 2x capture of one of the 9 CSS-challenge fixtures with one
planted change, 9 of each kind:
- a digit changed in text of 14px or smaller;
- a short label's colour changed;
- an element moved 3–4px with `translate`;
- nothing (the control).

The ground truth is read from the pixel diff. The self-check passed: an oracle scored 36/36 and
an always-"unchanged" reader scored 9/36.

**Reader.** No provider key was set, so the reader was the coding agent itself, through the
bench's agent mode (`--export-agent`). Each arm was a packet answered by 3 fresh subagents,
12 tasks each. The single-look and zoom arms were answered by different agents, and round 2 by
agents that had not seen round 1.

**Blinding.** A packet holds only:
- the tasks, under shuffled anonymous ids;
- the two images at exactly the size a provider would be sent;
- the bench's prompt;
- for the zoom arm, a helper that does one `runZoomLoop` zoom: the box is mapped onto the
  full-resolution original, cropped, and magnified to the budget, up to 6 zooms per task.

No case id, fixture name or path to the ground truth appears in a packet, and a test holds that.

**Budgets.**

| round | budget | how a 1440×1248 page is shown |
|---|---|---|
| 1 | `DEFAULT_IMAGE_BUDGET`, 1568px / 1.15MP | 1151×998, about 0.8 of CSS size |
| 2 | `--max-edge 768` | 768×665, about 0.53 of CSS size; tall pages as narrow as 446px |

Zoom crops are magnified to the same budget as the view, as in the loop.

## Results

| budget | arm | correct | text | colour | offset | none | located | zooms/case |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1568px | single | 35/36 | 8/9 | 9/9 | 9/9 | 9/9 | 85% | 0 |
| 1568px | zoom | 35/36 | 8/9 | 9/9 | 9/9 | 9/9 | 85% | 2.9 |
| 768px | single | 33/36 | 8/9 | 8/9 | 8/9 | 9/9 | 80% | 0 |
| 768px | zoom | 35/36 | 8/9 | 9/9 | 9/9 | 9/9 | 85% | 3.6 |

**Paired on the same cases** (fixed = right with zoom, wrong without; broke = the reverse):

| budget | fixed by zoom | broken by zoom | both right | both wrong | sign test p |
|---|---:|---:|---:|---:|---:|
| 1568px | 0 | 0 | 35 | 1 | 1.000 |
| 768px | 2 | 0 | 33 | 1 | 0.500 |

**The two cases zoom fixed at 768px:**
- **`grid-complex-offset`** (element moved 0,4). The single look said "unchanged". The zoom arm
  used all 6 zooms and read `0,4`.
- **`landing-product-color`** (blue → `#ea580c`). The single look read `#dc2626`, which is 50 off on
  one channel against a tolerance of 48. The zoom arm read `#ea580c` after 2 zooms.

**Cost.** This is subagent usage per 12-task chunk, including the reading of the brief and prompts.

| budget | arm | tokens | wall time |
|---|---|---:|---:|
| 1568px | single | ~120k | ~115s |
| 1568px | zoom | ~174k | 330–380s |
| 768px | single | ~98k | ~115s |
| 768px | zoom | ~139k | 420–480s |

## What the bench got wrong, in the order to fix

1. **The planted colour is a palette value a reader can name without reading it.** The colour is
   always the farthest of five Tailwind 600s, and `#ea580c` was named exactly in 14 of 18 colour
   answers in round 1. So colour scores measure recognising a palette as much as reading a pixel.
   Planting an off-palette colour, for example a random hue at fixed lightness, would fix this.
2. **Offsets come from a set of four values that a reader can guess.** The four are ±4,0, 0,4 and
   3,0, and each is scored with ±1px tolerance, so "4 in the direction it saw" is nearly always
   right once a shift is noticed. Planting 1–6px drawn per case, and scoring the exact magnitude
   separately, would fix this.
3. **Neither arm can read a change under a blurred overlay.** The one miss in every arm,
   `stacking-context-text` ("50+" → "00+"), is text behind a `backdrop-filter` modal. Zoom
   magnifies pixels; it does not unblur them. The planter should require the element to be topmost
   at its own centre (`elementFromPoint`), or such cases should be reported as their own kind.
4. **The cases are too easy at the default budget to separate the arms.** Both arms scored 35/36,
   with 9/9 on offsets and colours. Harder cases (10–11px text, 1–2px shifts, longer pages) or
   more of them would let a real effect show up as discordant pairs.
5. **36 cases give too little power.** Two fixes and no breaks is p = 0.5. Detecting a 10-point
   effect needs roughly 100–150 cases per arm.

## Caveats

- **The reader is one model**, the one serving this session. How much zoom helps depends on the
  model: a weaker reader has more to gain, which the provider runs this bench exists for will
  show.
- **The agents are not the loop.** A subagent used the zoom helper by hand, from a written brief,
  where a model in the loop would use a tool call. The images, budget, crops and prompt were the
  loop's; the turn-taking was not.
- **Rule breaches in round 1.** One zoom agent ran `cat` on the packet's own task files and chained
  commands around its zoom calls; another wrapped one zoom call in `cd` and a loop. Both read only
  inside the packet, so no answer could leak. Round 2's brief allowed no shell command but the bare
  helper, and it was reported kept.
- **Honesty is the one thing the packet cannot enforce.** The agents have a shell, and the
  full-resolution originals are on the same disk. The packet keeps them out of an honest agent's
  way, and the agents said they stayed in the packet.
