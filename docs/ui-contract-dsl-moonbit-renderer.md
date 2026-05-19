# UI Contract DSL and MoonBit renderer plan

Date: 2026-05-20

## Decision

Treat the design target as a UI Contract DSL / IR instead of direct CSS.

CSS remains an output target and escape hatch, but the editable source of truth
for agent loops should be:

- semantic landmarks
- pattern / goal metadata
- layout contracts
- responsive rules
- machine-readable markers
- interaction states
- scrollports
- grid/subgrid tracks
- decoration tokens
- content bindings
- asset / canvas hooks

This keeps design intent separate from browser-specific CSS serialization.

## Editing Metadata Policy

Every design run should keep a UI Contract IR artifact as editing metadata.

Recommended filename:

```text
design-runs/<name>/ui.contract.json
```

This file is not a screenshot and not a final build artifact. It is the
editable design model that lets agents round-trip between:

- AI mock image
- semantic landmarks
- layout constraints
- generated HTML/CSS
- visual reports

The contract should be versioned with the design run because it explains *why*
CSS was generated in a certain shape. When the implementation changes, rerun
introspection and either update the contract or treat the diff as a design
regression.

The contract should retain intentionally high-level metadata:

- landmark role and accessible name
- pattern, goal, and source-of-truth metadata
- min/max width policy
- height / scrollport policy
- grid/subgrid tracks
- responsive viewport overrides
- required markers and states
- decoration/token references
- content density and asset/canvas policy

It should not become a full CSS AST. CSS remains an output/escape-hatch layer.

## Why Not Direct CSS

The current dogfood loop already shows that the agent is not really editing
individual declarations. It is trying to answer higher-level questions:

- Is this landmark fluid, fixed, or bounded by min/max width?
- Is this section document-flow content or an internal scrollport?
- Are these children aligned by shared grid tracks or local offsets?
- Which markers and states prove that the implementation is usable?
- Is the mismatch in layout, decoration, or content?
- Which semantic region should be edited next?

Those are contract questions. CSS is too low-level as the primary editing
surface.

## Initial TypeScript IR

The first stable schema lives in:

```text
packages/vlmkit-markup/src/contract/ui-contract.ts
```

It is intentionally small:

- `UiContract`
- `UiContractScreen`
- `UiContractViewport`
- `UiContractLandmark`
- `UiLayoutContract`
- pattern / goal metadata
- marker / state / slot / repeat contracts
- content / decoration / asset / canvas contracts
- width / height / display / scroll policies
- responsive overrides

This TypeScript version is a schema anchor and dogfood harness. It validates the
editing metadata needed by current dogfood, but it is not meant to become the
final heavy implementation.

## Introspection Tool

Existing implementations can be converted into a draft UI Contract:

```bash
vlmkit contract introspect path/to/page.html \
  --screen-id blog-home \
  --pattern editorial \
  --goal app \
  --viewport desktop:1536x1024 \
  --viewport mobile:432x911@2 \
  --out design-runs/blog-20260519/ui.contract.json
```

The tool opens the page, captures concrete ARIA/semantic landmarks, reads the
current layout contract from computed styles, captures common implementation
markers / assets / canvas hooks, and writes `ui.contract.json`.

The initial introspector intentionally reports incomplete contracts instead of
guessing intent. For example, a region with no `min-width` / `max-width` is
emitted as `fluid unbounded` and the validator reports:

```text
fluid width must declare min or max
```

That is useful editing feedback: it tells the agent to decide whether the
region should be bounded, fixed, intrinsic, or deliberately unbounded.

Validation is available separately:

```bash
vlmkit contract validate design-runs/blog-20260519/ui.contract.json
```

## MoonBit Rewrite Candidate

The final implementation should be considered for MoonBit once the IR proves
stable.

Reasons:

- the contract will become a compiler, not just a report formatter;
- layout solving benefits from precise algebraic data types;
- renderer backends need deterministic tests and snapshotable output;
- MoonBit can share types with `mizchi/crater` / `crater-dom` / `crater-css`;
- keeping the core in MoonBit makes it easier to reuse from CLI, server, and
  future wasm/runtime integrations.

Proposed package boundary:

```text
vlmkit TypeScript CLI
  -> reads/writes UI Contract JSON
  -> calls MoonBit compiled JS/WASM module

MoonBit contract core
  -> parse / validate UI Contract
  -> normalize responsive variants
  -> compile to CSS/HTML skeleton
  -> simulate layout via renderer backend
  -> emit layout/decorate action plan

Renderer backends
  -> chromium backend: compatibility oracle
  -> crater backend: CSS semantics / paint-tree / breakpoint engine
  -> layout backend: future fast layout-only simulator
```

## Renderer Strategy

### Chromium

