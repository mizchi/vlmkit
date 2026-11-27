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

/**
 * The rendered DOM as veriss reads it: the document, with the head cut to its meta and title. In the
 * body, the sheets (given to veriss as CSS), scripts and the like are never removed: each is replaced
 * by an empty <template> where it is, so :first-child and :nth-child count the siblings the browser
 * counted. (An empty <style>, <script>, <link> or <noscript> is an element veriss cannot lay out;
 * <template> is never rendered and still a child. Only :nth-of-type over those tags reads otherwise.)
 */
const RENDERED_HTML_JS = `(() => {
  const root = document.documentElement.cloneNode(true);
  const head = root.querySelector("head");
  if (head) for (const el of [...head.children]) if (el.localName !== "meta" && el.localName !== "title") el.remove();
  for (const el of root.querySelectorAll("body style, body link, body script, body noscript, body template"))
    el.replaceWith(document.createElement("template"));
  return "<!doctype html>" + root.outerHTML;
})()`;

export async function runStatic(
  page: Page,
  inspector: CssInspector,
  /** The viewport height the browser measured at: without one, veriss leaves every explicit block size Unknown. */
  height: number,
  widths = { min: 320, max: 1920 },
): Promise<StaticReport | { skipped: string }> {
  const analyzeHTML = await loadVeriss();
  if (!analyzeHTML)
    return {
      skipped: `${VERISS_PACKAGE} is not installed (an optional peer): install it for the static checks over every width`,
    };
  const { texts: sheetTexts, unordered } = await inspector.sheetTexts();
  // The cascade reads sheets in document order; one whose place is not known (an @import, a constructed
  // sheet) could be put anywhere, and a later rule decides what wins: not analysed, never guessed.
  if (unordered)
    return {
      skipped: `${unordered} stylesheet(s) have no owner element (an @import or a constructed sheet), so their place in the cascade is not known: static analysis skipped`,
    };
  const html = (await page.evaluate(RENDERED_HTML_JS)) as string;
  // A sheet with a media condition goes in under it, one line before its own first line.
  const texts = sheetTexts.map((s) => (s.media ? `@media ${s.media} {\n${s.text}\n}` : s.text));
  const sheets: SheetSpan[] = sheetTexts.map((s, i) => ({
    sheet: s.sheet,
    firstFileLine: s.media ? s.firstFileLine - 1 : s.firstFileLine,
    lines: texts[i]!.split("\n").length,
  }));
  const started = performance.now();
  let r: ReturnType<AnalyzeHTML>;
  try {
    r = analyzeHTML(html, {
      name: "page",
      css: texts.join("\n"),
      viewport: { ...widths, height: { min: height, max: height } },
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
