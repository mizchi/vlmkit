# Component-focused VRT with `check story`

Fixing one component with a full-page diff is the wrong instrument. The image is
large, the diff cascades — nudge a header and every row below it reports as
changed — and the part you are working on is buried in the part you are not.

`vlmkit check story` mounts one story and screenshots **only that component**.
Measured on this example: 30,448px across three stories versus 1,440,000px for
the same count of full-viewport shots — **47x smaller**.

## Run this example

No dev server, no bundler, no framework: the gallery here is plain JS, so it
works straight off the filesystem.

```bash
cd examples/story-gallery
G="file://$PWD/index.html"

# First run writes baselines and reports new-baseline — not a pass.
vlmkit check story components/Button/Primary Card/Default --gallery "$G"

# Second run compares. Clean.
vlmkit check story components/Button/Primary Card/Default --gallery "$G"

# Now edit .btn's padding in index.html and re-run:
#   ✗ components/Button/Primary   88x40   15.97% diff (562/3520px)
#       heatmap: .vlmkit/stories/components-Button-Primary/...heatmap.png
#       region 0,0 96x64 content
#   ✓ Card/Default               274x88   0.00% <= 0.50%
# The Card reports clean even though the stylesheet changed. That is the point.

# Accept an intended change:
vlmkit check story components/Button/Primary --gallery "$G" --update-baseline
```

From a checkout without a global install, substitute
`node --experimental-strip-types ../../src/cli/vlmkit.ts` for `vlmkit`.

## How it connects to Playwright component testing

Playwright's component testing has two halves:

| Half | Where it lives | vlmkit's relationship |
|---|---|---|
| The `mount` fixture | `@playwright/test`, **1.62+** | Not used. Depending on it would force a version bump on every consumer. |
| The **gallery** — a page exposing `window.mount({ story, props })` / `window.unmount()`, rendering into `#root` | Yours, served by your dev server at the URL you set as `baseURL` | This is what `check story` drives, via `page.evaluate` — exactly how the fixture itself does it. |

So `check story` needs no spec files, no config dialect, and no particular
Playwright version. What it does require is those two functions on `window`.

Storybook is *not* drop-in: its iframe renders from a URL query param and exposes
no `window.mount`, so `check story` reports `mount-failed` against it. A few lines
in `.storybook/preview.js` that define `window.mount` in terms of Storybook's own
renderer would bridge it, but that shim is yours to write and is not something
this has been verified against.

`index.html` here is a gallery in ~40 lines of vanilla JS. Read it to see the
whole contract: resolve a story id, render into `#root`, **reject** on an unknown
story (that rejection is the only failure channel the contract has, and it is
what turns a typo'd id into a real message instead of a blank screenshot).

## The real thing: a React + Vite gallery

Playwright's docs are explicit that the gallery is framework-specific and yours
to own — there is no template to copy. The shape is small:

```tsx
// src/playwright/gallery/main.tsx  → served at /playwright/gallery/index.html
import { createRoot, type Root } from 'react-dom/client';

// Stories are ordinary modules exporting named render functions:
//   src/components/Button.story.tsx  →  export const Primary = () => <Button title="Submit" />;
const modules = import.meta.glob('../../components/**/*.story.tsx', { eager: true });

/** `components/Button/Primary` ← src/components/Button.story.tsx export `Primary`. */
const stories = new Map<string, (props: any) => JSX.Element>();
for (const [path, mod] of Object.entries(modules)) {
  const id = path.replace(/^.*\/components\//, 'components/').replace(/\.story\.tsx$/, '');
  for (const [name, story] of Object.entries(mod as Record<string, any>)) {
    if (typeof story === 'function') stories.set(`${id}/${name}`, story);
  }
}

const container = document.getElementById('root')!;
// Reuse the root across calls: the contract notes that re-rendering into the
// same root is what makes `component.update(props)` preserve component state.
let root: Root | undefined;

declare global {
  interface Window {
    mount(params: { story: string; props?: Record<string, unknown> }): Promise<void>;
    unmount(): Promise<void>;
  }
}

window.mount = async ({ story, props }) => {
  const Story = stories.get(story)
    ?? [...stories].find(([id]) => id.endsWith(`/${story}`))?.[1];
  // Reject, don't render a placeholder — an unknown id must not screenshot as
  // an empty box.
  if (!Story) throw new Error(`unknown story "${story}". Known: ${[...stories.keys()].join(', ')}`);
  root ??= createRoot(container);
  root.render(<Story {...(props ?? {})} />);
  // React 18+'s render() takes no callback and does not return a promise, so
  // await two frames: resolve only once the browser has actually laid the
  // component out, or a screenshot taken right after mount catches an empty box.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
};

window.unmount = async () => {
  root?.unmount();
  root = undefined;
};
```

Then point `check story` at it and the loop is the same:

```bash
vlmkit check story components/Button/Primary --gallery http://localhost:5173/playwright/gallery/index.html
```

Your `*.spec.ts` files (with the 1.62 `mount` fixture and `toHaveScreenshot`) and
`check story` can coexist — they read the same stories through the same gallery.
Use the specs for behaviour and `check story` for the tight visual repair loop,
where you want a small image, a region list, and a verdict rather than a test
report.

## Determinism

A story-scoped shot removes most page-level flake by construction, but not all
of it. If a story is not pixel-stable:

- `--settle <ms>` waits after `mount` resolves, for entry transitions. Better
  still, disable animation in the gallery's `window.mount` — it is your
  setup hook, and that is where CT's `beforeMount` work goes.
- `--threshold <ratio>` raises the bar. Note the default is **0.005**, tighter
  than a page default would be: on a 3,520px button a handful of stray pixels is
  already a percent.
- Fonts are the usual culprit. Self-host the fonts the component uses; a
  fallback substituting mid-run reads as real drift.

## Baselines

`.vlmkit/stories/<story>/<viewport>.png`, and they are keyed on the story id **as
written**. The gallery owns id resolution and the contract gives no way to ask it
what an id resolved to, so `components/Button/Primary` and the equally valid
suffix `Button/Primary` get separate baselines. Pick one spelling per story — the
durable way is to list them in `vlmkit.gates.json`:

```jsonc
{
  "defaults": {
    "gates": [
      "check story components/Button/Primary --gallery http://localhost:5173/playwright/gallery/index.html",
      "check story components/Card/Default --gallery http://localhost:5173/playwright/gallery/index.html"
    ],
    "rules": { "check.story/new-baseline": "off" }
  }
}
```

`check story` is an ordinary gate, so it also gets `--json` (the shared envelope,
with region geometry under `evidence`), `--advisory`, `--rule`, a run-ledger
entry, and `vlmkit rules check story`.
