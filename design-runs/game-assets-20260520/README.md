# GPT Image 2 game asset dogfood

Date: 2026-05-20

## Purpose

Evaluate how far `gpt-image-2` can go for game asset production before we
build more vlmkit automation around generated assets.

This is not a markup scenario. The source of truth is asset usefulness:
silhouette, consistency, separability, atlas readiness, and whether the output
can become downstream game data.

Official API facts used for this run:

- `gpt-image-2` is an image generation/editing model with text and image input
  and image output.
- The Image API supports image generations and image edits. For one-shot asset
  generation, use `/v1/images/generations`; use the Responses API when we need
  multi-turn image editing.
- GPT image responses return base64 image data and usage metadata.
- `gpt-image-2` does not currently support transparent backgrounds, so sprite
  atlas tests use an opaque chroma-key background instead of alpha.
- Standard pricing is per token: text input $5 / 1M, image input $8 / 1M, image
  output $30 / 1M. The script stores returned usage so actual cost can be
  calculated from the API response.

Sources:

- https://developers.openai.com/api/docs/models/gpt-image-2
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/guides/tools-image-generation
- https://developers.openai.com/api/docs/pricing

## Sequence

Run in this order. Do not move to the next stage until the current stage has a
useful pass/fail note.

| Stage | Output | Question |
|---|---|---|
| `concept-single` | 1 concept image | Can it create a coherent game object with readable silhouette and material language? |
| `turnaround-3view` | Front/side/back sheet | Can it keep one object consistent across orthographic views? |
| `sprite-atlas-2d` | 2D atlas sheet | Can it keep cell boundaries, consistent scale, and animation variants usable for slicing? |
| `model-reference-3d` | 3D modeling reference sheet | Can it create references good enough for a separate image-to-3D or Blender modeling pass? |

`model-reference-3d` is intentionally not a GLB/OBJ test. `gpt-image-2` returns
images, so the asset it can produce directly is a model sheet, not a 3D model
file.

## Commands

Dry-run all prompts without spending API credits:

```bash
node design-runs/game-assets-20260520/run-gpt-image-2.mjs --list
node design-runs/game-assets-20260520/run-gpt-image-2.mjs --stage all
```

Generate one stage:

```bash
OPENAI_API_KEY=... node design-runs/game-assets-20260520/run-gpt-image-2.mjs \
  --stage concept-single \
  --run
```

Generate the full first pass:

```bash
OPENAI_API_KEY=... node design-runs/game-assets-20260520/run-gpt-image-2.mjs \
  --stage all \
  --quality medium \
  --n 1 \
  --run
```

Outputs are written to `outputs/`. Generated images are local experiment
artifacts; do not commit them unless they are promoted into a report fixture.

## Evaluation notes

Score each stage 0-2 per item:

- 0: unusable
- 1: usable with manual cleanup
- 2: usable as-is for the next pipeline step

### `concept-single`

- silhouette is readable at thumbnail size
- style is game-production friendly, not only poster art
- materials/colors are coherent
- object design has clear front/back/top cues
- no unwanted text or UI labels

### `turnaround-3view`

- front, side, and back describe the same object
- scale is consistent across panels
- perspective is orthographic enough for modeling
- important asymmetries are preserved
- no decorative background interfering with reference use

### `sprite-atlas-2d`

- grid is regular enough to slice
- background is flat enough for chroma-key removal
- sprite scale and anchor point are consistent
- variants read as the same object
- no shadows, overlaps, labels, or gutters bleeding into cells

### `model-reference-3d`

- front/side/top/back views are mutually consistent
- form can be approximated as simple geometry
- material regions are visible
- silhouette and proportions match earlier stages
- sheet is useful for a separate image-to-3D or manual modeling pass

## Expected failure modes

- The 3-view sheet may drift between views.
- The atlas may draw beautiful icons but fail grid regularity.
- `gpt-image-2` cannot directly output transparent PNGs, so alpha-ready sprites
  require post-processing or a different model/tool.
- The 3D stage can only produce model references, not mesh topology, UVs,
  rigging, or a game-ready model file.
- Labels and tiny callouts may become visual noise; prefer text-free sheets and
  keep semantic metadata outside the image.

## Next vlmkit work if this is promising

