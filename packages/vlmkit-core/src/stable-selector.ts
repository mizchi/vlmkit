/**
 * The one in-page selector generator, as a script fragment.
 *
 * Six gates needed "name this element so a reader can find it again", and six
 * copies of this function existed. Three of them had lost the recursive call:
 *
 *     const parent = el.parentElement;
 *     if (!parent) return el.tagName.toLowerCase();
 *     const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
 *     return el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")";
 *
 * which returns `p:nth-of-type(1)` — the first `<p>` of *every* parent on the page.
 * `check animation` on a page with two animated first-children reported three
 * findings on two different elements, all three carrying the identical selector
 * `div:nth-of-type(1)`, which matched both. The report named nothing.
 *
 * The `if (!parent) return` line is what gives the accident away: without recursion a
 * root element returning `html` rather than `html:nth-of-type(1)` is a distinction
 * with no purpose. It is a base case, and the recursive step it guarded was dropped.
 *
 * ## The contract
 *
 * The returned selector matches **exactly one** element in the document it was
 * generated from. That is the whole point — it is what makes a finding actionable,
 * what lets two findings be told apart, and what `--allow "<selector>;<reason>"`
 * matches against. `packages/vlmkit-markup/src/selector-uniqueness.test.ts` asserts
 * it against real gate output rather than against this source, so a seventh copy
 * appearing elsewhere is still caught.
 *
 * Preference order: `#id` → `tag.class` when unique → recursive
 * `<parent-path> > tag:nth-of-type(n)`.
 *
 * ## Why a string
 *
 * These run inside `page.evaluate`, and most callers assemble their collector as a
 * template literal, so the shared form has to be text. Interpolate it at the top of
 * the script:
 *
 * ```ts
 * const COLLECT = `(() => { ${STABLE_SELECTOR_JS} … })()`;
 * ```
 *
 * `motion-detect.ts` is the exception: it passes a real typed arrow to
 * `page.evaluate`, so it carries its own copy on purpose and the uniqueness test is
 * what holds the two in agreement.
 */
export const STABLE_SELECTOR_JS = `
  function stableSelector(el) {
    if (!el || !el.tagName) return "(no target)";
    const id = el.getAttribute && el.getAttribute("id");
    if (id) return "#" + CSS.escape(id);
    const classes = el.classList ? Array.from(el.classList).slice(0, 3) : [];
    if (classes.length > 0) {
      const selector = el.tagName.toLowerCase() + classes.map((c) => "." + CSS.escape(c)).join("");
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter((item) => item.tagName === el.tagName);
    return stableSelector(parent) + " > " + el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")";
  }
`;
