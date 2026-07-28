---
name: mock-markup
description: Markup from a mock image or screenshot — recreate a page as HTML/CSS when the only input is an exported design image (Figma export, retina screenshot, competitor-site capture) with no reference HTML. Normalizes @2x/@3x exports to CSS pixels (scan mock), then drives the deterministic verify-markup loop to a DONE verdict. Works with any agent model — the agent's own vision is the only VLM required, no API key; Haiku handles structure/spacing cheaply, hard 1px endgames measured to need Sonnet (see Model selection). Use when asked to "implement this mock", "turn this screenshot into HTML", or markup from an image that did not come from this repo's own capture tooling.
---

# Mock Markup — image in, verified page out

The auto-markup / dynamic-markup loops assume targets captured by this
repo's own tooling: @1x, pixel width = CSS viewport width, and a
reference page that proves the 0/0 floor. A mock arrives with none of
that. This mode closes the three gaps in order: **normalize the image,
transcribe what it shows, loop on the verdict.**

## Phase 0 — intake (once per image)

```bash
vlmkit scan mock mock.png --out targets/target-desktop.png
```

- Infers the device-pixel scale (@2x Figma exports, @3x phone shots) by
  matching against common CSS viewport widths, and writes the
  normalized @1x PNG. **Loop against the normalized file, never the
  raw export** — a 2560px-wide retina image renders the attempt at a
  2560px viewport and nothing converges.
- If the report says the scale is ambiguous, resolve it yourself
  (`--width <design px>` when the design width is known; Figma frames
  are usually 1440 or 1280).
- If the report says **noisy** (component count above ~24): the mock is
  photo-heavy or dense. Build the page skeleton with the page loop, but
  drive each busy region separately — crop it and use `build component`
  — instead of expecting page-level 0/0 in one pass.
- Multiple images at different widths = responsive variants: normalize
  each, and treat the widths as the breakpoint spec (dynamic-markup
  Phase A rules apply).

## Phase 1 — transcription (once)

Read the normalized image ONCE with your own vision and take thorough
notes: structure, sizes (measure — sizes are spec), colors, and **the
complete copy**. Real text from the mock, transcribed exactly; there is
no reference page to fall back on, and `check copy`'s placeholder scan
treats lorem-ipsum-style filler as a suspect. Photos and illustrations
inside the mock are content, not layout: reproduce their box (size,
position, fill approximation or gradient), never try to redraw them.

## Phase 2 — the loop

```bash
vlmkit verify markup attempt.html --target targets/target-desktop.png [...]
```

Same discipline as the fixture flows (one fix per round, obey the
trend line, fix the first kickback item first), with two mock-specific
caveats:

- **No `--reference`, so no calibration floor.** Kickback items are
  still real by default. A residual may be declared design-tool
  rendering (and reported instead of fixed) ONLY when ALL of these
  hold — the S7 run abused this clause to rationalize plain CSS bugs,
  so the bar is deliberately high:
  1. it is ≤2px thin OR sits inside an embedded photo/illustration
     region the intake flagged as noisy;
  2. you re-read the actual crop and name the pixel evidence (colors,
     alpha gradient) in your report — "survived my fixes" is not
     evidence;
  3. it is NOT a solid-fill component ≥8px tall, NOT a page-height
     delta, and NOT accompanied by gap/ordering items in the same
     region — those are always your CSS.
  A page-height error is never an artifact: it is unclosed spacing,
  and everything below the first wrong gap is its debris. Fix the
  gap items before touching anything the height error displaced.
- **Pixel diff % is advisory.** Font rasterization differs between the
  design tool and Chromium, so expect a higher floor than
  capture-vs-capture fixtures. Composition 0/0 + height within
  tolerance is the gate; the diff number is for trend, not for judging
  done.

## Model selection

Measured on this exact task type (S7-fresh A/B, same prompt and
budget): **Sonnet reached DONE autonomously in 9 rounds (~6x the cost
per run); Haiku 4.5 stalled NOT DONE at 12 rounds on the 1px-divider
endgame (~6x cheaper, ~3x faster).** Mock work leans harder on the
endgame skills (hairline placement, text-tone matching against
design-tool rasterization) than fixture work does, so the model gap
matters more here:

- Default to **Sonnet** for a one-off "turn this mock into a page"
  request that must ship without supervision.
- Use **Haiku + driver handoffs** when batching many mocks behind a
  verifier harness and cost dominates; expect to finish hard pages
  with escalation legs. Full guidance and the escalation pattern:
  dynamic-markup SKILL.md § Model selection.

## Done condition

`verify markup` prints **DONE** (all targets 0/0 + height in tolerance
+ gates clean or expected-warn-only), and your report includes the
transcribed-copy note and any declared-irreproducible residuals with
their reasoning. If the intake step flagged the mock as noisy, the
report must say which regions were driven by `build component` instead.

Budget and KPIs: as in dynamic-markup (rounds ledger-audited via
`.vlmkit/run-ledger.jsonl`).