1. Add an asset-sheet inspector that detects grid regularity, gutters, dominant
   background color, alpha/chroma-key readiness, and sprite bbox consistency.
2. Add an `asset contract` alongside UI Contract:
   - subject id
   - asset kind: concept, turnaround, atlas, model-reference
   - intended downstream step
   - view labels / atlas grid / expected background
3. Add a report that compares generated stages for identity drift.
4. Add a bridge from `model-reference-3d` to an external image-to-3D generator
   only after the 2D reference quality is good enough.

## Manual 3D blockout trial

The generated goblin turnaround was copied as:

- `references/goblin-turnaround.png`

A first low-poly blockout was generated from that reference:

- `models/goblin-club-blockout/goblin-club-blockout.glb`
- `models/goblin-club-blockout/goblin-club-blockout.obj`
- `models/goblin-club-blockout/goblin-club-blockout.mtl`
- `models/goblin-club-blockout/renders/*.png`
- `models/goblin-club-blockout/kagura-handoff.json`

This is not automated image-to-3D reconstruction. It is a procedural blockout
that encodes the visible design decisions from the reference: large head,
pointed ears, hooked nose, leather vest, ragged skirt, cloth wraps, bare feet,
and wooden club. It is useful as a scale/proportion starting point for manual
sculpting, rigging tests, or a later image-to-3D pipeline.

Regenerate:

```bash
node design-runs/game-assets-20260520/models/goblin-club-blockout/generate-goblin-blockout.mjs
```

Render GLB/OBJ with fixed Three.js + Playwright cameras:

```bash
node design-runs/game-assets-20260520/tools/render-model.mjs \
  --input design-runs/game-assets-20260520/models/goblin-club-blockout/goblin-club-blockout.glb \
  --view all \
  --mode geometry

node design-runs/game-assets-20260520/tools/render-model.mjs \
  --input design-runs/game-assets-20260520/models/goblin-club-blockout/goblin-club-blockout.obj \
  --view all \
  --mode geometry
```

Compare the fixed renders:

```bash
node design-runs/game-assets-20260520/tools/compare-renders.mjs \
  --dir design-runs/game-assets-20260520/models/goblin-club-blockout/renders \
  --base goblin-club-blockout \
  --mode geometry

node design-runs/game-assets-20260520/tools/compare-renders.mjs \
  --dir design-runs/game-assets-20260520/models/goblin-club-blockout/renders \
  --base goblin-club-blockout \
  --mode material
```

Current fixed-render result:

- geometry GLB vs OBJ: near-zero diff across front / side / back / iso.
- material GLB vs OBJ: 8-14% diff, expected because GLB PBR and OBJ/MTL
  material paths are not equivalent.

## Kagura integration direction

`mizchi/kagura` is a 2D-first MoonBit game engine with browser WebGPU and
native backends. Its public README describes glTF loading and 2D/3D renderer
facades in the engine boundary, so the clean handoff from vlmkit should be GLB
plus validation snapshots.

Split responsibilities:

- vlmkit: generate references, produce blockouts, render fixed camera previews,
  compare GLB/OBJ or GLB/kagura renders, and write asset handoff manifests.
- kagura: load GLB/glTF into the runtime, bind gameplay scale/origin, handle
  animation and scene integration, and eventually run engine-side visual smoke
  tests.

Initial shared contract:

- `primaryModel`: GLB path
- `sourceReference`: generated turnaround image
- `originPolicy`: model origin convention
- `coordinateNotes`: Y-up / front direction notes
- `renderChecks`: front / side / back / iso snapshots and thresholds

## Shared asset tools

The first passes kept renderer and verifier scripts inside individual model
directories. That made dogfood quick, but it hid the reusable quality gates. The
shared tools now live in `tools/`:

- `tools/render-model.mjs`: fixed-camera GLB/GLTF/OBJ snapshots
- `tools/compare-renders.mjs`: GLB vs OBJ pixel comparison
- `tools/render-animation.mjs`: fixed-camera animation frame snapshots
  with direct canvas capture and transparent-buffer retry
