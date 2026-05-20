# Game Asset Motion Dogfood

Date: 2026-05-20

## Context

This dogfood explored whether vlmkit can move beyond static generated images
into game asset production:

`image/model reference -> asset contract -> GLB/OBJ -> motion IR -> retargeted GLB -> render/quality gate`

The concrete scenario used a voxel robot and real `.vrma` motion samples from
`tk256ailab/vrm-viewer`, kept under ignored `design-runs/.../external/`.

## What Works

- `gpt-image-2` is useful for concept and reference sheets, but not direct 3D
  output. The useful boundary is image reference -> deterministic asset
  contract -> generated or modeled GLB.
- Fixed-camera Three.js + Playwright renders are good enough as a cheap,
  repeatable visual smoke gate for GLB/OBJ and animation clips.
- VRMA is already close to the desired adapter boundary when it is binary glTF
  with `VRMC_vrm_animation.humanoid.humanBones`.
- A small Motion IR is effective. It decouples input adapters from target model
  generation:
  `VRMA/Mixamo/etc -> Motion IR -> retarget -> GLB -> render gate`.
- Real `.vrma` samples `LookAround`, `Goodbye`, and `Jump` all pass the
  mechanical pipeline:
  fetch, extract, verify IR, apply to robot, verify GLB, render, verify renders.
- The same three samples now pass the deterministic quality gate when the target
  is declared as a simplified rig:
  `--root-translation-mode relative --retarget-profile robot-voxel`.
- `robot-voxel` is now a named weighted retarget profile. `simple-rig` remains
  an alias, but the report records the canonical profile name, score, weighted
  penalty, and skipped-by-policy breakdown.
- Smoke runs can require `--min-quality pass` so warnings do not silently pass
  CI-style loops. The failure report keeps the quality summary for debugging.
- `apply-motion-ir --audit-out` now writes a root normalization audit. The
  smoke report summarizes source root height, target base height, root delta
  ranges, normalized ranges, applied scale, and a root scaling recommendation
  for each root translation track.
- The same audit now records target rig bind metrics from retargeted node world
  positions: skeleton bounds, skeleton height, hand span, foot spread, and
  pelvis-to-foot height.
- Motion IR extraction now records source humanoid rest metrics from VRMA
  nodes. `apply-motion-ir` compares those source metrics with target bind
  metrics and emits an initial pose warning.
- Animation renders wait for two extra browser frames after viewer readiness
  before screenshot capture, reducing first-frame WebGL paint races.
- The renderer saves canvas PNG data directly and retries transparent capture
  buffers by reloading the viewer once. This is more stable than page-level
  screenshots for first-frame WebGL smoke tests.
- `ground-y` is now checked with `groundDeltaY` when render metadata includes
  normalized bind bounds, avoiding false warnings from camera-fit world
  coordinates.
- The animation viewer records tracked pelvis, hand, and foot positions.
  `verify-motion-quality` now emits a `foot-contact` check based on
  `left_foot` / `right_foot` bind-vs-animated delta.
  It also emits a `limb-extent` check from tracked node displacement.
- `verify-motion-quality-gold` now compares smoke reports against a committed
  small calibration fixture for `LookAround`, `Goodbye`, and `Jump`.
- `compare-motion-quality-reports` now compares candidate smoke reports against
  a baseline. In the current Jump test, `scale-to-model` improves ground error
  but regresses foot contact and pelvis displacement, so the decision is
  `candidate-tradeoff`.
- The dry-run VLM review scaffold can create a contact sheet and strict JSON
  prompt for cheap reviewers such as UI-TARS / Nova Lite without adding a
  blocking human step.

## What Failed Or Warned

Before the latest loop, all three tested external VRMA samples produced the
same quality warnings:

- retained tracks: 16
- skipped channels: 36
- skipped regions: 30 finger, 2 body, 2 arm, 2 toe/foot
- quality verdict: `warn`
- warning checks: `ground-y`, `retained-channels`

After adding relative root translation, normalized ground deltas, and the
`robot-voxel` retarget profile, the same batch reports:

- quality verdict: `pass`
- retarget profile score: 1.0
- weighted penalty: 0
- skipped-by-policy: 30 finger ignored, 4 upper-body fallback, 2 toe ignored
- source initial root height: `LookAround` 0.87944, `Goodbye` 0.89459,
  `Jump` 0.86145
- target base root height: 1.25
- root delta y range: `LookAround` -0.006..0.003, `Goodbye` -0.007..0.011,
  `Jump` -0.094..0.230
- `LookAround` groundDeltaY: -0.047..-0.012
- `Goodbye` groundDeltaY: -0.031..-0.013
- `Jump` groundDeltaY: -0.107..-0.052
- `LookAround` foot minDeltaY: -0.009..0.009
- `Goodbye` foot minDeltaY: -0.004..0.007
- `Jump` foot minDeltaY: 0.004..0.118
- tracked node max displacement: `LookAround` 0.991, `Goodbye` 1.012,
  `Jump` 1.104; pelvis stays under 0.183 across the batch
- retained-channel ratio: 0.3077, accepted because only simplified-rig
  tolerated regions are skipped

This means parser correctness is no longer the main blocker. The next blocker
is adding more target rigs and expanding the gold set before promoting the
schema out of the dogfood directory.

## Product Lessons

