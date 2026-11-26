#!/usr/bin/env bash
# Build the platform-specific tree-sitter MoonBit grammar for jev-lint once; it is not committed.
# Run through `vp run jev-parser-moonbit` (a dependency of `jev-plan` / `jev-check`).
set -euo pipefail

REV=5435c307c6cf2ef0d508a99047b06f35a4308444
DIR=.jev-lint/parsers

if [ -f "$DIR/moonbit.dylib" ]; then
  exit 0
fi

mkdir -p "$DIR"
if [ ! -d "$DIR/tree-sitter-moonbit/.git" ]; then
  git clone --filter=blob:none https://github.com/moonbitlang/tree-sitter-moonbit.git "$DIR/tree-sitter-moonbit"
fi
git -C "$DIR/tree-sitter-moonbit" fetch --depth 1 origin "$REV"
git -C "$DIR/tree-sitter-moonbit" checkout --detach "$REV"
(cd "$DIR/tree-sitter-moonbit" && tree-sitter build --output ../moonbit.dylib)