- `tools/verify-renders.mjs`: nonblank frame and finite-bounds checks
- `tools/verify-gltf-motion.mjs`: node, clip, channel, and loop checks
- `tools/verify-asset-contract.mjs`: handoff contract checks
- `tools/apply-motion-ir.mjs`: retarget normalized humanoid motion IR and write
  derived GLB animation clips; supports root translation policies for simplified
  target rigs and `--audit-out` normalization reports
- `tools/verify-motion-ir.mjs`: validate motion IR shape, loop closure, and
  optional model retarget targets
- `tools/extract-gltf-motion-ir.mjs`: extract glTF/GLB animation clips into
  normalized motion IR
- `tools/stamp-vrma-humanoid.mjs`: create a local VRMA-style fixture by adding
  `VRMC_vrm_animation.humanoid.humanBones` to an animated GLB
- `tools/fetch-external-vrma-sample.mjs`: download ignored third-party VRMA
  samples for local smoke tests
- `tools/run-external-vrma-smoke.mjs`: batch fetch/extract/retarget/render
  external VRMA samples and write a structured smoke report; supports
  normalization audit summaries, root scaling recommendations, and
  `--min-quality pass|warn|fail` for CI-style gating
- `tools/verify-motion-quality.mjs`: turn render metadata, frame bboxes,
  normalized ground deltas, tracked foot contact, tracked limb displacement,
  and Motion IR warnings into `pass` / `warn` / `fail`; supports strict and
  named weighted retarget profiles
- `tools/verify-motion-quality-gold.mjs`: compare a smoke report against a
  small committed quality calibration fixture
- `tools/review-motion-with-vlm.mjs`: optional cheap VLM second opinion using
  a generated contact sheet; dry-runs without credentials
- `tools/retarget-profiles.mjs`: named retarget downgrade profiles with
  weighted skip scoring; `simple-rig` is kept as an alias of `robot-voxel`
- `motions/external-vrma-quality-gold.json`: calibration ranges for
  `LookAround`, `Goodbye`, and `Jump` on the voxel robot

Model-local scripts are thin wrappers for backwards compatibility. New
scenarios should call the shared tools directly and keep only generation logic
inside the model directory.

## Voxel goblin trial

After the first smooth low-poly blockout, the target was tightened to a
MagicaVoxel-like voxel character. This produced a much more coherent asset
target because the prompt specified the game-art style before model creation.

Reference:

- `references/goblin-voxel-turnaround.png`

Generated voxel outputs:

- `models/goblin-voxel/goblin-voxel.glb`
- `models/goblin-voxel/goblin-voxel.obj`
- `models/goblin-voxel/goblin-voxel.mtl`
- `models/goblin-voxel/renders/*.png`
- `models/goblin-voxel/kagura-handoff.json`

Current fixed-render result:

- geometry GLB vs OBJ: 0.00% diff across front / side / back / iso.
- material GLB vs OBJ: 8-22% diff, still expected because GLB PBR and OBJ/MTL
  material paths are not equivalent.

Takeaway:

- For game assets, the first prompt must declare target art style and downstream
  use. "3D model" alone is too ambiguous and tends to produce generic smooth
  low-poly output.
- Voxel is a promising target for this workflow because the image model can
  express grid-like constraints clearly in the turnaround sheet, and vlmkit can
  reconstruct a usable cube model with deterministic primitives.

## Motion-ready robot trial

The next useful external pattern came from npaka's Codex voxel model article:

- https://note.com/npaka/n/nde5589d13536

The article's important signal is that quality improves when the asset pipeline
continues past static model generation into animation replay. It tries a voxel
robot, saves a humanoid model as VRM, replays VRMA, and then tries Mixamo FBX as
an external motion source. For vlmkit, this suggests a new acceptance gate:
humanoid voxel assets must be evaluated by named joints, stable pivots, and
sampled motion frames, not only by bind-pose renders.

This run adds a procedural motion fixture:

- `models/robot-voxel-motion/robot-voxel-motion.glb`
- `models/robot-voxel-motion/robot-voxel-motion.obj`
- `models/robot-voxel-motion/robot-voxel-motion.mtl`
- `models/robot-voxel-motion/renders/*.png`
- `models/robot-voxel-motion/kagura-handoff.json`

The GLB has named transform nodes for head, torso, pelvis, arms, legs, hands,
and feet, plus `idle_bob`, `walk_cycle`, and `wave` animation clips. This is not
yet VRM/VRMA, but it creates the same kind of quality checkpoint: if fixed
front/side/iso animation frames are blank, out of bounds, or visually broken,
the asset is not motion-ready.

