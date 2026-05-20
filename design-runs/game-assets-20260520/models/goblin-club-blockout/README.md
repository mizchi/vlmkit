# Goblin club blockout

This is a first-pass low-poly model derived from the generated goblin
turnaround reference.

Reference:

- `../../references/goblin-turnaround.png`

Generated outputs:

- `goblin-club-blockout.obj`
- `goblin-club-blockout.mtl`
- `goblin-club-blockout.glb`
- `goblin-club-blockout.metadata.json`
- `kagura-handoff.json`

Regenerate:

```bash
node design-runs/game-assets-20260520/models/goblin-club-blockout/generate-goblin-blockout.mjs
```

Render fixed camera snapshots:

```bash
node design-runs/game-assets-20260520/models/goblin-club-blockout/render-model.mjs \
  --input design-runs/game-assets-20260520/models/goblin-club-blockout/goblin-club-blockout.glb \
  --view all \
  --mode geometry

node design-runs/game-assets-20260520/models/goblin-club-blockout/render-model.mjs \
  --input design-runs/game-assets-20260520/models/goblin-club-blockout/goblin-club-blockout.obj \
  --view all \
  --mode geometry
```

Compare GLB and OBJ renders:

```bash
node design-runs/game-assets-20260520/models/goblin-club-blockout/compare-model-renders.mjs \
  --mode geometry
```

Current comparison:

| Mode | View | Diff |
|---|---|---:|
| geometry | front | 0.00% |
| geometry | side | 0.00% |
| geometry | back | 0.00% |
| geometry | iso | 0.00% |
| material | front | 14.08% |
| material | side | 8.19% |
| material | back | 13.49% |
| material | iso | 12.16% |

Scope:

- This is a blockout, not a production sculpt.
- It captures proportions, ears, nose, vest, skirt, wraps, feet, and club.
- Texture details from the image are represented as simple materials only.
- Next step is either manual sculpt cleanup or an image-to-3D pipeline using
  the turnaround sheet plus this blockout as scale/proportion reference.

Kagura integration notes:

- `kagura` is 2D-first with future 3D, and its architecture includes glTF
  loading and 2D/3D renderer boundaries. Keep GLB as the primary handoff.
- vlmkit should own asset generation, reference sheets, fixed-camera preview,
  and GLB/OBJ visual comparison.
- kagura should own runtime import, WebGPU rendering, gameplay scale, animation,
  and scene integration.
- The shared artifact should be a small handoff manifest:
  `kagura-handoff.json`.
