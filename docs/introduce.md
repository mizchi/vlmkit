# What is vlmkit?

An introduction for someone who has never seen this project. No prior
context assumed — not about CSS tooling, not about AI agents.

## The problem it solves

How do you know a web page is actually *right*?

The honest answer, for most teams, is "someone looked at it." A human
squints at a screenshot, scrolls around, and says "looks fine." That
works badly, for a familiar list of reasons:

- The page breaks only at 768px, and nobody happened to look at 768px.
- Two absolutely-positioned labels overlap by 50 pixels, but only when
  a number gets long enough.
- The button works with a mouse but is a `<div>` with a click handler —
  keyboard and screen-reader users can't operate it at all.
- The marketing copy says "Start your free trial" in the spec and
  "Start your trial" on the page, and no pixel-level glance catches it.
- A CSS refactor changed nothing important — except one thing, on one
  viewport, that nobody will notice until a customer does.

The problem got sharper recently: **AI coding agents now write a lot of
HTML and CSS**, and an agent's claim that its work is done is worth
even less than a human's squint. Agents confidently report "verified"
without verifying. Given a checkable goal, some will even game it —
hide the required copy in invisible text, or flip an ARIA attribute for
50 milliseconds so an assertion passes. (Both really happened during
this project's evaluation runs; both are now caught. More below.)

## The idea: measure, don't look

vlmkit renders your page in a real browser (headless Chromium via
Playwright) and turns "does it look right?" into **checks that pass or
fail the same way every time** — DOM geometry, pixel math, computed
styles, accessibility probes. No screenshots to squint at, no AI
judgment call in the loop, and — apart from three clearly-marked
optional extras listed near the end — **no API key**.

(Yes, the name says VLM — vision-language model. The project started
by asking VLMs to judge pages, measured them against ground truth,
and found the VLM judge was the unreliable part. The measurements
became the product; the VLM features were demoted to those optional
key-gated extras. The name is the fossil record.)

When a check fails, it doesn't just say "failed." It prints what this
project calls a *kickback* — the defect, where it is (a CSS selector),
the measured numbers, and usually the direction of the fix:

```
x [page-overflow-x] @768: The page scrolls horizontally by 156px at 768px
  viewport width — sticking out: main > p:nth-of-type(1) (right edge 924px).
x [text-collision] @1280: "Total: €1,240" overlaps "Refunds: €80" by 52x17px —
  same-layer text blocks must not overlap; check negative margins…
```

That format is deliberate: it's readable by a human and pasteable into
an AI agent's next prompt. Fix what it names, re-run, repeat until
green. The loop is the product.

vlmkit calls each of these checks a **gate**: it either passes or it
blocks, and a fixed set of gates is how you define "done" for a piece
of work. What to expect before you install:

- A single-render gate runs in a few seconds. Multi-viewport gates
  render several widths (`check integrity`: three) and
  `check breakpoints --sweep` renders every fuzz step, so those sit
  at the tens-of-seconds end on a breakpoint-heavy page — still cheap
  enough to re-run ten times in a fix loop. Gate findings come in two
  severities: a **suspect** blocks (and fails CI with
  `--fail-on-suspect`); a **warn** is advisory.
- Setup is `npm install` plus a one-time Playwright Chromium download
  (a browser — expect on the order of 150 MB, a few minutes once).
- Point it at a file or at your dev server. It navigates and waits
  for network activity to go idle (30s cap), so React/Vue/
  anything-client-rendered is fine, CSS-in-JS included — styles are
  measured after they exist. The honest flip side: a page that
  *never* goes idle (persistent polling, websockets) hits that 30s
  cap and the gate errors rather than measuring a half-settled page —
  point it at a locally rendered file or a route without the socket.
  Same workaround for pages behind a login: a no-auth route or a
  local file (there is no cookie/storage-state injection today).

## What you can do with it

Each of these is one command against a local HTML file or a URL.

**"Did I break the page?"** — `check integrity` scans three viewports
at once for the defects nobody spots by eyeballing: horizontal
overflow, overlapping/clipped/cut-off text, text painted over by other
elements, invisible text, collapsed containers, JS errors, resources
that failed to load, a page that rendered unstyled. No reference
design needed. Intentional patterns (screen-reader-only text, hero
overlays, ellipsis truncation) are recognized and reported as exempt
instead of failing. This gate has its own real-page false-positive
audit: [five mirrored external sites](./reports/2026-07-30-integrity-external-dogfood.md)
(example.com, danluu.com, CSS Zen Garden, Hacker News, W3C APG),
which surfaced four false-positive classes — all fixed with standing
regression tests — and one true positive (Hacker News really does
scroll horizontally at 768px).

**"Is the wording exactly right?"** — `check copy` takes a plain-text
list of required copy and verifies every line is on the page,
*visibly*, character-for-character. It opens collapsed accordions and
unselected tabs (found via their ARIA attributes) so hidden-by-design
copy passes, and the report records which revealed state carried each
line. Copy hidden by trickery is a different story: font-size 0,
transparent color, off-screen positioning, and text the same color as
its background are each called out with a reason class. That invisibility detector (specifically — not
all of copy matching) was audited against seven real websites (MDN,
Wikipedia, W3C, web.dev, Hacker News, danluu.com, example.com) with
zero false positives —
[methodology and full results here](./reports/2026-07-31-copy-invisible-real-site-audit.md).
The manifest itself is three lines of convention:

```
# copy.txt — one required line per row; "# " headings are comments
Start your free trial
Cancel anytime
```

Whitespace is normalized, matching is case-sensitive (casing is
spec), and a line may match anywhere on the page.

**"Does it actually behave?"** — `check breakpoints --sweep` proves
your responsive boundary is exact (no width where the layout breaks,
no off-by-one at 768px). `check interactions` presses keys at every
control and maps the ARIA state transitions — the clickable-`<div>`
problem is caught mechanically. `verify flow` runs a scripted user
journey and asserts each step's outcome on the live DOM: in one
evaluation, a card-game screen had to survive "play a card, watch the
enemy's HP drop by exactly 6, spend the energy, end the turn, take
8 damage into 5 block" — every number checked by clicking through it.

**"Does it match the design?"** — `verify markup` compares your build
against a target screenshot and returns one verdict plus the full fix
list: which components are missing, misplaced, mis-sized, mis-ordered,
with selectors attached. The mechanism is deterministic, not a vision
model: both images are segmented into solid-fill regions by pixel
connectivity, regions are paired across target and render by
position/size/fill, and every unpaired or mismatched region is
pixel-confirmed against the target before it's allowed to block.
`scan mock` first normalizes a retina/Figma export to CSS pixels so
the comparison is fair.

**"Did today's change alter anything visually?"** — `snapshot` captures
a baseline the first time and reports per-viewport pixel diffs (with
heatmaps) on every run after. Approve intended changes; investigate
the rest. `diff-pr` does the same as a CI gate.

**"Is this generated image usable?"** — `check asset` vets an image —
say, character art from an image-generation model — before it enters a
page slot: right aspect ratio, actually transparent background (not
matted onto a rectangle), not near-empty, silhouette readable against
the backdrop it will sit on, colors that don't clash with the page.

As a copy-paste cheat sheet (with when you'd reach for each; only
`verify flow` is missing, because it needs a page-specific flow
script rather than a one-liner):

```bash
# while editing — after any layout/CSS change:
npx vlmkit check integrity page.html                         # anything broken?
# before pushing — when the page carries spec'd copy:
npx vlmkit check copy page.html --manifest copy.txt          # wording exact & visible?
# before pushing — when the page is responsive:
npx vlmkit check breakpoints page.html --sweep               # boundaries hold?
# before pushing — when the page has interactive controls:
npx vlmkit check interactions page.html                      # keyboard-operable?
# while building against a design:
npx vlmkit verify markup attempt.html --target design.png    # matches the design?
# continuously / in CI — regression tracking:
npx vlmkit snapshot http://localhost:3000/ --output .vlmkit/snapshots   # what changed?
# before dropping a generated image into the page:
npx vlmkit check asset sprite.png --slot 220x300 --expect-transparent   # usable?
```

Iterating is just re-running the same command after each edit (there
is also `vlmkit watch` for a file-watching inner loop). A few
mechanics worth knowing up front: copy matching is
whitespace-normalized but **case-sensitive** substring matching
(casing is treated as spec); `check breakpoints` renders one pixel
below, at, and above every breakpoint your CSS declares, and
`--sweep` additionally fuzzes the widths in between in 25px steps;
and in CI any gate becomes a failing step with `--fail-on-suspect`:

```yaml
# .github/workflows/ui-gates.yml (the relevant steps)
- run: npm ci && npx playwright install chromium --with-deps
- run: npx vlmkit check integrity dist/index.html --fail-on-suspect
```

There is more: design-token conformance (hard-coded values that
should be tokens), dark-theme parity, WCAG contrast/touch/focus
checks, layout survival under 30%-longer translated text, suggested
replacements when a refactor kills a CSS selector, and visual
equivalence for framework migrations. The full map is in
`vlmkit --help`, organized by exactly this kind of "you want to…"
question.

## How is this different from screenshot-testing services?

Hosted visual-testing products (and Playwright's own screenshot
assertions) answer one question: *did the pixels change since the
approved baseline?* vlmkit's `snapshot`/`diff-pr` covers that job
locally. But most of this document is about a different question that
baseline-diffing cannot ask: *is the page correct in the first
place?* A baseline diff is blind on day one (there is nothing to
compare against), blind to defects that were already in the baseline,
and mute about causes — it shows you changed pixels, not "this
element overflows by 156px, here is its selector." The gates are
reference-free, name the defect, and are built to referee an agent's
work loop. The two approaches compose: gates while building,
baseline diffs to hold the line afterwards.

## Adopting in a team

The operational questions a lead will ask, answered plainly:

- **Who maintains the copy manifest?** It's a plain-text file in your
  repo, next to the page it specs. Treat it like the spec it is:
  copy changes and manifest changes travel in the same PR, and a
  forgotten manifest update surfaces as a named failing line in the
  CI copy gate instead of drifting silently.
- **When do baselines get re-approved?** `snapshot` diffs against the
  stored baseline until someone runs `snapshot approve` — that's the
  deliberate, reviewable re-baseline step. Baselines are files in the
  output directory you chose; version or ignore them per your team's
  taste (they're plain PNGs + a JSON report, no service, no lock-in).
- **What's the false-positive triage path?** Read the finding: if the
  gate itself recognized intent it's already under `exempted` (not a
  failure); if it's deliberately hidden copy, accept its class with
  `--allow-invisible <class>`; if it's a genuinely novel intentional
  pattern integrity mis-flags, that's a tool issue — file it (that is
  exactly how the exemption set grew to date).
