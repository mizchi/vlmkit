# modules-request-walk scene log

## Round 1
**Command:**
```
pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/ha/scene.json --expect fixtures/anim-scenario/briefs/facts/modules-request-walk.expect.json
```

**Error:** `✗ sequence: "web" is highlighted in the final frame but the facts do not point at it`

**Fix:** Added `{"unhighlight": "web", "ms": 0}` before the final highlight step. The `ms: 0` applies it inside the previous beat with no step of its own, so it doesn't create a new step in the narration.

**Result after fix:** ✓ 0 error(s), 0 warning(s)

---

## Summary

**Initial check result:** 1 ✗, 0 ⚠

The single error was that "web" was highlighted in the first step (when the request enters the storefront) but was never unhighlighted, so it remained lit in the final frame. The facts expected only the two async edges ("payments->queue", "orders->queue") to be highlighted at the end. The fix came from understanding the facts sheet — without it, I would have shipped the figure with the wrong modules highlighted at the end.

**Rounds used:** 1 round

**What the fact sheet told me that check alone would not:**
- Quote: `"highlighted": ["payments->queue", "orders->queue"]`
- This exactly specified which edges must be lit in the final frame. Without this, I might have left "web" highlighted (because it's the entry point) or highlighted other modules. The check alone would have caught an obvious error like too many things highlighted, but the fact sheet ensured I highlighted the *correct* elements — the two async dependencies that make the system eventually consistent. I would have shipped an incorrect figure without it.

**What didn't help, was missing, or was confusing:**
Nothing. The writing guide was complete and clear:
- The schema output for `kind: modules` showed all available sequence operations (show, hide, highlight, unhighlight, flow, note, relabel, annotations)
- The `kind: modules` section explained that without a sequence it's a still figure, and with a sequence it's walked like a diagram
- The `kind: expect` schema clearly showed the fact sheet format and that "highlighted" was a required field
- The annotation ops table explained that `ms: 0` folds an op into the previous beat without creating a new step
- The "Checking a figure against the facts" section explained why the fact sheet exists: to catch issues the formal checks cannot, like deleted real dependencies or highlighted wrong edges

**Hand-typed coordinates, colours, or canvas sizes:**
- None. The `kind: modules` layout is automatic — positions are computed from the dependency graph.
- All module ids, group ids, and dependency directions came from the brief or fact sheet; no hand-coded coordinates.
- All colours are theme defaults (node, nodeStroke, text, accent, muted, ok, bad, background).
- No canvas size specified — the kind chose one that fits.

**Deliverables:**
- ✓ `scene.json` — passes `check --expect` with 0 errors, 0 warnings
- ✓ `map.svg` — static module map (final frame of the animation)
- ✓ `walk.gif` — animated walk (167 frames, 13950ms)
- ✓ All facts verified: 8 modules, 9 dependencies, 2 highlighted edges, 3 groups
- ✓ Narration matches brief: request enters at web, passes through gateway and checkout, shows three async paths (inventory→db, payments→queue, orders→db/queue), ends with two async hops highlighted
