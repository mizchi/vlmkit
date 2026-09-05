# @mizchi/vlmkit-anim

Declarative explanatory animations, for an AI to explain something to a
person: a sorting run, a binary search with its pointers, a state-machine trace, heap
and BST operations, a DP table filling in,
a graph traversal, a chart revealed series by series, messages between
distributed nodes, a concept diagram walked through in beats, or a generic
vector tween. One JSON file in, a `<vlm-anim>` web component (SVG + Web
Animations, ~7KB, no dependencies) out — plus headless SVG frames and checks
that the motion says what the file claims.

Every kind also takes five **annotation** ops (`value`, `callout`, `snapshot`,
`group`, `text`) that point at the kind's own things by name, and `kind: compose`
puts several scenes side by side, in sequence or in parallel.

```bash
vlmkit-anim schema --kind sort          # the writing guide for one kind
vlmkit-anim schema --kind annotations   # the shared ops and each kind's anchors
vlmkit-anim check scene.json            # validate → compile → semantic checks → stats (exit 1 on errors)
vlmkit-anim explain scene.json          # the narration as a numbered list
vlmkit-anim render scene.json --step 4  # one frame as SVG
vlmkit-anim html scene.json --out page.html
```

```json
{ "format": "vlmkit-anim/scene@1", "kind": "sort", "algorithm": "bubble", "values": [5, 3, 8, 1] }
```

Two layers: a **Scene** (`kind` + intent, the thing you write and re-read) that
compiles to a **Timeline** (nodes + keyframe tracks + captioned steps, the
thing that plays). Writing guide: [`docs/anim-ir.md`](../../docs/anim-ir.md).
Design notes: [`docs/design/anim-ir.md`](../../docs/design/anim-ir.md).

## Library

```ts
import { compileScene, checkAnimation, renderFrameSvg, renderEmbedHtml, RUNTIME_SOURCE } from "@mizchi/vlmkit-anim";

const timeline = compileScene(scene);          // throws SceneValidationError with diagnostics
const problems = checkAnimation(timeline, scene);
const svg = renderFrameSvg(timeline, 1200);    // deterministic, browser-free
const html = renderEmbedHtml(timeline);        // self-contained page
```

### Writing scenes in TypeScript

```ts
// insertion.scene.ts — any verb takes it: vlmkit-anim check insertion.scene.ts
import { scene } from "@mizchi/vlmkit-anim";
export default scene.sort({ algorithm: "insertion", values: [5, 3, 8, 1, 4] });
```

`scene.<kind>({ … })` fills in `format` and `kind` and types the body; `sceneJson(s)`
writes the equivalent JSON file. JSON stays the format — this is the editor's view of it.

## Optional peers

- `playwright` — `frames --png`, `sheet` (PNG), `video`, `eval`. Everything else is browser-free.
- `@mizchi/vlmkit-animation-eval` — `vlmkit-anim eval page.html`: the frame-sampled evaluator
  behind vlmkit's `check animation` gate, run on the pages this tool emits. Writing needs neither.

Sample outputs for every fixture (one GIF and one contact sheet each) are in
[`samples/`](./samples/README.md).

## Scenes from a repository

```bash
vlmkit-anim repo --out docs/diagrams --name architecture       # the workspace's packages, layer by layer
vlmkit-anim pr --base origin/main --title "PR #12: …" --out pr  # one beat per commit: areas touched, import edges, counts
```

Both write the scene, a GIF, a contact sheet and a markdown file with the narration and both
images embedded — paste it into the pull request, or let a workflow do it on every push (this
repository's `pr-visual` workflow does). The scene is kept so the picture stays editable.
