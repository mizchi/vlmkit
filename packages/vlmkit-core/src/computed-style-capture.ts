/// <reference lib="dom" />
export type ComputedStyleSnapshot = Record<string, Record<string, string>>;
export type InteractionType = "hover" | "focus" | "active";

/** Pseudo-class state names that CDP `CSS.forcePseudoState` accepts. */
export type ForcedPseudoState =
  | "hover"
  | "focus"
  | "focus-visible"
  | "focus-within"
  | "active";

export interface InteractionTargetPlan {
  selector: string;
  normalizedSelector: string;
  /**
   * Primary interaction kind, kept for legacy fallback ordering:
   * `:active` collapses to "active", any `:focus*` to "focus", else "hover".
   */
  interaction: InteractionType;
  /**
   * The actual pseudo-class names extracted from the selector — preserves
   * the full set (e.g. `:hover:active` → ["hover", "active"]) so Crater and
   * the CDP-driven Playwright fallback can force identical states.
   */
  forcedStates: ForcedPseudoState[];
}

const FORCED_PSEUDO_REGEX = /:(focus-visible|focus-within|focus|hover|active)\b/g;

function extractForcedStates(selector: string): ForcedPseudoState[] {
  const states: ForcedPseudoState[] = [];
  const seen = new Set<string>();
  FORCED_PSEUDO_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FORCED_PSEUDO_REGEX.exec(selector)) !== null) {
    const state = match[1] as ForcedPseudoState;
    if (seen.has(state)) continue;
    seen.add(state);
    states.push(state);
  }
  return states;
}

function classifyInteractionFromStates(states: ForcedPseudoState[]): InteractionType {
  if (states.includes("active")) return "active";
  if (states.some((s) => s === "focus" || s === "focus-visible" || s === "focus-within")) return "focus";
  return "hover";
}

export const TRACKED_PROPERTIES = [
  "display", "visibility", "opacity",
  "width", "height", "max-width", "max-height", "min-width", "min-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-radius",
  "background-color", "background-image",
  "color", "font-size", "font-weight", "font-family", "font-style",
  "text-decoration", "text-align", "text-transform",
  "line-height", "letter-spacing", "word-spacing", "white-space",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink",
  "align-items", "justify-content", "gap",
  "position", "top", "right", "bottom", "left",
  "overflow", "overflow-x", "overflow-y", "box-shadow", "cursor",
  // Note: grid-template-columns / rows etc. are NOT tracked here because
  // `getComputedStyle()` resolves `minmax(0, 1fr)` to `0px`, which looks
  // like an authored value but would break layout if written back as CSS.
  // The LLM still has the authored values via the full CSS embedded in
  // the prompt — those just aren't surfaced as report deltas.
  "aspect-ratio",
];

const INTERACTION_PSEUDO_PATTERN = /:(focus-visible|focus-within|focus|hover|active)\b/g;
const INTERACTION_SELECTOR_PATTERN = /:(focus-visible|focus-within|focus|hover|active)\b/;

export function normalizeInteractionSelector(selector: string): string {
  return selector
    .replace(INTERACTION_PSEUDO_PATTERN, "")
    .replace(/::[\w-]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~])\s*/g, " $1 ")
    .trim();
}

