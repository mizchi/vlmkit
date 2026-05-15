# CI gate: `vrt diff-pr` mode + `vrt.config` route declaration + per-route thresholds

## Context

Every vrt invocation today is a single `compare <a> <b>` call. CI
workflows need to run a *suite* — every page / route a team cares
about — and gate the build on regressions. There's no config to
declare that suite, no policy layer for "hero must be 0% but admin
can be 2%", and the existing `--strict` flag is binary across all
routes and viewports.

Depends on the baseline-lifecycle ticket: `vrt diff-pr` is the
*consumer* of pinned baselines. Without `vrt baseline` shipping
first, this ticket's "load the baseline for route X" step has no
backing storage.

## What's needed

### `vrt.config.{json,toml,js}`

Project-level config that declares the suite vrt should know about:

```json
{
  "routes": [
    { "name": "home",  "url": "http://localhost:3000/" },
    { "name": "about", "url": "http://localhost:3000/about/" },
    { "name": "admin", "url": "http://localhost:3000/admin/",
      "thresholds": { "wide": 0.02, "desktop": 0.02, "mobile": 0.03 } }
  ],
  "viewports": ["mobile", "desktop", "wide"],
  "tokens": "./DESIGN.md",
  "approvalPath": "./approval.json",
  "baselineDir": ".vrt/baselines",
  "thresholds": { "wide": 0.005, "desktop": 0.005, "mobile": 0.01 }
}
```

- `thresholds.<viewport>` is the per-viewport `maxDiffRatio` allowed.
  Routes can override; otherwise the top-level value applies.
- `tokens` becomes the default `--tokens` arg.
- `baselineDir` resolves baseline PNGs by route name.

### `vrt diff-pr`

New subcommand:

```
vrt diff-pr                       # uses vrt.config; bring-your-own dev server
vrt diff-pr --config custom.json
vrt diff-pr --output .vrt/runs/pr-current/
```

Behavior:

1. Reads `vrt.config`.
2. For each route, locates the stored baseline under
   `<baselineDir>/<route.name>/<viewport>.png`.
3. Runs `vrt compare` against that baseline (URL mode — agents have
   typically not pre-rendered HTML files into the repo; they rely on
   a running dev server pointed at by `route.url`).
4. Applies the route's resolved threshold policy.
5. Emits a single markdown report (`.vrt/runs/pr-current/summary.md`)
   suitable for pasting into a PR comment:
   - Table of route × viewport × diff% × threshold × pass/fail
   - Worst-offender wireframe suggestions (top 5 across the suite)
   - Triptych links for any route that's over threshold
6. Exits with code:
   - `0` if every (route, viewport) is within its threshold OR
     covered by an approval
   - `1` on any uncovered breach

### Examples shipped

- `vrt.config.json` example in `examples/` or `fixtures/` showing
  routes + per-route thresholds
- Update `docs/api-design.md` with the new subcommand
- A "from zero to CI green" doc with the recipe: `vrt baseline pin
  --all` to seed, then `vrt diff-pr` in CI

## Done when

- [ ] `vrt.config` loader supports JSON + TOML (JS optional)
- [ ] Loader honors per-route threshold overrides
- [ ] `vrt diff-pr` runs the suite, emits markdown summary, exits
      0/1 against the policy
- [ ] Approval manifest entries correctly suppress breaches (test
      with an intentional regression that's covered by an approval)
- [ ] Per-route thresholds enforce (test with a regression that's
      under route A's threshold but over route B's)
- [ ] Example `vrt.config.json` checked in
- [ ] Docs updated

## Open questions

- Should `vrt diff-pr` boot its own dev server, or strictly bring-
  your-own? Recommend BYO for v1 — CI runners already manage their
  own services; vrt staying agnostic is simpler.
- PR-comment integration: the markdown summary is the payload. The
  glue to actually post it (via `gh` CLI in a real project, or
  GitHub MCP in this harness) is a separate ticket once this lands.

## Severity

`major` — productionization blocker. Without a CI mode, vrt's
regression-net story is "manually run a command and read the
output" — which doesn't scale to multi-person codebases.

## References

- baseline-and-approve.md (prerequisite)
- vrt-watch.md (sibling — both consume the suite definition but
  watch is dev-time, diff-pr is CI-time)
