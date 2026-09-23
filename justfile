set shell := ["bash", "-cu"]

default:
    @just --list

# The dogfood runner uses the patched sibling checkout until its next release.
# Build the platform-specific MoonBit grammar once; it is not committed.
jev-parser-moonbit:
    @if [ ! -f .jev-lint/parsers/moonbit.dylib ]; then \
      mkdir -p .jev-lint/parsers && \
      if [ ! -d .jev-lint/parsers/tree-sitter-moonbit/.git ]; then git clone --filter=blob:none https://github.com/moonbitlang/tree-sitter-moonbit.git .jev-lint/parsers/tree-sitter-moonbit; fi && \
      git -C .jev-lint/parsers/tree-sitter-moonbit fetch --depth 1 origin 5435c307c6cf2ef0d508a99047b06f35a4308444 && \
      git -C .jev-lint/parsers/tree-sitter-moonbit checkout --detach 5435c307c6cf2ef0d508a99047b06f35a4308444 && \
      (cd .jev-lint/parsers/tree-sitter-moonbit && tree-sitter build --output ../moonbit.dylib); \
    fi

jev-plan: jev-parser-moonbit
    node --experimental-strip-types ../jev-lint/src/cli.ts check --dry-run --cache none

jev-check: jev-parser-moonbit
    node --experimental-strip-types ../jev-lint/src/cli.ts check

# Regenerate installer-specific copies from the canonical router and workflows.
sync-skill-package:
    node scripts/sync-skill-package.mjs

# Run deterministic package and intro-page contracts.
verify-skill-package:
    node --test tests/skill-package.test.mjs examples/vlmkit-intro-page/page.test.mjs

# Install into isolated consumer repositories with both supported installers.
smoke-skill-installers: verify-skill-package
    node scripts/smoke-skill-installers.mjs
