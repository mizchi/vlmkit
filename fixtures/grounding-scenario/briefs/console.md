# Brief: act on the Northwind Console from a screenshot

You are standing in for a computer-use agent. You have been handed **one
screenshot** of a web page and a list of things a user asked for. For each one
you must say **where to click**, as a pixel coordinate in that screenshot.

You do not get the page's source, and you do not get to click and look again.
One submission.

## The screenshot

`fixtures/grounding-scenario/shots/console.png` — 640x360. This is the image a
model is given: the page was rendered at a 1280x720 viewport and reduced by half
before you saw it. Your coordinates are in **this image's** pixel space, origin
top-left. Anything outside 0..639 x 0..359 is off the image.

## The tasks

| id | what the user asked for |
|---|---|
| `renew` | "Renew the plan." |
| `manage-globex` | "Open the account management for Globex Media." |
| `export-csv` | "Export the invoices as CSV." |
| `publish` | "Publish my change to the billing contact." |
| `audit-log` | "Take me to the audit log." |
| `account-menu` | "Open my account menu." |

Each one is reachable: for every task there is at least one coordinate in this
image at which a click reaches the intended control. Six for six is possible.

## The tool

`vlmkit check grounding` measures the page the way you see it and prints an
action map — every target's click point in the same screenshot pixels, what a
click there actually reaches, and the risks on that coordinate.

```sh
P=fixtures/grounding-scenario/pages/console.html
V="node --experimental-strip-types src/cli/vlmkit.ts"

$V check grounding $P                       # the action map + the findings
$V check grounding $P --json                # the same, machine-readable
$V check grounding $P --mark <your-dir>/marked.png    # the map drawn on the shot
$V check grounding $P --at 473,96 --at 12,5 # what does a click HERE reach?
```

`--at` takes a coordinate you already have — one of yours, or one the map
printed — and tells you which element a click there would actually reach. It is
repeatable.

`--help` describes the rest. Run it as often as you like, with any flags.

## You may read

- This brief.
- `fixtures/grounding-scenario/shots/console.png`.
- Anything `vlmkit check grounding` prints, and any file it writes for you.
- `docs/cli-reference.md`.

## You MUST NOT read

Pointing a tool **at** the page is fine. Opening it is not.

- `fixtures/grounding-scenario/pages/` — the page's HTML. Do not read it, cat it,
  grep it, or open it in a browser devtools-style dump. It is the answer key for
  half these tasks.
- `fixtures/grounding-scenario/briefs/answers/` — the expected targets.
- `fixtures/grounding-scenario/score.mjs` — the grader.
- `fixtures/grounding-scenario/attempts/` — anyone else's attempt.
- `packages/vlmkit-markup/src/inspect/grounding-scan.ts`, its gate definition and
  its tests, and `fixtures/grounding/` — the tool's own source and fixtures.
- `docs/reports/`, `CHANGELOG.md`.

## Your working directory

`fixtures/grounding-scenario/attempts/<your-letter>/` — create it.

## Deliverables

**1. `answers.json`** in your directory, coordinates in screenshot pixels:

```json
{
  "renew":         { "x": 0, "y": 0 },
  "manage-globex": { "x": 0, "y": 0 },
  "export-csv":    { "x": 0, "y": 0 },
  "publish":       { "x": 0, "y": 0 },
  "audit-log":     { "x": 0, "y": 0 },
  "account-menu":  { "x": 0, "y": 0 }
}
```

**2. `log.md`** in your directory. Per task, one row:

| task | coordinate | confidence (high/low) | what told me |
|---|---|---|---|

"What told me" is the important column, and it should quote: the line of tool
output you acted on, or "the screenshot" when you read it off the image, or "a
guess" when it was. If the tool and the image disagreed, say which you followed.

**3. A report in your final message, under 300 words:**

1. Your six coordinates, and which you would bet on.
2. What the tool told you that you could not have got from the screenshot.
3. What you needed and it did not give you — be specific and quote the output.
4. Any line of its output you believe is **wrong**, and what you did about it.
