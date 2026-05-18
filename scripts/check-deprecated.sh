#!/usr/bin/env bash
#
# Forbid renamed-before-0.5.0 API identifiers from re-entering source.
# Existing legitimate uses (alias declarations, barrel re-exports, tests
# that exercise the alias) are allow-listed explicitly.
#
# Invoked from `.github/workflows/lint-deprecated.yml` on every PR.
set -euo pipefail

FORBIDDEN=(
  checkA11yTree
  evaluateDomEquivalence
)

PATTERN=$(IFS='|'; echo "${FORBIDDEN[*]}")

# Files that are allowed to mention these names:
#   - test files (verify the alias still works post-rename)
#   - the source files that *declare* the alias
#   - the curated barrels that re-export the alias
ALLOWLIST=(
  'packages/vrt-core/src/a11y-semantic\.ts'
  'packages/vrt-core/src/dom-equivalence\.ts'
  'packages/vrt-core/src/index\.ts'
  '\.test\.ts'
)
ALLOW_PATTERN=$(IFS='|'; echo "${ALLOWLIST[*]}")

VIOLATIONS=$(grep -rEn "\\b(${PATTERN})\\b" \
  packages/ src/ \
  --include='*.ts' \
  --exclude-dir=node_modules \
  | grep -vE "(${ALLOW_PATTERN}):" \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ Deprecated identifier(s) used in non-allowlisted source:"
  echo ""
  echo "$VIOLATIONS"
  echo ""
  echo "Migration:"
  echo "  checkA11yTree         → verifyA11yTree"
  echo "  evaluateDomEquivalence → verifyDomEquivalence"
  echo ""
  echo "If the use is legitimate (a new test file, a new shim layer),"
  echo "add the path to the ALLOWLIST in scripts/check-deprecated.sh."
  exit 1
fi

echo "✓ scripts/check-deprecated.sh — no deprecated identifiers in non-allowlisted source"