Regenerate and verify:

```bash
node design-runs/game-assets-20260520/models/robot-voxel-motion/generate-robot-motion.mjs
node design-runs/game-assets-20260520/tools/verify-gltf-motion.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --contract design-runs/game-assets-20260520/models/robot-voxel-motion/kagura-handoff.json
node design-runs/game-assets-20260520/tools/render-animation.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --clip walk_cycle \
  --view all \
  --time all \
  --mode material
node design-runs/game-assets-20260520/tools/verify-renders.mjs \
  --dir design-runs/game-assets-20260520/models/robot-voxel-motion/renders \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.render-verify.json
node design-runs/game-assets-20260520/tools/verify-asset-contract.mjs \
  --contract design-runs/game-assets-20260520/models/robot-voxel-motion/kagura-handoff.json
```

Implementation note:

- Reserve `extras.pivot` for numeric loader-owned pivot data. The local
  Three.js GLTFLoader reconstructs pivots from that field, so human-readable
  labels must use `pivotLabel` instead.

## Motion IR bridge

Before taking a dependency on VRM/VRMA or FBX loaders, this run adds a small
humanoid motion IR:

- `motions/robot-vrma-standin.motion.json`

This IR uses source skeleton names such as `hips`, `rightUpperArm`, and
`leftUpperLeg`, then retargets them to generated glTF nodes such as `pelvis`,
`right_upper_arm`, and `left_upper_leg`. The current file is a stand-in for real
VRMA and Mixamo input. It lets vlmkit verify the important boundary first:
external motion source -> normalized motion IR -> retargeted GLB animation ->
fixed-camera motion snapshots.

Create the derived GLB:

```bash
node design-runs/game-assets-20260520/tools/apply-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --motion design-runs/game-assets-20260520/motions/robot-vrma-standin.motion.json \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb
```

Render and verify the imported clips:

```bash
node design-runs/game-assets-20260520/tools/render-animation.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --clip vrma_alert_wave \
  --view all \
  --time 0,0.4,0.8,1.2 \
  --mode material \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/renders

node design-runs/game-assets-20260520/tools/render-animation.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --clip mixamo_walk_standin \
  --view iso \
  --time 0,0.25,0.5,0.75 \
  --mode material \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/renders

node design-runs/game-assets-20260520/tools/verify-renders.mjs \
  --dir design-runs/game-assets-20260520/models/robot-voxel-motion/derived/renders \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.render-verify.json
```

The next real implementation should replace the stand-in IR producer, not the
rest of the pipeline:

- VRMA parser -> humanoid motion IR
- Mixamo FBX parser/converter -> humanoid motion IR
- humanoid motion IR -> `apply-motion-ir.mjs` -> derived GLB

Current adapter coverage:

```bash
node design-runs/game-assets-20260520/tools/verify-motion-ir.mjs \
  --motion design-runs/game-assets-20260520/motions/robot-vrma-standin.motion.json \
  --model design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb

node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --clips vrma_alert_wave,mixamo_walk_standin \
  --source-kind gltf-vrma-bridge \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.extracted.motion.json

node design-runs/game-assets-20260520/tools/apply-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --motion design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.extracted.motion.json \
  --replace-existing \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.extracted-roundtrip.glb
```

This roundtrip proves the producer boundary:

`animated GLB/VRMA-style source -> motion IR -> retargeted GLB -> render gate`.

## VRMA humanoid fixture

Official VRM Animation facts used here:

- VRM Animation stores animation as glTF animation data.
- `VRMC_vrm_animation` is a root glTF extension.
- `humanoid.humanBones` maps VRM humanoid bone names such as `hips` and
  `rightUpperArm` to glTF node indices.
- VRMA is intended as a separate animation file and commonly uses the `.vrma`
  extension.

Sources:

- https://vrm.dev/en/vrma/
- https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm_animation-1.0

The local fixture stamps this extension onto the derived animated GLB:

```bash
node design-runs/game-assets-20260520/tools/stamp-vrma-humanoid.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.glb \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.fixture.vrma
```

Then extraction can target humanoid names instead of source node names:

