# Brief: act on the Northwind Console from a screenshot (control arm)

You are standing in for a computer-use agent. You have been handed **one
screenshot** of a web page and a list of things a user asked for. For each one
you must say **where to click**, as a pixel coordinate in that screenshot.

You do not get the page's source, you get no tooling, and you do not get to
click and look again. One submission. Your own eyes on the image are the whole
instrument — which is the point of this arm: it measures what the screenshot
alone is worth.

## The screenshot

`fixtures/grounding-scenario/shots/console.png` — 640x360. This is the image a
model is given: the page was rendered at a 1280x720 viewport and reduced by half
before you saw it. Your coordinates are in **this image's** pixel space, origin
top-left. Anything outside 0..639 x 0..359 is off the image.

Read it carefully. Crop it, scale it up, sample its pixels — any inspection of
**this PNG** is allowed and encouraged.

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

## You may read

- This brief.
- `fixtures/grounding-scenario/shots/console.png`, by any means.

## You MUST NOT read or run

- `fixtures/grounding-scenario/pages/` — the page's HTML, by any route.
- `fixtures/grounding-scenario/briefs/answers/` — the expected targets.
- `fixtures/grounding-scenario/score.mjs` — the grader.
- `fixtures/grounding-scenario/attempts/` — anyone else's attempt.
- `vlmkit check grounding`, or any other vlmkit command, or Playwright, or any
  other way of loading the page. This arm is the screenshot and nothing else.
- `packages/vlmkit-markup/`, `docs/reports/`, `CHANGELOG.md`.

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

"What told me" should say what in the image you used — the text you read, the
colour you found, the edge you measured — or "a guess" when it was one.

**3. A report in your final message, under 300 words:**

1. Your six coordinates, and which you would bet on.
2. Which tasks the image answered cleanly.
3. Which tasks the image could not answer, and what was missing — be specific.
4. For any task you guessed: what you would have needed to know.