export function buildInteractionTargetPlans(
  selectors: string[],
): InteractionTargetPlan[] {
  const plans: InteractionTargetPlan[] = [];
  const seen = new Set<string>();

  for (const selectorText of selectors) {
    for (const rawSelector of selectorText.split(",")) {
      const selector = rawSelector.trim();
      if (!selector || !INTERACTION_SELECTOR_PATTERN.test(selector)) continue;
      const normalizedSelector = normalizeInteractionSelector(selector);
      if (!normalizedSelector) continue;
      const forcedStates = extractForcedStates(selector);
      if (forcedStates.length === 0) continue;
      const interaction = classifyInteractionFromStates(forcedStates);
      const key = `${interaction}\u0000${normalizedSelector}\u0000${forcedStates.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plans.push({ selector, normalizedSelector, interaction, forcedStates });
    }
  }

  return plans;
}

export function selectInteractionFallbackPlans(
  plans: InteractionTargetPlan[],
  emulatedSnapshotMeaningful: boolean,
): InteractionTargetPlan[] {
  const selected: InteractionTargetPlan[] = [];
  const seen = new Set<string>();

  function add(plan: InteractionTargetPlan) {
    const key = `${plan.interaction}\u0000${plan.normalizedSelector}\u0000${plan.forcedStates.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    selected.push(plan);
  }

  for (const plan of plans) {
    // `:active` and any `:focus*` cannot be triggered by CSS-rule rewriting
    // alone — they need real DOM activation or a forced-state override.
    // Pure `:hover` plans only fall back when the in-page rewrite produced
    // nothing meaningful.
    if (plan.interaction !== "hover" || !emulatedSnapshotMeaningful) add(plan);
  }

  return selected;
}

export function mergeComputedStyleSnapshots(
  ...snapshots: ComputedStyleSnapshot[]
): ComputedStyleSnapshot {
  const merged: ComputedStyleSnapshot = {};
  for (const snapshot of snapshots) {
    for (const [selector, props] of Object.entries(snapshot)) {
      merged[selector] = { ...props };
    }
  }
  return merged;
}

export function captureComputedStyleSnapshotInDom(props: string[]): ComputedStyleSnapshot {
  const results: ComputedStyleSnapshot = {};
  const semanticTags = new Set([
    "main", "nav", "header", "footer", "aside", "article", "section",
    "table", "thead", "tbody", "tr", "th", "td", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "input", "select", "textarea",
    "pre", "code", "blockquote", "img", "span", "div", "form", "label",
  ]);

  function getClassNames(element: {
    classList?: unknown;
    className?: unknown;
  }): string[] {
    const classList = element.classList;
    if (classList && typeof classList === "object") {
      if (Symbol.iterator in classList) {
        return Array.from(classList as Iterable<unknown>)
          .map((value) => String(value))
          .filter(Boolean);
      }

      const length = Number((classList as { length?: number }).length ?? 0);
      const values: string[] = [];
      for (let i = 0; i < length; i++) {
        const token = String((classList as Record<number, unknown>)[i] ?? "");
        if (token) values.push(token);
      }
      if (values.length > 0) return values;
    }

    if (typeof element.className === "string") {
      return element.className.split(/\s+/).filter(Boolean);
    }

    return [];
  }

  const getStyle = typeof getComputedStyle === "function"
    ? getComputedStyle
    : typeof window !== "undefined" && typeof window.getComputedStyle === "function"
      ? window.getComputedStyle.bind(window)
      : null;
  if (!getStyle) {
    throw new Error("getComputedStyle is not available in this realm");
  }
  const styleGetter = getStyle;

  function shouldTrackElement(element: HTMLElement): boolean {
    if (element.id) return true;
    if (getClassNames(element).length > 0) return true;
    return semanticTags.has(element.tagName.toLowerCase());
  }

  function buildElementKey(
    element: HTMLElement,
    tagCounters: Record<string, number>,
  ): string {
    if (element.id) return `#${element.id}`;
    const classNames = getClassNames(element);
    if (classNames.length > 0) return `.${classNames.join(".")}`;

    const tag = element.tagName.toLowerCase();
    const parentClass = element.parentElement ? getClassNames(element.parentElement)[0] : undefined;
    const ctx = parentClass ? `.${parentClass}` : "";
    const counterKey = `${ctx}>${tag}`;
    const count = tagCounters[counterKey] = (tagCounters[counterKey] ?? 0) + 1;
    return `${ctx}>${tag}[${count}]`;
  }

  function normalizeCssClassToken(token: string): string {
    return token.replace(/\\([^\n\r\f])/g, "$1");
  }

  function collectDeclaredClassAliases(): Set<string> {
    const aliases = new Set<string>();
    const classPattern = /\.((?:\\.|[-_a-zA-Z0-9])+)/g;

    function collectFromSelectorText(selectorText: string) {
      let match: RegExpExecArray | null;
      while ((match = classPattern.exec(selectorText))) {
        aliases.add(`.${normalizeCssClassToken(match[1])}`);
      }
    }

    function visitRule(rule: { selectorText?: unknown; cssRules?: unknown }) {
      if (typeof rule.selectorText === "string") {
        collectFromSelectorText(rule.selectorText);
      }
      const nested = rule.cssRules;
      if (!nested || typeof (nested as { length?: unknown }).length !== "number") return;
      const nestedRules = nested as { length: number; [index: number]: unknown };
      for (let i = 0; i < nestedRules.length; i++) {
        const child = nestedRules[i];
        if (child && typeof child === "object") {
          visitRule(child as { selectorText?: unknown; cssRules?: unknown });
        }
      }
    }

    const styleSheets = (document as Document & { styleSheets?: StyleSheetList }).styleSheets;
    if (!styleSheets) return aliases;
    for (const sheet of Array.from(styleSheets)) {
      try {
        const rules = (sheet as CSSStyleSheet).cssRules;
        for (const rule of Array.from(rules)) {
          visitRule(rule as { selectorText?: unknown; cssRules?: unknown });
        }
      } catch { /* cross-origin stylesheet */ }
    }
    return aliases;
  }

  function captureElementStyles(key: string, element: HTMLElement) {
    if (!key || results[key]) return;

    const computed = styleGetter(element);
    const styles: Record<string, string> = {};
    for (const prop of props) {
      styles[prop] = computed.getPropertyValue(prop);
    }
    results[key] = styles;

    for (const pseudo of ["::before", "::after"] as const) {
      const pseudoComputed = styleGetter(element, pseudo);
      const content = pseudoComputed.getPropertyValue("content");
      if (!content || content === "none" || content === "normal") continue;

      const pseudoStyles: Record<string, string> = {};
      for (const prop of props) {
        pseudoStyles[prop] = pseudoComputed.getPropertyValue(prop);
      }
      results[`${key}${pseudo}`] = pseudoStyles;
    }
  }

  const elements = document.querySelectorAll("*");
  const tagCounters: Record<string, number> = {};
  const declaredClassAliases = collectDeclaredClassAliases();

  for (const element of elements) {
    const he = element as HTMLElement;
    if (!shouldTrackElement(he)) continue;
    const key = buildElementKey(he, tagCounters);
    captureElementStyles(key, he);
    for (const className of getClassNames(he)) {
      const alias = `.${className}`;
      if (declaredClassAliases.has(alias)) {
        captureElementStyles(alias, he);
      }
    }
  }

  return results;
}

export function captureComputedStyleSnapshotForTargetSelectorsInDom(input: {
  props: string[];
  selectors: string[];
}): ComputedStyleSnapshot {
  const { props, selectors } = input;
  const results: ComputedStyleSnapshot = {};
  const semanticTags = new Set([
    "main", "nav", "header", "footer", "aside", "article", "section",
    "table", "thead", "tbody", "tr", "th", "td", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "input", "select", "textarea",
    "pre", "code", "blockquote", "img", "span", "div", "form", "label",
  ]);

  function getClassNames(element: {
    classList?: unknown;
    className?: unknown;
  }): string[] {
    const classList = element.classList;
    if (classList && typeof classList === "object") {
      if (Symbol.iterator in classList) {
        return Array.from(classList as Iterable<unknown>)
          .map((value) => String(value))
          .filter(Boolean);
      }

      const length = Number((classList as { length?: number }).length ?? 0);
      const values: string[] = [];
      for (let i = 0; i < length; i++) {
        const token = String((classList as Record<number, unknown>)[i] ?? "");
        if (token) values.push(token);
      }
      if (values.length > 0) return values;
    }

    if (typeof element.className === "string") {
      return element.className.split(/\s+/).filter(Boolean);
    }

    return [];
  }

  const getStyle = typeof getComputedStyle === "function"
    ? getComputedStyle
    : typeof window !== "undefined" && typeof window.getComputedStyle === "function"
      ? window.getComputedStyle.bind(window)
      : null;
  if (!getStyle) {
    throw new Error("getComputedStyle is not available in this realm");
  }

  function shouldTrackElement(element: HTMLElement): boolean {
    if (element.id) return true;
    if (getClassNames(element).length > 0) return true;
    return semanticTags.has(element.tagName.toLowerCase());
  }

  function buildElementKey(
    element: HTMLElement,
    tagCounters: Record<string, number>,
  ): string {
    if (element.id) return `#${element.id}`;
    const classNames = getClassNames(element);
    if (classNames.length > 0) return `.${classNames.join(".")}`;

    const tag = element.tagName.toLowerCase();
    const parentClass = element.parentElement ? getClassNames(element.parentElement)[0] : undefined;
    const ctx = parentClass ? `.${parentClass}` : "";
    const counterKey = `${ctx}>${tag}`;
    const count = tagCounters[counterKey] = (tagCounters[counterKey] ?? 0) + 1;
    return `${ctx}>${tag}[${count}]`;
  }

  const targets: Element[] = [];
  for (const selector of selectors) {
    try {
      targets.push(...document.querySelectorAll(selector));
    } catch { /* invalid selector */ }
  }

  const tagCounters: Record<string, number> = {};
  for (const element of targets) {
    const he = element as HTMLElement;
    if (!shouldTrackElement(he)) continue;
    const key = buildElementKey(he, tagCounters);
    if (!key || results[key]) continue;

    const computed = getStyle(he);
    const styles: Record<string, string> = {};
    for (const prop of props) {
      styles[prop] = computed.getPropertyValue(prop);
    }
    results[key] = styles;

    for (const pseudo of ["::before", "::after"] as const) {
      const pseudoComputed = getStyle(he, pseudo);
      const content = pseudoComputed.getPropertyValue("content");
      if (!content || content === "none" || content === "normal") continue;

      const pseudoStyles: Record<string, string> = {};
      for (const prop of props) {
        pseudoStyles[prop] = pseudoComputed.getPropertyValue(prop);
      }
      results[`${key}${pseudo}`] = pseudoStyles;
    }
  }

  return results;
}

export function collectInteractionTargetPlansInDom(): InteractionTargetPlan[] {
  const selectorTexts: string[] = [];

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const isStyleRule = typeof CSSStyleRule === "undefined"
          ? typeof (rule as { selectorText?: unknown }).selectorText === "string"
          : rule instanceof CSSStyleRule;
        if (!isStyleRule) continue;
        const selectorText = (rule as CSSStyleRule).selectorText;
        if (!/:(focus-visible|focus-within|focus|hover|active)\b/.test(selectorText)) continue;
        selectorTexts.push(selectorText);
      }
    } catch { /* cross-origin */ }
  }

  const plans: InteractionTargetPlan[] = [];
  const seen = new Set<string>();
  for (const selectorText of selectorTexts) {
    for (const rawSelector of selectorText.split(",")) {
      const selector = rawSelector.trim();
        if (!selector || !/:(focus-visible|focus-within|focus|hover|active)\b/.test(selector)) continue;
        const normalizedSelector = selector
          .replace(/:(focus-visible|focus-within|focus|hover|active)\b/g, "")
          .replace(/::[\w-]+/g, "")
          .replace(/\s+/g, " ")
          .replace(/\s*([>+~])\s*/g, " $1 ")
          .trim();
        if (!normalizedSelector) continue;
      const forcedStates: ForcedPseudoState[] = [];
      {
        const seenStates = new Set<string>();
        const pattern = /:(focus-visible|focus-within|focus|hover|active)\b/g;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(selector)) !== null) {
          const s = m[1] as ForcedPseudoState;
          if (seenStates.has(s)) continue;
          seenStates.add(s);
          forcedStates.push(s);
        }
      }
      if (forcedStates.length === 0) continue;
      const interaction: InteractionType = forcedStates.includes("active")
        ? "active"
        : forcedStates.some((s) => s === "focus" || s === "focus-visible" || s === "focus-within")
          ? "focus"
          : "hover";
      const key = `${interaction}\u0000${normalizedSelector}\u0000${forcedStates.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plans.push({ selector, normalizedSelector, interaction, forcedStates });
    }
  }

  return plans;
}

export async function waitForInteractionStylesInDom(): Promise<void> {
  try {
    void (document.documentElement as HTMLElement | undefined)?.offsetHeight;
  } catch { /* ignore */ }

  const waitFrame = () => new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });

  await waitFrame();
  await waitFrame();
}

export async function captureEmulatedInteractionStyleSnapshotInDom(
  props: string[],
): Promise<ComputedStyleSnapshot> {
  const results: ComputedStyleSnapshot = {};
  const semanticTags = new Set([
    "main", "nav", "header", "footer", "aside", "article", "section",
    "table", "thead", "tbody", "tr", "th", "td", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "input", "select", "textarea",
    "pre", "code", "blockquote", "img", "span", "div", "form", "label",
  ]);

  function getClassNames(element: {
    classList?: unknown;
    className?: unknown;
  }): string[] {
    const classList = element.classList;
    if (classList && typeof classList === "object") {
      if (Symbol.iterator in classList) {
        return Array.from(classList as Iterable<unknown>)
          .map((value) => String(value))
          .filter(Boolean);
      }

      const length = Number((classList as { length?: number }).length ?? 0);
      const values: string[] = [];
      for (let i = 0; i < length; i++) {
        const token = String((classList as Record<number, unknown>)[i] ?? "");
        if (token) values.push(token);
      }
      if (values.length > 0) return values;
    }

    if (typeof element.className === "string") {
      return element.className.split(/\s+/).filter(Boolean);
    }

    return [];
  }

  const getStyle = typeof getComputedStyle === "function"
    ? getComputedStyle
    : typeof window !== "undefined" && typeof window.getComputedStyle === "function"
      ? window.getComputedStyle.bind(window)
      : null;
  if (!getStyle) {
    throw new Error("getComputedStyle is not available in this realm");
  }

  function shouldTrackElement(element: HTMLElement): boolean {
    if (element.id) return true;
    if (getClassNames(element).length > 0) return true;
    return semanticTags.has(element.tagName.toLowerCase());
  }

  function buildElementKey(
    element: HTMLElement,
    tagCounters: Record<string, number>,
  ): string {
    if (element.id) return `#${element.id}`;
    const classNames = getClassNames(element);
    if (classNames.length > 0) return `.${classNames.join(".")}`;

    const tag = element.tagName.toLowerCase();
    const parentClass = element.parentElement ? getClassNames(element.parentElement)[0] : undefined;
    const ctx = parentClass ? `.${parentClass}` : "";
    const counterKey = `${ctx}>${tag}`;
    const count = tagCounters[counterKey] = (tagCounters[counterKey] ?? 0) + 1;
    return `${ctx}>${tag}[${count}]`;
  }

  const emulatedRules: string[] = [];
  const targetSelectors = new Set<string>();

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const isStyleRule = typeof CSSStyleRule === "undefined"
          ? typeof (rule as { selectorText?: unknown }).selectorText === "string"
          : rule instanceof CSSStyleRule;
        if (!isStyleRule) continue;
        const selectorText = (rule as CSSStyleRule).selectorText;
        if (!/:(focus-visible|focus-within|focus|hover|active)\b/.test(selectorText)) continue;

        const emulatedSelector = selectorText
          .replace(/:(focus-visible|focus-within|focus|hover|active)\b/g, "")
          .replace(/\s+/g, " ")
          .replace(/\s*([>+~])\s*/g, " $1 ")
          .trim();
        if (emulatedSelector) {
          emulatedRules.push(`${emulatedSelector} { ${(rule as CSSStyleRule).style.cssText} }`);
        }

        for (const rawSelector of selectorText.split(",")) {
          const normalizedSelector = rawSelector
            .trim()
            .replace(/:(focus-visible|focus-within|focus|hover|active)\b/g, "")
            .replace(/::[\w-]+/g, "")
            .replace(/\s+/g, " ")
            .replace(/\s*([>+~])\s*/g, " $1 ")
            .trim();
          if (normalizedSelector) targetSelectors.add(normalizedSelector);
        }
      }
    } catch { /* cross-origin */ }
  }

  if (emulatedRules.length === 0 || targetSelectors.size === 0) return {};

  const style = document.createElement("style");
  style.id = "__hover_emulation__";
  style.textContent = emulatedRules.join("\n");
  (document.head ?? document.documentElement).appendChild(style);

  try {
    try {
      void (document.documentElement as HTMLElement | undefined)?.offsetHeight;
    } catch { /* ignore */ }

    const waitFrame = () => new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });

    await waitFrame();
    await waitFrame();

    const selectorText = [...targetSelectors].join(", ");
    let targets: NodeListOf<Element>;
    try {
      targets = document.querySelectorAll(selectorText);
    } catch {
      targets = document.querySelectorAll("*");
    }
    const tagCounters: Record<string, number> = {};

    for (const element of targets) {
      const he = element as HTMLElement;
      if (!shouldTrackElement(he)) continue;
      const key = buildElementKey(he, tagCounters);
      if (!key || results[key]) continue;

      const computed = getStyle(he);
      const styles: Record<string, string> = {};
      for (const prop of props) {
        styles[prop] = computed.getPropertyValue(prop);
      }
      results[key] = styles;

      for (const pseudo of ["::before", "::after"] as const) {
        const pseudoComputed = getStyle(he, pseudo);
        const content = pseudoComputed.getPropertyValue("content");
        if (!content || content === "none" || content === "normal") continue;

        const pseudoStyles: Record<string, string> = {};
        for (const prop of props) {
          pseudoStyles[prop] = pseudoComputed.getPropertyValue(prop);
        }
        results[`${key}${pseudo}`] = pseudoStyles;
      }
    }

    return results;
  } finally {
    style.remove();
  }
}

