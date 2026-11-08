/**
 * `vlmkit check mobile` (issue #219): what breaks on a phone that a narrow desktop window does
 * not show. The page is opened as a touch phone (`isMobile`, `hasTouch`, 390x844 by default),
 * so its viewport meta is honoured, and four things are measured:
 *
 * - the viewport meta: zoom turned off or capped below 200% (WCAG 1.4.4), or no meta at all;
 * - each carousel (a horizontal scroller whose items are at least half its width) is swiped by
 *   real touch events, and where it comes to rest is judged: on an item, or between two;
 * - each text field is focused and the software keyboard opened over the bottom 40% (the visual
 *   viewport shrinks and `resize` fires, as Chrome does by default; with
 *   `interactive-widget=resizes-content` the layout viewport shrinks instead), and a field the
 *   keyboard still covers once the page has answered is reported;
 * - with `viewport-fit=cover`, the safe-area insets of a notched phone are set
 *   (`Emulation.setSafeAreaInsetsOverride`) and text and controls under them are reported.
 *
 * The decisions are `@mizchi/vlmkit-judge/mobile.ts`; this file measures.
 */
import type { Page } from "playwright";
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  coversSafeArea,
  isCarousel,
  keyboardMode,
  overlapPx,
  parseViewportMeta,
  swipeLanding,
  zoomBlocked,
} from "@mizchi/vlmkit-judge/mobile.ts";
import { STYLE_SAMPLING_JS } from "../style/style-sampling.ts";

export interface MobileCheckOptions extends PageLoadOptions {
  source: string;
  /** The phone's CSS viewport. */
  device?: { width: number; height: number };
  /** The software keyboard's height, in CSS px (default 40% of the screen). */
  keyboardPx?: number;
  /** Safe-area insets set when the page draws under them (default a notched phone's, portrait). */
  insets?: { top: number; bottom: number; left: number; right: number };
  storageState?: string;
}

export type MobileRule =
  | "zoom-disabled"
  | "no-viewport-meta"
  | "swipe-unsnapped"
  | "keyboard-covers-input"
  | "safe-area-overlap";

export interface MobileFinding {
  rule: MobileRule;
  severity: "suspect" | "warn";
  selector?: string;
  message: string;
}

export interface MobileReport {
  source: string;
  device: { width: number; height: number };
  viewportMeta: string | null;
  carousels: { selector: string; items: number; landedAt: number; aligned: boolean }[];
  inputs: { selector: string; covered: boolean; bottom: number }[];
  /** Null: the page does not draw under the insets (no `viewport-fit=cover`), so none were set. */
  safeArea: { top: number; bottom: number; left: number; right: number; checked: number } | null;
  keyboard: { px: number; mode: string };
  findings: MobileFinding[];
}

export const DEFAULT_DEVICE = { width: 390, height: 844 };
/** An iPhone 14's portrait insets: the notch above, the home indicator below. */
export const DEFAULT_INSETS = { top: 47, bottom: 34, left: 0, right: 0 };
const MAX_CAROUSELS = 4;
const MAX_INPUTS = 6;

const settle = (page: Page, ms = 50) =>
  page.evaluate(
    (wait) =>
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(), wait)))),
    ms,
  );

/** Horizontal scrollers with their items, each tagged so it can be found again. */
const FIND_SCROLLERS = `(() => {
  ${STYLE_SAMPLING_JS}
  const out = [];
  let n = 0;
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowX)) continue;
    if (el.scrollWidth <= el.clientWidth + 8 || el.clientWidth < 100 || !visible(el)) continue;
    const items = [...el.children].filter((c) => visible(c)).map((c) => c.getBoundingClientRect().width);
    el.setAttribute("data-vlmkit-scroller", String(n++));
    out.push({ id: n - 1, selector: path(el), clientWidth: el.clientWidth, items });
  }
  return out;
})()`;

const TEXT_FIELDS = `(() => {
  ${STYLE_SAMPLING_JS}
  const kinds = /^(text|search|email|tel|url|password|number|)$/;
  const out = [];
  let n = 0;
  for (const el of document.querySelectorAll("input, textarea, [contenteditable=''], [contenteditable=true]")) {
    if (el.tagName === "INPUT" && !kinds.test((el.getAttribute("type") || "").toLowerCase())) continue;
    if (el.disabled || el.readOnly || !visible(el)) continue;
    el.setAttribute("data-vlmkit-field", String(n++));
    out.push({ id: n - 1, selector: path(el) });
  }
  return out;
})()`;

