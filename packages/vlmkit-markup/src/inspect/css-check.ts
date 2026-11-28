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
import {
  INERT_CONTEXT_FN,
  inertCandidateProperty,
  inertOnAll,
  judgeInertDeclarations,
  mergeInertWidths,
  regimeWidths,
  type InertContext,
  type InertSample,
} from "@mizchi/vlmkit-judge/inert-declaration.ts";
import type { Page } from "playwright";
import { mergeStaticFindings } from "@mizchi/vlmkit-judge/css-static.ts";
import { CssInspector } from "../stress/responsive-css.ts";
import { runStatic, type StaticReport } from "./veriss-bridge.ts";

export interface CssCheckOptions extends PageLoadOptions {
  source: string;
  viewport?: { width: number; height: number };
  /** Elements whose matched rules are read (document order). */
  maxElements?: number;
  /** Inert-declaration candidates confirmed one by one when removing them together changes the page. */
  maxInertConfirm?: number;
  storageState?: string;
}

export interface CssCheckReport {
  source: string;
  viewport: { width: number; height: number };
  inspected: { elements: number; totalElements: number; sheets: number; media: number };
  declarations: DeclarationSample[];
  /** Declarations the context table calls inert on every element they match, with whether removing them changed nothing. */
  inert: { widths: number[]; candidates: number; confirmed: number; unstable: number[]; samples: InertSample[] };
  /** veriss's static analysis of the rendered page, or why it did not run. */
  static: StaticReport | { skipped: string };
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
    const { page, redirect } = await openSource(browser, options.source, {
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
      const widths = options.viewport ? [viewport.width] : regimeWidths(await inspector.mediaConditions());
      const inert = await measureInert(
        page,
        inspector,
        limit,
        options.maxInertConfirm ?? DEFAULT_MAX_INERT_CONFIRM,
        widths,
        viewport.height,
      );
      if (widths.length > 1) await page.setViewportSize(viewport);
      const staticReport = await runStatic(page, inspector, viewport.height);
      const own = [...judgeCssCheck({ declarations, media, redirect }), ...judgeInertDeclarations(inert.samples)];
      return {
        source: options.source,
        viewport,
        inspected: { elements, totalElements, sheets: inspector.sheetCount, media: media.length },
        declarations,
        media,
        inert: {
          widths,
          candidates: inert.candidates,
          confirmed: judgeInertDeclarations(inert.samples).length,
          unstable: inert.unstable,
          samples: inert.samples,
        },
        static: staticReport,
        findings:
          "skipped" in staticReport ? own : mergeStaticFindings(own, staticReport.warnings, staticReport.sheets),
      };
    } finally {
      await inspector.close();
      await page.close();
    }
  });
}

export const DEFAULT_MAX_INERT_CONFIRM = 60;

/** Every box and every pixel of the page, for "removing this changed nothing". */
async function pageState(page: Page): Promise<{ boxes: string; pixels: Buffer }> {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const boxes = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"), (e) => {
      const r = e.getBoundingClientRect();
      return `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}`;
    }).join(";"),
  );
  const pixels = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
  return { boxes, pixels };
}
const same = (a: { boxes: string; pixels: Buffer }, b: { boxes: string; pixels: Buffer }) =>
  a.boxes === b.boxes && a.pixels.equals(b.pixels);

/**
 * The inert-declaration samples. At each width (one per width regime of the page's media
 * queries, or the `--viewport` alone), every matched declaration the context table calls inert
 * on every element it matches is a candidate, confirmed by blanking it in its sheet and finding
 * every box and pixel unchanged: all candidates of a width together first, and one by one (up
 * to `maxConfirm`) only when that changes the page. A width whose page is not the same in two
 * captures out of five confirms nothing. The widths are merged by declaration: one that may
 * work at any width where its rule matches is dropped (`mergeInertWidths`).
 */