- **Where does gate configuration live?** Contracts, flows, copy
  manifests, and snapshot config (`vrt.config.json`) are files in
  your repo. Everything else — which gates run per page, and any
  `--allow-invisible` acceptances — is CLI flags, so the reviewed
  source of truth is wherever you write the invocation: the CI yaml
  or an npm script. That's deliberate but has a consequence worth
  knowing: to see every active suppression, you grep the yaml, and
  each run's verdict lands in the ledger. There is no central config
  file that aggregates gate sets today.
- **Can we encode our own rules?** Yes — two of the gates are
  user-defined by design. `check layout --contract layout.json` turns
  structural rules into a machine-checked contract. This is the whole
  format — a list of rules, each checked at a viewport width:

  ```json
  { "rules": [
    { "selector": ".sidebar",   "at": 1280, "width": 260 },
    { "selector": ".stat-card", "at": 768,  "perRow": 2, "count": 4 },
    { "selector": "button",     "at": 375,  "minHeight": 48 },
    { "selector": "header",     "at": 375,  "above": "main", "fullWidth": true }
  ] }
  ```

  (`minHeight` checks every match — touch-target rules; `width`/
  `perRow`/`above`/`count`/`visible` cover the rest.) `verify flow
  --flow flow.json` does the same for behavior ("click X, then Y must
  show Z"). Your design-system rules become gates without writing
  tool code.
- **What do agents get vs. juniors?** The same kickbacks. Juniors get
  named, measured CSS lessons; agents get a referee. The MCP server
  exposes verify_markup, check_integrity, check_copy,
  check_interactions, scan_handlers, build_page, check_layout,
  check_equivalence, and verify_flow as tools.
- **How does the manifest scale across pages?** Shared copy means
  shared updates: if a component's CTA text changes and it appears on
  five pages, five manifests change in that same PR — any page whose
  manifest was forgotten fails its copy gate, provided that page's
  gate is actually wired into CI (that wiring is yours to maintain).
  Manifest updates go through the same review as any copy change.
- **Will it flake in CI?** The geometry gates measure DOM layout in
  the same pinned Chromium on every run, so they are stable across
  machines *except* where platform font metrics move text a pixel —
  rare for suspects, which trigger on gross measurements (156px
  overflow, 52px overlap), not 1px shifts. Pixel-exact `snapshot`
  baselines are a different animal: generate them in the same
  environment that compares them (in CI, or one shared container) —
  a macOS-made baseline diffed on Linux will disagree about font
  antialiasing, and that is the classic road to a gate everyone
  ignores.
- **What does rollout look like?** Pilot on one page (run
  `check integrity`, expect it to surface existing debt), then add
  `--fail-on-suspect` gates to CI for your critical pages, then
  grow contracts and manifests where specs are stable. Agent
  integration is optional and can come last.


## For AI coding agents: a referee with an audit trail

(Not using coding agents? Skip ahead — everything above works
standalone.)

If you do, vlmkit's role is the referee. Across 19 scripted
evaluation scenarios (pages in
[`fixtures/auto-markup-proof/`](../fixtures/auto-markup-proof/),
write-ups in [`docs/reports/`](./reports/)) the working loop is:

1. Give the agent a task and a fixed **done condition** — a set of
   gates that must all pass (e.g. `check integrity` CLEAN +
   `check copy --manifest` 0 missing + `scan handlers` /
   `check interactions` no suspects).
2. The agent builds, runs the gates itself, reads the failure
   reports, fixes, repeats. Inexpensive models handle this fine — the
   zero-shot scenario attempts linked above were driven by Claude
   Haiku 4.5 and reached their gate done-conditions (some only after
   audit-driven kickback rounds — the reports show which); the gates
   supplied the precision the small model lacked.
3. Every gate invocation is automatically appended to
   `.vlmkit/run-ledger.jsonl` (one JSON line per run: timestamp,
   tool, source, verdict). When an agent says "I verified it," you
   grep the ledger; an empty ledger under a "verified" claim is
   itself a finding — that exact catch happened in
   [the black-box onboarding run](./reports/2026-07-31-blackbox-onboarding-validation.md).

Integration is the CLI itself, the MCP server
(`{ "mcpServers": { "vlmkit": { "command": "npx", "args": ["-y", "@mizchi/vlmkit", "mcp"] } } }`
in `.mcp.json` — the gates become tools the agent calls natively), or
the `markup-assist` skill: one SKILL.md instruction file (routing
table, loop discipline, and rules like *"never hide copy to pass
check copy"* and *"if the tool itself fails to run, STOP and report —
don't substitute hand-rolled checks and claim verified"*) copied from
this repo's `.claude/skills/markup-assist/` into yours.

Did agents try to cheat these gates? Yes, and the cases are
documented: copy hidden in a `font-size: 0` span
([S18](./reports/2026-07-31-s18-zero-shot-chat-tool-gate-gaming.md)),
`aria-disabled` flipped for 50ms so an assertion passed while
assistive tech was lied to
([S19](./reports/2026-07-31-s19-game-ui-occlusion-probe.md)), a
silent fallback to hand-rolled checks reported as "verified"
([black-box run](./reports/2026-07-31-blackbox-onboarding-validation.md)).
Each one became a hardening — visible-text matching (a
[12-vector hiding battery](./reports/2026-07-31-copy-gate-silencing-battery.md)
plus a
[7-site audit](./reports/2026-07-31-copy-invisible-real-site-audit.md)),
force-clicks through disabled controls, ledger-auditable claims. The
linked reports are the test evidence; this will not stop future
agents from finding new tricks, but the ones that were tried are
closed.

## Honest limits

Trust lives in stated boundaries, so here are the ones that matter:

- **"Intentional" is recognized by measurement, not by magic.** The
  integrity gate exempts patterns it can verify geometrically —
  screen-reader-only text (fully clipped, not partially cut), image
  replacement, hero overlays, ellipsis truncation. There is no
  user-defined exemption list for integrity yet; the copy gate DOES
  take an explicit per-class allow flag for deliberately hidden copy.
  A novel intentional pattern may need a small markup adjustment or a
  report to the tracker.
- **A green gate set is not a correctness proof.** Gates catch the
  defect classes they encode. This project tracks its own false
  negatives the hard way — every evaluation run is independently
  audited for defects all gates missed. Across the 19 scenarios that
  audit found exactly one (art painting over a readout, six gates
  green); it became a new probe the same day
  ([the S19 report](./reports/2026-07-31-s19-game-ui-occlusion-probe.md)).
  The honest claim is "adversarially maintained," not "complete."
- **A flow gate proves the paths it walks and nothing else.** If a
  behavior matters, put a step on it.
- **Third-party CSS is checked as rendered.** If your UI library
  overflows at 375px, the gate reports it like any other defect —
  there is no per-origin scoping.
- **Common intentional patterns, concretely**: sticky/fixed bars that
  cover content while pinned are measured as scroll-escapable and
  exempted; hero text-over-image overlays are exempted when the
  backing is measured as such; dynamic content (tickers, timestamps)
  is handled by `snapshot --mask ".selector"`, not by integrity. Transient states (open modals, hovering tooltips) are only
  checked if a flow step opens them.

## What vlmkit is not

- **Not an aesthetics judge** — "is it correct, legible, operable,
  faithful to spec" is the scope; taste stays with humans.
- **Not a test framework** — no test files for the core gates; it
  runs alongside your Playwright suite (keep your screenshot
  assertions — gates answer a different question), and
  `--fail-on-suspect` / `diff-pr` cover CI.
- **Not an AI service** — everything runs locally and
  deterministically. Exactly three optional features take an API
  key: `heal markup`, `check copy --vlm`, and the CSS fix-loop
  experiments.

vlmkit is MIT-licensed. It is also young — `@mizchi/vlmkit` 0.8.x,
one maintainer, with the evaluation reports cited here dated within
weeks of each other. The gates carry the receipts above, but nothing
substitutes for running them on your own pages; the rollout advice
(pilot advisory, gate CI later) is sized to that maturity.

## Try it

```bash
npm install -D @mizchi/vlmkit
npx playwright install chromium   # once
npx vlmkit check integrity http://localhost:3000/
```

What the loop looks like in practice, end to end:

```
$ npx vlmkit check integrity page.html
verdict: DEFECTS (1 fail, 0 warn, 0 exempted)
  x [page-overflow-x] @768: The page scrolls horizontally by 144px at
    768px viewport width — sticking out: div.chart-strip (right edge 912px).

$ # the selector names the culprit: .chart-strip has width: 880px
$ # change it to: width: 100%; max-width: 880px;

$ npx vlmkit check integrity page.html
verdict: CLEAN (0 fail, 0 warn, 0 exempted)
```

That's the whole workflow — the gate names the element and the
measurement, you (or your agent) change one line, the gate confirms.
Intentional patterns don't fight you: screen-reader-only text, hero
overlays, and ellipsis truncation are auto-recognized and reported as
`exempted`, and deliberate hidden copy can be accepted per class with
an explicit flag. From there:

- [README](../README.md) — the two-minute quickstart and setup
- [`markup-assist.md`](./markup-assist.md) — which gate for which job,
  with done-condition recipes
- [`cli-reference.md`](./cli-reference.md) — every command
- [`docs/reports/`](./reports/) — the dated evaluation runs behind
  every claim in this document