/** Text and controls on screen, with whether they are fixed to the screen (fixed or stuck). */
const ON_SCREEN = `(() => {
  ${STYLE_SAMPLING_JS}
  const screenFixed = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === "fixed" || p === "sticky") return true;
    }
    return false;
  };
  const out = [];
  const seen = new Set();
  const add = (el, r, what) => {
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight) return;
    const key = el;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ selector: path(el), what, top: r.top, bottom: r.bottom, left: r.left, right: r.right, fixed: screenFixed(el) });
  };
  for (const el of document.querySelectorAll("a[href], button, input, select, textarea, [role=button], [role=link]"))
    if (visible(el)) add(el, el.getBoundingClientRect(), "control");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim() || !t.parentElement || !visible(t.parentElement)) continue;
    if (t.parentElement.closest("a[href], button, [role=button], [role=link]")) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    add(t.parentElement, range.getBoundingClientRect(), "text");
  }
  return out;
})()`;

async function swipe(page: Page, selector: number) {
  const box = await page.evaluate((id) => {
    const el = document.querySelector(`[data-vlmkit-scroller="${id}"]`) as HTMLElement;
    el.scrollLeft = 0;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, selector);
  await settle(page, 100);
  const cdp = await page.context().newCDPSession(page);
  const y = box.y + box.h / 2;
  const from = box.x + box.w * 0.8;
  const distance = box.w * 0.6;
  const steps = 12;
  const point = (x: number) => [{ x, y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(from - (distance * i) / steps),
    });
    await page.waitForTimeout(16);
  }
  // Held before lifting, so the release carries no fling: where a finger stops is where a
  // carousel with nothing to snap it comes to rest.
  await page.waitForTimeout(100);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(700);
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-vlmkit-scroller="${id}"]`) as HTMLElement;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const left = r.left + el.clientLeft + parseFloat(cs.paddingLeft);
    return {
      scrollLeft: el.scrollLeft,
      maxScroll: el.scrollWidth - el.clientWidth,
      clientWidth: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      snapType: cs.scrollSnapType,
      items: [...el.children].map((c) => {
        const b = c.getBoundingClientRect();
        return { left: b.left - left, width: b.width };
      }),
    };
  }, selector);
}

/** Open the keyboard over the focused field and read where the field ends up. */
async function keyboardOver(
  page: Page,
  id: number,
  px: number,
  mode: string,
  device: { width: number; height: number },
) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate((i) => (document.querySelector(`[data-vlmkit-field="${i}"]`) as HTMLElement).focus(), id);
  if (mode === "resizes-content") await page.setViewportSize({ width: device.width, height: device.height - px });
  else
    await page.evaluate(
      (k) => {
        const vv = window.visualViewport;
        if (!vv) return;
        const full = window.innerHeight;
        Object.defineProperty(vv, "height", { configurable: true, get: () => full - k });
        vv.dispatchEvent(new Event("resize"));
      },
      mode === "overlays-content" ? 0 : px,
    );
  await settle(page, 100);
  // The browser scrolls a focused field into the part of the screen left over; a field in a
  // fixed or sticky bar does not move with the scroll, so it stays where the page put it.
  const read = await page.evaluate(
    ({ i, visibleBottom }) => {
      const el = document.querySelector(`[data-vlmkit-field="${i}"]`) as HTMLElement;
      let r = el.getBoundingClientRect();
      if (r.bottom > visibleBottom) {
        window.scrollBy(0, r.bottom - visibleBottom + 8);
        r = el.getBoundingClientRect();
      }
      return { top: r.top, bottom: r.bottom };
    },
    { i: id, visibleBottom: device.height - px },
  );
  await settle(page, 50);
  const after = await page.evaluate((i) => {
    const r = (document.querySelector(`[data-vlmkit-field="${i}"]`) as HTMLElement).getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  }, id);
  // Close the keyboard again for the next field.
  if (mode === "resizes-content") await page.setViewportSize(device);
  else
    await page.evaluate(() => {
      const vv = window.visualViewport as VisualViewport & { height: number };
      if (!vv) return;
      delete (vv as unknown as Record<string, unknown>).height;
      vv.dispatchEvent(new Event("resize"));
    });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await settle(page, 50);
  return { read, after };
}

export async function runMobileCheck(options: MobileCheckOptions): Promise<MobileReport> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { openSource } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { pickPageLoad } = await import("@mizchi/vlmkit-core/page-load.ts");
  const device = options.device ?? DEFAULT_DEVICE;
  const keyboardPx = options.keyboardPx ?? Math.round(device.height * 0.4);
  const insets = options.insets ?? DEFAULT_INSETS;
  const load = {
    ...pickPageLoad(options),
    ...(options.storageState ? { storageState: options.storageState } : {}),
    viewport: device,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  };
  return withBrowser(async (browser) => {
    const open = async () => (await openSource(browser, options.source, load)).page;
    const findings: MobileFinding[] = [];

    // 1. The viewport meta.
    const page = await open();
    const content = await page.evaluate(
      () => document.querySelector('meta[name="viewport" i]')?.getAttribute("content") ?? null,
    );
    const meta = parseViewportMeta(content);
    if (content === null)
      findings.push({
        rule: "no-viewport-meta",
        severity: "warn",
        message: `no <meta name="viewport">: a phone lays the page out 980px wide and shrinks it to fit — add <meta name="viewport" content="width=device-width, initial-scale=1">`,
      });
    const blocked = zoomBlocked(meta);
    if (blocked)
      findings.push({
        rule: "zoom-disabled",
        severity: "suspect",
        message: `the viewport meta ${blocked} (WCAG 1.4.4 Resize Text): drop user-scalable and maximum-scale — "${content}"`,
      });

    // 2. Carousels, swiped.
    const scrollers = (
      (await page.evaluate(FIND_SCROLLERS)) as { id: number; selector: string; clientWidth: number; items: number[] }[]
    ).filter((s) => isCarousel(s.clientWidth, s.items));
    const carousels: MobileReport["carousels"] = [];
    for (const s of scrollers.slice(0, MAX_CAROUSELS)) {
      const landed = await swipe(page, s.id);
      const verdict = swipeLanding(landed);
      carousels.push({
        selector: s.selector,
        items: s.items.length,
        landedAt: landed.scrollLeft,
        aligned: verdict.aligned,
      });
      if (landed.scrollLeft <= 2) continue; // it did not move under a finger: nothing to judge here
      if (!verdict.aligned)
        findings.push({
          rule: "swipe-unsnapped",
          severity: "suspect",
          selector: s.selector,
          message: `a swipe left ${s.selector} at ${Math.round(landed.scrollLeft)}px, ${Math.round(verdict.offBy)}px off the nearest slide${
            landed.snapType === "none"
              ? ": it has no scroll-snap-type — give it scroll-snap-type: x mandatory and its items scroll-snap-align: start"
              : ` although it declares scroll-snap-type: ${landed.snapType} — check its items' scroll-snap-align`
          }`,
        });
    }
    await page.close();

    // 3. The software keyboard over each text field.
    const kbPage = await open();
    const mode = keyboardMode(meta);
    const fields = ((await kbPage.evaluate(TEXT_FIELDS)) as { id: number; selector: string }[]).slice(0, MAX_INPUTS);
    const inputs: MobileReport["inputs"] = [];
    const visibleBottom = device.height - (mode === "overlays-content" ? 0 : keyboardPx);
    for (const f of fields) {
      const { after } = await keyboardOver(kbPage, f.id, keyboardPx, mode, device);
      const covered = after.bottom > visibleBottom + 1;
      inputs.push({ selector: f.selector, covered, bottom: after.bottom });
      if (covered)
        findings.push({
          rule: "keyboard-covers-input",
          severity: "suspect",
          selector: f.selector,
          message: `with the keyboard open (${keyboardPx}px, ${mode}), ${f.selector} stays at ${Math.round(after.top)}-${Math.round(after.bottom)}px, under the keyboard from ${visibleBottom}px: a field fixed to the bottom has to follow window.visualViewport (resize: bottom = innerHeight - visualViewport.height - visualViewport.offsetTop), or the page can ask for interactive-widget=resizes-content in its viewport meta`,
        });
    }
    await kbPage.close();

    // 4. The safe area, when the page draws under it.
    let safeArea: MobileReport["safeArea"] = null;
    if (coversSafeArea(meta)) {
      const saPage = await open();
      const cdp = await saPage.context().newCDPSession(saPage);
      await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets } as never);
      await settle(saPage, 100);
      const top = { top: 0, bottom: insets.top };
      const bottom = { top: device.height - insets.bottom, bottom: device.height };
      const hits = new Map<string, { what: string; band: string; px: number }>();
      let checked = 0;
      for (const at of ["top", "end"] as const) {
        await saPage.evaluate(
          (where) => window.scrollTo(0, where === "top" ? 0 : document.documentElement.scrollHeight),
          at,
        );
        await settle(saPage, 100);
        const boxes = (await saPage.evaluate(ON_SCREEN)) as {
          selector: string;
          what: string;
          top: number;
          bottom: number;
          fixed: boolean;
        }[];
        checked += boxes.length;
        for (const b of boxes) {
          // At the top of the page anything under the notch stays there; at the end anything
          // over the home indicator does. In between only what is fixed to the screen does.
          const bands: [string, { top: number; bottom: number }][] = [];
          if (at === "top" || b.fixed) bands.push(["notch (top)", top]);
          if (at === "end" || b.fixed) bands.push(["home indicator (bottom)", bottom]);
          for (const [band, range] of bands) {
            const px = overlapPx(b, range);
            if (px >= 2 && !hits.has(b.selector + band)) hits.set(b.selector + band, { what: b.what, band, px });
          }
        }
      }
      for (const [key, h] of hits) {
        const selector = key.slice(0, key.length - h.band.length);
        findings.push({
          rule: "safe-area-overlap",
          severity: "suspect",
          selector,
          message: `${h.what === "text" ? "text in" : "the control"} ${selector} runs ${Math.round(h.px)}px under the ${h.band} inset: with viewport-fit=cover, pad it by env(safe-area-inset-${h.band.startsWith("notch") ? "top" : "bottom"})`,
        });
      }
      await cdp.detach();
      await saPage.close();
      safeArea = { ...insets, checked };
    }

    return {
      source: options.source,
      device,
      viewportMeta: content,
      carousels,
      inputs,
      safeArea,
      keyboard: { px: keyboardPx, mode },
      findings,
    };
  });
}

/** The report as text; under rule settings an `off` rule's findings are not printed. */
export function formatMobileReport(report: MobileReport, rules?: RuleView): string {
  const shown = report.findings.flatMap((f) => {
    const tier = ruleTier(rules, f.rule, f.severity);
    return tier === "off" ? [] : [{ ...f, tier }];
  });
  const lines = [
    `${BOLD}${CYAN}vlmkit check mobile${RESET}`,
    `${DIM}source: ${report.source}${RESET}`,
    `${DIM}as a touch phone ${report.device.width}x${report.device.height}; viewport meta: ${report.viewportMeta === null ? "none" : `"${report.viewportMeta}"`}${RESET}`,
    `${DIM}carousels swiped: ${report.carousels.length}${report.carousels.length ? ` (${report.carousels.map((c) => `${c.selector} ${c.aligned ? "on a slide" : `at ${Math.round(c.landedAt)}px`}`).join(", ")})` : ""}; text fields under a ${report.keyboard.px}px keyboard (${report.keyboard.mode}): ${report.inputs.length}; safe area: ${report.safeArea ? `insets ${report.safeArea.top}/${report.safeArea.bottom}px, ${report.safeArea.checked} boxes` : "not drawn under (no viewport-fit=cover)"}${RESET}`,
    "",
  ];
  if (shown.length === 0) lines.push(`${GREEN}ok${RESET} nothing a phone breaks was found`);
  for (const f of shown)
    lines.push(`${f.tier === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`} [${f.rule}] ${f.message}`);
  const fails = shown.filter((f) => f.tier === "suspect").length;
  lines.push("", `${fails} suspect, ${shown.length - fails} warn`);
  return lines.join("\n");
}
