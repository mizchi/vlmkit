/**
 * `vlmkit check css`: CSS the browser accepted as text and then ignored, decided by the browser.
 *
 * The idea is veriss's (mizchi/veriss, rule catalog §1 "CSS の構文" and §2 "at-rule"): a
 * declaration whose value the grammar rejects is dropped whole and the previous value stays,
 * and an `@media` the browser cannot evaluate is false for everyone — both silently. veriss
 * decides them statically from a grammar of its own; here the rendering browser says:
 *
 * - each author declaration in a rule that matches an element carries the DevTools protocol's
 *   `parsedOk` (Chromium's own parser), read through `CssInspector` — the protocol reads linked
 *   `file:` and CDN sheets the CSSOM cannot;
 * - each `@media` atom is evaluated with `matchMedia` as `(f)` and `not (f)`
 *   (`MEDIA_ATOM_PROBE_JS`, shared with `check animation`);
 * - whether an unknown declaration's property is known at all is `CSS.supports(p, "initial")`.
 *
 * The decisions are `@mizchi/vlmkit-judge/css-check.ts`; this file measures. Chromium only:
 * another engine has no protocol to read `parsedOk` from, and says so.
 */
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  judgeCssCheck,
  MEDIA_ATOM_PROBE_JS,
  nearestWord,
  type CssCheckFinding,
  type DeclarationSample,
  type MediaSample,
} from "@mizchi/vlmkit-judge/css-check.ts";
import { CssInspector } from "../stress/responsive-css.ts";

export interface CssCheckOptions extends PageLoadOptions {
  source: string;
  viewport?: { width: number; height: number };
  /** Elements whose matched rules are read (document order). */
  maxElements?: number;
  storageState?: string;
}

export interface CssCheckReport {
  source: string;
  viewport: { width: number; height: number };
  inspected: { elements: number; totalElements: number; sheets: number; media: number };
  declarations: DeclarationSample[];
  media: MediaSample[];
  findings: CssCheckFinding[];
}

export const DEFAULT_MAX_ELEMENTS = 3000;
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

export async function runCssCheck(options: CssCheckOptions): Promise<CssCheckReport> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { openSource } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { pickPageLoad } = await import("@mizchi/vlmkit-core/page-load.ts");
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const limit = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  return withBrowser(async (browser) => {
    const { page } = await openSource(browser, options.source, {
      ...pickPageLoad(options),
      ...(options.storageState ? { storageState: options.storageState } : {}),
      viewport,
    });
    const inspector = await CssInspector.open(page);
    if (!inspector)
      throw new Error("check css needs Chromium: it reads each declaration's parsedOk through the DevTools protocol");
    try {
      const { elements, declarations: raw } = await inspector.unparsedDeclarations(limit);
      const mediaRules = await inspector.mediaRules();
      const totalElements = await page.evaluate(() => document.getElementsByTagName("*").length);
      const probe = (await page.evaluate(
        `(() => {${MEDIA_ATOM_PROBE_JS}
          return {
            atoms: ${JSON.stringify(mediaRules.map((m) => m.condition))}.map(unknownMediaAtom),
            known: ${JSON.stringify([...new Set(raw.map((d) => d.property))])}.map((p) => p.startsWith("--") || CSS.supports(p, "initial")),
            properties: Array.from(getComputedStyle(document.documentElement)),
          };
        })()`,
      )) as { atoms: (string | null)[]; known: boolean[]; properties: string[] };
      const knownByName = new Map([...new Set(raw.map((d) => d.property))].map((p, i) => [p, probe.known[i]!]));
      const declarations: DeclarationSample[] = raw.map((d) => {
        const propertyKnown = knownByName.get(d.property) ?? true;
        return {
          ...d,
          propertyKnown,
          ...(propertyKnown ? {} : { suggest: nearestWord(d.property.toLowerCase(), probe.properties) }),
        };
      });
      const media: MediaSample[] = mediaRules.map((m, i) => ({ ...m, unknownAtom: probe.atoms[i] ?? null }));
      return {
        source: options.source,
        viewport,
        inspected: { elements, totalElements, sheets: inspector.sheetCount, media: media.length },
        declarations,
        media,
        findings: judgeCssCheck({ declarations, media }),
      };
    } finally {
      await inspector.close();
      await page.close();
    }
  });
}

/** The report as text; under rule settings an `off` rule's findings are not printed. */
export function formatCssCheckReport(report: CssCheckReport, rules?: RuleView): string {
  const shown = report.findings.flatMap((f) => {
    const tier = ruleTier(rules, f.rule, f.severity);
    return tier === "off" ? [] : [{ ...f, tier }];
  });
  const i = report.inspected;
  const lines = [
    `${BOLD}${CYAN}vlmkit check css${RESET}`,
    `${DIM}source: ${report.source}${RESET}`,
    `${DIM}read through the DevTools protocol at ${report.viewport.width}x${report.viewport.height}: ${i.sheets} stylesheet(s), ${i.media} @media rule(s), the matched rules of ${i.elements}${i.elements < i.totalElements ? ` of ${i.totalElements}` : ""} element(s)${RESET}`,
    `${DIM}declarations are judged where a rule matches now; rules under a media query that does not match at this viewport are not read${RESET}`,
    "",
  ];
  if (shown.length === 0)
    lines.push(`${GREEN}ok${RESET} the browser kept every declaration and can evaluate every @media`);
  for (const f of shown)
    lines.push(
      `${f.tier === "suspect" ? `${RED}x${RESET}` : f.tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`} [${f.rule}] ${f.message}`,
    );
  const fails = shown.filter((f) => f.tier === "suspect").length;
  const warns = shown.filter((f) => f.tier === "warn").length;
  lines.push("", `${fails} suspect, ${warns} warn, ${shown.length - fails - warns} info`);
  return lines.join("\n");
}
