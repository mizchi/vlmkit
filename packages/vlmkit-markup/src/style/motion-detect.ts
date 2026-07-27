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
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

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

export interface MotionDetectionOptions {
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

  const issues: MotionIssue[] = [];
  if (!hasReducedMotionRule && (activeAnimationSamples.length > 0 || activeTransitionSamples.length > 0)) {
    issues.push({
      kind: "missing-reduced-motion",
      severity: "suspect",
      message: "Active animation or transition declarations exist, but no `prefers-reduced-motion: reduce` rule was found.",
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
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    if (options.html !== undefined) {
      await page.setContent(options.html, { waitUntil: "networkidle" });
    } else if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.setContent(await readFile(resolve(options.source), "utf-8"), { waitUntil: "networkidle" });
    }

    const result = await page.evaluate((limit) => {
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
        return `${el.tagName.toLowerCase()}:nth-of-type(${nth})`;
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
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) continue;
          for (const rule of Array.from(rules)) cssText.push(rule.cssText || "");
        } catch {
          // Cross-origin stylesheet; skip.
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
      return { cssText: cssText.join("\n"), samples };
    }, maxSamples);

    await page.close();
    return analyzeMotionSamples({
      source: options.source,
      cssText: result.cssText,
      samples: result.samples,
    });
  } finally {
    await browser.close();
  }
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

function printUsage(exitCode: number): never {
  console.log("Usage: vlmkit check motion <html-or-url> [options]");
  console.log("Options:");
  console.log("  --json              Print JSON report");
  console.log("  --max-samples <n>   Max motion elements to sample (default: 100)");
  console.log("  --fail-on-suspect   Exit non-zero when suspect issues are found");
  process.exit(exitCode);
}

function parseArgs(argv: string[]) {
  let json = false;
  let failOnSuspect = false;
  let maxSamples = 100;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h" || arg === "help") printUsage(0);
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") failOnSuspect = true;
    else if (arg === "--max-samples") maxSamples = Number.parseInt(argv[++i] ?? "100", 10);
    else positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);
  return { source: positional[0]!, json, failOnSuspect, maxSamples };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  const report = await runMotionDetection({
    source: parsed.source,
    maxSamples: parsed.maxSamples,
  });
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatMotionDetectionReport(report));
  }
  if (parsed.failOnSuspect && report.issues.some((issue) => issue.severity === "suspect")) {
    process.exit(1);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "motion-detect" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
