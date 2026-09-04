# First Attempt Check Output

```
✓ scene.json (chart): 0 error(s), 0 warning(s)
  4830ms · 8 steps (7 captioned) · 48 nodes · 48 tracks / 116 keyframes
  scene 845 B → timeline 14315 B (×16.9)
  next: vlmkit-anim explain fixtures/anim-scenario/attempts/v/scene.json · vlmkit-anim render fixtures/anim-scenario/attempts/v/scene.json --step N · vlmkit-anim html fixtures/anim-scenario/attempts/v/scene.json --out page.html
```

## Explain Output

```
Deploys per week by team (Q1–Q4) — 8 steps, 4830ms, 48 nodes
 1. [    0ms] Deploys per week by team (Q1–Q4)
 2. [  350ms] Search team: already at high deployment velocity
 3. [ 1050ms] Payments team crosses the target in Q3
 4. [ 1750ms] Target: 10 deploys per week
 5. [ 2450ms] Mobile team lags behind the target
 6. [ 3150ms] The review decided to invest in the mobile platform
 7. [ 3850ms] A pipeline fix shipped late in Q4, boosting mobile above target
 8. [ 4550ms] (end)
```

**Result: First attempt green (0 errors, 0 warnings)**