Keep Chromium as the compatibility oracle. It is slower, but it defines browser
truth for final VRT and obscure CSS behavior.

### crater

Use `mizchi/crater` for fast structured rendering where it is accurate enough.
Existing vlmkit already integrates a Crater BiDi client with viewport,
HTML content, screenshot, raw paint data, computed styles, and responsive
breakpoint discovery.

Crater is a good fit for:

- media query / breakpoint normalization
- computed layout inspection
- paint tree / structured diff
- fast approximation of common layout and paint
- contract-to-render feedback without launching Chromium

Known current risk from local docs:

- border radius, font weight, text decoration, some margins, and some
  `align-items` cases are not yet full-fidelity.

Policy: use crater as a fast semantic renderer, not as the final browser truth.
When crater and Chromium disagree, mark the case as backend divergence and keep
Chromium as the oracle.

### layout backend

If `mizchi/layout` or a similar MoonBit layout-only renderer becomes available,
use it for an even smaller loop:

- no DOM parsing
- no CSS cascade
- no paint
- only contract layout resolution

This backend should answer:

- landmark bboxes
- grid track sizes
- subgrid inheritance
- scrollport content size
- responsive stack order

It should not answer decoration fidelity.

## Contract Compiler Pipeline

```text
brief / mock
  -> UI Contract draft
  -> validate contract
  -> compile semantic HTML skeleton
  -> compile CSS grid/subgrid/tokens
  -> simulate layout
  -> compare landscape/layout/decorate lanes
  -> update contract or implementation
```

The key loop is:

```text
target landscape
  -> infer/update UI Contract
  -> simulate contract
  -> compare contract landscape
  -> only then generate CSS
```

This keeps the agent from patching CSS symptoms before the layout model is
right.

## DSL Shape

Start with JSON / TypeScript object shape, not a custom parser.

Example:

```json
{
  "version": 1,
  "screens": [
    {
      "id": "blog-home",
      "pattern": "editorial",
      "goal": "app",
      "sourceOfTruth": "semantic-dom",
      "viewports": [
        { "label": "desktop", "width": 1536, "height": 1024 },
        { "label": "mobile", "width": 432, "height": 911, "dpr": 2 }
      ],
      "markers": [
        { "kind": "primary-cta", "selector": "[data-primary-cta]", "required": true }
      ],
      "states": [
        { "id": "cta-focus", "kind": "focus-visible", "selector": "[data-primary-cta]" }
      ],
      "content": {
        "kind": "static",
        "text": { "rowCount": 12, "maxLength": 420 }
      },
      "decoration": {
        "typography": [
          { "role": "hero-title", "family": "system-serif", "size": 56, "lineHeight": 1.08 }
        ],
        "palette": [
          { "role": "surface", "token": "surface", "value": "#f8faf7" }
        ],
        "media": [
          { "slot": "hero-preview", "crop": "cover", "aspectRatio": "16/10" }
        ]
      },
      "assets": [
        { "id": "hero-preview", "kind": "image", "policy": "replaceable", "slot": "hero" }
      ],
      "landmarks": [
        {
          "id": "main",
          "role": "main",
          "name": "Blog home",
          "layout": {
            "width": { "kind": "fluid", "min": 320, "max": 1324 },
            "height": { "kind": "content" },
            "display": {
              "kind": "grid",
              "columns": ["minmax(0, 760px)", "minmax(280px, 360px)"],
              "rows": ["auto", "1fr"],
              "areas": [["content", "rail"]],
              "gap": { "row": 48, "column": 64 }
            },
            "scroll": { "x": false, "y": false }
          },
          "slots": [
            { "id": "content", "kind": "content", "gridArea": "content", "required": true },
            { "id": "rail", "kind": "list", "gridArea": "rail" }
          ],
          "repeat": { "kind": "feed", "itemName": "article-card", "minItems": 4 }
        }
      ]
    }
  ]
}
```

## Migration Plan

1. Keep TypeScript IR as the public JSON contract and dogfood surface.
2. Keep `vlmkit contract introspect` and `validate` aligned with the schema.
3. Add JSON artifact output from `vlmkit build component`.
4. Add `vlmkit contract compile --html --css`.
5. Add crater-backed `vlmkit contract simulate`.
6. Port validator + simulator core to MoonBit after schema stops moving.
7. Keep TS wrappers for CLI, filesystem, Playwright, and package integration.

## Open Questions

- Whether `subgrid` should be represented as display policy or track policy.
- Whether decoration tokens should live in the same contract file or separate
  `theme.tokens.json`.
- How much target inference should be automatic from AI mock images vs written
  by the agent.
- Whether crater should own contract simulation APIs, or vlmkit should compile
  contracts into crater style/tree nodes.
