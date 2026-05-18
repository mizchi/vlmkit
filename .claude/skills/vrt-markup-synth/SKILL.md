---
name: vrt-markup-synth
description: Five DOM/pixel-based signal tools for markup work — turn a screenshot + HTML scaffold into a converging pixel diff (build component), crop a page screenshot into per-component PNGs (scan component), audit hard-coded values against a design-token scale (check tokens), verify theme parity (check theme — light vs dark render), and stress-test layout under inflated text (stress i18n). All five are pure DOM + Playwright + pixel processing — **no VLM / no API key required**. The agent supplies the markup reasoning; the tool surfaces the signal. Use when you've authored HTML/CSS and want signal back without paying VLM latency or cost.
---

# vrt-markup-synth

Despite the name, **these tools do not generate markup**. They give an
agent *signal* — pixel diffs, bbox crops, computed-style violations,
light/dark fill comparisons, overflow flags — that an agent uses to
write or revise HTML/CSS itself. The agent is the VLM. Each tool is
deterministic Playwright + image math; runs in ~1-5s; needs zero API
keys.

## Sub-tools

| Command | Input | Output | What runs |
|---|---|---|---|
| `vrt build component <target.png> <current.html>` | Reference image + your current HTML | Markdown report: pixel diff + bbox + palette + heatmap + text-row signals | Playwright renders `current.html` at the target's viewport, pixel-diffs vs `target.png`, surfaces image-only signals. **No VLM.** Agent iterates `current.html`. |
| `vrt scan component <screenshot>` | Full-page PNG | `components/*.png` + `manifest.json` (bbox + role guess) | Bbox detection + clustering on the image. **No VLM.** |
| `vrt check tokens <html-or-url>` | Page | Markdown table: violation + nearest-token | Playwright + computed-style scan; snaps to allowed scale within tolerance. **No VLM.** Internal binary name: `vrt design-tokens` (same thing — the dispatcher routes both). |
| `vrt check theme <html>` | Page | Markdown report: "unthemed" bboxes (light/dark render same) | Playwright with `emulateMedia({ colorScheme: 'light' / 'dark' })`, per-bbox color sampling, identical-fill flag. **No VLM.** |
| `vrt stress i18n <html>` | Page | Markdown report: selectors that overflow / wrap | Inflate every visible text node by a multiplier (synthetic `word → word + 'X'×k`), measure `scrollWidth > clientWidth` / height growth / right-edge overflow. **No VLM.** No translation dictionary. |

## Invocation

The `vrt` CLI in this repo is invoked **from source**:

```bash
node --experimental-strip-types src/cli/vrt.ts <command...>
# e.g. node --experimental-strip-types src/cli/vrt.ts check tokens fixtures/element-compare/before.html
```

The published binary (`./dist/vrt.mjs` or a globally installed `vrt`)
may lag the source. If it errors with `Unknown command: build`, the
dist is stale — run `pnpm build` or use the source form. All
`vrt ...` invocations below assume one of these two forms.

## When to use

- **build component**: "I'm reproducing this Figma export — give me
  fast pixel signal each round so I converge without eyeballing."
- **scan component**: "this dashboard has 8 components; I want each
  cropped to its own PNG so I can pair-iterate with `build component`."
- **check tokens**: drift audit before / during a design-system
  rollout. Snap-to-scale lints, not subjective.
- **check theme**: pre-launch sanity for a dark-mode rollout — finds
  selectors that didn't migrate off hard-coded light colors.
- **stress i18n**: detect "DE / JP / AR will break the layout" before
  the bug is filed.

## When NOT to use

- Comparing two existing pages: `vrt-visual-diff`.
- Migrating an existing implementation: `vrt-migration-eval`.
- Self-repairing a known regression: `vrt-css-fix-loop`.

## Quickstart

