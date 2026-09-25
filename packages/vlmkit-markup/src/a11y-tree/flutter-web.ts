/**
 * The Flutter web collector: Flutter's semantics tree, read out of the page as a
 * `vlmkit-a11y/1` tree.
 *
 * Flutter paints into a canvas, so the page's DOM holds no app content until something asks
 * the engine for accessibility. The engine installs a 1x1 `flt-semantics-placeholder` for
 * exactly that; clicking it builds `flt-semantics-host`, whose `<flt-semantics>` nodes carry
 * roles, names, rects and states. Two things about that DOM decide how it is read:
 *
 * - **It paints nothing.** Flutter renders it transparent (`filter: opacity(0%)`), so every
 *   computed colour is `rgba(0,0,0,0)` and a DOM gate reading paint reports every label as
 *   invisible at 1.00:1. This collector reads no paint; contrast is measured on the frame.
 * - **The placeholder must be clicked before anything else happens.** It is parked at
 *   (-1,-1), so Playwright's actionability checks refuse it, and a gate's steps run after
 *   navigation. `FLUTTER_SEMANTICS_INIT` runs as an init script — before the app's own
 *   scripts — and polls for the placeholder, which is the hook a served-copy injection used
 *   to provide (ofc-app's `serve-web.mjs`).
 *
 * Roles map onto the contract's vocabulary here, once: `<h1>`-`<h6>` are headings, an
 * `<input>` / `<textarea>` is a text field, a `<flt-semantics>` with no role is text when it
 * carries a name and a group otherwise. `flt-tappable` is the tap action.
 */
import type { A11yNode } from "@mizchi/vlmkit-judge/a11y-tree.ts";

/** Init script: click the semantics placeholder as soon as the engine installs it. */
export const FLUTTER_SEMANTICS_INIT = `(() => {
  let done = false, tries = 0;
  const enable = () => {
    if (done) return;
    const placeholder = document.querySelector("flt-semantics-placeholder");
    if (!placeholder) return;
    done = true;
    placeholder.click();
  };
  const timer = setInterval(() => { enable(); if (done || ++tries > 600) clearInterval(timer); }, 50);
  window.addEventListener("flutter-first-frame", enable);
})()`;

/**
 * In-page probe: is this a Flutter web app, and how far along is its semantics tree?
 *
 * `flutter` is true from `load` on — the engine's elements come later, but the bootstrap
 * script (`flutter_bootstrap.js`, `flutter.js` or `main.dart.js`) or `window._flutter` is
 * there at once — so a page that is not Flutter is refused on the first poll instead of
 * after the whole timeout.
 */
export const FLUTTER_STATE_JS = `(() => ({
  flutter: !!window._flutter || !!document.querySelector(
    "flutter-view, flt-glass-pane, flt-semantics-placeholder, flt-semantics-host,"
    + " script[src*='flutter_bootstrap.js'], script[src*='flutter.js'], script[src*='main.dart.js']"),
  nodes: document.querySelectorAll("flt-semantics-host flt-semantics").length,
}))()`;

/** One element as the page reports it; `flutterWebNodes` maps these onto the contract. */
export interface FlutterWebRawNode {
  path: string;
  tag: string;
  role: string | null;
  ariaLabel: string | null;
  text: string;
  value: string | null;
  rect: { left: number; top: number; width: number; height: number };
  headingLevel: number | null;
  tappable: boolean;
  scrolls: boolean;
  disabled: boolean;
  checked: boolean | null;
  selected: boolean | null;
  expanded: boolean | null;
  hidden: boolean;
  focused: boolean;
}

/**
 * In-page collector. Walks `flt-semantics-host`, keeping `<flt-semantics>`, headings and
 * text inputs as nodes; a `<span>` is the text of the node that holds it, not a node.
 */
