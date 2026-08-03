#!/usr/bin/env bash
# Smoke test for the built dist/vlmkit.mjs. Verifies the published bin
# accepts every top-level subcommand the source CLI exposes.
#
# History: #48 originally surfaced that dist/vlmkit.mjs's dispatcher used
# `import.meta.resolve(<source-path-string>)`, so leaves couldn't
# resolve from the bundled artifact. That has been fixed — the
# dispatcher now uses `() => import("literal-path")` factory functions
# and a `__VRT_DISPATCHER__` env sentinel, both bundler-friendly. This
# script now runs strict by default and any FAIL is a real regression.
#
# Pass `--lenient` to exit 0 even on failure (useful for local
# debugging while iterating).
set -u

STRICT=1
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --lenient) STRICT=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

DIST="dist/vlmkit.mjs"
if [[ ! -f "$DIST" ]]; then
  echo "error: $DIST not found. Run 'pnpm build' first." >&2
  exit 2
fi

PASS=()
FAIL=()

probe_help() {
  local label="$1" expected="$2"; shift 2
  # Some leaves print usage and exit 1 when they receive --help (their
  # "missing required positional" path). We treat that as a successful
  # routing probe as long as the expected substring appears.
  local out
  out=$(node "$DIST" "$@" --help 2>&1 || true)
  if echo "$out" | grep -q -F -- "$expected"; then
    PASS+=("$label")
    return
  fi
  FAIL+=("$label  (expected: '$expected')")
}

probe_exec() {
  local label="$1" expected="$2"; shift 2
  local out
  if out=$(node "$DIST" "$@" 2>&1); then
    if echo "$out" | grep -q -F -- "$expected"; then
      PASS+=("$label")
      return
    fi
  fi
  FAIL+=("$label  (expected: '$expected')")
}

echo "==> smoke-dist: $(node "$DIST" --version 2>&1)"

# Top-level subcommand surface (matches the new vlmkit 0.5.0 group structure).
probe_help "diff html"            "Usage:"                 diff html
probe_help "diff agent"           "migration"              diff agent
probe_help "diff png"             "PNG"                    diff png
probe_help "migration compare"    "vlmkit diff html"            migration compare
probe_help "snapshot"             "snapshot"               snapshot
probe_help "build component"      "Usage: vlmkit build component" build component
probe_help "scan component"       "component-extract"      scan component
probe_help "check tokens"         "design-tokens"          check tokens
probe_help "check theme"          "theme-parity"           check theme
probe_help "stress i18n"          "i18n-stress"            stress i18n

# A real (no-flag) invocation that exercises the dispatcher delegate
# path — catches ERR_MODULE_NOT_FOUND on the bundled artifact.
probe_exec "diff html exec" "after"  diff html fixtures/element-compare/before.html fixtures/element-compare/after.html --output /tmp/vrt-smoke-dist-exec/

echo
echo "Pass: ${#PASS[@]} / Fail: ${#FAIL[@]}"
if (( ${#PASS[@]} > 0 )); then
  printf '  ✓ %s\n' "${PASS[@]}"
fi
if (( ${#FAIL[@]} > 0 )); then
  echo
  printf '  ✗ %s\n' "${FAIL[@]}"
  echo
  echo "These are regressions — the dispatcher should route every"
  echo "documented subcommand. Investigate before merging."
  if (( STRICT )); then
    exit 1
  fi
fi
