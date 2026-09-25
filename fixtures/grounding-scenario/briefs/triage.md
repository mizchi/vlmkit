# Brief: finish a job in the Helpdesk triage queue, by clicking

You are standing in for a computer-use agent. You get a screenshot, a way to act,
and the next screenshot. Nothing else — no page source, no selectors.

This is a **loop**, not one answer. Act, look, decide, act again.

## The job

**Archive the ticket about checkout webhook retries in `eu-west-1`.** The fix for
that region has shipped. Any other region's ticket must stay open.

That is the whole goal. It is reachable in as few as three actions. You are
scored on the page state your actions actually produce, not on what you report —
so being sure is worth more than being fast.

These count against you and cannot be undone inside a run:

- **Deleting, reporting as spam, or snoozing any ticket** — each takes it out of
  the queue.
- **Archiving any ticket other than the one above.**

## Seeing and acting

The first screenshot is `fixtures/grounding-scenario/shots/triage.png` — 640x360,
the page rendered at a 1280x720 viewport and halved. Every coordinate you give,
and every scroll amount, is in **these** pixels.

```sh
V="node --experimental-strip-types"
A="fixtures/grounding-scenario/act.mjs"

$V $A <your-letter> --page triage click 85,68      # click at a screenshot px point
$V $A <your-letter> --page triage move 85,68       # move the pointer there (hover), no click
$V $A <your-letter> --page triage wheel 85,120 60  # scroll 60px at a point (positive = down)
$V $A <your-letter> --page triage shot             # re-shoot without acting
$V $A <your-letter> --page triage reset            # forget every action, start over
```

Always pass `--page triage`. Each call prints the path of the screenshot that
resulted. **Look at it.** That picture is the harness's only report on what your
action did.

Actions accumulate: the harness replays everything you have done, in order, on a
fresh page, then does the new one. So `reset` genuinely undoes a mistake — but
only if you notice you made one.

## The tool

`vlmkit check grounding` measures the page and prints an action map — every
target's click point in the same screenshot pixels, what a click there actually
reaches, and the risks on that coordinate.

```sh
P=fixtures/grounding-scenario/pages/triage.html
$V src/cli/vlmkit.ts check grounding $P
$V src/cli/vlmkit.ts check grounding $P --json
$V src/cli/vlmkit.ts check grounding $P --at 85,68 --at 247,111
$V src/cli/vlmkit.ts check grounding $P --mark <your-dir>/marked.png
$V src/cli/vlmkit.ts check grounding $P --after "wheel 85,120 60" --after "click 85,68"
```

`--at` hit-tests a coordinate you already have and says which element a click
there would reach.

**`--after` replays actions before measuring**, so the map describes the screen
those actions leave rather than the page as first loaded. It takes the same verbs
and the same pixels as the harness — `"click x,y"`, `"move x,y"`, `"wheel x,y dy"`
— so to map the screen you are looking at, pass your own actions so far, in order.
Without it the map is of the first load, however many actions you have taken.
`--help` has the rest.

## You may read

- This brief.
- Any screenshot the harness writes, and `shots/triage.png`.
- Anything `vlmkit check grounding` prints, and any file it writes for you.
- `docs/cli-reference.md`.

## You MUST NOT read

Pointing a tool **at** the page is fine. Opening it is not.

- `fixtures/grounding-scenario/pages/` — the page's HTML. Do not read, cat, grep,
  head or sed it. It is the answer key.
- `fixtures/grounding-scenario/briefs/answers/` — the goal state.
- `fixtures/grounding-scenario/score-flow.mjs`, `score.mjs` — the graders.
- `fixtures/grounding-scenario/act.mjs` — the harness's own source.
- `fixtures/grounding-scenario/attempts/` — anyone else's attempt.
- `fixtures/grounding-scenario/README.md`, `packages/vlmkit-markup/`,
  `fixtures/grounding/`, `docs/reports/`, `CHANGELOG.md`.

## Your working directory

`fixtures/grounding-scenario/attempts/<your-letter>/` — the harness creates it.

## Deliverables

**1. The page state.** Your `session.json` is the submission; it is written for
you. Stop when you believe the job is done.

**2. `log.md`** in your directory. One row per action — harness actions and tool
runs both:

| # | action | what I expected | what the next screenshot / output showed | how I knew |
|---|---|---|---|---|

"How I knew" should quote the line of tool output, or name the thing in the
picture, that told you — or say plainly that you could not tell.

**3. A report in your final message, under 300 words:**

1. Did you archive the right ticket, and in how many harness actions?
2. **How did you know which ticket was the one** — and at which step did you
   know it? Quote what told you.
3. How did you find the control that archives, and know it was not one of the
   others?
4. What the tool told you that the screenshots alone would not have.
5. Any line of its output you believe is **wrong or unusable** — quote it
   verbatim and say what you did instead.
