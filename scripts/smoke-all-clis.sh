#!/usr/bin/env bash
# Smoke test for the markup-assistance toolkit.
# Runs every CLI on a canonical fixture and verifies it produces a
# report file. Run from the repo root.
set -u

PASS=()
FAIL=()
OUT_BASE="test-results/smoke"

run() {
  local label="$1" expected_file="$2"
  shift 2
  local outdir="$OUT_BASE/$label"
  rm -rf "$outdir"
  if "$@" > "$OUT_BASE/$label.log" 2>&1; then
    # `-` means stdout-only (no file output to check).
    if [[ "$expected_file" == "-" ]] || [[ -e "$outdir/$expected_file" ]]; then
      PASS+=("$label")
    else
      FAIL+=("$label (no $expected_file)")
    fi
  else
    FAIL+=("$label (exit $?)")
  fi
}

mkdir -p "$OUT_BASE"

# Markup-assistance commands (new)
run "component-from-image" "report.md" \
  node --experimental-strip-types src/vrt.ts component-from-image \
    fixtures/wireframe/pricing-card/target-desktop.png \
    fixtures/wireframe/pricing-card/blank.html \
    --output-dir "$OUT_BASE/component-from-image"

run "multi-page-consistency" "report.md" \
  node --experimental-strip-types src/vrt.ts multi-page-consistency \
    --selector .footer \
    --files fixtures/multi-page/footer-drift/about.html fixtures/multi-page/footer-drift/blog.html fixtures/multi-page/footer-drift/pricing.html \
    --output-dir "$OUT_BASE/multi-page-consistency"

run "component-consistency" "report.md" \
  node --experimental-strip-types src/vrt.ts component-consistency \
    fixtures/component-consistency/inline-leak/page.html \
    --selector .card \
    --output-dir "$OUT_BASE/component-consistency"

run "theme-parity" "report.md" \
  node --experimental-strip-types src/vrt.ts theme-parity \
    fixtures/theme-parity/card-with-bug/buggy.html \
    --output-dir "$OUT_BASE/theme-parity"

run "i18n-stress" "report.md" \
  node --experimental-strip-types src/vrt.ts i18n-stress \
    fixtures/i18n-stress/button-overflow/page.html \
    --output-dir "$OUT_BASE/i18n-stress"

run "a11y-contrast" "report.md" \
  node --experimental-strip-types src/vrt.ts a11y-contrast \
    fixtures/a11y-contrast/low-contrast/page.html \
    --output-dir "$OUT_BASE/a11y-contrast"

run "a11y-touch" "report.md" \
  node --experimental-strip-types src/vrt.ts a11y-touch \
    fixtures/a11y-touch/small-targets/page.html \
    --output-dir "$OUT_BASE/a11y-touch"

run "a11y-focus-order" "report.md" \
  node --experimental-strip-types src/vrt.ts a11y-focus-order \
    fixtures/a11y-focus-order/reversed/page.html \
    --output-dir "$OUT_BASE/a11y-focus-order"

run "component-from-image-typo" "report.md" \
  node --experimental-strip-types src/vrt.ts component-from-image \
    fixtures/typography/wrong-size-weight/target.png \
    fixtures/typography/wrong-size-weight/buggy.html \
    --output-dir "$OUT_BASE/component-from-image-typo"

run "interact" "report.md" \
  node --experimental-strip-types src/vrt.ts interact \
    fixtures/interact/dropdown-form/page.html \
    --sequence fixtures/interact/dropdown-form/sequence.json \
    --output-dir "$OUT_BASE/interact"

run "media-variants" "report.md" \
  node --experimental-strip-types src/vrt.ts media-variants \
    fixtures/media-variants/card/hostile.html \
    --output-dir "$OUT_BASE/media-variants"

run "cross-browser" "report.md" \
  node --experimental-strip-types src/vrt.ts cross-browser \
    fixtures/wireframe/pricing-card/reference.html \
    --allow-skipped \
    --output-dir "$OUT_BASE/cross-browser"

run "design-tokens" "report.md" \
  node --experimental-strip-types src/vrt.ts design-tokens \
    fixtures/design-tokens/off-scale/page.html \
    --output-dir "$OUT_BASE/design-tokens"

run "perf" "report.md" \
  node --experimental-strip-types src/vrt.ts perf \
    fixtures/perf/cls-bug/page.html \
    --output-dir "$OUT_BASE/perf"

run "explore" "report.md" \
  node --experimental-strip-types src/vrt.ts explore \
    fixtures/explore/declarative/page.html \
    --output-dir "$OUT_BASE/explore"

run "component-extract" "report.md" \
  node --experimental-strip-types src/vrt.ts component-extract \
    fixtures/wireframe/pricing-card/target-desktop.png \
    --crop 0 \
    --output-dir "$OUT_BASE/component-extract"

# skill writes to <output-dir>/skill-<name>/. Adjust assertion:
# pass --output-dir = OUT_BASE, then the resulting report lives at
# $OUT_BASE/skill-pricing-card/report.md — assert with that label.
run "skill-pricing-card" "report.md" \
  node --experimental-strip-types src/vrt.ts skill run pricing-card \
    --against fixtures/wireframe/pricing-card/reference.html \
    --output-dir "$OUT_BASE"

# Migration mode (existing) — uses the shadcn fixture
run "compare" "migration-report.json" \
  node --experimental-strip-types src/vrt.ts compare \
    --dir fixtures/migration/shadcn-to-luna \
    --baseline before.html --variants after-blank.html \
    --output-dir "$OUT_BASE/compare" \
    --no-paint-tree --no-discover

# Existing image tools
run "png-diff" "-" \
  node --experimental-strip-types src/vrt.ts png-diff \
    fixtures/wireframe/pricing-card/target-desktop.png \
    fixtures/wireframe/pricing-card/target-desktop.png \
    --output-dir "$OUT_BASE/png-diff"

echo
echo "=============================="
echo "PASS: ${#PASS[@]}"
for p in "${PASS[@]}"; do echo "  ✓ $p"; done
echo "FAIL: ${#FAIL[@]}"
for f in "${FAIL[@]}"; do echo "  ✗ $f"; done
echo "=============================="

[[ ${#FAIL[@]} -eq 0 ]]