- The main loop should not depend on human visual review. Human input should
  calibrate thresholds and gold fixtures; the working loop should emit
  machine-readable `pass` / `warn` / `fail`.
- VLM reviewers should be second opinions over deterministic evidence, not the
  source of truth. They should receive a contact sheet plus metrics and return
  strict JSON.
- `warn` is useful. It let the agent continue while preserving the exact
  quality debt. In this run, `warn` clearly identified that the ground metric
  was measuring the wrong coordinate space and that skeleton coverage needed a
  target-profile policy.
- Skip counts alone are too coarse. Region-level skip aggregation is necessary
  because dropping 30 finger channels is less severe for a blocky robot than
  dropping hips, head, or upper arms.
- Root translation must be policy-controlled. For generated simplified
  characters, `relative` is safer than copying source hips coordinates because
  it keeps the target bind height and only applies motion deltas.
- Normalization must leave a machine-readable audit trail. Otherwise an agent
  cannot tell whether a bad render came from parser drift, root scaling, or the
  target rig's bind pose.
- The audit should recommend, not silently switch, root scaling policy. In the
  current three-sample set, `LookAround` and `Goodbye` stay `relative-ok`
  because their vertical root motion is tiny; `Jump` emits
  `consider-scale-to-model` because source/target root height differs and the
  clip has meaningful vertical root motion.
- A recommendation needs a paired comparison run. `scale-to-model` passed for
  Jump, but it was not strictly better: ground error improved while foot contact
  and pelvis displacement regressed. That argues for keeping `relative` as the
  smoke default until the target bind-height measurement is richer.
- Target bind metrics are now available in the audit. For the voxel robot the
  measured retarget skeleton is height 1.88, hand span 1.12, foot spread 0.48,
  and pelvis-to-lowest-foot height 1.02. This is the right input for source
  rest-pose comparison; `targetBaseRootHeight` alone was only pelvis height.
- Source rest metrics show why this should be pose-aware rather than only
  scale-aware. The VRMA source skeleton height is 1.304, hand span 0.926, and
  foot spread 0.140. Core scale ratios are close enough to be usable
  (`skeletonHeight` 1.442, `legHeight` 1.258, `handSpan` 1.209), but foot
  spread scale is 3.438, so the audit emits `foot-spread-mismatch`.

## Next Implementation Order

1. **Retarget profile policy v2**
   - Add more named profiles beyond `robot-voxel`.
   - Classify bones into required, optional, ignorable, and fallback.
   - Calibrate weighted region scoring against more targets.
   - Example: dropped fingers = pass/low cost, dropped hips/head/upper arms =
     fail.

2. **Root and ground normalization**
   - Use the new report comparison output to calibrate when
     `consider-scale-to-model` should escalate from warning to candidate mode.
   - Expand pose mismatch scoring beyond foot spread: shoulder width, arm
     rest angle, leg spread, and source/target up-axis assumptions.
   - Add actionable suggestions when `groundDeltaY` exceeds thresholds.

3. **Motion quality gate v2**
   - Expand the current three-sample gold set with more styles and target rigs.
   - Include per-clip and per-region scores in the JSON report.

4. **VLM review real run**
   - Run UI-TARS first because it is cheap and fast in the existing VLM bench.
   - Use Nova Lite as stable fallback / second reviewer.
   - Measure whether VLM adds signal beyond deterministic warnings.

5. **Kagura smoke**
   - Load the generated GLB and play a clip in `mizchi/kagura`.
   - Emit the same structured JSON style: load status, clip status, frame status.

6. **Promote stable tools**
   - After the retarget and normalization policy stabilizes, move Motion IR,
     retarget profile validation, and quality gates out of `design-runs`.

## Current Commands

```bash
node design-runs/game-assets-20260520/tools/run-external-vrma-smoke.mjs \
  --samples LookAround,Goodbye,Jump \
  --root-translation-mode relative \
  --retarget-profile robot-voxel \
  --min-quality pass \
  --review-vlm \
  --review-dry-run

node design-runs/game-assets-20260520/tools/verify-motion-quality-gold.mjs \
  --report design-runs/game-assets-20260520/external/vrma/tk256ailab/smoke-report.json \
  --gold design-runs/game-assets-20260520/motions/external-vrma-quality-gold.json

node design-runs/game-assets-20260520/tools/compare-motion-quality-reports.mjs \
  --baseline design-runs/game-assets-20260520/external/vrma/tk256ailab/smoke-report.json \
  --candidate design-runs/game-assets-20260520/external/vrma/tk256ailab/smoke-report.scale-to-model.json \
  --samples Jump
```

Useful ignored outputs:

- `design-runs/game-assets-20260520/external/vrma/tk256ailab/smoke-report.json`
- `design-runs/game-assets-20260520/external/vrma/tk256ailab/*.motion-quality.json`
- `design-runs/game-assets-20260520/external/vrma/tk256ailab/*.motion-quality.contact-sheet.png`
- `design-runs/game-assets-20260520/external/vrma/tk256ailab/*.vlm-review.json`

## Sources

- https://note.com/npaka/n/nde5589d13536
- https://vrm.dev/en/vrma/
- https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm_animation-1.0
- https://github.com/tk256ailab/vrm-viewer
- https://openrouter.ai/bytedance/ui-tars-1.5-7b
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html
