# grounding-scenario — subagent evaluation fixture for `check grounding`

Closed-loop validation of `vlmkit check grounding` (see
`.claude/skills/agent-validation-loop`). A fresh subagent is handed **one
screenshot** of a page and six things a user asked for, and must emit a click
coordinate for each. It never sees the page's HTML. What it cannot work out,
and why, is the deliverable.

The gate's claim is that an agent seeing only a screenshot can act on a page.
This fixture is the only way to test that claim, because the failure it exists
to catch — the coordinate you emit is not the one the browser routes — is
invisible to a unit test, which knows the selectors.

## What is measured, and how

The scorer does **not** compare the attempt's coordinate to an expected
coordinate. There is rarely one right answer, and an expected coordinate would
just be a second guess. It dispatches the point at the live page and asks the
browser who receives it:

```
screenshot px --(/ scale)--> CSS px --> document.elementFromPoint
```

A task is HIT when the element that takes the click is the expected one or a
descendant — the same question the browser answers when a real agent sends the
click. A MISS names what the click *would* have activated, so a report can say
"it opened Acme's settings, not Globex's" rather than "wrong by 26 pixels".

```sh
node fixtures/grounding-scenario/score.mjs fixtures/grounding-scenario/attempts/a/answers.json
```

## Two kinds of round

**v1–v2 measured one frame**: a screenshot, six things a user asked for, one
coordinate each, scored by dispatching those coordinates at the live page.

**v3 measures the loop**: a job that takes three actions, a harness that clicks
and hands back the next screenshot, and a goal scored on the DOM the actions
actually produced. It exists because v2's report named the two things one frame
cannot reach — whether an agent can tell its click worked, and a target cut by an
inner scroll container rather than the page fold.

```sh
node fixtures/grounding-scenario/act.mjs f click 93,70       # act, get the next shot
node fixtures/grounding-scenario/act.mjs f wheel 93,120 240  # scroll at a point
node fixtures/grounding-scenario/act.mjs f reset             # undo everything
node fixtures/grounding-scenario/score-flow.mjs fixtures/grounding-scenario/attempts/f/session.json
```

`act.mjs` **replays** rather than holding a browser open: every call reloads the
page and re-runs the whole action list before doing the new one. That costs a
second and buys reproducibility from the file alone, resumability after a crash,
and a scorer that rebuilds the final state instead of trusting the attempt's
account of it — which matters here, because "did my click work" is the claim
under test.

## Layout

- `pages/<name>.html` — the page under test. **Off-limits to every attempt**: it
  is the answer key for half the tasks. Attempts may point tools *at* it.
- `act.mjs` — the v3 harness: click / wheel / shot / reset, by replay.
- `score-flow.mjs` — the v3 scorer: replays a session, reads the DOM, checks the
  goal. Also off-limits.
- `shots/<name>.png` — the one artifact both arms get: the viewport shot at
  1280x720 and reduced to the resolution `check grounding` reports by default
  for that width (640x360, scale 0.5), with the same resampling `image-resize.ts`
  uses — so an attempt's coordinates and the gate's action map are denominated
  in the same pixels. Regenerate with `node shoot.mjs`.
- `briefs/<name>.md` — the treatment arm: screenshot + `check grounding`.
- `briefs/<name>-control.md` — the control arm: screenshot and nothing else, no
  tooling of any kind. It measures what the image alone is worth, which is the
  only baseline against which "the tool helped" means anything.
- `briefs/answers/<name>.expect.json` — the sheet: task id → the element the
  click must reach, and the hazard each task carries. Withheld from attempts.
- `attempts/<letter>/` — `answers.json` and `log.md` per run.

The log asks for one row per task with a **"what told me"** column, quoting the
line of output the attempt acted on (or "the screenshot", or "a guess"). That
column is where the findings come from: a coordinate being right says less than
what the agent believed when it wrote it.

## `console.html` and its six tasks (v1–v2)

`console.html` is an app screen — a billing console — rather than a synthetic
hazard board, so the ordinary controls outnumber the traps and a run can be
scored on both. Four tasks carry a hazard and two are ordinary:

| task | hazard |
|---|---|
| `renew` | a promo ribbon covers the button's left 86%; **only a 17 CSS px strip on its right edge routes to it** |
| `manage-globex` | three rows paint the same `Manage`; only the row text separates them |
| `export-csv` | 7x7 screenshot px, touching two siblings — one of which deletes |
| `publish` | screen says `Send`, accessible name says `Publish changes`; also cut by the fold |
| `audit-log` | none — an ordinary nav link |
| `account-menu` | painted `RM`, accessible name `Account menu` |