export const COLLECT_FLUTTER_SEMANTICS = `(() => {
  const host = document.querySelector("flt-semantics-host");
  if (!host) return null;
  const KEEP = /^(flt-semantics|h[1-6]|input|textarea)$/;
  const segment = (el, index) => {
    const id = el.id && el.id.startsWith("flt-semantic-node-") ? "n" + el.id.slice(18) : null;
    return id ?? el.tagName.toLowerCase() + "[" + index + "]";
  };
  // Own text: text nodes and non-node elements (spans), stopping at the next kept node.
  const ownText = (el) => {
    let out = "";
    for (const child of el.childNodes) {
      if (child.nodeType === 3) out += child.textContent;
      else if (child.nodeType === 1 && !KEEP.test(child.tagName.toLowerCase())) out += ownText(child);
    }
    return out;
  };
  const tri = (v) => (v === "true" ? true : v === "false" ? false : null);
  const out = [];
  const walk = (el, prefix) => {
    let index = 0;
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      if (!KEEP.test(tag)) { walk(child, prefix); continue; }
      const path = (prefix ? prefix + ">" : "") + segment(child, index++);
      const r = child.getBoundingClientRect();
      const cs = getComputedStyle(child);
      const isField = tag === "input" || tag === "textarea";
      out.push({
        path,
        tag,
        role: child.getAttribute("role"),
        ariaLabel: child.getAttribute("aria-label"),
        text: isField ? "" : ownText(child).replace(/\\s+/g, " ").trim(),
        value: isField ? child.value : null,
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        headingLevel: /^h[1-6]$/.test(tag) ? Number(tag[1]) : (child.getAttribute("aria-level") ? Number(child.getAttribute("aria-level")) : null),
        tappable: child.hasAttribute("flt-tappable"),
        scrolls: !isField && (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)),
        disabled: child.getAttribute("aria-disabled") === "true" || child.hasAttribute("disabled"),
        checked: tri(child.getAttribute("aria-checked")),
        selected: tri(child.getAttribute("aria-selected")) ?? tri(child.getAttribute("aria-current")),
        expanded: tri(child.getAttribute("aria-expanded")),
        hidden: child.getAttribute("aria-hidden") === "true",
        focused: document.activeElement === child,
      });
      walk(child, path);
    }
  };
  walk(host, "");
  return out;
})()`;

const ROLE_MAP: Record<string, string> = {
  button: "button", link: "link", checkbox: "checkbox", radio: "radio", switch: "switch",
  slider: "slider", tab: "tab", menuitem: "menuitem", combobox: "combobox", heading: "heading",
  img: "image", image: "image", dialog: "dialog", alertdialog: "dialog", group: "group",
  list: "list", listitem: "listitem", tablist: "group", radiogroup: "group", text: "text",
  textbox: "textfield", searchbox: "textfield", scrollbar: "scrollview", region: "group",
};

/** Map raw semantics elements onto the contract. Pure: this is what the unit tests read. */
export function flutterWebNodes(raw: readonly FlutterWebRawNode[]): A11yNode[] {
  return raw.map((r) => {
    const name = (r.ariaLabel ?? "").trim() || r.text;
    let role: string;
    if (r.tag === "input" || r.tag === "textarea") role = "textfield";
    else if (/^h[1-6]$/.test(r.tag)) role = "heading";
    else if (r.role) role = ROLE_MAP[r.role] ?? r.role;
    else role = name ? "text" : "group";
    const actions = [
      ...(r.tappable ? ["tap"] : []),
      ...(r.scrolls ? ["scroll"] : []),
      ...(role === "textfield" && !r.disabled ? ["setText"] : []),
    ];
    const states: NonNullable<A11yNode["states"]> = {
      ...(r.disabled ? { disabled: true } : {}),
      ...(r.focused ? { focused: true } : {}),
      ...(r.checked !== null ? { checked: r.checked } : {}),
      ...(r.selected !== null ? { selected: r.selected } : {}),
      ...(r.expanded !== null ? { expanded: r.expanded } : {}),
      ...(r.hidden ? { hidden: true } : {}),
    };
    return {
      path: r.path,
      role,
      ...(name ? { name } : {}),
      ...(r.value ? { value: r.value } : {}),
      rect: {
        left: Math.round(r.rect.left * 10) / 10,
        top: Math.round(r.rect.top * 10) / 10,
        width: Math.round(r.rect.width * 10) / 10,
        height: Math.round(r.rect.height * 10) / 10,
      },
      ...(Object.keys(states).length > 0 ? { states } : {}),
      ...(actions.length > 0 ? { actions } : {}),
    };
  });
}

/** In-page: mark the tappable node whose name is exactly `name`, for a forced click. */
export const markFlutterTarget = (name: string): string => `(() => {
  const want = ${JSON.stringify(name)};
  const host = document.querySelector("flt-semantics-host");
  if (!host) return 0;
  const nameOf = (el) => (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim();
  const hits = [...host.querySelectorAll("flt-semantics[flt-tappable], flt-semantics[role=button], flt-semantics[role=link], flt-semantics[role=tab]")]
    .filter((el) => nameOf(el) === want);
  document.querySelectorAll("[data-vlmkit-click]").forEach((el) => el.removeAttribute("data-vlmkit-click"));
  // The innermost match: a tappable row whose text is its button's is the button.
  const inner = hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
  if (inner[0]) inner[0].setAttribute("data-vlmkit-click", "");
  return inner.length;
})()`;