```bash
# Image-driven build loop. You supply current.html; the tool returns
# pixel signal each iteration. Agent (= you) edits current.html until
# the diff converges.
vrt build component design.png current.html --output report.md

# Full screenshot → per-component crops
vrt scan component dashboard.png --output components/

# Token conformance (default scales — no --tokens needed for first pass)
vrt check tokens src/index.html
#   ↑ uses default spacing/radius/z-index scales + 0.5px tolerance.
#   Pass --tokens design-tokens.json to override.

# Theme parity (renders light + dark, flags identical fills)
vrt check theme src/index.html --output-dir test-results/theme/

# i18n / overflow stress (synthetic inflate, default factor 1.4)
vrt stress i18n src/index.html --inflate 1.4
```

## Build component — what the report contains

The output is a Markdown report (not an HTML/CSS file). Each section
is a different image-only signal:

- **Bbox table** — IoU per rank-matched bbox; survives DOM rewrites.
- **Palette** — dominant colors in target vs current; surfaces "you
  used #2d2d2d but the target is #1e1e1e."
- **Text-row Δy** — row-by-row vertical alignment shift.
- **Heatmap** — concentrated regions of diff, prioritized.
- **Per-state** (optional `--states hover focus-visible`) — re-renders
  current.html under each interactive state and diffs each.

The agent iterates `current.html` between runs. There is no
auto-fix — the tool is the eyes, the agent is the hands.

## Check tokens — what counts as a violation

`vrt check tokens` flags computed-style values that aren't on the
allowed scale within tolerance. The default scales:

| Property kind | Default scale |
|---|---|
| `padding`, `margin`, `gap` | `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` |
| `border-radius` | `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 48, 999` |
| `z-index` | `0, 1, 10, 100, 1000, 9999` |
| Tolerance | `0.5px` (snap to nearest within ±tolerance) |

Output excerpt:

```
selector             property        value     nearest-token   Δ
main>div.sidebar     margin-top      10.00px   8               +2.00
main>div.sidebar     padding         15.00px   16              -1.00
footer               padding         15.00px   16              -1.00
```

Override the scales with `--config <path>` (JSON: `{ radius, spacing,
zIndex, shadowTiers, tolerance }`) or with the individual
`--radius-scale a,b,c,...` / `--spacing-scale ...` / `--z-scale ...`
flags.

## Environment

**No API keys are required for any sub-tool in this skill.** The
"VLM" / `VRT_VLM_MODEL` env vars listed in other VRT skills do not
apply here.

The only prerequisite is Playwright with chromium installed
(`npx playwright install chromium` if missing).

## Cost

**$0 in API spend.** Each sub-tool is a deterministic Playwright +
pixel-math run. Compute cost is whatever your local box (or CI runner)
charges to launch chromium + render — typically 1-5s per invocation.

## Failure modes

- "browser not found" → run `npx playwright install chromium`.
- `build component` Δ stays > 50% across runs → the target image and
  current.html are at different viewport sizes; the tool sizes the
  viewport from the target image dimensions, so check the image is
  the intended export resolution (mobile target rendered into desktop
  HTML will never converge).
- `check theme` reports every bbox as "unthemed" → the page didn't
  actually respond to the `prefers-color-scheme` toggle (no
  `[data-theme=dark]` switch in the markup). Verify by loading the
  page with system dark mode on — if it stays light, the page has no
  dark variant to audit.
- `check tokens` shows zero violations even though the page clearly
  uses ad-hoc values → you're outside the default tolerance (`0.5px`)
  but inside the scale's snap zone. Tighten with `--tolerance 0` for a
  strict pass.
- `stress i18n` reports zero overflow even on a clearly fragile
  layout → the inflate multiplier is too low; bump `--inflate 2.0` or
  higher.

## Pair with other skills

After running these tools, the agent typically:

1. Reads the Markdown report.
2. Edits HTML/CSS.
3. Re-runs the same sub-tool (`build component` loop especially).
4. Optionally cross-validates with `vrt-visual-diff` after the markup
   is in place.

Nothing here calls a VLM — and that's intentional. Pixel diffs and
overflow flags are cheaper, faster, and deterministic compared to
asking a model "did this change look right?".
