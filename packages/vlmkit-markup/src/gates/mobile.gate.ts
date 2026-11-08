/**
 * `check mobile` (issue #219): the page as a touch phone — zoom, swipes, the software keyboard
 * and the safe area. Measurement in `../inspect/mobile-check.ts`, decisions in
 * `@mizchi/vlmkit-judge/mobile.ts`.
 */
import { readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { firstPositional, viewportFlag } from "@mizchi/vlmkit-core/plugin/args.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import {
  DEFAULT_DEVICE,
  DEFAULT_INSETS,
  formatMobileReport,
  runMobileCheck,
  type MobileCheckOptions,
  type MobileReport,
} from "../inspect/mobile-check.ts";

export const mobileGate = defineGate<MobileReport, MobileCheckOptions>({
  id: "check.mobile",
  command: ["check", "mobile"],
  title: "Phone behaviour",
  summary:
    "As a touch phone: zoom allowed, carousels land on a slide, the keyboard leaves the field visible, nothing under the notch",
  category: "behavior",
  usage: `Opens the page as a touch phone (${DEFAULT_DEVICE.width}x${DEFAULT_DEVICE.height}, isMobile, hasTouch), so its viewport
meta is honoured. Then: the meta must not turn zoom off or cap it under 200% (WCAG 1.4.4);
each carousel (a horizontal scroller whose items are at least half its width) is swiped with
touch events and must come to rest on a slide; each text field is focused with the software
keyboard open over the bottom 40% (the visual viewport shrinks and fires resize, as Chrome
does; interactive-widget=resizes-content shrinks the layout instead) and must still be
visible once the page has answered; and with viewport-fit=cover, a notched phone's safe-area
insets (${DEFAULT_INSETS.top}px top, ${DEFAULT_INSETS.bottom}px bottom) are set and no text or control may sit under them.
Chromium's phone, not Safari's: iOS ignores user-scalable=no, and its keyboard and fixed
elements behave differently.`,
  rules: [
    {
      id: "zoom-disabled",
      title: "The viewport meta turns pinch-zoom off or caps it under 200%",
      severity: "suspect",
      docs: "WCAG 1.4.4. user-scalable=no / 0, or maximum-scale under 2.",
    },
    {
      id: "no-viewport-meta",
      title: "No viewport meta: a phone lays the page out 980px wide",
      severity: "warn",
    },
    {
      id: "swipe-unsnapped",
      title: "A swiped carousel comes to rest between two slides",
      severity: "suspect",
      docs: "Judged on scrollers whose items are each at least half its width; a row of chips scrolls freely.",
    },
    {
      id: "keyboard-covers-input",
      title: "With the software keyboard open, the focused text field is under it",
      severity: "suspect",
      docs: "Usually a composer fixed to the bottom that does not follow window.visualViewport.",
    },
    {
      id: "safe-area-overlap",
      title: "With viewport-fit=cover, text or a control sits under a safe-area inset",
      severity: "suspect",
      docs: "Pad it by env(safe-area-inset-*). Only pages that ask for viewport-fit=cover are drawn there.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to check",
      positional: 0,
      required: true,
    },
    {
      name: "device",
      placeholder: "WxH",
      kind: "string",
      description: "The phone's CSS viewport",
      defaultDescription: `${DEFAULT_DEVICE.width}x${DEFAULT_DEVICE.height}`,
    },
    {
      name: "keyboard",
      placeholder: "px",
      kind: "number",
      description: "Software keyboard height in CSS px",
      defaultDescription: "40% of the device height",
    },
    {
      name: "insets",
      placeholder: "top,bottom[,left,right]",
      kind: "string",
      description: "Safe-area insets in CSS px",
      defaultDescription: `${DEFAULT_INSETS.top},${DEFAULT_INSETS.bottom}`,
    },
    {
      name: "storage-state",
      placeholder: "file",
      kind: "path",
      description: "Playwright storage state for pages behind a login",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check mobile <html-or-url>", [
      "--device",
      "--keyboard",
      "--insets",
      "--storage-state",
    ]);
    const device = viewportFlag(argv, "device");
    const keyboardPx = readNumber(argv, "keyboard");
    if (keyboardPx !== undefined && !(keyboardPx >= 0))
      throw new UsageError(`--keyboard takes a height in px, got ${keyboardPx}`);
    const rawInsets = readFlag(argv, "insets");
    let insets: MobileCheckOptions["insets"];
    if (rawInsets !== undefined) {
      const n = rawInsets.split(",").map((v) => Number(v.trim()));
      if (n.length < 2 || n.length > 4 || n.some((v) => !(v >= 0)))
        throw new UsageError(`--insets takes top,bottom[,left,right] in px, e.g. 47,34; got ${rawInsets}`);
      insets = { top: n[0]!, bottom: n[1]!, left: n[2] ?? 0, right: n[3] ?? 0 };
    }
    const storageState = readFlag(argv, "storage-state");
    return {
      source,
      ...(device ? { device } : {}),
      ...(keyboardPx !== undefined ? { keyboardPx } : {}),
      ...(insets ? { insets } : {}),
      ...(storageState ? { storageState } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runMobileCheck(options),
  findings: (report): Finding[] =>
    report.findings.map((f) => ({
      rule: f.rule,
      severity: f.severity,
      message: f.message,
      ...(f.selector ? { selector: f.selector } : {}),
    })),
  format: formatMobileReport,
  headline: (report) =>
    `${report.findings.length} finding(s): ${report.carousels.length} carousel(s), ${report.inputs.length} field(s), safe area ${report.safeArea ? "checked" : "not drawn under"}`,
  ledger: (report, options) => ({
    tool: "check-mobile",
    source: options.source,
    headline: {
      findings: report.findings.length,
      carousels: report.carousels.length,
      inputs: report.inputs.length,
      safeArea: report.safeArea !== null,
    },
  }),
});
