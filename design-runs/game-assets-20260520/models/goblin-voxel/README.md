# Goblin voxel model

This model targets a MagicaVoxel-like game asset style, not a PS1 low-poly
style. The source reference is the generated voxel turnaround:

- `../../references/goblin-voxel-turnaround.png`

Generated outputs:

- `goblin-voxel.glb`
- `goblin-voxel.obj`
- `goblin-voxel.mtl`
- `goblin-voxel.metadata.json`
- `kagura-handoff.json`

Regenerate:

```bash
node design-runs/game-assets-20260520/models/goblin-voxel/generate-goblin-voxel.mjs
```

Render fixed camera snapshots with the shared Three.js + Playwright viewer:

```bash
node design-runs/game-assets-20260520/models/goblin-club-blockout/render-model.mjs \
  --input design-runs/game-assets-20260520/models/goblin-voxel/goblin-voxel.glb \
  --view all \
  --mode material \
  --out design-runs/game-assets-20260520/models/goblin-voxel/renders
```

Compare GLB and OBJ renders:

```bash
node design-runs/game-assets-20260520/models/goblin-club-blockout/compare-model-renders.mjs \
  --base goblin-voxel \
  --mode geometry \
  --dir design-runs/game-assets-20260520/models/goblin-voxel/renders
```

Current comparison:

| Mode | View | Diff |
|---|---|---:|
| geometry | front | 0.00% |
| geometry | side | 0.00% |
| geometry | back | 0.00% |
| geometry | iso | 0.00% |
| material | front | 21.83% |
| material | side | 8.52% |
| material | back | 22.19% |
| material | iso | 20.84% |

Target constraints:

- blocky cube primitives only
- readable front / side / back silhouette
- limited palette
- green skin, large voxel ears, dark leather vest, ragged shorts, tan wraps,
  bare blocky feet, and chunky wooden club
- primary handoff format: GLB

This is still a manual procedural reconstruction from the generated reference.
It is not automatic image-to-voxel conversion.

Assessment:

- This direction matches the prompt better than the earlier smooth low-poly
  blockout. The asset reads as a voxel character rather than a generic low-poly
  mesh.
- The generated voxel turnaround is a stronger reference target because it
  already encodes a cube grid, limited palette, and blocky silhouette.
- Geometry parity between GLB and OBJ is exact in the fixed renderer. Material
  diffs are expected because GLB PBR and OBJ/MTL shading differ.
