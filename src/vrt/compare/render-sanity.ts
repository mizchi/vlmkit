/**
 * Heuristics for detecting "the baseline didn't actually render" failures
 * that produce silent diff inflation, like the broken Tailwind CDN
 * described in `docs/reports/2026-05-11-tailwind-fixture-reproducibility.md`.
 *
 * Kept as a pure module so the heuristics can be unit-tested separately
 * from the Playwright-driven render pipeline.
 */

export interface FailedRequest {
  url: string;
  errorText: string;
}

export interface RenderProbe {
  /** Computed body font-family. */
  bodyFontFamily: string;
  /** Number of CSSOM stylesheets attached to the document. */
  styleSheetCount: number;
  /** Whether `document.body` has any direct or descendant elements with a `class` attribute. */
  hasClassAttributes: boolean;
  /** Whether the source HTML declared any external <script src=...> tags. */
  declaredExternalScripts: boolean;
  /** Whether the source HTML declared any external <link rel="stylesheet" href=...> tags. */
  declaredExternalStylesheets: boolean;
}

export interface RenderSanityWarning {
  /** Short machine-readable code. */
  code:
    | "failed-resource-load"
    | "default-font-with-classes"
    | "no-styles-but-classes"
    | "external-asset-declared-but-missing";
  message: string;
}

export interface RenderSanityInput {
  failedRequests: FailedRequest[];
  probe: RenderProbe;
}

export interface RenderSanityResult {
  ok: boolean;
  warnings: RenderSanityWarning[];
  failedRequests: FailedRequest[];
}

const BROWSER_DEFAULT_FONTS = new Set([
  "times new roman",
  "times",
  '"times new roman"',
  "serif",
]);

function looksLikeBrowserDefault(fontFamily: string): boolean {
  const normalized = fontFamily.trim().toLowerCase();
  return BROWSER_DEFAULT_FONTS.has(normalized);
}

function isCriticalAsset(req: FailedRequest): boolean {
  const url = req.url.toLowerCase();
  if (url.endsWith(".css")) return true;
  if (url.endsWith(".js") || url.endsWith(".mjs")) return true;
  // CDN endpoints without an extension still matter.
  if (/(tailwind|fonts|jsdelivr|unpkg|cdnjs)/.test(url)) return true;
  return false;
}

/**
 * Evaluate the collected probe + failed requests and emit warnings if the
 * baseline likely didn't render as intended.
 */
export function evaluateRenderSanity(input: RenderSanityInput): RenderSanityResult {
  const warnings: RenderSanityWarning[] = [];

  for (const req of input.failedRequests) {
    if (!isCriticalAsset(req)) continue;
    warnings.push({
      code: "failed-resource-load",
      message: `External asset failed to load: ${req.url} (${req.errorText})`,
    });
  }

  const probe = input.probe;
  const defaultFont = looksLikeBrowserDefault(probe.bodyFontFamily);

  if (defaultFont && probe.hasClassAttributes && probe.declaredExternalScripts) {
    warnings.push({
      code: "default-font-with-classes",
      message:
        `body font-family is browser default ("${probe.bodyFontFamily}") but the HTML ` +
        `declares external scripts and class attributes — the styling pipeline ` +
        `likely failed to apply. Consider inlining the generated CSS (see ` +
        `before-inlined.html pattern).`,
    });
  }

  if (probe.declaredExternalStylesheets && probe.styleSheetCount === 0 && probe.hasClassAttributes) {
    warnings.push({
      code: "external-asset-declared-but-missing",
      message:
        "HTML declares <link rel='stylesheet'> but no CSSOM stylesheets are attached; " +
        "the external CSS likely failed to load.",
    });
  }

  if (
    probe.hasClassAttributes &&
    probe.styleSheetCount === 0 &&
    defaultFont &&
    !probe.declaredExternalScripts &&
    !probe.declaredExternalStylesheets
  ) {
    warnings.push({
      code: "no-styles-but-classes",
      message:
        "DOM has class attributes but no stylesheet is attached and body font is " +
        "browser default — the inline <style> may have been stripped.",
    });
  }

  return {
    ok: warnings.length === 0,
    warnings,
    failedRequests: input.failedRequests,
  };
}

/** Heuristic source-HTML inspection used to populate `RenderProbe`. */
export function probeSourceHtml(html: string): {
  declaredExternalScripts: boolean;
  declaredExternalStylesheets: boolean;
} {
  return {
    declaredExternalScripts: /<script[^>]+\bsrc\s*=/i.test(html),
    declaredExternalStylesheets: /<link[^>]+\brel\s*=\s*["']?stylesheet["']?[^>]+\bhref\s*=/i.test(html)
      || /<link[^>]+\bhref\s*=[^>]+\brel\s*=\s*["']?stylesheet/i.test(html),
  };
}

/**
 * Browser-side script (string-form) for reading the {@link RenderProbe}
 * fields that need DOM access. Stays free of TypeScript imports so it can
 * be fed verbatim to `page.evaluate()`.
 */
export const RENDER_PROBE_BROWSER_SCRIPT = `(() => {
  const body = document.body;
  if (!body) return { bodyFontFamily: "", styleSheetCount: 0, hasClassAttributes: false };
  const styles = getComputedStyle(body);
  const hasClass = body.hasAttribute("class") || body.querySelector("[class]") != null;
  return {
    bodyFontFamily: styles.fontFamily || "",
    styleSheetCount: document.styleSheets.length,
    hasClassAttributes: hasClass,
  };
})()`;
