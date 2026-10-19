# motion-repair v3: new broken pages, the defects no rule covered (2026-10-19)

## Question

Rounds 1 and 2 were all about whether a target could be seen. Round 3 used three new pages whose
defects are about where and when the motion happens. The setup was the same as before:

- Each page went to a fresh agent, which got the page, its brief, the skill router and the CLI's help.
- Agents were forbidden from reading the fixtures, the reports, the source and each other's work.
- Each agent had four rounds.
- The judge is `fixtures/motion-repair/oracle.mjs`, which the agents did not see. It fails every page as given and passes the reference fix in `reference/`.

| page | planted defect |
|---|---|
| drawer | the page shell is `opacity: 0` with `animation: shell-in …`, but the keyframes are `@keyframes shellIn`, so the whole page stays blank |
| popover | `transform-origin: top right` on a popover that must grow out of a button at its bottom-left |
| stagger | four feed entries that must begin at 200/280/360/440ms all have `animation-delay: 200ms` |

## Result

| page | rounds | oracle on the repair | what found the defect | `inspect motion` on the broken page |
|---|---:|---|---|---|
| drawer | 1 of 4 | PASS | `check animation`'s `undefined-keyframes`, which named the cause exactly | `target-hidden`, but "clipped by an ancestor, covered, or off-screen" |
| popover | 1 of 4 | PASS | the agent reading the centre path in the `frames:` row, then its own look at the frames | **no fail** ("follows ease-out exactly") |
| stagger | 2 of 4 | PASS | the agent comparing `check animation`'s list (four `after 200ms`) with the brief | **no fail** |

All three repairs are right. Two of the three defects passed every rule, and the agents found them
by reading numbers the tool printed without judging them.

## What the agents said

> "`inspect motion` said `rendered at opacity 0.00): clipped by an ancestor, covered, or
> off-screen` — it names opacity but not the ancestor that carries it (`.shell`), and opacity 0
> is not among the causes it lists." (drawer)

> "There is no option for the corner a scale must grow from … 'follows ease-out exactly … no fail'
> reads as a clean bill of health for an animation a reviewer called broken." (popover)

> "Nothing detects simultaneity or stagger … The `frames:` rows show `0.00` then `1.00` at 232ms
> though opacity should then be ~0.2 — the column is visible share, but it reads like opacity."
> "`snapshot strip` has no crop: eleven 1280px frames squeezed into 1600px are unreadable, so I
> cropped them with PIL myself." (stagger)

## What is fixed

These are measured from the page, so no key is needed:

- **When each target begins.** Every target line now says `begins at Nms`. That is the frame time less how long the target's own longest animation has been active (`elapsedMs`).
  - With two or more targets, a `begins:` line puts them side by side. When they begin within one frame of each other, it says so.
  - `--expect-start 200,280,360,440` (per target, in order) or `--expect-stagger 80` (from the first target) turns a difference into `start-mismatch`.
- **Where a scale grows from.** For a scale that changes by 10% or more, the line names the point of the box that stays put: "the scale grows from its top-right corner". It is solved from the box and the scale, against the largest-scale frame.
  - `--expect-origin bottom-left` turns a difference into `origin-mismatch`, which names the `transform-origin` to set.
  - `transform-origin`'s own word order (`left bottom`) is accepted.
- **A transparent target names why.** The line names the ancestor whose opacity makes the target transparent, and says whether anything animates it: `transparent: div.shell renders at opacity 0.00, and nothing animates it (if it is meant to fade in, its animation is not running: check animation names an animation-name with no @keyframes)`.
  - `check integrity`'s `degenerate-render` now lists that cause too.
- **Smaller fixes:**
  - The frames row is labelled `frames (time, share of it seen, centre)`.
  - `snapshot strip --crop x,y,w,h` cuts the same region from every frame.
  - `inspect motion`'s strip line now carries a crop around where the targets move, when that is under half the frame.

After the fixes, on the same pages:

- `inspect motion --selector .drawer` fails the broken drawer and names `div.shell`.
- `--expect-origin bottom-left` fails the broken popover.
- `--expect-stagger 80` fails three of the four broken entries.
- Each reference fix passes.

`fixtures/motion-defects/` is unchanged.

## Deferred

- On a page held at an ancestor's opacity 0, `check integrity` reports the text as
  `rgb(255, 255, 255) on rgb(255, 255, 255)`. It is really `#1b2430`, and it is invisible only
  because of the parent's opacity. The colour the collector shows is the composited colour, not
  the declared one.
- `check animation` exits 1 on `reduced-motion-ignored` after every repair. None of the briefs asks
  for reduced motion: one agent added a rule for it and two left it.
- `check animation` defaults to a 1280x720 viewport, while `inspect motion` defaults to 1280x800.
- `diff png` labelled one level of antialiasing noise between two captures of the same page as
  `3 text-change, 1 element-added, 1 icon-change`.
- Jev: the popover agent ran it with a statement about the gap to the button. Both the broken and
  the fixed page scored 0.85 ($0.00689), so it told them apart no better than the pixels did.
