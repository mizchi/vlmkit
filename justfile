set shell := ["bash", "-cu"]

default:
    @just --list

# Regenerate installer-specific copies from the canonical router and workflows.
sync-skill-package:
    node scripts/sync-skill-package.mjs

# Run deterministic package and intro-page contracts.
verify-skill-package:
    node --test tests/skill-package.test.mjs examples/vlmkit-intro-page/page.test.mjs

# Install into isolated consumer repositories with both supported installers.
smoke-skill-installers: verify-skill-package
    node scripts/smoke-skill-installers.mjs
