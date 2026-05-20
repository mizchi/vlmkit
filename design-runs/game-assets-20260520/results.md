# GPT Image 2 game asset results

Date:

## Run config

| Field | Value |
|---|---|
| Model | `gpt-image-2` |
| Subject | `moss-skimmer` |
| Quality |  |
| Size override |  |
| `n` |  |
| Operator |  |

## Summary

| Stage | Generated | Score | Verdict | Notes |
|---|---:|---:|---|---|
| `concept-single` |  |  / 10 |  |  |
| `turnaround-3view` |  |  / 10 |  |  |
| `sprite-atlas-2d` |  |  / 10 |  |  |
| `model-reference-3d` |  |  / 10 |  |  |

Verdict labels:

- `pass`: useful for next pipeline step as-is.
- `cleanup`: useful with manual cleanup or post-processing.
- `retry`: prompt needs another round.
- `fail`: unsuitable for this asset pipeline.

## Stage notes

### `concept-single`

| Check | Score 0-2 | Notes |
|---|---:|---|
| thumbnail silhouette readable |  |  |
| single coherent object |  |  |
| front/back/top cues visible |  |  |
| no unwanted text |  |  |
| style usable for game production |  |  |

### `turnaround-3view`

| Check | Score 0-2 | Notes |
|---|---:|---|
| front side back are the same object |  |  |
| view scale is consistent |  |  |
| orthographic enough for modeling |  |  |
| asymmetries preserved |  |  |
| no background interference |  |  |

### `sprite-atlas-2d`

| Check | Score 0-2 | Notes |
|---|---:|---|
| regular 4x3 grid |  |  |
| flat chroma-key background |  |  |
| consistent scale and anchor |  |  |
| variants stay the same object |  |  |
| no gutter bleed or labels |  |  |

### `model-reference-3d`

| Check | Score 0-2 | Notes |
|---|---:|---|
| front side top back are consistent |  |  |
| simple geometry is visible |  |  |
| material regions are readable |  |  |
| matches earlier Moss Skimmer identity |  |  |
| useful as image-to-3D or Blender reference |  |  |

## Cost

Fill from each `*.metadata.json`.

| Stage | Input text tokens | Input image tokens | Output tokens | Estimated cost USD |
|---|---:|---:|---:|---:|
| `concept-single` |  |  |  |  |
| `turnaround-3view` |  |  |  |  |
| `sprite-atlas-2d` |  |  |  |  |
| `model-reference-3d` |  |  |  |  |

## Follow-up prompt changes

- 

## Motion fixture result

This result is not a GPT Image 2 image run. It records the follow-up
motion-readiness dogfood added after reviewing the voxel robot / VRMA workflow
in https://note.com/npaka/n/nde5589d13536.

| Fixture | Generated | Verdict | Notes |
|---|---:|---|---|
| `robot-voxel-motion` | yes | `cleanup` | GLB node/clip verification and nonblank fixed-camera motion renders pass. Visual quality is still a procedural fixture, not final art. |

Checks:

- `tools/verify-gltf-motion.mjs`: passed
- `tools/render-animation.mjs --clip walk_cycle --view all --time all`: passed
- `tools/render-animation.mjs --clip wave --view iso --time 0,0.3,0.6,0.9,1.2`: passed
- `tools/verify-renders.mjs`: passed
- `tools/verify-asset-contract.mjs`: passed

Learned:

- Static voxel GLB/OBJ parity is not enough for humanoid assets.
- Keep motion metadata in the contract: node names, pivot labels, clip ids,
  sampled frames, and render checks.
- Avoid writing human-readable labels to `extras.pivot`; use `pivotLabel`.
- Renderer and verifier code should live in shared tools. Model directories
  should own generation code and fixtures, not copy the quality-gate scripts.

## Motion IR bridge result

The VRM/VRMA step is represented by a normalized stand-in IR for now:

- `motions/robot-vrma-standin.motion.json`
- `tools/apply-motion-ir.mjs`
- `models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb`

| Clip | Source kind | Verdict | Notes |
|---|---|---|---|
| `vrma_alert_wave` | VRMA stand-in | `cleanup` | Retargeted into GLB and fixed-camera renders pass. Needs real VRMA parsing next. |
| `mixamo_walk_standin` | Mixamo stand-in | `cleanup` | Retargeted into GLB and iso motion renders pass. Needs FBX import/conversion next. |

Checks:

- `tools/apply-motion-ir.mjs`: produced derived GLB
- `tools/verify-motion-ir.mjs`: stand-in and extracted IR passed
- `tools/extract-gltf-motion-ir.mjs`: extracted imported clips from derived GLB
- `tools/verify-gltf-motion.mjs`: derived GLB passed required node/clip/loop checks
- `tools/render-animation.mjs`: imported clip snapshots generated
- `tools/verify-renders.mjs`: derived motion snapshots passed nonblank and finite-bounds checks

Learned:

- The valuable boundary is not "support VRMA" by itself. It is source motion ->
  normalized humanoid IR -> retarget map -> derived GLB -> visual motion gate.
- This lets VRMA and Mixamo arrive as input adapters later, without changing the
  renderer, verifier, or Kagura handoff contract.
- The GLB extraction roundtrip gives us a producer test: an animated GLB can be
  converted into motion IR, retargeted back onto the base model, and rendered.

## VRMA humanoid fixture result

Added a local VRMA-style fixture stage:

- `tools/stamp-vrma-humanoid.mjs`
- `models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.fixture.vrma`
- `models/robot-voxel-motion/derived/robot-voxel-motion.fixture-vrma.extracted.motion.json`
- `models/robot-voxel-motion/derived/robot-voxel-motion.fixture-vrma.roundtrip.glb`

