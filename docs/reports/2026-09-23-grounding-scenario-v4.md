# grounding-scenario v4: a page the pixels cannot answer, and the screen after the click (2026-09-23)

## Question

v3 ended with every arm finishing the job from pixels alone. Four actions each,
no score moved, and the report named what a v4 needed: *"A task that discriminates
would have to make the pixels insufficient — a list whose rows are visually
alike, or a target whose label is only in the a11y tree."* It also named one gap
without fixing it. G8: the map describes the first load only, so the second half
of every job was invisible to it.

v4 asks both halves:

- when the rows **look alike** and the controls are **icons only**, does the map
  supply what the picture cannot, and does the arm without it pay for the lack?
- once the gate can measure the screen an action leaves (`--after`), do agents
  use it, and what do they still have to take from the picture?

The page is `triage.html`, a helpdesk triage queue. The job is to **archive the
checkout-webhook ticket for `eu-west-1`**: scroll, open, archive, three actions
at best, scored on the DOM. It has two hazards:

- **Three look-alike tickets.** Three tickets from one customer are titled
  "Checkout webhook retries exhausted for region …". The list cuts every title
  before the region, so all three rows paint the same text. The look-alike on
  the first screen is `us-east-1`, which is not the target. The target and the
  third look-alike (`eu-central-1`) are below the list's scroll edge.
- **An icon-only toolbar.** The detail panel's actions are Archive, Report spam,
  Delete and Snooze, 15 screenshot px each, named on hover and in `aria-label`.
  Three of the four take the ticket out of the queue. At 0.5x the spam octagon
  reads much like the snooze clock.

The round had four arms: two with the tool (`i` sonnet, `j` haiku) and two
controls (`k` sonnet, `l` haiku). v3 had one control; the smaller model's
control was added because a smaller model is where pixel-only guessing costs most.

## Before any agent ran

Two tool changes went in first. Each was found by building the page or carried
over from v3, and neither waited for this round's words.

**The map threw away the one fact it had.** Every label was cut at 48 characters,
so the map printed `eu-west-1` and `eu-central-1` as the same
`"Checkout webhook retries exhausted for region e…"`. The tool read the full name
the screen cannot show, and its formatter cut the distinguishing word. That was
fixed before the round, on v1's precedent for a known loss: a label now runs to
the end of the word that tells it from its closest sibling (`distinctLabels`).

**G8 became `--after`.** v3's words:

> "it measures the page as first loaded only, so Reply/Archive/Delete never
> appear anywhere in its output … I had to locate the Archive button myself by
> sampling screenshot pixel colors" (f)

> "after scrolling changes the page, the grounding map becomes stale." (g)

Re-running a gate that loads a URL returns the first screen however often it is
run. `--after "click x,y"` / `"move x,y"` / `"wheel x,y dy"` replays the caller's
actions first, in screenshot px and spelled the way the harness logs them. The
*Out of the frame* block prints its scroll as one of those actions.

The harness gained `--page`, a `move` verb, and wheel `dy` in screenshot px, so a
harness action and an `--after` replay land on the same screen. v3's sessions
still replay as they did.

## Result

| agent | arm | actions | goal | look-alikes opened | misclicks | what it believed |
|---|---|---|---|---|---|---|
| i | sonnet + tool | **3** | ✓ | 0 | 0 | done |
| j | haiku + tool | 6 | ✓ | 0 | 0 (+1 exploratory, after the job) | done |
| k | sonnet **control** | 11 | ✓ | 2 | 2 | done |
| l | haiku **control** | 12 (budget) | ✓ | 1 | 7 | **failed** |

**The column v3 could not move moved.** Both tool arms found the target without
opening a look-alike. Both controls opened look-alikes and clicked things that
did nothing they wanted. `k` took 8 actions more than the minimum of 3, and `l`
took 9, though its goal was already reached at action 7. Only `i` reached the
minimum.