Every task is answerable: a known-good answer set scores 6/6.

## `inbox.html` and its one job (v3)

A helpdesk inbox. The job is **archive the ticket titled "Payment webhook
retries"**, reachable in three actions — scroll the list, click the ticket, click
Archive — and scored on the DOM, with deleting any ticket and archiving the wrong
one both counting against.

| hazard | why it is here |
|---|---|
| the target is the 9th of 12 tickets in a **218px scroll container** | every clipped finding in v1–v2 was the page's own fold; nothing had exercised a target cut by an inner scrollport, and the remedy is an action (`wheel`) rather than a coordinate |
| `Archive` sits between `Reply` and `Delete` | a miss to the right is irreversible inside a run |
| `Mark all read` is wired and changes **nothing observable** | no pixels, no DOM, no attribute — an agent that clicks it to test the harness should say it learned nothing, not that the click failed |

The scroll container is the one that found something before any agent ran, and
it is recorded here because it is the shape of defect a synthetic fixture does
not have. `check grounding` reports seven of the twelve tickets as
`occluded-target` with:

> `a click there goes to html — and no point inside the box routes here, so
> nothing can click it until html moves or drops pointer-events.`

They are not occluded. They are clipped by their scroll container, `inFrame` is
true because their boxes are inside the *viewport*, and `elementFromPoint`
answers `html` because that is what is painted outside the list's box. The advice
is unactionable — and the task's own target is one of the seven. It was left in place for the round on v1's precedent, and what the
agents did with it decided the fix. `f` refused it — "the actual fix is scrolling
the list, which the harness supports and the tool never names as an option" — and
`h`, with no tool at all, specified the replacement: "A DOM-aware tool would have
told me directly '12 tickets, scrolled to 4/12'". `g` is the one worth keeping:
it reached the right action from the wrong sentence and filed it as the tool
helping.

**Fixed in v3.** Visibility is measured against every clipping ancestor, so
`inFrame` means *painted*; a target a container hides is inventory rather than a
finding, and carries `clippedBy` — the container, whether it scrolls, and how far.
The page went from `status: suspect` with seven false suspects to `status: ok`
with a scroll plan.

## Rounds

| round | agents | scores | what changed in the tool since |
|---|---|---|---|
| v1 | `a` sonnet+tool, `b` haiku+tool, `c` sonnet control | 6/6, **5/6**, 5/6 | as merged in [#155](https://github.com/mizchi/vlmkit/pull/155) |
| v2 | `d` haiku+tool, `e` sonnet+tool | **6/6**, 6/6 | the map aims at a reachable point; `--at`; findings quote the frame |
| v3 | `f` sonnet+tool, `g` haiku+tool, `h` control — the `inbox.html` flow | 4 actions each, all reached | visibility measured against clipping ancestors; `clippedBy` and the *Out of the frame* block |

v1's two arms failed on **opposite** tasks: the tool won `export-csv`, which the
image cannot answer (three unlabelled 7x7 colour chips — the control guessed by
colour and hit the one beside it), and lost `renew` for the agent that believed
it. Only the agent that used the tool *and* contradicted one of its lines scored
6/6. v2's `d` is v1's `b` — same model, same brief — and it reaches `renew` by
doing exactly what `b` did: taking the tool's number. An agent that follows the
map verbatim and reasons about nothing scores 6/6 now and 5/6 before.

Reports: `docs/reports/2026-09-21-grounding-scenario-v{1,2}.md`.

Two defects were found by **building** the scenario, before any agent ran, and
both are recorded because a realistic page found them where the synthetic
fixture did not:

1. `imprecise-target` printed the element's own size beside a verdict computed
   from the part of it inside the frame — `"#publish (button \"Send\") is 34x18
   screenshot px — under the 10px floor"`, a line that contradicts itself. Fixed
   before v1 so the round would not spend itself on a known lie: the message now
   quotes the measured size and names the fold when the fold is the cause.
2. `occluded-target` reported `"no point inside the box routes here at all"` for
   `renew`, and that is **false** — a 17px strip on the button's right edge does
   route to it. The hit test samples a 3x3 grid and every sample lands under the
   ribbon. Left in place for v1 on purpose: what an agent *does* with a false
   "hopeless" verdict decided the fix, and what it did (emit the covered centre)
   is why the answer was to move the map's point rather than soften the wording.
