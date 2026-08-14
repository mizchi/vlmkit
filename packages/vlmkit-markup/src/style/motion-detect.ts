#!/usr/bin/env node
/**
 * CSS motion detector.
 *
 * This does not judge animation correctness frame-by-frame. It samples
 * CSSOM motion declarations and reports whether active animations /
 * transitions exist, whether animations are running or paused, and
 * whether author CSS declares a reduced-motion fallback.
 *
 * For rendered-frame evaluation (visible effect, motion bbox, settle
 * time, behavioral reduced-motion parity) use `vlmkit check animation`
 * (./animation-eval.ts).
 *
 * Usage:
 *   vlmkit check motion <html-or-url>
 *   vlmkit check motion <html-or-url> --json
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { type PageLoadOptions, navigatePage, navigationOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export interface MotionComputedSample {
  selector: string;
  tagName: string;
  animationName: string;
  animationDuration: string;
  animationDelay: string;
  animationPlayState: string;
  transitionProperty: string;
  transitionDuration: string;
  transitionDelay: string;
}

export type MotionIssueKind =
  | "missing-reduced-motion"
  | "unreadable-stylesheet"
  | "running-animation";

export interface MotionIssue {
  kind: MotionIssueKind;
  severity: "warn" | "suspect";
  message: string;
  selector?: string;
}

export interface MotionDetectionInput {
  source: string;
  cssText: string;
  /**
   * Stylesheets that could not be read at all, by the page or by the caller.
   * Non-empty means "no rule found" is not a claim this gate is entitled to make.
   */
  unreadableStylesheets?: string[];
  samples: MotionComputedSample[];
}

export interface MotionDetectionReport {
  source: string;
  hasReducedMotionRule: boolean;
  sampleCount: number;
  activeAnimationCount: number;
  activeTransitionCount: number;
  runningAnimationCount: number;
  pausedAnimationCount: number;
  samples: MotionComputedSample[];
  issues: MotionIssue[];
}

export interface MotionDetectionOptions extends PageLoadOptions {
  source: string;
  html?: string;
  maxSamples?: number;
  viewport?: { width: number; height: number };
}

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

function cssTimeToMs(value: string): number {
  const v = value.trim().toLowerCase();
  if (!v) return 0;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  if (v.endsWith("ms")) return n;
  if (v.endsWith("s")) return n * 1000;
  return 0;
}

export function parseCssTimeList(value: string): number[] {
  return value.split(",").map(cssTimeToMs);
}

function maxCssTime(value: string): number {
  return Math.max(0, ...parseCssTimeList(value));
}

function hasActiveAnimation(sample: MotionComputedSample): boolean {
  return sample.animationName.trim() !== "none" &&
    sample.animationName.trim() !== "" &&
    maxCssTime(sample.animationDuration) > 0;
}

function hasActiveTransition(sample: MotionComputedSample): boolean {
  return sample.transitionProperty.trim() !== "none" &&
    sample.transitionProperty.trim() !== "" &&
    maxCssTime(sample.transitionDuration) > 0;
}

