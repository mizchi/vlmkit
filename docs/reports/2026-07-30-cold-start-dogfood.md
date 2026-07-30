# Cold-start dogfood

**Date:** 2026-07-30  
**Method:** independent fresh-context pass against `main`, starting with CLI help
and without context about recent changes.

The pass used `vlmkit --help`, `--version`, `snapshot --help`, and `diff html
--help`, then attempted a static-HTML comparison. Findings are recorded below
rather than inferred from the recent change list.

## A. CLI discovery and navigation

**Finding — stale version string (minor):** `vlmkit --version` printed
`vlmkit/0.6.0`, while the root package manifest is `0.7.0`.

**Disposition — fixed in this session:** the CLI now reports `0.7.0`, with a
CLI regression test. This is a straightforward release-metadata correction.

The top-level help is long because it retains deprecated aliases. The grouped
canonical commands appear first and are usable; no change is made in this pass.

## B. First representative task

The pass selected a local static HTML comparison (`vlmkit diff html`) after
reading its help. The command shape and output-directory option were clear.

The independent execution environment could not launch Playwright and printed
a Chromium environment error. That is an environment-provisioning failure, not
a reproducible repository defect: the markup test suite launches Chromium
successfully in this checkout. The report does not attribute a product bug or
source fix to that observation.

**Disposition — won't fix:** browser installation/provisioning belongs to the
consumer environment. The existing README installation and quick-start steps
are the appropriate guidance; no unverified workaround is added.

## C. First-time task guidance

The initial pass looked for an example server before recognizing that `diff
html` accepts files directly. The README already demonstrates this direct-file
workflow and includes a runnable command. The repository also contains fixture
HTML under `fixtures/`.

**Disposition — won't fix:** this is a discovery cost, not an absence of a
supported path. Adding a built-in development server would be unrelated scope
for a visual-regression CLI.

## D. Follow-up accounting

| friction point | disposition |
|---|---|
| CLI/package version mismatch | fixed: `0.7.0` plus regression test |
| Chromium launch failure in isolated dogfood environment | won't fix: not reproducible as a repository failure |
| initially missed direct-file comparison path | won't fix: README already documents it |
| long command list with deprecated aliases | won't fix: compatibility aliases remain intentionally visible |

## Validation

```bash
node --test src/cli/cli.test.ts
pnpm --filter @mizchi/vlmkit-markup test
```

The first validates the version output. The second independently confirms the
checkout can launch Chromium for browser-backed tests.
