# grounding-scenario v2: the model that lost the task now wins it (2026-09-21)

## Question

v1 found that `check grounding` told an agent a covered button was unreachable
when a 17px strip of it was not, and the smaller model believed it and clicked
the thing on top. v2 asks two things: does the model that lost that task now get
it, and what does an agent hunting for the *next* wrong coordinate find once the
obvious one is gone?

Same page, same six tasks, same scorer. What changed is the tool: the action
map's click point is now the point that reaches the target, `--at` hit-tests a
coordinate the caller already has, and findings quote the frame instead of the
preset's cap. The brief was updated to announce those two affordances — an agent
that is not told they exist will not read the source to discover them.

## Result

| agent | arm | v1 | v2 | the miss |
|---|---|---|---|---|
| a | sonnet + tool | 6 / 6 | — | — |
| b → **d** | haiku + tool | 5 / 6 | **6 / 6** | — |
| a → **e** | sonnet + tool | 6 / 6 | **6 / 6** | — |
| c | sonnet, screenshot only | 5 / 6 | — | `export-csv` |

An agent that follows the map verbatim, emitting `point` for every task and
reasoning about nothing, now scores **6/6** where it scored 5/6. That is the
measurement that matters: the map's contract is the coordinate, and the
coordinate now holds.

`d` is the same model as v1's `b`, on the same brief, and it reached `renew`
by doing what `b` did — taking the tool's number:

> "Occlusion of `renew`: 'a click there goes to #promo' at the visual centre
> (447,96), forcing offset to (472,91). Without this, I'd have aimed at the
> button's geometric centre and hit the promo overlay."

`e` checked every claim rather than trusting any:

> "the boundary sits exactly at x=468/469, matching the reported '4px of room'
> to the pixel … Nothing the tool printed contradicted the screenshot or my own
> pixel/hit-test checks — every claim verified exactly."

That is v1's G1, G2 and G3 closed by the two agents who would have hit them.

## What v2 found — three, all smaller than v1's

### G4 — only occlusion declared that the point had moved

> "For the three bottom-clipped targets (#contact/#revert/#publish, visibleBox
> 6px of 18px), the click point is silently recentred into the visible sliver,
> but only the occlusion case gets an explicit `"aimedOffCentre":{"centre","room"}`
> field — clipping gets no equivalent margin number, just prose." (e)

Correct, and the asymmetry was accidental: both cases move the coordinate off
the element's own centre. **Fixed:** `aimedOffCentre` carries a `reason`
(`occluded` | `clipped`) and is emitted for both, so a consumer can read a 3px
aim budget off the row instead of deriving it from two boxes.

The first version of that fix compared the two centres and labelled three nav
links and a table button `clipped` with 7px of room — `point` and the box centre
are rounded from different quantities and disagree by a pixel on ordinary
targets. The condition is a box the frame actually cut. A regression the round
caught on its own fixture before it reached an agent, and a test pins it.

### G5 — "not a target" was read as "harmless"

> "`-> #promo (not a target)` never says whether #promo is inert or itself
> clickable; 'not a target' means 'not in the actionable list,' not 'safe to
> slip onto.'" (e)

**Fixed:** a probe now walks from the hit up to `<body>` for the nearest element
carrying a role, an `onclick` or a non-negative `tabindex` and names it —
`(not in this map, and the click would set off X)` — or states the measured
absence: `(not in this map; nothing up to <body> declares itself interactive)`.
A hit on a control's own icon resolves back to that control's row, so a probe
that does the right thing stops reading as a miss.

### G6 — the advice to scroll did not say what had been measured

> "The tool output states 'scroll it into view before aiming' … but doesn't
> clarify whether scrolling occurred during measurement or if the screenshot is
> pre-scrolled. If the page scrolled after capture, coordinates may be
> pre-scroll." (d)

It never scrolls. **Fixed:** the message says so — "this gate measures the
initial frame and never scrolls, so scroll it into view and re-run before
aiming."

## One thing that is not the tool's to fix

`d` doubted a correct line for a wrong reason:

> "The screenshot shows the yellow button cleanly visible with no overlay at
> that coordinate. Either the promo is CSS-invisible or the measurement was
> taken at a different scroll/viewport state."

The yellow shape *is* the overlay; the button underneath is blue. `d` could not
tell them apart in the image — and got the task right anyway, by following a
number it did not believe. Recorded because it is the case the gate exists for:
the agent's reading of the picture was wrong and the measurement carried it.

## Honest read, and why the loop stops here

v1 moved a task; v2 moved three field names and a clause. Both arms are at the
ceiling this scenario can measure, `e` went looking for a wrong coordinate and
found none, and the remaining findings are about how a row is *described* rather
than whether it is right. That is the stopping signal.

What v3 would ask, when there is a reason to run it: this scenario is one frame
and one click each. The untested half is the turn *after* the click — whether an
agent can tell from the next screenshot that its action did what it meant, which
is `vlmkit inspect explore`'s measurement and has never been put in front of an
agent. A second page with a scrollable region would also be worth it: every
clipped finding here is the page's own fold, and nothing has exercised a target
cut by an inner scroll container.

## Files

- `fixtures/grounding-scenario/` — `attempts/{a,b,c,d,e}/`, briefs, answer sheet, `score.mjs`
- `fixtures/grounding/partly-covered.html` — the sweep's and the probe's fixture
- `packages/vlmkit-markup/src/inspect/grounding-scan.ts`, `src/gates/grounding.gate.ts`
- v1: `docs/reports/2026-09-21-grounding-scenario-v1.md`
