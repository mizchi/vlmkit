# Humanoid motion IR

This directory holds a small normalized motion format used before adding a real
VRM/VRMA or Mixamo FBX dependency.

The intent is to keep external motion sources out of model generation code:

1. Convert a motion source into this IR.
2. Retarget the IR onto a model's named glTF nodes.
3. Write a derived GLB with imported animation clips.
4. Use the shared render and verifier tools to check the result.

This is a bridge, not a replacement for VRMA. The next implementation can add a
real VRMA reader that emits the same IR.

## Shape

```json
{
  "version": 1,
  "id": "robot-vrma-standin",
  "source": {
    "kind": "vrma-standin",
    "note": "manual stand-in while VRMA parser is not wired"
  },
  "retarget": {
    "hips": "pelvis",
    "spine": "torso",
    "head": "head"
  },
  "clips": [
    {
      "id": "vrma_alert_wave",
      "durationSeconds": 1.6,
      "loop": true,
      "tracks": [
        {
          "target": "rightUpperArm",
          "path": "rotation",
          "keyframes": [
            { "time": 0, "euler": [-0.2, 0, -0.3] }
          ]
        }
      ]
    }
  ]
}
```

Track targets may be either glTF node names or source skeleton names. The
`retarget` table maps source names to glTF node names.

## Tools

Validate an IR against a target model:

```bash
node design-runs/game-assets-20260520/tools/verify-motion-ir.mjs \
  --motion design-runs/game-assets-20260520/motions/robot-vrma-standin.motion.json \
  --model design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb
```

Extract supported animation tracks from a GLB/VRMA-style file into IR:

```bash
node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --clips vrma_alert_wave,mixamo_walk_standin \
  --source-kind gltf-vrma-bridge \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.extracted.motion.json
```

The extractor currently supports GLB/VRMA-like binary glTF files with
`rotation` and `translation` animation channels. It writes quaternion rotations
to the IR. For `--target-space humanoid`, it reads
`VRMC_vrm_animation.humanoid.humanBones` and emits humanoid bone names as track
targets.

Create a local VRMA-style fixture from an animated GLB:

```bash
node design-runs/game-assets-20260520/tools/stamp-vrma-humanoid.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.fixture.vrma
```

Extract by humanoid bone names from the fixture:

```bash
node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.fixture.vrma \
  --clips vrma_alert_wave,mixamo_walk_standin \
  --source-kind vrma-fixture \
  --target-space humanoid \
  --retarget-preset robot-voxel \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.fixture-vrma.extracted.motion.json
```

For real VRMA inputs, the source skeleton can be more detailed than the target
fixture. `--retarget-preset robot-voxel` keeps only bones supported by the
current voxel robot and records skipped channels in `source.warnings`. Add
`--strict-retarget` when a scenario should fail on any unsupported channel.

Local-only third-party sample fetch:

```bash
node design-runs/game-assets-20260520/tools/fetch-external-vrma-sample.mjs \
  --sample LookAround
```

The downloaded `.vrma`, license, extracted IR, roundtrip GLB, and renders stay
under ignored `design-runs/game-assets-20260520/external/`.
