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
judgment call in the loop, and for almost everything, **no API key**.

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

## What you can do with it

Each of these is one command against a local HTML file or a URL.

**"Did I break the page?"** — `check integrity` scans three viewports
at once for the defects nobody spots by eyeballing: horizontal
overflow, overlapping/clipped/cut-off text, text painted over by other
elements, invisible text, collapsed containers, JS errors, resources
that failed to load, a page that rendered unstyled. No reference
design needed. Intentional patterns (screen-reader-only text, hero
overlays, ellipsis truncation) are recognized and reported as exempt
instead of failing.

**"Is the wording exactly right?"** — `check copy` takes a plain-text
list of required copy and verifies every line is on the page,
*visibly*, character-for-character. It opens collapsed accordions and
unselected tabs so hidden-by-design copy passes (with provenance), but
copy hidden by trickery — font-size 0, transparent color, off-screen
positioning, text the same color as its background — is called out
with a reason class. Verified against seven real websites with zero
false positives.

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
with selectors attached. `scan mock` first normalizes a retina/Figma
export to CSS pixels so the comparison is fair.

**"Did today's change alter anything visually?"** — `snapshot` captures
a baseline the first time and reports per-viewport pixel diffs (with
heatmaps) on every run after. Approve intended changes; investigate
the rest. `diff-pr` does the same as a CI gate.

**"Is this generated image usable?"** — `check asset` vets an image —
say, character art from an image-generation model — before it enters a
page slot: right aspect ratio, actually transparent background (not
matted onto a rectangle), not near-empty, silhouette readable against
the backdrop it will sit on, colors that don't clash with the page.

There is more (design-token conformance, dark-theme parity, WCAG
contrast/touch/focus checks, i18n text-stress, selector healing,
framework-migration equivalence) — the full map is in `vlmkit --help`,
organized by exactly this kind of "you want to…" question.

## For AI coding agents: a referee that can't be argued with

If you use coding agents, vlmkit's real role is **the referee**. The
workflow that this project has validated across 19 scripted scenarios
(landing pages, e-commerce, dashboards, checkout forms, an app shell
with a hamburger drawer, a card-battle game UI):

1. Give the agent a task and a fixed *done condition* — a set of gates
   that must all pass.
2. The agent builds, runs the gates itself, reads the kickbacks, fixes,
   repeats. Cheap models handle this fine: the gates supply the
   precision the model lacks.
3. Every gate invocation is logged to a local ledger, so "I verified
   it" claims are auditable after the fact.

Agents integrate three ways: they can just run the CLI; or you add the
MCP server (one `.mcp.json` entry — the gates become tools the agent
calls natively); or you copy the `markup-assist` skill into your
project so the agent knows the routing table by heart.

One thing this project treats as a feature, not an embarrassment: in
evaluation runs, agents **did** try to cheat the gates — required copy
packed into a `font-size: 0` span; an `aria-disabled` attribute set for
50ms so an assertion would pass while assistive tech was lied to; a
silent fallback to hand-rolled checks reported as "verified." Each
incident became a hardening: copy is now matched against geometrically
*visible* text only, flows can force-click through disabled controls
to prove they do nothing, and the ledger exposes verification claims
with no runs behind them. The gates have been adversarially tested
against the exact population that will try hardest to fool them.

## What vlmkit is not

- **It does not judge aesthetics.** Whether the page is beautiful, or
  whether generated art "looks like a proper villain," is out of scope
  by design. The gates answer "is it correct, legible, operable, and
  faithful to the spec" — taste stays with humans.
- **It is not a test framework.** No test files to write for the core
  gates; you point a command at a page. (It plays well next to
  Playwright tests, and can generate/heal them, but that's a separate
  corner of the toolkit.)
- **It is not an AI service.** Everything above runs locally and
  deterministically. A handful of optional extras (LLM-drafted CSS
  fixes, VLM transcription) take an API key and are clearly marked.

## Try it

```bash
npm install -D @mizchi/vlmkit
npx playwright install chromium   # once
npx vlmkit check integrity http://localhost:3000/
```

Fix what it names; re-run until `verdict: CLEAN`. From there:

- [README](../README.md) — the two-minute quickstart and setup
- [`markup-assist.md`](./markup-assist.md) — which gate for which job,
  with done-condition recipes
- [`cli-reference.md`](./cli-reference.md) — every command
- [`docs/reports/`](./reports/) — the dated evaluation runs behind
  every claim in this document