export function analyzeMotionSamples(input: MotionDetectionInput): MotionDetectionReport {
  const hasReducedMotionRule = /@media[^{]*prefers-reduced-motion[^{]*reduce/i.test(input.cssText);
  const activeAnimationSamples = input.samples.filter(hasActiveAnimation);
  const activeTransitionSamples = input.samples.filter(hasActiveTransition);
  const runningAnimationSamples = activeAnimationSamples.filter((sample) =>
    sample.animationPlayState.split(",").some((state) => state.trim() === "running")
  );
  const pausedAnimationSamples = activeAnimationSamples.filter((sample) =>
    sample.animationPlayState.split(",").some((state) => state.trim() === "paused")
  );

  const unreadable = input.unreadableStylesheets ?? [];
  const issues: MotionIssue[] = [];
  if (!hasReducedMotionRule && (activeAnimationSamples.length > 0 || activeTransitionSamples.length > 0)) {
    // With an unread stylesheet in the page, absence of the rule is unproven. Say
    // that instead of asserting it: `check animation` reads the *behaviour* under
    // emulation and does not depend on CSS text, so a dogfood run got
    // `missing-reduced-motion` from here and `reduced-motion: honored` from there
    // on one file, with no way to tell which to trust.
    issues.push(unreadable.length === 0
      ? {
        kind: "missing-reduced-motion",
        severity: "suspect",
        message: "Active animation or transition declarations exist, but no `prefers-reduced-motion: reduce` rule was found.",
      }
      : {
        kind: "unreadable-stylesheet",
        severity: "warn",
        message: `Active animation or transition declarations exist and no \`prefers-reduced-motion: reduce\` rule was found`
          + ` in the CSS this gate could read — but ${unreadable.length} stylesheet(s) could not be read`
          + ` (${unreadable.slice(0, 3).join(", ")}), so the rule may be in one of them.`
          + ` \`check animation\` measures the behaviour under emulation instead and does not depend on CSS text.`,
      });
  }

  for (const sample of runningAnimationSamples.slice(0, 10)) {
    issues.push({
      kind: "running-animation",
      severity: "warn",
      selector: sample.selector,
      message: `${sample.selector} has running animation \`${sample.animationName}\` (${sample.animationDuration}).`,
    });
  }

  return {
    source: input.source,
    hasReducedMotionRule,
    sampleCount: input.samples.length,
    activeAnimationCount: activeAnimationSamples.length,
    activeTransitionCount: activeTransitionSamples.length,
    runningAnimationCount: runningAnimationSamples.length,
    pausedAnimationCount: pausedAnimationSamples.length,
    samples: input.samples,
    issues,
  };
}

export async function runMotionDetection(
  options: MotionDetectionOptions,
): Promise<MotionDetectionReport> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const maxSamples = options.maxSamples ?? 100;
  return await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    if (options.html !== undefined) {
      await page.setContent(options.html, navigationOptions(options));
    } else {
      // file: URL navigation so relative stylesheets resolve — setContent
      // gives the document an about:blank base URL (same fix as the other
      // page-loading checks).
      const url = isUrl(options.source) ? options.source : pathToFileURL(resolve(options.source)).href;
      await navigatePage(page, url, options);
    }

    const result = await page.evaluate((limit) => {
      // The one copy of `stableSelector` that is not `STABLE_SELECTOR_JS`, because this
      // gate passes a real typed arrow to `page.evaluate` rather than assembling a script
      // string. It must agree with the shared one, and `selector-uniqueness.test.ts` is
      // what holds it there — it asserts the property on this gate's output, not on source.
      function stableSelector(el: Element): string {
        const id = el.getAttribute("id");
        if (id) return `#${CSS.escape(id)}`;
        const className = Array.from(el.classList).slice(0, 3).map((c) => `.${CSS.escape(c)}`).join("");
        if (className) {
          const classSelector = `${el.tagName.toLowerCase()}${className}`;
          if (document.querySelectorAll(classSelector).length === 1) return classSelector;
        }
        const parent = el.parentElement;
        if (!parent) return el.tagName.toLowerCase();
        const siblings = Array.from(parent.children).filter((item) => item.tagName === el.tagName);
        const nth = siblings.indexOf(el) + 1;
        // The recursive prefix. Without it this returned `p:nth-of-type(1)` — the first
        // `<p>` of every parent on the page — so a finding named nothing in particular.
        return `${stableSelector(parent)} > ${el.tagName.toLowerCase()}:nth-of-type(${nth})`;
      }

      function cssTimeToMsInPage(value: string): number {
        const v = value.trim().toLowerCase();
        if (!v) return 0;
        const n = Number.parseFloat(v);
        if (!Number.isFinite(n)) return 0;
        if (v.endsWith("ms")) return n;
        if (v.endsWith("s")) return n * 1000;
        return 0;
      }

      function maxTimeInPage(value: string): number {
        return Math.max(0, ...value.split(",").map(cssTimeToMsInPage));
      }

      const cssText: string[] = [];
      const unreadable: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) continue;
          for (const rule of Array.from(rules)) cssText.push(rule.cssText || "");
        } catch {
          // NOT merely "cross-origin; skip". Reading `cssRules` of a linked
          // stylesheet throws `SecurityError` for a `file://` document too, because
          // Chromium gives every file an opaque origin — so on the most common way
          // this gate is invoked, a local HTML file, every linked sheet lands here.
          // Swallowing it and then reporting "no `prefers-reduced-motion` rule was
          // found" asserts something the page never got to look at. The href goes
          // back to the caller, which reads it another way.
          if (sheet.href) unreadable.push(sheet.href);
        }
      }

      const samples: MotionComputedSample[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const style = getComputedStyle(el);
        const sample: MotionComputedSample = {
          selector: stableSelector(el),
          tagName: el.tagName,
          animationName: style.animationName,
          animationDuration: style.animationDuration,
          animationDelay: style.animationDelay,
          animationPlayState: style.animationPlayState,
          transitionProperty: style.transitionProperty,
          transitionDuration: style.transitionDuration,
          transitionDelay: style.transitionDelay,
        };
        const hasAnimation = sample.animationName.trim() !== "none" &&
          maxTimeInPage(sample.animationDuration) > 0;
        const hasTransition = sample.transitionProperty.trim() !== "none" &&
          maxTimeInPage(sample.transitionDuration) > 0;
        if (hasAnimation || hasTransition) samples.push(sample);
        if (samples.length >= limit) break;
      }
      return { cssText: cssText.join("\n"), unreadable, samples };
    }, maxSamples);

    // Fetch what the page was not allowed to read. `page.request` is the browser
    // context's own client, so it is not bound by the document's opaque origin;
    // a `file:` URL is read from disk, which `fetch()` inside the page cannot do
    // either.
    const recovered: string[] = [];
    const stillUnreadable: string[] = [];
    for (const href of result.unreadable) {
      try {
        if (href.startsWith("file://")) {
          recovered.push(await readFile(fileURLToPath(href), "utf8"));
        } else {
          const response = await page.request.get(href);
          if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
          recovered.push(await response.text());
        }
      } catch {
        stillUnreadable.push(href);
      }
    }
    await page.close();
    return analyzeMotionSamples({
      source: options.source,
      cssText: [result.cssText, ...recovered].join("\n"),
      unreadableStylesheets: stillUnreadable,
      samples: result.samples,
    });
  });
}

