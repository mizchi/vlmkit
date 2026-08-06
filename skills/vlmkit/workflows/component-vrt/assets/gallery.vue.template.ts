/**
 * Vue 3 gallery for Playwright component testing + `vlmkit check story`.
 *
 * Copy to your app (e.g. `src/playwright/gallery/main.ts`), drop `.template`
 * from the filename, adjust the glob. Serve via `gallery.host.html`.
 *
 * Implements `_gallery-contract.md`: `window.mount({ story, props })` renders
 * into `#root` and rejects on failure, `window.unmount()` tears down.
 */
import { createApp, h, type App, type Component } from "vue";

/** Adjust to your layout. `.vue` single-file stories are one story each. */
const modules = import.meta.glob<Record<string, unknown>>(
  "../../components/**/*.story.{ts,js,vue}",
  { eager: true },
);

const stories = new Map<string, Component>();
for (const [path, mod] of Object.entries(modules)) {
  const id = path
    .replace(/^.*?\/components\//, "components/")
    .replace(/\.story\.(?:[jt]s|vue)$/, "");
  if (path.endsWith(".vue")) {
    // "A single-file-component story is one story, addressed by its path alone
    // (its default export)" — the spec's grammar.
    if (mod.default) stories.set(id, mod.default as Component);
    continue;
  }
  for (const [name, value] of Object.entries(mod)) {
    if (value) stories.set(`${id}/${name}`, value as Component);
  }
}

function resolveStory(id: string): Component {
  const exact = stories.get(id);
  if (exact) return exact;
  const matches = [...stories.keys()].filter((key) => key.endsWith(`/${id}`));
  if (matches.length === 1) return stories.get(matches[0]!)!;
  if (matches.length > 1) throw new Error(`story id "${id}" is ambiguous: ${matches.join(", ")}`);
  throw new Error(`unknown story "${id}". Known: ${[...stories.keys()].join(", ")}`);
}

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
 * Vue differs from React here: there is no "render into an existing app" call,
 * so state preservation across `update(props)` comes from keeping the same app
 * instance and swapping reactive props. Recreating the app per mount is the
 * simple correct thing for VRT (each `check story` run navigates fresh anyway);
 * if you need `update()` to preserve state, hold the props in a `reactive` and
 * mutate it instead of remounting.
 */
let app: App | undefined;

declare global {
  interface Window {
    mount(params: { story: string; props?: Record<string, unknown> }): Promise<void>;
    unmount(): Promise<void>;
  }
}

window.mount = async ({ story, props }) => {
  const Story = resolveStory(story);
  freezeAnimation();
  app?.unmount();
  app = createApp({ render: () => h(Story, props ?? {}) });
  // Install plugins / providers here — this function is the browser-side
  // equivalent of the old beforeMount hook.
  app.mount(container);
  // Await layout, not just render: a screenshot does not retry the way a
  // locator assertion does.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

window.unmount = async () => {
  app?.unmount();
  app = undefined;
};
