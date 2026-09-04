# @mizchi/vlmkit-anim

Declarative explanatory animations, for an AI to explain something to a
person: a sorting run, a binary search with its pointers, a state-machine trace, heap
and BST operations, a DP table filling in,
a graph traversal, a chart revealed series by series, messages between
distributed nodes, a concept diagram walked through in beats, or a generic
vector tween. One JSON file in, a `<vlm-anim>` web component (SVG + Web
Animations, ~7KB, no dependencies) out — plus headless SVG frames and checks
that the motion says what the file claims.

```bash
vlmkit-anim schema --kind sort          # the writing guide for one kind
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

## Optional peers

- `playwright` — `frames --png`, `sheet` (PNG), `video`, `eval`. Everything else is browser-free.
- `@mizchi/vlmkit-animation-eval` — `vlmkit-anim eval page.html`: the frame-sampled evaluator
  behind vlmkit's `check animation` gate, run on the pages this tool emits. Writing needs neither.

Sample outputs for every fixture (one GIF and one contact sheet each) are in
[`samples/`](./samples/README.md).
