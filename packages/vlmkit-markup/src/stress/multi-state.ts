/**
 * Multi-state capture for VRT.
 *
 * Forces CSS pseudo-classes (`:hover`, `:focus`, `:active`,
 * `:focus-visible`) on every element matching a list of interactive
 * selectors, via the CDP method `CSS.forcePseudoState`. Once forced,
 * the page renders as if those elements were truly in that state, so
 * we can take a screenshot of the "all buttons hovered" version of the
 * page and diff baseline vs variant.
 *
 * Why CDP and not Playwright `locator.hover()`? Because `hover()`
 * physically moves a mouse cursor: only one element can be "hovered"
 * at a time, side effects bleed into siblings, and the cursor itself
 * appears in the screenshot. `forcePseudoState` is non-destructive,
 * per-element, and stacks: we can force `:hover` on *all* matching
 * elements simultaneously.
 *
 * The supported pseudo classes are constrained by CDP — the docs
 * list `active`, `focus`, `focus-visible`, `focus-within`, `hover`,
 * `target`, `visited`, `enabled`, `disabled`, `valid`, `invalid`,
 * `user-invalid`, `required`, `optional`, `read-only`, `read-write`,
 * `in-range`, `out-of-range`, `placeholder-shown`, `default`,
 * `checked`, `indeterminate`. We expose the common interaction ones.
 */
import type { Page } from "playwright";

export type ForcedPseudoState = "hover" | "focus" | "active" | "focus-visible";

export const DEFAULT_INTERACTIVE_SELECTORS = [
  "button:not([disabled])",
  "a[href]",
  "[role='button']",
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
] as const;

export interface ApplyForcedStateOptions {
  /** Pseudo-class to force. */
  state: ForcedPseudoState;
  /**
   * CSS selectors of elements to force into the state. Defaults to
   * `DEFAULT_INTERACTIVE_SELECTORS`. The selectors are unioned and
   * matched via `document.querySelectorAll`.
   */
  selectors?: readonly string[];
  /** Cap on number of elements forced (avoid runaway pages). Default 200. */
  maxElements?: number;
}

const DEFAULT_MAX_ELEMENTS = 200;

export interface AppliedForcedState {
  state: ForcedPseudoState;
  /** Number of elements actually forced. */
  forcedCount: number;
  /** Number of elements found but skipped (over `maxElements`). */
  skippedCount: number;
  /** Tag-and-class fingerprints of the forced elements (truncated). */
  affectedElements: string[];
  /**
   * Bounding boxes of the forced elements in viewport coordinates.
   * Used by callers to classify state-induced diff pixels as
   * "edge" (within a few px of any bbox perimeter — likely UA
   * default outline) vs "interior" (inside, away from perimeter
   * — likely author background / color rule). Lets the consumer
   * distinguish UA-only changes from real author-styled states.
   */
  bboxes: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Force a pseudo-state on all elements matching the given selectors.
 *
 * Returns a record of which elements were affected. Idempotent —
 * calling twice with the same state is harmless. To clear, call with
 * an empty selector list (or just navigate away).
 */
export async function applyForcedPseudoState(
  page: Page,
  options: ApplyForcedStateOptions,
): Promise<AppliedForcedState> {
  const selectors = options.selectors ?? DEFAULT_INTERACTIVE_SELECTORS;
  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const state = options.state;

  // Collect element fingerprints + backend node IDs via a single
  // page.evaluate. We use the experimental `__getNodeIds` shim below
  // only when there's no easier way; here we just return CSS paths.
  const matched = await page.evaluate(
    ({ selectorList, cap }) => {
      const joined = (selectorList as string[]).join(",");
      const all = Array.from(document.querySelectorAll(joined)) as Element[];
      const capped = all.slice(0, cap);
      // Tag the elements we care about with a marker attribute the CDP
      // path can then look up. We avoid relying on querySelectorAll
      // ordering inside CDP (browser quirks). The marker is removed
      // after the screenshot.
      const fingerprints: string[] = [];
      const bboxes: Array<{ x: number; y: number; width: number; height: number }> = [];
      for (let i = 0; i < capped.length; i++) {
        const el = capped[i] as HTMLElement;
        el.setAttribute("data-vlmkit-state-marker", String(i));
        const tag = el.tagName.toLowerCase();
        const cls = el.className && typeof el.className === "string"
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
        fingerprints.push(`${tag}${cls}`);
        const r = el.getBoundingClientRect();
        bboxes.push({ x: r.x, y: r.y, width: r.width, height: r.height });
      }
      return { fingerprints, bboxes, total: all.length };
    },
    { selectorList: [...selectors], cap: maxElements },
  );

  // Disable CSS transitions and animations *before* forcing the
  // pseudo-state. Without this, a `transition: background 0.15s` on
  // the target element means the state-screenshot catches the button
  // mid-animation — typically registering only ~10% of the intended
  // color change. The end-state colors then look ~identical to the
  // default render and the suspect flag fires falsely. Subagent H
  // dogfood: this masked a correctly-wired `:hover` rule and made
  // the suspect signal unreliable. Injected at !important to override
  // any author rule.
  await page.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation: none !important;
    }`,
  });

  // IMPORTANT: do NOT detach the CDP session here. Detaching clears
  // session-scoped `CSS.forcePseudoState` overrides, so the screenshot
  // taken by the caller would lose the forced state. The session is
  // implicitly cleaned up when the page closes.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
    nodeId: root.nodeId,
    selector: "[data-vlmkit-state-marker]",
  });
  let forcedCount = 0;
  for (const nodeId of nodeIds) {
    try {
      await cdp.send("CSS.forcePseudoState", {
        nodeId,
        forcedPseudoClasses: [state],
      });
      forcedCount++;
    } catch {
      // forcePseudoState rejects detached / pseudo-element nodes; skip.
    }
  }
  return {
    state,
    forcedCount,
    skippedCount: Math.max(0, matched.total - matched.fingerprints.length),
    affectedElements: matched.fingerprints.slice(0, 12),
    bboxes: matched.bboxes,
  };
}

/**
 * Remove the `data-vlmkit-state-marker` attributes left behind by
 * `applyForcedPseudoState`. Call before re-running the same probe in
 * a different state.
 */
export async function clearStateMarkers(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("[data-vlmkit-state-marker]")
      .forEach((el) => el.removeAttribute("data-vlmkit-state-marker"));
  });
}
