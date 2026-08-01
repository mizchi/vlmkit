#!/usr/bin/env bash
# Set up a pinned-revision "arm" for an A/B audit of the gates.
#
# Why this exists: the 2026-08-01 FP re-audit's first run was vacuous
# because the baseline worktree's node_modules was symlinked to the main
# repo's, and node_modules/@mizchi/vlmkit-* there points at the MAIN
# repo's packages. Every cross-package deep import resolved to current
# code, so both arms ran the same build and the audit reported a
# reassuring "0 new findings" that meant nothing.
#
# This script links third-party deps from the shared store but points
# @mizchi/* at the worktree's OWN packages, then verifies the isolation
# held before you are allowed to trust anything.
#
# Usage: src/util/ab-arm-setup.sh <revision> <target-dir>
#   e.g. src/util/ab-arm-setup.sh 86d4cdb /tmp/audit/before
set -euo pipefail

REV="${1:?usage: ab-arm-setup.sh <revision> <target-dir>}"
DIR="${2:?usage: ab-arm-setup.sh <revision> <target-dir>}"
REPO="$(git rev-parse --show-toplevel)"

git -C "$REPO" worktree add --detach "$DIR" "$REV" >/dev/null 2>&1 || {
  echo "worktree add failed (already exists?)" >&2; exit 1;
}

mkdir -p "$DIR/node_modules/@mizchi"
for entry in "$REPO"/node_modules/*; do
  name="$(basename "$entry")"
  [ "$name" = "@mizchi" ] && continue
  ln -sfn "$entry" "$DIR/node_modules/$name"
done
[ -d "$REPO/node_modules/.bin" ] && ln -sfn "$REPO/node_modules/.bin" "$DIR/node_modules/.bin"
# The load-bearing part: workspace packages resolve to THIS revision.
for pkg in "$DIR"/packages/*/; do
  ln -sfn "../../packages/$(basename "$pkg")" "$DIR/node_modules/@mizchi/$(basename "$pkg")"
done

# Isolation proof: the arm's own package sources must be what runs. Compare
# a resolved package file against the worktree copy; if the symlink leaked
# to the main repo these differ whenever the revision differs.
resolved="$(readlink -f "$DIR/node_modules/@mizchi/vlmkit-markup")"
expected="$(readlink -f "$DIR/packages/vlmkit-markup")"
if [ "$resolved" != "$expected" ]; then
  echo "ISOLATION FAILED: @mizchi/vlmkit-markup -> $resolved (expected $expected)" >&2
  exit 1
fi
echo "arm ready at $DIR (rev $REV), workspace packages isolated"
echo "NEXT: prove the arms differ on a case whose answer you know before reading results."