async function measureInert(
  page: Page,
  inspector: CssInspector,
  limit: number,
  maxConfirm: number,
  widths: readonly number[],
  height: number,
): Promise<{ samples: InertSample[]; candidates: number; unstable: number[] }> {
  const entries: { key: string; width: number; sample: InertSample | null }[] = [];
  const unstable: number[] = [];
  let candidateCount = 0;
  for (const width of widths) {
    if (widths.length > 1) await page.setViewportSize({ width, height });
    const { declarations } = await inspector.matchedDeclarations(limit, inertCandidateProperty);
    const contexts = new Map<number, InertContext | null>();
    const candidates: { key: string; sample: InertSample; edit: (typeof declarations)[number] }[] = [];
    for (const d of declarations) {
      for (const n of d.nodes)
        if (!contexts.has(n)) contexts.set(n, await inspector.onNode<InertContext>(n, INERT_CONTEXT_FN));
      const ctx = d.nodes.map((n) => contexts.get(n) ?? null);
      if (!inertOnAll(d.property, d.value, ctx)) {
        entries.push({ key: d.key, width, sample: null });
        continue;
      }
      candidates.push({
        key: d.key,
        edit: d,
        sample: {
          selector: d.selector,
          property: d.property,
          value: d.value,
          sheet: d.sheet,
          ...(d.line !== undefined ? { line: d.line } : {}),
          contexts: ctx,
          confirmed: false,
        },
      });
    }
    candidateCount += candidates.length;
    if (candidates.length > 0) {
      // Two captures that agree (at most five): the first one can land before fonts or images settle.
      let before = await pageState(page);
      let stable = false;
      for (let i = 0; i < 4 && !stable; i++) {
        const next = await pageState(page);
        stable = same(before, next);
        before = next;
      }
      if (!stable) unstable.push(width);
      else {
        const allAtOnce = await inspector.withoutRanges(
          candidates.map((c) => c.edit),
          () => pageState(page),
        );
        if (same(before, allAtOnce)) for (const c of candidates) c.sample.confirmed = true;
        else
          for (const c of candidates.slice(0, maxConfirm))
            c.sample.confirmed = same(before, await inspector.withoutRanges([c.edit], () => pageState(page)));
      }
    }
    for (const c of candidates) entries.push({ key: c.key, width, sample: c.sample });
  }
  return { samples: mergeInertWidths(entries), candidates: candidateCount, unstable };
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
    "skipped" in report.static
      ? `${YELLOW}static analysis skipped:${RESET} ${report.static.skipped}`
      : `${DIM}veriss (static, every width 320-1920px): ${report.static.status} in ${report.static.ms}ms, ${report.static.warnings.length} warning(s) read${report.static.images ? `, ${report.static.images} image size(s) from the files the page loaded` : ""}${
          Object.keys(report.static.unknown).length
            ? `; could not decide: ${Object.entries(report.static.unknown)
                .map(([c, n]) => `${c} x${n}`)
                .join(", ")}`
            : ""
        }${RESET}`,
    report.inert.widths.length
      ? `${DIM}inert declarations, judged at ${report.inert.widths.join(", ")}px: ${report.inert.candidates} candidate(s) from the context table, ${report.inert.confirmed} inert at every width where their rule matches and confirmed by removing them (every box and pixel unchanged)${report.inert.unstable.length ? `; at ${report.inert.unstable.join(", ")}px the page changed between captures, so nothing was confirmed there` : ""}${RESET}`
      : `${DIM}inert declarations: not judged — the page's width queries either use a value that is not a px / em / rem number (a calc(), a vw) or make more than 16 width regimes, so not every regime would be measured and no declaration is called inert across them. Pass --viewport to judge one width${RESET}`,
    "",
  ];
  if (shown.length === 0)
    lines.push(
      `${GREEN}ok${RESET} the browser kept every declaration, can evaluate every @media, no declaration the context table checks is inert${"skipped" in report.static ? "" : ", and veriss found nothing"}`,
    );
  for (const f of shown)
    lines.push(
      `${f.tier === "suspect" ? `${RED}x${RESET}` : f.tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`} [${f.rule}] ${f.message}`,
    );
  const fails = shown.filter((f) => f.tier === "suspect").length;
  const warns = shown.filter((f) => f.tier === "warn").length;
  lines.push("", `${fails} suspect, ${warns} warn, ${shown.length - fails - warns} info`);
  return lines.join("\n");
}
