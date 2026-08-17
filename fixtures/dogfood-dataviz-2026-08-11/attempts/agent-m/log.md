# agent-m — ops dashboard dogfood log

Server: `node serve.mjs 5311` from this directory. Page checked as served throughout.

## Round 1 — measure

**`check integrity http://localhost:5311/`** (no flags) — reproduced complaint #1 exactly:

```
error: page load timed out after 30000ms waiting for `networkidle`
  1 request(s) still open:
    http://localhost:5311/api/live (open 30.0s)
  ... Try `--wait-until load` (or `domcontentloaded`), or pin the network with `--har <file>`.
  Raising `--timeout` will not help an endpoint that never closes.
```

This is the best error message in the tool. Names the culprit request, the elapsed
time, the fix, and the non-fix. 31s wasted, once.

**`check integrity … --wait-until load`** — 2.6s, `verdict: DEFECTS`:

- `[page-overflow-x] @768: The page scrolls horizontally by 24px at 768px viewport
  width — caused by: main.grid > section:nth-of-type(3) (extends to x=792px …)` → #3
- `[low-contrast-text] … rgb(168, 168, 168) on rgb(255, 255, 255) is contrast 2.38:1
  — below the 4.5:1 WCAG AA floor for 13px body text. 3 element(s)` → #2

**`check copy … --wait-until load`** — `placeholder-text: Placeholder "TODO" found in
rendered text` → #4.

**`check design … --wait-until load`** — `button 6 inst 3 styles reuse 2x drift`.
Dominant style, used 3x, is the vendor's: "padding 0/0/0/0, radius 0, no painted
text, border 0, bg rgba(0,0,0,0)". The gate volunteered the diagnosis for #5:
"that shape is usually a third-party widget's own controls. If it is not yours,
exclude its subtree: --exclude". All five reported problems located in one round.

**`check breakpoints`** independently confirmed #3 at the 767px boundary.

## Round 1 — fix

- `theme.css` `.status` `#a8a8a8` → `#6b6b6b` (5.2:1).
- `theme.css` `.grid` `repeat(3, 240px)` → `repeat(3, minmax(0, 240px))`. 720px of
  track + 48px gap + 48px padding = 816px, over a 768px tablet viewport; the only
  media query was `max-width: 767px`, so tablet got the desktop layout.
- `index.html` error-rate status → "Share of successful requests, last 5 min"
  (brief confirms the denominator).
- `vlmkit.gates.json` via `gates init`, then hand-edited: `webServer` block,
  `--exclude ".vendorchart-ctrl-group"` on `check design`.

`gates init` added `--wait-until load --timeout 15000` by itself for a URL source
and explained why. Good.

## Round 2 — re-measure

`gates run`: 5/7 pass, 13s wall. Two problems, both mine-via-the-tool:

- `check layout` → `did not run: error: --contract <contract.json> is required`.
  `gates list` printed it as a runnable plan line; the arity error only appears at
  run time. Dropped the gate.
- `check a11y touch` → fails on the three vendor 24x24 buttons. This gate has no
  `--exclude` and no per-selector `--allow`, unlike `check design` and
  `check integrity`. Tried the help's own suggestion, `--level AA`: passes, but it
  lowers the bar for our own buttons too, and the help claims "Clustered targets
  (within 24px of a sibling) are flagged" — the vendor buttons sit 4px apart and
  were *not* flagged at AA. Settled on an auditable page-wide rule suppression with
  reason/owner/expires, which `gates suppressions` lists as `109d left`.

## Round 3 — sensitivity check on #5, then green

Added `--allow "button#acknowledge;…"` for the deliberate primary variant →
`COHERENT`. Then tested whether the number actually *moves*: appended
`#snooze { border-radius: 2px; padding: 6px 10px; }` and re-ran.

Still `verdict: COHERENT (0 finding(s))`. **The gate was silenced, not fixed.**
Excluding vendor DOM leaves 3 buttons; allowing one leaves 2; 2 is below the
default `--min-instances 3`, so the role is not judged at all — and nothing in the
output says so. A skipped role and a coherent role print identically.

Without the `--allow` the same page is permanently `DRIFT` (the primary button is
a legitimate variant). So out of the box, both configurations reproduce complaint
#5 — the verdict never moves, it is just stuck at a different value.

Fix: `--min-instances 2 --min-reuse 2` alongside the allow. Verified both
directions:

```
clean:    button  2 inst  1 styles  reuse   2x  0 one-off  ok     → COHERENT
drifted:  button  2 inst  2 styles  reuse   1x  2 one-off  drift  → DRIFT (exit 1)
```

Final `gates run` from a cold start (server spawned by `webServer`, `CI=1`):
`ALL PASS (6/6)`, wall 15.1s, `webServer: stopped`, exit 0.

## CI command

```
cd fixtures/dogfood-dataviz-2026-08-11/attempts/agent-m
npx vlmkit gates run          # webServer starts and stops the dashboard itself
npx vlmkit gates suppressions --require-expiry --require-owner
```