export function computedStyleSnapshotToMap(
  snapshot: ComputedStyleSnapshot,
): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const [selector, props] of Object.entries(snapshot)) {
    map.set(selector, props);
  }
  return map;
}

// esbuild injects __name(fn, "name") calls into Function.toString() output.
// Polyfill it as a no-op for page.evaluate contexts.
export const ESBUILD_NAME_POLYFILL = "var __name = typeof __name !== 'undefined' ? __name : function(fn) { return fn; };";

export function buildComputedStyleCaptureExpression(
  props: string[] = TRACKED_PROPERTIES,
): string {
  return `(function(){ ${ESBUILD_NAME_POLYFILL} return (${captureComputedStyleSnapshotInDom.toString()})(${JSON.stringify(props)}); })()`;
}

export function buildComputedStyleCaptureJsonExpression(
  props: string[] = TRACKED_PROPERTIES,
): string {
  return `JSON.stringify(${buildComputedStyleCaptureExpression(props)})`;
}

export function parseComputedStyleSnapshot(value: unknown): ComputedStyleSnapshot {
  const candidate = typeof value === "string" ? safeJsonParse(value) : value;
  if (!isRecord(candidate)) return {};

  const snapshot: ComputedStyleSnapshot = {};
  for (const [selector, props] of Object.entries(candidate)) {
    if (!isRecord(props)) continue;
    const normalized: Record<string, string> = {};
    for (const [prop, propValue] of Object.entries(props)) {
      normalized[prop] = typeof propValue === "string" ? propValue : String(propValue ?? "");
    }
    snapshot[selector] = normalized;
  }
  return snapshot;
}

export function hasMeaningfulComputedStyleSnapshot(snapshot: ComputedStyleSnapshot): boolean {
  return Object.values(snapshot).some((props) =>
    Object.values(props).some((value) => value.trim().length > 0)
  );
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