All four archived the right ticket and none took any ticket out of the queue. The
irreversible controls were never hit, by either arm. At this scale the icon
glyphs *were* separable by eye, with effort. `k` cropped and zoomed the toolbar
from the screenshot file before its one archive click, and `l` found the right
icon by trying it.

`l`'s row is the round's sharpest finding, and it is not in the goal column.
`l` archived the right ticket on its **seventh** action, then read the "Archived."
confirmation as a dropdown item called *Archive* and clicked the words four
times. It reported:

> "I did NOT successfully archive the ticket. … The Archive menu option in the
> dropdown did not respond to my click attempts." (l)

Before that, it had clicked the blue *Reply* button three times believing it was
Archive. All seven wasted clicks were harmless, and only because Reply does
nothing here and confirmation text takes no click. That is v3's question, *can an
agent tell that its click worked*, answered no from pixels alone by the smaller
model.

## What worked — in their words

The map disambiguated the look-alikes before the agent had scrolled at all:

> "The very first tool run (no `--after`, initial load) already told me — before
> any scrolling — that the hidden part of the list held three near-identical
> tickets: `t3 "…region us-east-1…"`, `t8 "…region eu-west-1…"`, `t11 "…region
> eu-central-1…"`. The initial screenshot shows all three as the same truncated
> string … the tool disambiguated them a full step before I could see it myself."
> (i)

That line is the pre-round label fix doing its job. Before the fix, `t8` and
`t11` would both have read `"…for region e…"`.

`--after` put the second screen in the map, and both tool arms used it:

> "At 15x15px, 16px apart, these four icons are not distinguishable from the
> screenshot alone — the labels are the only reason I knew which one was safe."
> (i, quoting `t15 "Archive" @ (560,50)` … `t17 "Delete" @ (592,50)` from
> `--after "wheel 85,120 100" --after "click 85,161"`)

The control arms said what they lacked, and it is what the map carries:

> "row boundaries in the 640x360 shot are only ~21px apart … a hover state or
> per-row bounding box would have removed the guesswork" (k)

The rows are 28px apart. `k` misjudged them by eye twice.

## What didn't — and what changed

### F1 — a 1px strip was reported as a whole row that was "crowded" (j) — fixed

After two wheels, `j`'s target sat under the list's bottom edge with **one pixel**
of it painted. The map said:

```
t8 button "…eu-west-1…" @ (85,185) 149x28 #list > button:nth-of-type(8) [crowded-target]
! crowded-target: …'s click point is 0px from #list > button:nth-of-type(7) …
```

`j` took it at its word:

> "Scroll down slightly more to separate t8 from t7 above it (crowded-target
> warning)" (j, log)

> "the tool correctly identified that t3 and t8 had spacing issues where a 6px
> offset could activate neighbors." (j, report)

The row was not crowded; it was barely on screen. `visibleBox` was the box cut by
the **frame** only, while the collector already intersected every clipping
ancestor to decide `inFrame`. v3 fixed visibility and aim against containers, but
not the box every size measurement is taken on. `i` hit the same defect a row
lower: a 12px strip reported as a full 28px row.

**Fixed:** the collector returns the painted rect, and `visibleBox` and `minSide`
are measured on it. `clippedBy` covers a partial cut too. `j`'s screen now reads (the finding wrapped here):

```
t8 button "…eu-west-1…" @ (85,185) 149x1 painted of 149x28 … [imprecise-target,crowded-target]
! t8 imprecise-target: … shows 149x1 screenshot px in the 640x360 frame, under the 10px floor:
  a few pixels for the model to aim at — #list cuts it (the element is 149x28);
  scroll it 27px (--after "wheel 85,120 27") and re-run before aiming.
```

### F5 — findings named a row by selector while the map named it by id (i) — fixed

> "plus a crowded-target warn: 'click point is 5px from #list >
> button:nth-of-type(9)'" (i, log, filed under t8)

