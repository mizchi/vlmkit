/**
 * The one definition of "what colour is behind this text", as browser-script source.
 *
 * ## Why this file exists
 *
 * `check integrity` and `check a11y contrast` both resolve an element's effective background,
 * and they resolved it differently. Dogfooding a page with a translucent toolbar over a
 * gradient (`examples/solitaire/`) made the difference visible:
 *
 *   check integrity      skipped 17 blocks, saying so: "background-image/gradient in the
 *                        stack — composite-background contrast is not deterministically
 *                        measurable"
 *   check a11y contrast  reported 9 failures at 1.08:1 for `#f2f7f2` on `#ffffff`
 *
 * The text is near-white on near-black. `check a11y contrast` did not report a near-miss, it
 * reported the **inverse**, because its `effectiveBg` had no notion of a background image and
 * fell back to white for a background it could not see. Two gates, one page, opposite answers,
 * and the wrong one was the gate whose entire subject is contrast — the third instance of that
 * exact shape in one release, after the dedup defect and the `js-error` attribution split.
 *
 * So the resolution lives here once, as a string, interpolated into both gates' browser
 * scripts — the pattern `animation-eval.ts` already uses for `ANIMATION_HELPERS_JS`. It has to
 * be source rather than a function because both consumers are `page.evaluate` payloads.
 *
 * ## What it decides, and what it refuses to decide
 *
 * Walking up from the element, accumulating background colours until an opaque one stops the
 * walk, then blending them over white: that is a composite the same way the browser composites
 * it, so a translucent panel over a solid page is measurable and is measured.
 *
 * A `background-image` — gradient, sprite, photo — is where it stops and says
 * `composite: true` instead of guessing. The colour behind the text is then whatever pixel
 * happens to be under it, which varies across the element and is not derivable from computed
 * style at all. A gate can screenshot and sample that (Layer B); a style walk cannot, and
 * guessing white is how you report near-white-on-near-black as 1.08:1.
 *
 * `composite: true` is a REFUSAL, not a pass. Both callers surface it as a stated exemption —
 * "17 blocks skipped, here is why" — because a contrast check that silently drops the elements
 * it cannot read is indistinguishable from one that found them acceptable.
 *
 * ## Contract
 *
 * Defines, in the page scope where it is interpolated:
 *
 *   parseColor(cssColor)            -> [r, g, b, a] | null
 *   blendColor(base, over)          -> [r, g, b]        (base is [r,g,b], over is [r,g,b,a])
 *   contrastRatio(a, b)             -> number           (WCAG 2.x, both args [r,g,b])
 *   resolveTextBackground(el)       -> { composite: boolean, bg: [r, g, b] }
 *   inheritedOpacity(el)            -> number           (product of the ancestor chain)
 *
 * Contains no backticks and no `${`, so it interpolates into a template literal without
 * escaping. `tests/browser-script-syntax` parses every such constant, which is what catches a
 * fragment that stops being valid JavaScript.
 */
export const CONTRAST_BACKGROUND_JS = `
  function parseColor(s) {
    const m = (s || "").match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map(parseFloat);
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  }
  function blendColor(base, over) {
    const a = over[3];
    return [
      base[0] * (1 - a) + over[0] * a,
      base[1] * (1 - a) + over[1] * a,
      base[2] * (1 - a) + over[2] * a,
    ];
  }
  function contrastRatio(a, b) {
    const channel = function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const lum = function (c) {
      return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
    };
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function resolveTextBackground(el) {
    const chain = [];
    for (let p = el; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      // A background image is the stopping condition, not a layer to skip: what is behind the
      // text becomes a pixel question, and answering it from computed style means inventing a
      // colour. Report the refusal instead.
      if ((ps.backgroundImage || "none") !== "none") return { composite: true, bg: [255, 255, 255] };
      const c = parseColor(ps.backgroundColor);
      if (c && c[3] > 0) chain.push(c);
      // An opaque colour hides everything behind it, so the walk is done.
      if (c && c[3] >= 1) break;
    }
    // Outermost first, so each layer composites onto what is already under it. White is the
    // canvas the browser paints on when nothing else does.
    let bg = [255, 255, 255];
    for (const c of chain.reverse()) bg = blendColor(bg, c);
    return { composite: false, bg: bg };
  }
  function inheritedOpacity(el) {
    let opacity = 1;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      // parseFloat(x) || 1 would turn an ancestor's opacity: 0 into 1. Opacity does not
      // inherit, so this chain is the only place a fully-transparent ancestor can be seen.
      const po = parseFloat(getComputedStyle(p).opacity);
      opacity *= Number.isFinite(po) ? po : 1;
    }
    return opacity;
  }
`;