Checks:

- `stamp-vrma-humanoid.mjs`: added `VRMC_vrm_animation.humanoid.humanBones`
- `extract-gltf-motion-ir.mjs --target-space humanoid`: extracted humanoid bone targets
- `verify-motion-ir.mjs`: extracted humanoid IR passed against the robot model
- `apply-motion-ir.mjs`: humanoid IR retargeted back onto the base GLB
- `verify-gltf-motion.mjs`: roundtrip GLB passed required node/clip checks
- `verify-renders.mjs`: fixture roundtrip render passed nonblank and finite-bounds checks

Learned:

- VRMA-specific handling belongs in the producer adapter. The common IR,
  retargeter, renderer, and verifier did not need to change.
- The next adapter should read a real `.vrma` file and preserve the same
  `VRMC_vrm_animation.humanoid.humanBones` -> humanoid target mapping.

## External VRMA smoke result

Used a local-only ignored sample from `tk256ailab/vrm-viewer`:

- source repo: https://github.com/tk256ailab/vrm-viewer
- sample: `VRMA/LookAround.vrma`
- license: https://raw.githubusercontent.com/tk256ailab/vrm-viewer/main/LICENSE

| Input | Verdict | Notes |
|---|---|---|
| `LookAround.vrma` | `pass` | Extracted as one non-loop clip, retargeted to the voxel robot with relative root translation, and rendered through the visual + quality gates. |
| `Goodbye.vrma` | `pass` | Same execution path passed; simplified-skeleton skips are accepted by the `robot-voxel` retarget profile. |
| `Jump.vrma` | `pass` | Same execution path passed; larger motion stays on-screen and normalized ground delta remains within threshold. |

Checks:

- `fetch-external-vrma-sample.mjs`: downloaded sample and license into ignored `external/`
- `extract-gltf-motion-ir.mjs`: emitted `LookAround` using the input filename because the source animation clip had no name
- `verify-motion-ir.mjs`: passed against the robot model
- `apply-motion-ir.mjs --root-translation-mode relative`: produced ignored `LookAround.robot-roundtrip.glb`
- `verify-gltf-motion.mjs --motion-ir`: passed required clip checks and skipped loop closure because the IR marks `LookAround` as non-loop
- `render-animation.mjs` and `verify-renders.mjs`: passed nonblank fixed-camera render checks
- `run-external-vrma-smoke.mjs --min-quality pass`: passed `LookAround`,
  `Goodbye`, and `Jump` as a batch with the `robot-voxel` profile
- `verify-motion-quality.mjs --retarget-profile robot-voxel`: emitted structured `pass` reports instead of requiring human visual review
- `review-motion-with-vlm.mjs --dry-run`: generated contact sheets and strict-JSON reviewer prompts for UI-TARS / Nova Lite without API spend

Observed shape:

- source humanoid map: 51 bones
- retained robot retarget targets: 15
- emitted tracks: 16
- skipped channels: 36
- skipped channel regions: 30 finger, 2 body, 2 arm, 2 toe/foot
- root translation mode: `relative`
- retarget profile: `robot-voxel` (`simple-rig` is an alias)
- quality verdict: `pass`
- retarget weighted score: 1.0, penalty 0
- skipped-by-policy: 30 finger ignored, 4 upper-body fallback, 2 toe ignored
- normalized ground delta: `LookAround` -0.047..-0.012,
  `Goodbye` -0.031..-0.013, `Jump` -0.107..-0.052
- foot contact min delta: `LookAround` -0.009..0.009,
  `Goodbye` -0.004..0.007, `Jump` 0.004..0.118
- tracked node max displacement: `LookAround` 0.991, `Goodbye` 1.012,
  `Jump` 1.104; pelvis stays under 0.183 across the batch

Learned:

- Real VRMA is already close enough to the IR boundary when it is binary glTF
  with `VRMC_vrm_animation.humanoid.humanBones`.
- The practical issue is target skeleton mismatch, not file decoding. For
  generated voxel assets, retarget presets need a documented downgrade policy:
  skip fine-grained bones, map core limbs, and surface the lost channels.
- One-shot motion requires a different verifier mode from looping game cycles.
- Running multiple samples shifted the next bottleneck from parser correctness
  to retarget policy. All three tested samples execute. They pass when the
  target is declared as a simplified rig, because dropped fingers, toes,
  chest, neck, and shoulder channels are tolerated while core limb channels
  remain mapped.
- The retarget policy now has a first named profile module. `robot-voxel`
  assigns zero penalty to fingers, toes, chest, neck, and shoulder fallback
  skips, while skipped core bones such as hips/head/arms/legs fail the profile.
- Smoke runs can now require a minimum quality verdict. `--min-quality pass`
  passes for `robot-voxel` and fails for `strict`, preserving the quality
  summary in the failure report.
- Render capture now waits two browser animation frames after viewer readiness
  before screenshotting, avoiding first-frame WebGL paint races in quality
  metrics.
- The animation viewer now records tracked node positions for pelvis, hands,
  and feet. The quality gate uses `left_foot` / `right_foot` bind-vs-animated
  deltas to flag foot sinking or always-floating motion without human review.
  The same tracked nodes also produce a `limb-extent` envelope check.
- Root translation should default to relative motion for generated simplified
  characters. Copying source hips translation directly mixes the source
  avatar's body height into the target pelvis.
- Ground checks should compare the animated bounds against the normalized bind
  bounds (`groundDeltaY`), not raw world `minGroundY` after camera-fit
  normalization.
- VLM review should consume the deterministic quality report and contact sheet.
  It should not be a blocking human proxy; it is a cheap second opinion for
  suspicious `warn` cases.
