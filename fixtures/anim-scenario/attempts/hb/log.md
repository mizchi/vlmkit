# Log: Ports and Adapters Figure

## Round 1

Command: `pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/hb/scene.json --expect fixtures/anim-scenario/briefs/facts/modules-ports-adapters.expect.json`

Output:
```
✓ scene.json (modules): 0 error(s), 0 warning(s)
  560ms · 2 steps (1 captioned) · 24 nodes · 0 tracks / 0 keyframes
  scene 574 B → timeline 4005 B (×7)
  facts modules-ports-adapters.expect.json: 7 module(s) · 7 dependencies · 1 forbidden · 3 group(s) — all as drawn
```

Layout check: `0 of 2 frames with layout issues · 0 overlap(s) · 0 clipped · 0 crossed`

All validation passed on the first attempt. No changes needed.

---

## Summary

### First `check --expect` Result
- ✗ count: **0** 
- ⚠ count: **0**
- All 7 modules match the fact sheet
- All 7 dependencies (http→app, cli→app, app→domain, app→port, port→domain, postgres→port, memory→port) verified
- Forbidden dependency (domain→postgres) correctly marked with `"style": "forbidden"`
- All 3 groups (driving, core, adapters) with correct membership verified by fact sheet

### Rounds Used
- Round 1: Initial scene passed all checks immediately

### What the Fact Sheet Told Me
The fact sheet provided the authoritative module ids and group membership. Quote: `"modules": ["http", "cli", "app", "domain", "port", "postgres", "memory"]` and the explicit `"forbidden": ["domain->postgres"]`. Without the fact sheet, I would have had to infer the correct node names and grouping from the brief text. The fact sheet ensured exact spelling and prevented guessing whether "server" vs "http", or "repo" vs "port" was correct. This was critical because a misspelled module id would fail the check.

### What Didn't Help or Was Missing
- The guide's `kind: modules` section (lines 548–605) was complete and sufficient. No ambiguity on how to structure `modules`, `deps`, `groups`, or the `forbidden` style.
- The annotation ops section was unnecessary for this still figure — no callouts, relations, or values were needed to explain the architecture.
- The `--expect` format guide was clear (lines 619–656). The fact sheet matched the schema without surprises.

### Hand-Typed Elements
- No coordinates were typed by hand. The `kind: modules` layout is automatic; the guide states (line 580): "The layout is automatic and deliberate."
- No colours were typed by hand. The forbidden edge uses the default `bad` colour (`#dc2626` red) automatically applied by `"style": "forbidden"`.
- Canvas size not manually set. The guide (line 594) states: "The canvas is sized for the map; set `canvas` to override." The default auto-sizing fit perfectly.
- Module ids, group ids and dependency tuples were copied exactly from the fact sheet to ensure they matched.

### Success
The figure was marked complete when `check --expect` exited 0 and `layout` reported 0 issues. The forbidden dependency is visibly different from the real arrows — drawn in red and dashed — making it clear this is the one that must not exist.