The message actually read `#list > button:nth-of-type(9)'s click point is 5px
from #list > button:nth-of-type(8)`. It was about `t9`, not the row `i` was about
to click. The reader had to match two selectors to an id by hand, and matched
wrong. **Fixed:** every finding carries `targetId`, and the prose leads each line
with it (`t9 crowded-target:`). `crowded-target` names the neighbour's id as well.

### F2 — "did it work" is not in a map of one screen (i, l) — fixed

> "After archiving, I re-ran `check grounding` replaying all 3 actions to verify.
> It still printed `t8` as a plain actionable button with `"disabled": false` in
> `--json` — no archived flag anywhere … The tool's action map does not track this
> state change; I had to trust the screenshot instead for post-action
> confirmation." (i)

`i` read the screenshot correctly. `l`, with only the screenshot, did not. A map
describes one screen, but the replay holds both: the screen before the last
action and the screen after it. **Fixed:** with `--after`, the report compares
them (`grounding-change.ts`):

```
What the last action (click (560,50)) changed:
  the click went to t15 "Archive"
  ~ t8 "…eu-west-1…" changed color, text-decoration-line
  ~ t15 "Archive" changed background-color — its :hover style, and the pointer is now on it
  + text "Archived."
```

Each of `l`'s four clicks on the confirmation now reads:

```
  the click went to p.flash, which is not in the map — nothing up to <body> declares itself interactive
```

Each of its three Reply clicks reads `the click went to t19 "Reply"`, followed by
"nothing on screen … the control may still have done something the page does not
show". That names the button it actually pressed.

The first cut went by pointer position alone. It filed the archived row's
strike-through as "possibly just hover", because the pointer had just left that
row. A restyle is now called `:hover` only when the pointer arrived or left
**and** a `:hover` rule in the page sets that property. A click that changes
nothing still says what it reached ("the control may still have done something
the page does not show"). That keeps v3's `Mark all read` from reading as a miss.

### Agent-side, not fixed

- **`j` described its confirmation wrongly.** Its log records a blue
  "Archived!" message "below the Close button". The page shows a green
  "Archived." and has no Close button. It then clicked (500,50), on the ticket's
  title, "exploring for close button location" after the job was done. The
  click was harmless here. F2 now answers it with `the click went to
  #detail-title, which is not in the map — nothing up to <body> declares itself
  interactive`.
- **Row misclicks by eye.** `k` hit neighbouring rows twice, and `l` believed
  Reply was Archive. Both are what the map exists to prevent, and the controls had
  no map. No change is needed.

## What this round did not establish

- **F1, F2 and F5 are unvalidated.** No fresh agent has read the new output. A v5
  on this page should check two things. Does the change block stop a small model
  from re-clicking a confirmation? Does anyone still chase a strip?
- **Only the action count separated the arms.** On the one outcome that is
  irreversible (touching a wrong control) both arms scored the same, zero. The
  page could make that discriminate by putting Delete's glyph closer to Archive's
  or dropping the tooltip. That was not tried here.
- **`--after` grows with the session.** `i` replayed three actions per tool run.
  A twelve-action session would mean twelve flags. No agent asked for a
  session-file input, so none was added.

## Files

- `fixtures/grounding-scenario/pages/triage.html`,
  `briefs/triage{,-control}.md`, `briefs/answers/triage.expect.json`,
  `attempts/{i,j,k,l}/`
- `fixtures/grounding-scenario/act.mjs` (`--page`, `move`, screenshot-px wheel),
  `score-flow.mjs` (per-page answer sheet)
- `packages/vlmkit-markup/src/inspect/grounding-scan.ts` (`distinctLabels`,
  `--after`, painted `visibleBox`, `targetId`)
- `packages/vlmkit-markup/src/inspect/grounding-change.ts` (what the last action
  changed)
- `fixtures/grounding/revealed-by-click.html` (the E2E fixture for `--after`)
- v1–v3: `docs/reports/2026-09-2{1,1,2}-grounding-scenario-v{1,2,3}.md`
