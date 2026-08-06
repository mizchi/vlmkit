/**
 * React gallery for Playwright component testing + `vlmkit check story`.
 *
 * Copy to your app (e.g. `src/playwright/gallery/main.tsx`), drop `.template`
 * from the filename, and point the glob at your own story files. Serve it via
 * `gallery.host.html`; the URL you serve it at is both your Playwright
 * `baseURL` and `check story --gallery`.
 *
 * Implements the contract in `_gallery-contract.md`: `window.mount({ story,
 * props })` renders into `#root` and rejects on failure, `window.unmount()`
 * tears down.
 */
import { createRoot, type Root } from "react-dom/client";

/**
 * Story discovery. `eager: true` because the gallery is a test-only entry —
 * lazy chunks would add a load race between `mount` resolving and the component
 * existing, for no benefit.
 *
 * Adjust this glob to your layout. It is the one line that is not portable.
 */
const modules = import.meta.glob<Record<string, unknown>>(
  "../../components/**/*.story.{tsx,jsx}",
  { eager: true },
);

type StoryFn = (props: Record<string, unknown>) => React.ReactNode;

/**
 * `src/components/Button.story.tsx` export `Primary` → `components/Button/Primary`,
 * the grammar the spec recommends and the fixture's docs use.
 */
const stories = new Map<string, StoryFn>();
for (const [path, mod] of Object.entries(modules)) {
  const id = path
    .replace(/^.*?\/components\//, "components/")
    .replace(/\.story\.[jt]sx?$/, "");
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === "function") stories.set(`${id}/${name}`, value as StoryFn);
  }
}

/** Any unique trailing suffix resolves; ambiguity is an error, never a guess. */
function resolveStory(id: string): StoryFn {
  const exact = stories.get(id);
  if (exact) return exact;
  const matches = [...stories.keys()].filter((key) => key.endsWith(`/${id}`));
  if (matches.length === 1) return stories.get(matches[0]!)!;
  if (matches.length > 1) {
    throw new Error(`story id "${id}" is ambiguous: ${matches.join(", ")}`);
  }
  throw new Error(`unknown story "${id}". Known: ${[...stories.keys()].join(", ")}`);
}

/**
 * Animation off, once, globally. A story caught mid-transition is not
 * pixel-stable, and this is cheaper and more reliable than waiting for it.
 */
function freezeAnimation(): void {
  if (document.getElementById("pw-freeze")) return;
  const style = document.createElement("style");
  style.id = "pw-freeze";
  style.textContent = `*,*::before,*::after{
    animation-duration:0s!important;animation-delay:0s!important;
    transition-duration:0s!important;transition-delay:0s!important;
    caret-color:transparent!important;
  }`;
  document.head.append(style);
}

const container = document.getElementById("root");
if (!container) throw new Error("gallery host page is missing #root");

/**
 * One root, reused. Recreating it per call resets component state, which would
 * break the fixture's `component.update(props)` — the spec calls this out
 * explicitly.
 */
let root: Root | undefined;

declare global {
  interface Window {
    mount(params: { story: string; props?: Record<string, unknown> }): Promise<void>;
    unmount(): Promise<void>;
  }
}

window.mount = async ({ story, props }) => {
  // Resolve BEFORE touching the DOM, so an unknown id rejects without leaving
  // the previous story on screen for a screenshot to catch.
  const Story = resolveStory(story);
  freezeAnimation();
  root ??= createRoot(container);
  root.render(<Story {...(props ?? {})} />);
  // React 18+'s render() takes no callback and returns nothing, so await two
  // frames: resolve only once the browser has actually laid the component out.
  // A screenshot does not retry the way a locator assertion does — without this
  // the first shot can catch an empty box.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

window.unmount = async () => {
  root?.unmount();
  root = undefined;
};
