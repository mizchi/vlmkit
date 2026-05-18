---
name: vrt-markup-synth
description: Generate or extract HTML/CSS components from screenshots and rendered pages. Five sub-tools — build component (image → standalone component), scan component (screenshot → cropped component PNGs), check tokens (design-token conformance), check theme (theme parity audit), stress i18n (overflow / wrap stress test). Use when the agent needs to author markup from a visual reference, audit token usage across an existing UI, or stress-test the layout under longer content / locale changes. VLM-driven; requires API keys.
---

# vrt-markup-synth

Markup tooling that uses a VLM to understand a target image or rendered
DOM, then either reproduces it as standalone HTML+CSS or audits it
against the design system. Five complementary commands; pick one per
task.

## Sub-tools

| Command | Input | Output | Purpose |
|---|---|---|---|
| `vrt build component <image>` | PNG/JPG screenshot | `component.html` + `component.css` | Reproduce a component from a reference image. VLM extracts structure + styling. |
| `vrt scan component <screenshot>` | Full-page screenshot | `components/*.png` | Detect distinct components, crop each into its own PNG for piecewise inspection. |
| `vrt check tokens <html-or-url>` | Page | Token-conformance report | Find hard-coded values that should reference design tokens (colors, spacing, font sizes). |
| `vrt check theme <url>` | Live URL | Theme-parity report | Force dark mode (or `prefers-color-scheme`), report selectors still painting with hard-coded light-mode colors. |
| `vrt stress i18n <url>` | Live URL | Layout stress report | Inflate text content (×2 length, multi-byte chars) and screenshot under each viewport; report overflow / wrap breakage. |

## When to use

- **build component**: "here's a Figma export, give me the HTML/CSS"
  workflow without manually transcribing.
- **scan component**: "this dashboard has 8 components; extract each
  so I can fix one at a time."
- **check tokens**: drift audit before / during a design-system
  rollout.
- **check theme**: pre-launch sanity for a dark-mode rollout.
- **stress i18n**: detect "DE / JP / AR will break the layout" *before*
  the bug is filed.

## When NOT to use

- Comparing two existing pages: `vrt-visual-diff`.
- Migrating an existing implementation: `vrt-migration-eval`.
- Self-repairing a known regression: `vrt-css-fix-loop`.

## Quickstart

```bash
# Image → component
vrt build component design.png --output components/card.html
# Writes components/card.html + components/card.css.

# Full screenshot → per-component crops
vrt scan component dashboard.png --output components/
# Writes components/<auto-name>.png for each detected component.

# Token conformance
vrt check tokens src/index.html --tokens design-tokens.json

# Theme parity (dark mode)
vrt check theme http://localhost:3000/ --mode dark

# i18n / overflow stress
vrt stress i18n http://localhost:3000/ \
  --locales de,ja,ar \
  --multiplier 2
```

## Build component — what the VLM does

`vrt build component` invokes the VLM with the reference image and a
prompt that asks for:

1. Component-level structure (parent → children).
2. Per-element semantic role (heading, button, input, etc.).
3. CSS properties: layout (flex / grid), spacing, color, typography.
4. Responsive intent if multiple viewport variants of the image are
   provided.

Output is **standalone**: the generated HTML/CSS does not depend on
any framework or external CSS reset. Combine with `vrt diff html`
(see `vrt-visual-diff`) to verify the reproduction matches the
target.

## Scan component — what gets detected

`vrt scan component` runs bbox detection on the screenshot, then
clusters elements that look like a single component (e.g. card =
image + title + body + actions). It outputs:

- One PNG per detected component (cropped tightly).
- A `manifest.json` listing each component's bbox + role guess.

This is the right preprocessing step before running
`vrt build component` on each piece.

## Check tokens — what counts as a violation

`vrt check tokens` flags computed-style values that are not present
in the token set. Colours, spacing values, font sizes, and
border-radius are checked by default. Pass `--tokens
<path-to-tokens.json>` to override the token source. Output is a
table:

```
selector       property        value         nearest-token   delta
.card          padding-top     14px          space-3 (12px)  +2px
.card-title    font-size       15px          fs-md (16px)    -1px
```

The "nearest-token" suggestion makes the fix obvious without a manual
lookup.

## Check theme — how dark-mode audit works

The tool loads the URL twice (light + dark via
`prefers-color-scheme` emulation), then surfaces:

- Selectors whose `color` / `background-color` didn't change at all.
- Selectors whose contrast ratio fails WCAG AA in dark mode.

Useful as a CI gate before declaring "dark mode supported."

## Stress i18n — what gets stressed

For each locale × text-multiplier combination:

1. Inflate every text node by the multiplier.
2. Swap to locale-representative characters (long German, multi-byte
   JP, RTL Arabic).
3. Screenshot every viewport.
4. Diff against the original; flag overflow (text spilling out of its
   container).

Report lists selectors that broke, with the worst-case screenshot
inline.

## Environment

| Variable | Required by |
|---|---|
| `VRT_VLM_MODEL` | All sub-tools (defaults to `bytedance/ui-tars-1.5-7b`) |
| `OPENROUTER_API_KEY` | Unprefixed model id |
| `GEMINI_API_KEY` | `gemini:` prefix |
| `ANTHROPIC_API_KEY` | `claude:` prefix |

For high-quality markup synthesis (`build component`), prefer the
`claude:claude-haiku-4-5-*` model — the cost is justified because the
output is consumed directly. For audit tools (`check tokens` / `check
theme`), the default ui-tars model is fine.

## Costs

| Tool | Typical calls | Approx cost (Haiku) |
|---|---|---|
| `build component` | 1-2 per component | ~$0.004 / component |
| `scan component` | 1 per screenshot | ~$0.002 / page |
| `check tokens` | 1 per page | ~$0.001 / page |
| `check theme` | 2 per page (light + dark) | ~$0.004 / page |
| `stress i18n` | locales × viewports per page | scales linearly |

## Failure modes

- VLM returns "image not available" → wrong model (some OpenRouter
  models don't support image input). Switch to ui-tars-1.5-7b or
  claude:haiku.
- Generated HTML doesn't match image → the reference image has
  multiple components; run `scan component` first to isolate.
- `check theme` reports every selector as failing → dark mode isn't
  actually enabled on the page (missing `[data-theme=dark]` toggle in
  the URL). Pass `--theme-selector <selector>` to override.
