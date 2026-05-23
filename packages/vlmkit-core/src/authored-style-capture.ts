/**
 * Authored CSS capture for properties whose computed form lies about the
 * authored shape.
 *
 * Motivating case (2026-05-23 dogfood, app-shell `.shell`):
 * `getComputedStyle().getPropertyValue("grid-template-columns")` resolves
 * `minmax(0, 1fr) 4px minmax(0, 1fr)` to a three px-tuple — but writing
 * those numbers back as CSS would corrupt the responsive layout. The fix is
 * not to track grid-template-* in computed-style at all; instead, walk
 * `document.styleSheets.cssRules` to emit the AUTHORED strings and diff
 * THEM. Same approach scales to `flex` shorthand, `transform`, and any
 * other property whose computed form diverges from authored.
 *
 * Surface mirrors `computed-style-capture` so consumers can reuse
 * `diffComputedStyles` (it's just `Record<selector, Record<prop, value>>`
 * → `Record<selector, Record<prop, value>>` either way).
 */
/// <reference lib="dom" />

export type AuthoredStyleSnapshot = Record<string, Record<string, string>>;

/**
 * Properties tracked by default. These are the ones whose computed
 * representation differs structurally from the authored source — anything
 * already faithful in `getComputedStyle` does not need this channel.
 */
export const AUTHORED_PROPERTIES = [
  "grid-template",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-auto-flow",
  "grid-column",
  "grid-row",
  "grid",
  "flex",
  "transform",
  "clip-path",
  "mask",
  "mask-image",
];

const MEDIA_SEPARATOR = " :: ";

/**
 * Format a "scoped" selector key. When `mediaCondition` is empty, returns
 * the bare selector text. When non-empty, the key reads
 * `@media (min-width: 768px) :: .shell` so the diff treats the same
 * selector inside a different `@media` block as a distinct row.
 */
function buildScopedSelectorKey(selector: string, mediaCondition: string): string {
  const trimmedMedia = mediaCondition.trim();
  if (!trimmedMedia) return selector;
  return `@media ${trimmedMedia}${MEDIA_SEPARATOR}${selector}`;
}

/**
 * Browser-context capture. Walks all same-origin stylesheets and nested
 * `@media` / `@supports` rules, collecting authored `value` strings for
 * each (scoped-selector, property) pair listed in `props`. Last
 * declaration wins per pair (mirrors authoring order; sufficient for
 * static diff use cases).
 *
 * Selectors are comma-split so `.a, .b { grid-template-columns: ... }`
 * fans out into both `.a` and `.b` entries.
 */
export function captureAuthoredStyleSnapshotInDom(props: string[]): AuthoredStyleSnapshot {
  const trackedProps = new Set(props);
  const results: AuthoredStyleSnapshot = {};

  function visit(rule: unknown, mediaCondition: string) {
    if (!rule || typeof rule !== "object") return;
    const ruleObj = rule as {
      selectorText?: unknown;
      style?: { getPropertyValue?: (name: string) => string } | null;
      conditionText?: unknown;
      media?: { mediaText?: unknown } | null;
      cssRules?: ArrayLike<unknown>;
    };

    // @media / @supports / @container — descend with the media condition extended.
    const conditionFromMedia = typeof ruleObj.media?.mediaText === "string"
      ? ruleObj.media!.mediaText
      : "";
    const conditionFromAt = typeof ruleObj.conditionText === "string"
      ? ruleObj.conditionText
      : "";
    const additionalCondition = conditionFromMedia || conditionFromAt;
    const nestedMedia = additionalCondition
      ? mediaCondition
        ? `${mediaCondition} and ${additionalCondition}`
        : additionalCondition
      : mediaCondition;

    if (ruleObj.cssRules && typeof (ruleObj.cssRules as { length?: unknown }).length === "number") {
      const nested = ruleObj.cssRules as ArrayLike<unknown>;
      for (let i = 0; i < nested.length; i++) {
        visit(nested[i], nestedMedia);
      }
      // Containers like @media/@supports never carry selectorText themselves.
      if (!ruleObj.selectorText) return;
    }

    if (typeof ruleObj.selectorText !== "string") return;
    const style = ruleObj.style;
    if (!style || typeof style.getPropertyValue !== "function") return;

    for (const rawSelector of ruleObj.selectorText.split(",")) {
      const selector = rawSelector.trim();
      if (!selector) continue;
      const key = buildScopedSelectorKey(selector, mediaCondition);
      for (const prop of trackedProps) {
        const value = style.getPropertyValue(prop);
        if (!value) continue;
        const bucket = results[key] ?? (results[key] = {});
        bucket[prop] = value.trim();
      }
    }
  }

  const styleSheets = (document as Document & { styleSheets?: StyleSheetList }).styleSheets;
  if (!styleSheets) return results;
  for (const sheet of Array.from(styleSheets)) {
    try {
      const rules = (sheet as CSSStyleSheet).cssRules;
      for (const rule of Array.from(rules)) {
        visit(rule, "");
      }
    } catch { /* cross-origin stylesheet */ }
  }

  return results;
}

// esbuild injects __name(fn, "name") calls into Function.toString() output.
const ESBUILD_NAME_POLYFILL =
  "var __name = typeof __name !== 'undefined' ? __name : function(fn) { return fn; };";

export function buildAuthoredStyleCaptureExpression(
  props: string[] = AUTHORED_PROPERTIES,
): string {
  return `(function(){ ${ESBUILD_NAME_POLYFILL} return (${captureAuthoredStyleSnapshotInDom.toString()})(${JSON.stringify(props)}); })()`;
}

export function buildAuthoredStyleCaptureJsonExpression(
  props: string[] = AUTHORED_PROPERTIES,
): string {
  return `JSON.stringify(${buildAuthoredStyleCaptureExpression(props)})`;
}

export function parseAuthoredStyleSnapshot(value: unknown): AuthoredStyleSnapshot {
  const candidate = typeof value === "string" ? safeJsonParse(value) : value;
  if (!isRecord(candidate)) return {};

  const snapshot: AuthoredStyleSnapshot = {};
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

export function hasMeaningfulAuthoredStyleSnapshot(snapshot: AuthoredStyleSnapshot): boolean {
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
