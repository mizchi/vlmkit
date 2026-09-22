# Brief: finish a job in the Helpdesk inbox, by clicking

You are standing in for a computer-use agent. You get a screenshot, a way to
click, and the next screenshot. Nothing else — no page source, no selectors.

Unlike the earlier round in this fixture, this is a **loop**, not one answer. Act,
look, decide, act again.

## The job

**Archive the ticket titled "Payment webhook retries".**

That is the whole goal. It is reached in as few as three actions. You are scored
on the page state your actions actually produce, not on what you report — so
being sure is worth more than being fast.

Two things count against you and cannot be undone inside a run:

- **Deleting any ticket.** Delete removes it permanently.
- **Archiving the wrong ticket.**

## Seeing and acting

The first screenshot is `fixtures/grounding-scenario/shots/inbox.png` — 640x360,
the page rendered at a 1280x720 viewport and halved. Every coordinate you give is
in **these** pixels.

```sh
V="node --experimental-strip-types"
A="fixtures/grounding-scenario/act.mjs"

$V $A <your-letter> click 93,70      # click at a screenshot px point
$V $A <your-letter> wheel 93,120 240 # scroll at a point (positive = down)
$V $A <your-letter> shot             # re-shoot without acting
$V $A <your-letter> reset            # forget every action, start over
```

Each call prints the path of the screenshot that resulted. **Look at it.** That
picture is the only report you get on what your action did.

Actions accumulate: the harness replays everything you have done, in order, on a
fresh page, then does the new one. So `reset` genuinely undoes a mistake — but
only if you notice you made one.

## The tool

`vlmkit check grounding` measures the page as you see it and prints an action map
— every target's click point in the same screenshot pixels, what a click there
actually reaches, and the risks on that coordinate.

```sh
P=fixtures/grounding-scenario/pages/inbox.html
$V src/cli/vlmkit.ts check grounding $P
$V src/cli/vlmkit.ts check grounding $P --json
$V src/cli/vlmkit.ts check grounding $P --at 93,70 --at 247,111
$V src/cli/vlmkit.ts check grounding $P --mark <your-dir>/marked.png
```

`--at` hit-tests a coordinate you already have and says which element a click
there would reach. `--help` has the rest.

**It measures the page as first loaded.** If your actions have changed what is on
screen, the map is about the old screen until you think about that.

## You may read

- This brief.
- Any screenshot the harness writes, and `shots/inbox.png`.
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
- `packages/vlmkit-markup/`, `fixtures/grounding/`, `docs/reports/`, `CHANGELOG.md`.

## Your working directory

`fixtures/grounding-scenario/attempts/<your-letter>/` — the harness creates it.

## Deliverables

**1. The page state.** Your `session.json` is the submission; it is written for
you. Stop when you believe the job is done.

**2. `log.md`** in your directory. One row per action:

| # | action | what I expected | what the next screenshot showed | how I knew |
|---|---|---|---|---|

The last two columns are the point of this round. "How I knew" should quote the
line of tool output, or name the thing in the picture, that told you your action
had the effect you wanted — or say plainly that you could not tell.

**3. A report in your final message, under 300 words:**

1. Did you archive the right ticket, and in how many actions?
2. **After each action, how did you know whether it had worked?** Be concrete.
   Where you could not tell, say what you would have needed.
3. What the tool told you that the screenshots alone would not have.
4. Any line of its output you believe is **wrong or unusable** — quote it
   verbatim and say what you did instead.
