/**
 * How the style gates sample a page, as browser-script source: which elements
 * count, what each one is called, and how a CSS length reads.
 *
 * ## Why this file exists
 *
 * `check design`, `check composition` and `check color` each collect the page
 * through a `page.evaluate` payload, and each carried its own `visible`, `px`
 * and `path`. Composition's were `check design`'s, pasted — byte-identical, so
 * a fix to one would have silently skipped the other. Colour's `path` was
 * re-typed instead, and read the class through `(className || "").toString()`,
 * which on an SVG element is an `SVGAnimatedString` whose string form is
 * `"[object SVGAnimatedString]"`: an `<svg class="icon">` came out as
 * `svg.[object`. The other two guard on `typeof className === "string"`.
 *
 * `path` is the one that matters most. It is the selector every finding in
 * these gates carries, and it is what `--allow "<selector>;<reason>"` matches
 * against, by substring. Three spellings of it meant an exemption written
 * against one gate's output could miss the same element in another's.
 *
 * ## Contract
 *
 * Defines, in the page scope where it is interpolated:
 *
 *   visible(el) -> boolean   rendered at all: `checkVisibility` with visibility,
 *                            opacity and content-visibility, falling back to
 *                            display / visibility where it does not exist
 *   px(cssValue) -> number   `parseFloat` to one decimal, 0 when not a number
 *   path(el) -> string       up to three `tag.firstClass` segments joined by `>`,
 *                            stopping at the first `tag#id`; SVG classes are not
 *                            read (see above)
 *
 * `visible` answers "is it rendered" for these gates' geometry, and skips an
 * off-screen `content-visibility: auto` section. A gate that needs a different
 * answer states it next to its own collector under a different name — colour's
 * is `painted` — so the difference is written down rather than being a second
 * definition of the same word.
 *
 * Contains no backticks and no `${`, so it interpolates into a template literal
 * without escaping; `style-sampling.test.ts` asserts both, and
 * `src/util/browser-script-escapes.test.ts` parses every consumer with this
 * spliced in.
 */
export const STYLE_SAMPLING_JS = `
  const visible = (el) => typeof el.checkVisibility === "function"
    ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })
    : getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; };
  const path = (el) => {
    const parts = [];
    for (let cur = el; cur && cur !== document.body && parts.length < 3; cur = cur.parentElement) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(p + "#" + cur.id); break; }
      if (typeof cur.className === "string" && cur.className.trim()) p += "." + cur.className.trim().split(/\\s+/)[0];
      parts.unshift(p);
    }
    return parts.join(">");
  };
`;