```bash
node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.vrma-bridge.fixture.vrma \
  --clips vrma_alert_wave,mixamo_walk_standin \
  --source-kind vrma-fixture \
  --target-space humanoid \
  --retarget-preset robot-voxel \
  --out design-runs/game-assets-20260520/models/robot-voxel-motion/derived/robot-voxel-motion.fixture-vrma.extracted.motion.json
```

This is still not a full VRMA implementation. It does prove the important
humanoid adapter boundary: `VRMC_vrm_animation.humanoid.humanBones` -> humanoid
motion IR targets -> model-specific retarget map -> derived GLB.

## External VRMA smoke test

The next dogfood pass uses a real `.vrma` file from `tk256ailab/vrm-viewer`.
The sample files and their derived outputs are local-only under ignored
`external/` because they are third-party assets. The repository keeps only the
fetch script, commands, and summarized result.

Source:

- https://github.com/tk256ailab/vrm-viewer
- https://raw.githubusercontent.com/tk256ailab/vrm-viewer/main/LICENSE

Fetch one sample:

```bash
node design-runs/game-assets-20260520/tools/fetch-external-vrma-sample.mjs \
  --sample LookAround
```

Run the full local-only batch smoke:

```bash
node design-runs/game-assets-20260520/tools/run-external-vrma-smoke.mjs \
  --samples LookAround,Goodbye,Jump \
  --review-vlm \
  --review-dry-run
```

This writes ignored per-sample artifacts plus
`external/vrma/tk256ailab/smoke-report.json`. `--review-dry-run` generates the
VLM contact sheet and prompt without spending model credits.

Extract and retarget only the humanoid bones supported by the current voxel
robot:

```bash
node design-runs/game-assets-20260520/tools/extract-gltf-motion-ir.mjs \
  --input design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.vrma \
  --source-kind external-vrma \
  --target-space humanoid \
  --retarget-preset robot-voxel \
  --out design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.extracted.motion.json

node design-runs/game-assets-20260520/tools/verify-motion-ir.mjs \
  --motion design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.extracted.motion.json \
  --model design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb
```

Apply and run a visual smoke test:

```bash
node design-runs/game-assets-20260520/tools/apply-motion-ir.mjs \
  --input design-runs/game-assets-20260520/models/robot-voxel-motion/robot-voxel-motion.glb \
  --motion design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.extracted.motion.json \
  --replace-existing \
  --out design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.robot-roundtrip.glb

node design-runs/game-assets-20260520/tools/verify-gltf-motion.mjs \
  --input design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.robot-roundtrip.glb \
  --motion-ir design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.extracted.motion.json

node design-runs/game-assets-20260520/tools/render-animation.mjs \
  --input design-runs/game-assets-20260520/external/vrma/tk256ailab/LookAround.robot-roundtrip.glb \
  --clip LookAround \
  --view iso \
  --time 0,1,2,3.9 \
  --mode material \
  --out design-runs/game-assets-20260520/external/vrma/tk256ailab/renders

node design-runs/game-assets-20260520/tools/verify-renders.mjs \
  --dir design-runs/game-assets-20260520/external/vrma/tk256ailab/renders
```

Learned:

- Real VRMA files may omit animation clip names; the extractor now falls back
  to the input file name.
- VRMA humanoid mappings can include full finger, toe, shoulder, neck, and chest
  bones. The current voxel robot is intentionally simpler, so `robot-voxel`
  retargeting skips unsupported channels with warnings instead of emitting
  invalid IR.
- GLB verification must distinguish loop clips from one-shot clips. External
  VRMA samples such as `LookAround` should pass `--motion-ir` so clip and loop
  metadata come from the adapter output.
- The first automated quality gate is intentionally conservative: nonblank and
  bounds failures are hard failures, while ground penetration, foot-contact
  envelope drift, tracked limb outliers, and low retained-channel ratio are
  warnings that keep the agent loop moving unless `--min-quality pass` is
  requested.
- Cheap VLM review is a second opinion, not the source of truth. The reviewer
  sees a contact sheet plus deterministic metrics and must return strict JSON.
  With no `OPENROUTER_API_KEY`, the review step is skipped but still emits
  prompt/contact-sheet artifacts for reproducibility.