export function formatMotionDetectionReport(report: MotionDetectionReport): string {
  const lines: string[] = [];
  const status = report.issues.some((issue) => issue.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit check motion${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(`samples: ${report.sampleCount}`);
  lines.push(`active animations: ${report.activeAnimationCount}`);
  lines.push(`active transitions: ${report.activeTransitionCount}`);
  lines.push(`running animations: ${report.runningAnimationCount}`);
  lines.push(`paused animations: ${report.pausedAnimationCount}`);
  lines.push(`reduced-motion rule: ${report.hasReducedMotionRule ? "yes" : "no"}`);
  if (report.samples.length > 0) {
    lines.push("");
    lines.push("Motion samples:");
    for (const sample of report.samples.slice(0, 20)) {
      lines.push(
        `  - ${sample.selector}: animation=${sample.animationName} ${sample.animationDuration} ${sample.animationPlayState}; transition=${sample.transitionProperty} ${sample.transitionDuration}`,
      );
    }
  }
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      const selector = issue.selector ? ` ${issue.selector}` : "";
      lines.push(`  ${icon} ${issue.kind}${selector}: ${issue.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No motion issues detected.${RESET}`);
  }
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check motion` is declared in `../gates/motion.gate.ts` and driven by the core
 * runner (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument
 * parsing, `--json`, `--advisory`, the run ledger and the exit code.
 */
