# Baseline lifecycle: `vlmkit baseline` (pin / update) + `vlmkit workflow approve` (ergonomic manifest authoring)

## Context

The 2026-05-15 design-md scenario (v1–v3) and its closed-loop validation
runs showed that vrt's signal layer is good enough for fresh agents to
reach near-pixel-perfect convergence on a new implementation. The piece
that's missing for vrt to scale from "single-shot tool" to "real
project's regression net" is the **baseline lifecycle**:

- Today's "golden" PNGs are scattered under `test-results/` or committed
  alongside fixtures. There's no concept of "the approved baseline for
  route X on branch Y, last updated date Z".
- The approval-manifest mechanism (`approval.json`) already exists and
  is honored by `runMigrationCompare`, but there's no CLI to author it.
  Agent-d explicitly identified `max-width: 641.32px` as a 1.32px sub-
  pixel deviation they couldn't act on — that's exactly the case
  approval should handle, but the only way to record it today is to
  hand-edit JSON.
- Without these two pieces, a team can't onboard vrt to a real codebase
  without ad-hoc tooling: who runs which command to update goldens?
  Where do PNGs live? How does a designer say "yes, that's the new
  intended look, accept it"?

## What's needed

### `vlmkit baseline` subcommand

```
vlmkit baseline pin <route-or-file> --as <name>
vlmkit baseline list
vlmkit baseline update <name>
vlmkit baseline diff <name>     # current render vs stored baseline
vlmkit baseline rm <name>
```

- `pin`: captures baseline PNG(s) across the declared viewport set,
  writes to `.vrt/baselines/<name>/<viewport>.png`, records metadata
  in `.vrt/baselines.json`: `{name, source, viewports, capturedAt,
  capturedFrom: branch/commit/url}`.
- `list`: tabular output — name, source, viewports, last-updated,
  staleness (was source modified since last pin?).
- `update`: re-snapshot, archive previous PNGs under
  `.vrt/baselines/<name>/_history/<timestamp>/` (so the human change
  is reversible).
- Storage: large PNGs should live outside git proper — `.vrt/`
  defaults to gitignored; users opt in to LFS (suggest `git lfs track
  ".vrt/baselines/**"`) or external S3-style storage via a pluggable
  backend (out of scope for the first cut; document the seam).

### `vlmkit workflow approve` subcommand

Ergonomic manifest authoring. Reads a `--run-id` (which is just the
output dir of a recent `vlmkit diff html`) and lets the operator approve
regions or selectors:

```
vlmkit workflow approve <run-id> --selector .hero__body --reason "sub-pixel AA" \
  --max-px 2 --expires 2026-08-15

vlmkit workflow approve <run-id> --region "x=120,y=80,w=200,h=40,viewport=mobile" \
  --reason "marquee animation; intentionally dynamic"

vlmkit workflow approve <run-id> --all-under 0.5pp --reason "minor AA drift"
```

- Appends entries to the project's `approval.json` (or path declared
  in `vrt.config`).
- Optional `--expires <date>`: rule auto-warns past the date, hard-
  fails after a grace period. Forces deliberate re-approval after the
  next design token shift.
- Optional `--acknowledged-by <name>` for audit trails.
- `--dry-run` to preview the manifest change without writing.

Manifest schema additions if needed: `expires`, `acknowledgedBy`,
`createdAt`. The existing region matchers (`src/approval.ts`) already
support most of this; the gap is the CLI.

## Done when

- [ ] `vlmkit baseline {pin,list,update,diff,rm}` work as described.
- [ ] `vlmkit workflow approve` writes JSON the existing approval pipeline already
      reads. Existing strict / non-strict behavior preserved.
- [ ] Tests cover manifest authoring, expiry (warn / fail), region
      matching round-tripped through CLI ↔ JSON.
- [ ] Documentation updated in `docs/api-design.md` with the new
      subcommands.
- [ ] `.vrt/` dir convention documented + `.gitignore` recommendation.

## Out of scope

- LFS / S3 plug-in backends. Document the seam, ship a local-disk
  backend first.
- Multi-tenant / cloud baseline storage.
- PR-comment integration (separate ticket: see CI-gate draft).

## Severity

`major` — operational scaling blocker. Without baseline lifecycle, vrt
is a personal-developer tool, not a team-owned regression net.

## References

- `docs/reports/2026-05-15-design-md-scenario-v{1,2,3}.md`
- `src/approval.ts` (existing region/manifest matcher)
- agent-d's "641.32px sub-pixel artifact" comment (v3 report)

---

**Status (2026-06-08, partial)**: `vlmkit baseline approve` ships the
approval-authoring CLI (`--selector --reason --max-px --max-ratio
--expires --acknowledged-by --kind --manifest --dry-run`), backed by the
pure `buildApprovalRuleFromInput`. Schema gained `acknowledgedBy` +
`createdAt` (audit trail); `expires` already existed. `vlmkit baseline
update` archives current baselines to `_history/<ts>/` then re-pins
(reversible). Region-bbox approval (`--region x,y,w,h`) is deliberately
NOT built — the pipeline has no bbox matcher, so approve by the region’s
selector instead. `update` reuses the diff-pr pin path. Tests:
`approval.test.ts` (schema + builder), `baseline-cli.test.ts` (archive +
approve CLI). Note: command lives under `vlmkit baseline approve`, not top-
level `vlmkit workflow approve` (that name is taken by the workflow bulk-approve).

**Update (2026-06-08): region-bbox approval now shipped.** `vrt
baseline approve --region "x=,y=,w=,h=[,viewport=,tol=]"` authors an
`ApprovalRule.region` zone. `filterApprovedVrtRegions` gained a
`viewport` opt and a region branch: a diff region is suppressed when ≥80%
of its area falls inside the zone (inflated by `tolerance`, default 8px)
and the rule’s viewport matches. `diff-pr` now applies
`filterApprovedVrtRegions` before the visual gate (empty DOM contexts, so
region-bbox rules bind in CI even without a selector). Epic 01 is now
complete bar TOML config (separate, in epic 03). Tests: `approval.test.ts`
(matcher + builder), `baseline-cli.test.ts` (--region CLI).
