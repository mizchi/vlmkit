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
- `ground-y` is now checked with `groundDeltaY` when render metadata includes
  normalized bind bounds, avoiding false warnings from camera-fit world
  coordinates.
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
- `LookAround` groundDeltaY: -0.047..-0.012
- `Goodbye` groundDeltaY: -0.031..-0.013
- `Jump` groundDeltaY: -0.107..-0.052
- retained-channel ratio: 0.3077, accepted because only simplified-rig
  tolerated regions are skipped

This means parser correctness is no longer the main blocker. The next blocker
is calibrating the profile schema against more target rigs and then promoting
it out of the dogfood directory.

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

## Next Implementation Order

1. **Retarget profile policy v2**
   - Add more named profiles beyond `robot-voxel`.
   - Classify bones into required, optional, ignorable, and fallback.
   - Calibrate weighted region scoring against more targets.
   - Example: dropped fingers = pass/low cost, dropped hips/head/upper arms =
     fail.

2. **Root and ground normalization**
   - Add source/target height scaling to the existing root translation modes:
     keep, relative, zero, horizontal-only, scale-to-model.
   - Compute source root height and target bind height.
   - Add actionable suggestions when `groundDeltaY` exceeds thresholds.

3. **Motion quality gate v2**
   - Add foot contact / floating metrics.
   - Add limb extent outlier checks against bind-pose bounds.
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
  --review-vlm \
  --review-dry-run
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
