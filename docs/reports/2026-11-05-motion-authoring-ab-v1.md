# motion-authoring A/B v1: writing CSS animation from a brief, with vlmkit and without (2026-11-05)

## Question

Can an agent write CSS animation correctly with vlmkit, and does vlmkit make the difference? Rounds
1-18 asked agents to repair a broken page. This round gives them no page at all. Each agent gets a
written brief and writes the page from nothing.

Six briefs, each a kind of motion that no repair round planted (`fixtures/motion-authoring/briefs/`):

| brief | what it asks for |
|---|---|
| tabs | an indicator that slides to a clicked tab over 300ms ease-in-out, its width changing with it; jumps under reduced motion |
| skeleton | an 80px highlight that sweeps the skeleton at a constant speed every 1200ms, clipped to it; content crossfades in at 1500ms over 300ms |
| bell | an icon that swings about its top centre, 14° / -12° / 8° / -4°, 700ms, starting at 800ms, once |
| modal | a backdrop that fades to 50% over 200ms linear; a dialog that rises 24px and grows from 95% over 250ms ease-out, 50ms after the click; a 150ms close that leaves nothing over the button |
| grid | nine tiles appearing from the centre outward (0 / 100 / 200ms), each growing from 80% about its own centre, 300ms ease-out |
| marquee | a track that moves left at 80px/s forever with a seamless loop, clipped, pausing while the pointer is over it; still under reduced motion |

Each brief went to two fresh agents on the default model:

- **The vlmkit group** got the CLI and the router skill.
- **The control group** got Node, Playwright and Chromium, and was not allowed to use vlmkit.

Both groups could take screenshots and write their own scripts.

A hidden oracle scored every page: `fixtures/motion-authoring/oracle.mjs`, 86 checks across the six briefs. It
uses plain Playwright and the Web Animations API, with no vlmkit code. It seeks every animation and measures the
page directly: boxes, opacity through ancestors, angle and scale composed from `translate`, `rotate`, `scale`
and `transform`, the screen point a turn keeps still, hit-testing, hover on the real clock and reduced motion.

The oracle was checked before any agent ran:

- **References:** it passes a reference page for each brief.
- **Mutants:** it fails one plausible slip per brief (`mutants/`): `ease` for `ease-in-out`, the pivot left at
  the centre, a transparent backdrop left over the button, linear for ease-out, no pause on hover, and an eased
  shimmer.

## Result

| brief | vlmkit | control |
|---|---|---|
| tabs | 13/13, 119s, 9 tool calls | 13/13, 55s, 5 tool calls |
| skeleton | 13/13, 182s, 15 | 13/13, 59s, 7 |
| bell | 10/10, 114s, 13 | 10/10, 38s, 4 |
| modal | 19/19, 112s, 12 | 19/19, 75s, 6 |
| grid | 21/21, 74s, 8 | 21/21, 43s, 5 |
| marquee | 10/10, 258s, 15 | 10/10, 39s, 4 |

**Both groups wrote all twelve pages correctly. This round does not show that vlmkit makes the difference.**
The control group was 2-6x faster.

Every control agent checked its page the same way: it paused `document.getAnimations()`, set `currentTime`,
and read the boxes. That method measures CSS animation exactly, and on these briefs it was enough. The briefs
spell out every number, and a capable model writes the obvious CSS for them correctly the first time.

The control agents named what they could not check, and none of those gaps cost them a check here:

- **bell:** "no independent check that the pivot point stays still on screen".
- **marquee:** "the loop seam … I relied on the arithmetic"; "proving that no logo is ever seen outside the strip
  would need a check over every frame".
- **grid:** "I could not watch the real-time playback frame by frame".
- **modal:** "frame-accurate timing … I checked the declared timings".

The oracle found two faults in itself; neither touched a page:

- An animation sought past its end with no forwards fill leaves `getAnimations()`, so later seeks missed it. Both
  grid pages, which use `backwards`, first scored 10/21. The oracle now keeps every animation it has seen.
- The bell brief says "first to the right (clockwise)". With the pivot at the top, a clockwise turn swings the
  bell's bottom to the left, so the two words disagree. Both agents followed "clockwise", which is what the oracle
  checks.

## What the vlmkit group hit

vlmkit caught one real defect. The skeleton agent's first page left the transparent content on top of the
skeleton: "FAIL target-hidden … covered by h2: div.skeleton makes a stacking context … paints below h2". The
oracle does not check that case.

The rest of what the vlmkit group reported is false alarms and gaps in the tool. That is why its runs took longer:

- **False fails:**
  - `size-jump` on a tile growing by its own scale ("nothing animates it"), on the centre tile only.
  - `direction-mismatch` on a bell that swings 14° clockwise first and nets about 0°.
  - `loop-seam` on a marquee that moves exactly one copy of its content.
  - `loop-seam` on a shimmer whose two ends are both clipped out of view.
  - `hidden-at-once` on a button that a 50% backdrop dims.
  - `no-visible-effect` on a shimmer that its own `--frames` show moving.
  - `occluded-text` on content that is still transparent.
  - `still-mismatch` on hover: the held clock does not honour `animation-play-state: paused`.
- **Contradictions:** `--expect-origin center` reported "not judged" while the target line said "grows from its
  centre". `target-unchanged` warned on a target given to `--expect-still`.
- **Gaps:**
  - no check of a box's width, or of whether it lines up with another element;
  - no expected pivot for a rotation;
  - no angle in each frame;
  - no click under reduced motion;
  - no start time relative to a later action;
  - one `--expect-direction` value applies to every target;
  - `--selector` does not fan out over every match.

## What this means

On these briefs, a strong model checking its work with plain Playwright did as well as one with vlmkit, and did
it faster. To show what vlmkit adds, the next round needs one or more of these:

- briefs whose failure modes this round's control agents named as unchecked (a pivot, a loop seam, clipping
  across frames, a cover or a stacking context, hover on the real clock);
- a smaller model, where writing it right the first time is less likely;
- a defect that seeking cannot show, such as JavaScript timing or a cover on top.

The false alarms above should be fixed first. As things stand, they cost the vlmkit group more time than the
tool saved it.

Round 2, after the fixes, with briefs built on known traps: `2026-11-05-motion-authoring-ab-v2.md` (12/12 again).

Pages and the oracle: `fixtures/motion-authoring/` (briefs, references, mutants, oracle) and
`docs/reports/data/2026-11-05-motion-authoring/` (the twelve pages, scored as above).
