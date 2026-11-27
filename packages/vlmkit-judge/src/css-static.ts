/**
 * `check css` with veriss (mizchi/veriss): the static half, merged with what the browser decided.
 *
 * veriss reads the page's DOM and CSS and decides, for every viewport width at once and without
 * rendering, which CSS the browser ignores. vlmkit hands it the rendered DOM and every stylesheet
 * the page loaded, and keeps for itself only what needs the browser: whether Chromium parsed a
 * declaration (`parsedOk`, exact for every grammar), whether it can evaluate a media feature
 * (`matchMedia`), and whether removing a declaration changes any pixel. Each finding is said once:
 * where both judged the same declaration, the browser's finding stays and says veriss agrees.
 *
 * Pure: no DOM, no Node built-ins (`purity.test.ts`).
 */
import type { CssCheckFinding } from "./css-check.ts";

/** One warning of veriss's report, located in the joined CSS it was given. */
export interface StaticWarning {
  code: string;
  message: string;
  selector?: string;
  property?: string;
  /** 1-based line in the joined CSS. */
  line?: number;
}

/** Where one stylesheet sits in the joined CSS (sheets are joined with one newline). */
export interface SheetSpan {
  sheet: string;
  /** The 1-based line of its first line in the file it lives in (an inline `<style>` is offset). */
  firstFileLine: number;
  lines: number;
}

/**
 * The check css rule a veriss code is reported as, or null when check css leaves it alone:
 * layout and accessibility codes are other gates' questions, and a shorthand beside its own
 * longhand in one rule is how hand-written CSS overrides one side.
 */
export function staticRule(code: string): "static-css" | "inert-declaration" | null {
  if (code === "W_LAYOUT_DECLARATION_INERT") return "inert-declaration";
  if (code === "W_CSS_SHORTHAND_CONFLICT") return null;
  return /^W_(?:CSS|HTML)_/.test(code) ? "static-css" : null;
}

/** A line of the joined CSS, put back in the sheet it came from. */
export function locateLine(line: number, sheets: readonly SheetSpan[]): { sheet: string; line: number } | null {
  let start = 1;
  for (const s of sheets) {
    if (line >= start && line < start + s.lines) return { sheet: s.sheet, line: s.firstFileLine + (line - start) };
    start += s.lines;
  }
  return null;
}

const where = (f: { sheet: string; line?: number }) => `${f.sheet}${f.line !== undefined ? `:${f.line}` : ""}`;

/**
 * The browser's findings and veriss's, one per declaration. A veriss warning on a declaration
 * the browser also reported (same sheet, line and property) adds "veriss agrees (CODE)" to the
 * browser's finding; one of its own is `static-css` or, for an inert declaration,
 * `inert-declaration` — once per declaration however many boxes veriss named.
 */
export function mergeStaticFindings(
  own: readonly CssCheckFinding[],
  warnings: readonly StaticWarning[],
  sheets: readonly SheetSpan[],
): CssCheckFinding[] {
  const key = (sheet: string, line: number | undefined, property: string | undefined) =>
    `${sheet}\u0000${line ?? ""}\u0000${property ?? ""}`;
  const out = own.map((f) => ({ ...f }));
  const byKey = new Map(out.map((f) => [key(f.sheet, f.line, f.property), f]));
  const agreed = new Map<CssCheckFinding, Set<string>>();
  const seen = new Set<string>();
  for (const w of warnings) {
    const rule = staticRule(w.code);
    if (!rule) continue;
    const at = w.line !== undefined ? locateLine(w.line, sheets) : null;
    const sheet = at?.sheet ?? "stylesheet";
    const k = key(sheet, at?.line, w.property);
    const mine = byKey.get(k);
    if (mine) {
      agreed.set(mine, (agreed.get(mine) ?? new Set()).add(w.code));
      continue;
    }
    if (seen.has(`${w.code}\u0000${k}`) || (rule === "inert-declaration" && seen.has(`inert\u0000${k}`))) continue;
    seen.add(`${w.code}\u0000${k}`);
    if (rule === "inert-declaration") seen.add(`inert\u0000${k}`);
    out.push({
      rule,
      severity: "warn",
      ...(w.selector ? { selector: w.selector } : {}),
      ...(w.property ? { property: w.property } : {}),
      sheet,
      ...(at ? { line: at.line } : {}),
      message: `[${w.code}] ${w.message} (${where({ sheet, ...(at ? { line: at.line } : {}) })}) — veriss, judged at every width from 320 to 1920px`,
    });
  }
  for (const [f, codes] of agreed) f.message += ` — veriss agrees (${[...codes].join(", ")})`;
  return out;
}
