#!/usr/bin/env bash
# Smoke test for the built dist/vrt.mjs. Verifies the published bin
# accepts every top-level subcommand the source CLI exposes.
#
# Wired up under issue #48: dist/vrt.mjs's dispatcher currently uses
# `import.meta.resolve(<source-path-string>)` to route leaves, so the
# bundled artifact can't resolve leaves once installed standalone.
# This script catches that class of breakage — until #48's dispatcher
# rewrite lands, expect FAIL rows here.
#
# Strict mode is off by default (exit 0 on failure) so the script can
# live on main without breaking CI. Pass `--strict` to exit 1 on any
# failure; flip the default to strict once #48 closes.
set -u

STRICT=0
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

DIST="dist/vrt.mjs"
if [[ ! -f "$DIST" ]]; then
  echo "error: $DIST not found. Run 'pnpm build' first." >&2
  exit 2
fi

PASS=()
FAIL=()

probe_help() {
  local label="$1" expected="$2"; shift 2
  local out
  if out=$(node "$DIST" "$@" --help 2>&1); then
    if echo "$out" | grep -q -F -- "$expected"; then
      PASS+=("$label")
      return
    fi
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

# Top-level subcommand surface (matches the new vrt 0.5.0 group structure).
probe_help "diff html"            "viewport"        diff html
probe_help "diff agent"           "migration"       diff agent
probe_help "diff png"             "PNG"             diff png
probe_help "migration compare"    "viewport"        migration compare
probe_help "snapshot"             "snapshot"        snapshot
probe_help "build component"      "image"           build component
probe_help "scan component"       "component"       scan component
probe_help "check tokens"         "tokens"          check tokens
probe_help "check theme"          "theme"           check theme
probe_help "stress i18n"          "i18n"            stress i18n

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
  echo "Failures expected until #48 (dist/vrt.mjs dispatcher rewrite) lands."
  echo "See: https://github.com/mizchi/vrt/issues/48"
  if (( STRICT )); then
    exit 1
  fi
fi
