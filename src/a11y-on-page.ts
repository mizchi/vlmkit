/**
 * Run the existing a11y checks (contrast + touch-target) on a
 * Playwright `Page` the caller already owns, without launching a
 * separate browser. Used by `vrt diff-pr` to fold a11y into its
 * per-route CI gate.
 *
 * The sample scripts and post-processors live in the existing
 * `a11y-contrast.ts` / `a11y-touch.ts` modules; this is glue.
 */

import type { Page } from "playwright";
import {
  A11Y_CONTRAST_SAMPLE_SCRIPT,
  analyzeA11yContrastSamples,
  type A11yContrastRawSample,
  type ContrastFinding,
} from "./a11y-contrast.ts";
import {
  A11Y_TOUCH_SAMPLE_SCRIPT,
  analyzeA11yTouchSamples,
  type A11yTouchRawSample,
  type TouchTargetFinding,
  type WcagTouchLevel,
} from "./a11y-touch.ts";

export interface OnPageA11yOptions {
  minTextLength?: number;
  touchLevel?: WcagTouchLevel;
  /**
   * Which checks to run. Omit any to skip — useful for routes where
   * (e.g.) touch-target sizing is irrelevant on a desktop-only viewport.
   */
  contrast?: boolean;
  touch?: boolean;
}

export interface OnPageA11yResult {
  contrastFailures: ContrastFinding[];
  touchFailures: TouchTargetFinding[];
}

const NEUTRALIZE_ANIMATIONS = `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
}`;

export async function runA11yOnPage(
  page: Page,
  options: OnPageA11yOptions = {},
): Promise<OnPageA11yResult> {
  const runContrast = options.contrast ?? true;
  const runTouch = options.touch ?? true;
  const minLen = options.minTextLength ?? 1;
  const touchLevel: WcagTouchLevel = options.touchLevel ?? "AA";

  // Neutralize transitions/animations so the sampled colors and
  // bounding boxes reflect the static rest state. Idempotent — the
  // caller may have done this already.
  try {
    await page.addStyleTag({ content: NEUTRALIZE_ANIMATIONS });
  } catch {
    // If the page is in a context that disallows addStyleTag (rare),
    // skip — the checks still work, just with potentially noisy
    // mid-animation samples.
  }

  let contrastFailures: ContrastFinding[] = [];
  let touchFailures: TouchTargetFinding[] = [];

  if (runContrast) {
    const samples = await page.evaluate(
      `(${A11Y_CONTRAST_SAMPLE_SCRIPT})(${minLen})`,
    ) as A11yContrastRawSample[];
    contrastFailures = analyzeA11yContrastSamples(samples);
  }
  if (runTouch) {
    const samples = await page.evaluate(A11Y_TOUCH_SAMPLE_SCRIPT) as A11yTouchRawSample[];
    touchFailures = analyzeA11yTouchSamples(samples, touchLevel);
  }
  return { contrastFailures, touchFailures };
}
