# Voxel robot motion trial

Date: 2026-05-20

## Purpose

This trial extends the voxel asset dogfood from static GLB/OBJ parity into a
motion-readiness gate. The model is intentionally procedural: the goal is not a
final production robot, but a test fixture that proves vlmkit can keep asset
metadata, model hierarchy, animation clips, and fixed-camera visual checks
together.

Reference article:

- https://note.com/npaka/n/nde5589d13536

## What to adopt from the article

The useful pattern is the sequence, not just the voxel style:

1. Generate a voxel 3-view reference with GPT Image 2.
2. Build a browser-rendered three.js model from that reference.
3. Add animation as a quality gate, first with simple object-specific motion,
   then with humanoid motion via VRM/VRMA.
4. For humanoids, try external motion sources such as Mixamo FBX, convert them
   into a reusable animation format, and replay them against the model.

For vlmkit, this implies that character assets should not stop at a static
render comparison. A usable humanoid asset needs named joints, stable pivots,
animation clips, frame snapshots, and a handoff contract that Kagura can load.

## Current fixture

Generated files:

- `robot-voxel-motion.glb`: primary animated glTF binary
- `robot-voxel-motion.obj` / `robot-voxel-motion.mtl`: static bind-pose debug
  fallback
- `robot-voxel-motion.metadata.json`: style, node, and motion contract
- `robot-voxel-motion.verify.json`: GLB structure verification
- `robot-voxel-motion.render-verify.json`: nonblank motion render verification
- `renders/*.png`: fixed-camera animation frame snapshots
- `kagura-handoff.json`: engine-facing contract sketch
- `derived/robot-voxel-motion.vrma-bridge.glb`: GLB with imported stand-in
  external motion clips

The GLB contains named transform nodes for hips, torso, head, arms, legs, hands,
and feet. It includes three clips:

- `idle_bob`: subtle loop for baseline pivot stability
- `walk_cycle`: in-place humanoid gait smoke test
- `wave`: upper-body articulation smoke test

## Commands

Generate the model:

```bash
node design-runs/game-assets-20260520/models/robot-voxel-motion/generate-robot-motion.mjs
```

Verify GLB nodes, clips, channel uniqueness, and loop closure:

```bash
node design-runs/game-assets-20260520/tools/verify-gltf-motion.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --contract design-runs/game-assets-20260520/models/robot-voxel-motion/kagura-handoff.json
```

Render fixed-camera motion snapshots:

```bash
node design-runs/game-assets-20260520/tools/render-animation.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --clip walk_cycle \
  --view all \
  --time all \
  --mode material

node design-runs/game-assets-20260520/tools/render-animation.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --clip wave \
  --view iso \
  --time 0,0.3,0.6,0.9,1.2 \
  --mode material
```

Verify that motion frames are not blank and have finite bounds:

```bash
node design-runs/game-assets-20260520/tools/verify-renders.mjs \
  --dir design-runs/game-assets-20260520/models/robot-voxel-motion/renders \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.render-verify.json
node design-runs/game-assets-20260520/tools/verify-asset-contract.mjs \
  --contract design-runs/game-assets-20260520/models/robot-voxel-motion/kagura-handoff.json
```

## Findings

- Voxel geometry makes proportions easier to edit, but final character quality
  still depends on the target style and motion target being specified before
  model creation.
- A static GLB/OBJ render comparison is insufficient for humanoids. A model that
  looks acceptable in bind pose can still fail when shoulders, elbows, hips, or
  knees rotate.
- Keeping an intermediate motion contract is useful: node names, pivot labels,
  clip names, loop duration, sampled frames, and expected engine direction can
  be verified without involving a full game runtime.
- Do not use `extras.pivot` as a string label in GLB metadata. The local
  Three.js GLTFLoader has a pivot reconstruction path that treats
  `userData.pivot` as an array. This fixture uses `pivotLabel` for human-readable
  labels and reserves `pivot` for numeric loader-owned data.
- Model-local scripts are wrappers around `../../tools/*`. New model scenarios
  should add generators locally but reuse the shared render, compare, contract,
  and motion verifiers.

## Next integration steps

1. Add a real GPT Image 2 prompt stage for voxel humanoid/robot 3-view sheets.
2. Add a VRM/VRMA bridge trial:
   - export or convert the voxel humanoid into a VRM-compatible skeleton
   - replay a small VRMA clip
   - render the same fixed camera frames for comparison
3. Add a Mixamo FBX import/conversion trial as a separate scenario, not as a
   default dependency.
4. Add a Kagura smoke fixture that loads `robot-voxel-motion.glb`, selects a clip,
   and emits the same front/side/iso validation frames from the engine boundary.

## Motion IR bridge

The first bridge does not parse real VRMA yet. It uses the normalized motion IR
in `../../motions/robot-vrma-standin.motion.json`, retargets source skeleton
names to this model's glTF nodes, and writes a derived GLB:

```bash
node design-runs/game-assets-20260520/tools/apply-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --motion design-runs/game-assets-20260520/motions/robot-vrma-standin.motion.json \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb
```

The derived GLB currently includes:

- `vrma_alert_wave`: VRMA-style upper-body alert/wave stand-in
- `mixamo_walk_standin`: Mixamo-style walking stand-in

The derived GLB can also be used as a GLB/VRMA-style source for extraction:

```bash
node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --clips vrma_alert_wave,mixamo_walk_standin \
  --source-kind gltf-vrma-bridge \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.extracted.motion.json

node design-runs/game-assets-20260520/tools/verify-motion-ir.mjs \
  --motion design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.extracted.motion.json \
  --model design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.extracted.motion.verify.json
```

Roundtrip check:

```bash
node design-runs/game-assets-20260520/tools/apply-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --motion design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.extracted.motion.json \
  --replace-existing \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.extracted-roundtrip.glb
```

VRMA-style humanoid fixture:

```bash
node design-runs/game-assets-20260520/tools/stamp-vrma-humanoid.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.fixture.vrma

node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.fixture.vrma \
  --clips vrma_alert_wave,mixamo_walk_standin \
  --source-kind vrma-fixture \
  --target-space humanoid \
  --retarget-preset robot-voxel \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.fixture-vrma.extracted.motion.json
```

The fixture uses the official `VRMC_vrm_animation.humanoid.humanBones` mapping
shape, but it is still a local generated test file. A later adapter should read
real `.vrma` files produced by external tools and emit the same motion IR.

Verification:

```bash
node design-runs/game-assets-20260520/tools/verify-gltf-motion.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --required-nodes robot_root,pelvis,torso,head,left_upper_arm,left_forearm,left_hand,right_upper_arm,right_forearm,right_hand,left_upper_leg,left_lower_leg,left_foot,right_upper_leg,right_lower_leg,right_foot \
  --required-clips idle_bob,walk_cycle,wave,vrma_alert_wave,mixamo_walk_standin \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.verify.json

node design-runs/game-assets-20260520/tools/verify-renders.mjs \
  --dir design-runs/game-assets-20260520/models/robot-voxel-motion/derived/renders \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.render-verify.json
```
