/**
 * vlmkit ⇄ veriss (mizchi/veriss): the rendered page handed to veriss's static analysis.
 *
 * veriss decides from HTML and CSS, for every viewport width at once and without rendering,
 * which CSS the browser ignores. It cannot run the page: a page whose DOM a script builds, or
 * whose CSS comes from files and CDNs, is out of its reach on its own. vlmkit has the page in a
 * browser, so it hands veriss the DOM after the page's scripts ran (the head cut to its meta and
 * title, which is what veriss reads) and the text of every stylesheet the page loaded, joined in
 * the order the browser reported them. Lines in veriss's report are lines of that joined CSS;
 * `SheetSpan`s put them back (`@mizchi/vlmkit-judge/css-static.ts`).
 *
 * veriss is an optional peer: without it this returns null and says why, and `check css` runs
 * the browser's rules alone.
 */
import type { Page } from "playwright";
import type { SheetSpan, StaticWarning } from "@mizchi/vlmkit-judge/css-static.ts";
import type { CssInspector } from "../stress/responsive-css.ts";

/** The package name, in one place: changing it (it was `veriss` before npm) is this line. */
export const VERISS_PACKAGE = "veriss";

export interface StaticReport {
  /** What veriss said about the page as a whole: verified, or unknown with its reasons. */
  status: string;
  warnings: StaticWarning[];
  sheets: SheetSpan[];
  /** veriss's Unknown reasons, by code, with a count: what it could not decide. */
  unknown: Record<string, number>;
  ms: number;
}

type AnalyzeHTML = (
  html: string,
  options: Record<string, unknown>,
) => {
  status: string;
  layoutWarnings?: {
    code: string;
    message: string;
    selector?: string;
    property?: string;
    css?: { line?: number; property?: string; selector?: string }[];
  }[];
  diagnostics?: { code: string; severity: string }[];
};

let loaded: Promise<AnalyzeHTML | null> | undefined;
/** veriss's `analyzeHTML`, or null when the optional peer is not installed. */
export function loadVeriss(): Promise<AnalyzeHTML | null> {
  loaded ??= import(/* @vite-ignore */ `${VERISS_PACKAGE}/html`).then(
    (m: { analyzeHTML?: AnalyzeHTML }) => m.analyzeHTML ?? null,
    () => null,
  );
  return loaded;
}

/** The rendered DOM as veriss reads it: the document, with the head cut to its meta and title. */
const RENDERED_HTML_JS = `(() => {
  const root = document.documentElement.cloneNode(true);
  const head = root.querySelector("head");
  if (head) for (const el of [...head.children]) if (el.localName !== "meta" && el.localName !== "title") el.remove();
  for (const el of root.querySelectorAll("body style, body link[rel~=stylesheet], body script, body noscript, body template")) el.remove();
  return "<!doctype html>" + root.outerHTML;
})()`;

export async function runStatic(
  page: Page,
  inspector: CssInspector,
  viewport = { min: 320, max: 1920 },
): Promise<StaticReport | { skipped: string }> {
  const analyzeHTML = await loadVeriss();
  if (!analyzeHTML)
    return {
      skipped: `${VERISS_PACKAGE} is not installed (an optional peer): install it for the static checks over every width`,
    };
  const sheetTexts = await inspector.sheetTexts();
  const html = (await page.evaluate(RENDERED_HTML_JS)) as string;
  const sheets: SheetSpan[] = sheetTexts.map((s) => ({
    sheet: s.sheet,
    firstFileLine: s.firstFileLine,
    lines: s.text.split("\n").length,
  }));
  const started = performance.now();
  let r: ReturnType<AnalyzeHTML>;
  try {
    r = analyzeHTML(html, {
      name: "page",
      css: sheetTexts.map((s) => s.text).join("\n"),
      viewport,
      // A shorthand beside its own longhand is how hand-written CSS overrides one side: a warning, and laid out.
      shorthandConflicts: "warning",
    });
  } catch (error) {
    return { skipped: `veriss could not read the page: ${error instanceof Error ? error.message : String(error)}` };
  }
  const unknown: Record<string, number> = {};
  for (const d of r.diagnostics ?? []) if (d.severity === "unknown") unknown[d.code] = (unknown[d.code] ?? 0) + 1;
  return {
    status: r.status,
    // One warning per declaration it names: an inert-declaration warning lists each property with its own line.
    warnings: (r.layoutWarnings ?? []).flatMap((w) =>
      (w.css?.length ? (w.code === "W_LAYOUT_DECLARATION_INERT" ? w.css : w.css.slice(0, 1)) : [{}]).map(
        (at: { line?: number; property?: string; selector?: string }) => {
          const property = at.property ?? w.property;
          const selector = at.selector ?? w.selector;
          return {
            code: w.code,
            message: w.message,
            ...(selector ? { selector } : {}),
            // An at-rule's name (@media, @import) is where it is written, not a property.
            ...(property && !property.startsWith("@") ? { property } : {}),
            ...(at.line !== undefined ? { line: at.line } : {}),
          };
        },
      ),
    ),
    sheets,
    unknown,
    ms: Math.round(performance.now() - started),
  };
}
