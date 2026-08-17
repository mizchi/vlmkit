/**
 * VRT Mask -- hide specific selectors before screenshotting.
 *
 * Uses visibility: hidden to preserve layout while hiding rendering.
 * Prevents false positives from dynamic content (counters, animations, ads).
 */
import type { Page } from "playwright";

/** What `applyMask` could and could not do, for the caller to report. */
export interface MaskResult {
  /** Selectors that matched at least one element and are now hidden. */
  applied: string[];
  /**
   * Selectors that are not valid CSS. They mask nothing, and before this they also
   * took their neighbours down with them — see `applyMask`.
   */
  invalid: string[];
  /**
   * Valid, but matched no element on this page. Almost always a typo, and the mask is a
   * silent no-op: the region the caller meant to exclude stays in the diff. Not fatal,
   * because a mask may legitimately target a region that only exists on some pages or
   * viewports, so this is for the caller to report rather than to fail on.
   */
  unmatched: string[];
}

/**
 * Inject mask styles into the page.
 * Sets visibility: hidden on target selectors including descendants.
 *
 * **One style tag per selector, not one for all of them.** The joined form was
 * `sel { visibility: hidden !important; }` per line in a single `addStyleTag`, and CSS
 * error recovery on a malformed selector consumes until it can resynchronize — which
 * takes the *following* rules with it. Measured with `[".a", ".b:not(", ".c"]`: the
 * browser kept exactly one rule, `.a`, and `.b` AND `.c` were both left visible. So a
 * single stray paren — the kind a shell quote produces — silently disabled every mask
 * after it while the CLI printed all three as applied.
 *
 * The harm runs the other way from most of this file's bugs: an unmasked dynamic region
 * makes the diff fail, which is loud. It becomes quiet when the operator responds by
 * raising the threshold to compensate, and that hides real regressions.
 *
 * Selectors are validated in the page rather than parsed here: `querySelectorAll` throws
 * on exactly the thing we need to detect, and it is the same engine that will apply the
 * CSS.
 */
export async function applyMask(page: Page, selectors: string[]): Promise<MaskResult> {
  const result: MaskResult = { applied: [], invalid: [], unmatched: [] };
  if (selectors.length === 0) return result;

  const counts = await page.evaluate((list: string[]) =>
    list.map((s) => {
      try {
        return document.querySelectorAll(s).length;
      } catch {
        return -1; // not valid CSS
      }
    }), selectors);

  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i]!;
    const count = counts[i] ?? -1;
    if (count < 0) {
      result.invalid.push(selector);
      continue;
    }
    if (count === 0) result.unmatched.push(selector);
    else result.applied.push(selector);
    // Injected even when it matched nothing: a valid selector that matches nothing is
    // harmless, and an element appearing later (a lazily-mounted carousel) is then still
    // covered. Only invalid selectors are withheld, because they are what breaks parsing.
    await page.addStyleTag({ content: `${selector} { visibility: hidden !important; }` });
  }
  return result;
}

/**
 * Accumulates mask outcomes across a run so the report is per-run, not per-page.
 *
 * Every caller applies masks inside a loop over pages × viewports, so reporting each
 * result where it happens would print the same problem dozens of times. The two states
 * also need different treatment:
 *
 *   - invalid CSS is page-independent, so it is said once and is a user error to fix;
 *   - "matched nothing" is page-dependent — a mask may legitimately target a region that
 *     exists on one route only — so it is worth reporting only for a selector that
 *     matched nothing *anywhere*, which is not knowable until the run ends.
 */
export class MaskTally {
  private readonly invalid = new Set<string>();
  private readonly everMatched = new Set<string>();
  private readonly everTried = new Set<string>();

  add(result: MaskResult): void {
    for (const s of result.invalid) this.invalid.add(s);
    for (const s of result.applied) {
      this.everMatched.add(s);
      this.everTried.add(s);
    }
    for (const s of result.unmatched) this.everTried.add(s);
  }

  /** Invalid selectors not yet reported, so a caller can say them once. */
  takeNewInvalid(): string[] {
    const fresh = [...this.invalid].filter((s) => !this.reportedInvalid.has(s));
    for (const s of fresh) this.reportedInvalid.add(s);
    return fresh;
  }
  private readonly reportedInvalid = new Set<string>();

  /** Selectors that were valid everywhere and matched nothing anywhere. */
  neverMatched(): string[] {
    return [...this.everTried].filter((s) => !this.everMatched.has(s));
  }
}

/**
 * One line naming what a mask could not do, or `null` when every selector applied.
 *
 * Shared so the call sites word it the same way; each of them already prints a
 * `Mask: <selectors>` line, which was a claim about state that a malformed selector made
 * false.
 */
export function formatMaskProblems(invalid: string[], neverMatched: string[]): string | null {
  const parts: string[] = [];
  if (invalid.length > 0) {
    parts.push(`invalid CSS, masking nothing: ${invalid.join(", ")}`);
  }
  if (neverMatched.length > 0) {
    parts.push(`matched no element on any page: ${neverMatched.join(", ")}`);
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

/**
 * Parse selector array from CLI --mask flags.
 * Supports comma-separated or multiple --mask flags.
 *
 * --mask ".stars,.carousel"
 * --mask ".stars" --mask ".carousel"
 */
export function parseMaskSelectors(args: string[]): string[] {
  const selectors: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mask" && args[i + 1]) {
      for (const s of args[i + 1].split(",")) {
        const trimmed = s.trim();
        if (trimmed) selectors.push(trimmed);
      }
    }
  }
  return selectors;
}
