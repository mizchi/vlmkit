---
name: mock-markup
description: Markup from a mock image or screenshot — recreate a page as HTML/CSS when the only input is an exported design image (Figma export, retina screenshot, competitor-site capture) with no reference HTML. Normalizes @2x/@3x exports to CSS pixels (scan mock), then drives the deterministic verify-markup loop to a DONE verdict. Works with any agent model including Haiku; the agent's own vision is the only VLM required — no API key. Use when asked to "implement this mock", "turn this screenshot into HTML", or markup from an image that did not come from this repo's own capture tooling.
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
  still real by default, but a *stable* residual that survives a
  correct-looking fix may be the mock's own rendering (design-tool
  antialiasing, embedded photos cresting as components). After TWO
  rounds where a residual resists a plausible fix, re-read that crop of
  the mock and decide whether it is reproducible in CSS at all; if not,
  say so in your report instead of burning rounds.
- **Pixel diff % is advisory.** Font rasterization differs between the
  design tool and Chromium, so expect a higher floor than
  capture-vs-capture fixtures. Composition 0/0 + height within
  tolerance is the gate; the diff number is for trend, not for judging
  done.

## Done condition

`verify markup` prints **DONE** (all targets 0/0 + height in tolerance
+ gates clean or expected-warn-only), and your report includes the
transcribed-copy note and any declared-irreproducible residuals with
their reasoning. If the intake step flagged the mock as noisy, the
report must say which regions were driven by `build component` instead.

Budget and KPIs: as in dynamic-markup (rounds ledger-audited via
`.vlmkit/run-ledger.jsonl`).
