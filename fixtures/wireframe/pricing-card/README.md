# Wireframe scenario: pricing card from screenshot

## Goal

A coding agent must produce HTML + CSS that visually matches the
target screenshots, starting from a blank page and *only* the
rendered images of the target. This is the "design hand-off"
scenario: no source HTML / spec hints / class names.

Differs from the migration scenarios (`fixtures/migration/*/`)
where the variant inherits the baseline's class names — there the
agent renames; here the agent invents both the markup *and* the
CSS from scratch.

## Files

- `reference.html` — the answer. **Do not show to the agent during
  the run.** Used by `vlmkit diff html` as the diff target.
- `target-mobile.png`, `target-desktop.png` — pre-rendered
  screenshots of `reference.html` at 375 / 1280 viewports. These
  are what the agent gets to look at.
- `blank.html` — starting point. Empty `<body>` + empty
  `<style id="target-css">`. Agent edits this (or copies it to
  `working.html` and edits that).

## Suggested workflow

```bash
# 1. Read the two screenshots.
ls fixtures/wireframe/pricing-card/target-*.png

# 2. Copy blank.html → working.html and write your CSS + body.
cp fixtures/wireframe/pricing-card/blank.html \
   fixtures/wireframe/pricing-card/working.html

# 3. Run vlmkit diff html. --no-dom-equivalence because the agent may
#    have invented different tags / class names from the reference.
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node --experimental-strip-types src/migration-compare.ts \
  --dir fixtures/wireframe/pricing-card \
  --baseline reference.html --variants working.html \
  --output-dir test-results/wireframe-pricing-card-iter1 \
  --no-paint-tree --no-dom-equivalence --dom-position-diff

# 4. Read the agent report.
node --experimental-strip-types src/diff-for-agent-cli.ts \
  test-results/wireframe-pricing-card-iter1/migration-report.json
```

## Why this fixture matters

Tools tuned for class-rename migrations (Subagents A–E) may
over-fit to "match `.card` against `.luna-panel` by DOM
position." This scenario tests the tools when:

- DOM positions don't necessarily align (agent's `<div>` tree may
  differ from reference's)
- The class-rename map is empty / sparse
- The signal must come from per-band shifts + heatmaps + raw
  per-element bbox / style data without selector hints

Use it to validate that `vlmkit diff agent` remains useful when
the DOM-position alignment is broken.
