# motion-repair v4: round 3's pages on the fixed tool (2026-10-19)

## Question

Round 3 added three new pages: drawer, popover and stagger. On two of them no rule fired, so the
agents found the defect only by reading numbers the tool printed. After round 3 the tool gained
three things:

- `begins at`, with `--expect-start` and `--expect-stagger`;
- `the scale grows from`, with `--expect-origin`;
- a line naming the transparent ancestor.

Round 4 gave the same three pages and briefs to five fresh agents:

- one per page on the default model;
- one smaller model on each of the two pages no rule had caught (popover and stagger).

The setup was unchanged from earlier rounds. Agents could not read fixtures, reports, source or each
other's work, they had four rounds, and the oracle was hidden from them.

## Result

| page | model | rounds | oracle | what found the defect | did the agent need the CSS? |
|---|---|---:|---|---|---|
| drawer | default | 1 | PASS | `check animation`'s `undefined-keyframes`, then `transparent: div.shell renders at opacity 0.00, and nothing animates it` | no |
| popover | default | 1 | PASS | `--expect-origin bottom-left`, routed by dynamic-markup B3c: `FAIL origin-mismatch … not its bottom-left corner: transform-origin: bottom left` | no |
| popover | small | 1 | PASS | the same line | no |
| stagger | default | 1 | PASS | `--expect-start 200,280,360,440`, and `begins: … — all within one frame: they start together` | only to confirm |
| stagger | small | 1 | PASS | the same | to find which rule overrode the delay |

Every repair took one round, against 1, 1 and 2 rounds in round 3. No agent found the cause by
reading the CSS first. Both small-model agents finished in one round.

> "this line in dynamic-markup B3c: 'A popover that must grow out of its button: `--expect-origin
> bottom-left` (`origin-mismatch` names the `transform-origin` to set)'. It matches this brief
> almost word for word." (popover)

## What they still hit, and what is fixed

- **`--expect-start` values were not paired with the targets in order.** The agent's report:

  > "`--selector .drawer --selector .shell --expect-start 400,0` gave `.drawer … begins at 400ms, not 0ms`. Swapping to `0,400` gave identical output." (drawer)

  `parseInstants` sorts and dedupes, because it is a grammar for frame instants. **Fixed:** each
  comma-separated value is parsed on its own and kept in order, duplicates included.
- **The fail's own frame showed nothing.**

  > "the fail is pinned 'at 300ms' … In that frame the popover is invisible (share 0.00)." (popover)

  **Fixed:** `origin-mismatch` is now reported at the most opaque frame that is scaled 10% or more
  from full size (430ms on the popover).
- **The crop cut off the reference point.**

  > "`--crop 8,540,308,200` cuts '+ Insert' half off. That is the reference point you need to judge
  > 'comes out of the button'." (popover)

  **Fixed:** the suggested crop is now padded by a quarter of the moving region, and by at least
  48px.
- **`diff html` read an entrance that had not finished as a layout defect.**

  > "it captures before the staggered entrance finishes … reports '8 layout-shift' and 'Fix
  > Candidates: 3x body { margin }' … Following it would have made the page worse." (stagger)

  **Fixed:** finite animations now settle before the baseline and the variant are read. The broken
  page against the fixed one is now 0.0% at every viewport, since their rest poses are identical.
- **`reduced-motion-ignored`.** All five agents met it again on briefs that say nothing about reduced
  motion: one added a rule and four left it, across four rounds. **Fixed in the message and in the
  skill:** when the brief sets no policy, it is WCAG 2.3.3 (AAA) advice, not a defect of the repair.
  The agent says so and judges the rest with `--rule reduced-motion-ignored=off`, which exits 0 on
  each reference page.
- **Smaller fixes:**
  - On a usage error, `inspect motion` now prints the error after the help, not above 80 lines of it:

    > "exited 2 and printed only the help." (drawer)

  - The help's report path is a URL, since an install has no `docs/`.
  - The skill now says plainly that without an expectation, where a scale grows from and when an
    animation begins are printed as facts under "no fail".

## Deferred

- The opacity a target is fitted on includes its ancestors'. The drawer read `follows ease-out in
  its opacity` for its parent's fade.
- `start-mismatch` names `animation-delay` but not the rule that sets it. The overriding
  `:nth-child` rules were found in the CSS.
- `check integrity` still names the composited colour (`rgb(255,255,255) on rgb(255,255,255)`) for
  text under an ancestor at opacity 0.
- Two captures of the same page differ by about 0.1% in `diff png`, and two agents measured that
  noise floor by hand.

## Next

Every defect class these six pages hold is now found by a rule, once the brief is turned into an
expectation. The open question is the step before that: whether an agent maps a brief's words onto
the flag without the skill line that names it. A next round should use briefs worded differently
from the skill's examples.
