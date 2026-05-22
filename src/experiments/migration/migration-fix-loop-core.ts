import { basename } from "node:path";
import {
  extractCss,
  parseCssDeclarations,
  replaceCss,
} from "../css-challenge/css-challenge-core.ts";
import type { MigrationDiffCategory } from "./migration-diff.ts";
import type { MigrationFixCandidate } from "./migration-fix-candidates.ts";
import { isPlaywrightSandboxRestrictionError } from "@mizchi/vlmkit-capture/playwright-launch-error.ts";
import type { ViewportSpec } from "@mizchi/vlmkit-capture/viewport-discovery.ts";

export interface MigrationCompareReportResult {
  variant: string;
  variantFile?: string;
  viewport: string;
  diffRatio: number;
  diffPixels: number;
  approved?: boolean;
  partiallyApproved?: boolean;
  dominantCategory: MigrationDiffCategory | "none";
  categorySummary: string;
  paintTreeSummary: string;
  paintTreeChangeCount: number;
  fixCandidates: MigrationFixCandidate[];
}

export interface MigrationCompareReport {
  dir?: string;
  baseline: string;
  variants: string[];
  viewports: ViewportSpec[];
  approvalPath?: string;
  strict?: boolean;
  paintTree?: {
    enabled: boolean;
    available: boolean;
    url?: string;
    error?: string;
  };
  results: MigrationCompareReportResult[];
}

export interface MigrationFix {
  selector: string;
  property: string;
  value: string;
  mediaCondition: string | null;
}

export interface SelectedMigrationFixTarget extends MigrationCompareReportResult {
  variantFile: string;
  viewportWidth: number;
}

export type MigrationConvergenceStatus = "clean" | "approved" | "remaining";

export interface MigrationVariantConvergence {
  variant: string;
  totalResults: number;
  cleanResults: number;
  approvedResults: number;
  remainingResults: number;
  status: MigrationConvergenceStatus;
}

export interface MigrationReportConvergence {
  totalResults: number;
  cleanResults: number;
  approvedResults: number;
  remainingResults: number;
  status: MigrationConvergenceStatus;
  variants: MigrationVariantConvergence[];
}

export function selectMigrationFixTarget(
  report: MigrationCompareReport,
  options: { variant?: string } = {},
): SelectedMigrationFixTarget | null {
  const filtered = report.results
    .filter((result) => result.diffPixels > 0)
    .filter((result) => !options.variant || result.variant === options.variant || result.variantFile === options.variant)
    .sort((left, right) => {
      if (right.diffPixels !== left.diffPixels) return right.diffPixels - left.diffPixels;
      if (right.paintTreeChangeCount !== left.paintTreeChangeCount) {
        return right.paintTreeChangeCount - left.paintTreeChangeCount;
      }
      if (right.fixCandidates.length !== left.fixCandidates.length) {
        return right.fixCandidates.length - left.fixCandidates.length;
      }
      return right.diffRatio - left.diffRatio;
    });

  const target = filtered[0];
  if (!target) return null;
  return {
    ...target,
    variantFile: resolveVariantFile(report, target),
    viewportWidth: report.viewports.find((viewport) => viewport.label === target.viewport)?.width ?? 0,
  };
}

export function summarizeMigrationReportConvergence(
  report: MigrationCompareReport,
): MigrationReportConvergence {
  const variants = [...new Set(report.results.map((result) => result.variant))]
    .map((variant) => summarizeMigrationVariantConvergence(
      variant,
      report.results.filter((result) => result.variant === variant),
    ));

  const cleanResults = variants.reduce((sum, variant) => sum + variant.cleanResults, 0);
  const approvedResults = variants.reduce((sum, variant) => sum + variant.approvedResults, 0);
  const remainingResults = variants.reduce((sum, variant) => sum + variant.remainingResults, 0);

  return {
    totalResults: report.results.length,
    cleanResults,
    approvedResults,
    remainingResults,
    status: summarizeConvergenceStatus(cleanResults, approvedResults, remainingResults),
    variants,
  };
}

export function buildMigrationFixLoopPrompt(input: {
  baselineFile: string;
  variantFile: string;
  target: SelectedMigrationFixTarget;
  currentCss: string;
}): string {
  const candidateLines = input.target.fixCandidates.length === 0
    ? ["(no heuristic candidates)"]
    : input.target.fixCandidates.slice(0, 5).map((candidate, index) => {
      const mediaSuffix = candidate.mediaCondition ? ` @media ${candidate.mediaCondition}` : "";
      return `${index + 1}. ${candidate.selector} { ${candidate.property}: ${candidate.value}; }${mediaSuffix} [score=${candidate.score}; ${candidate.reasoning}]`;
    });

  return `You are fixing a CSS migration regression.

Baseline file: ${input.baselineFile}
Current file: ${input.variantFile}
Viewport: ${input.target.viewport} (${input.target.viewportWidth}px)
Diff ratio: ${(input.target.diffRatio * 100).toFixed(2)}%
Diff pixels: ${input.target.diffPixels}
Dominant category: ${input.target.dominantCategory}
Category summary: ${input.target.categorySummary}
Paint tree summary: ${input.target.paintTreeSummary}

Top fix candidates:
${candidateLines.join("\n")}

Current CSS:
\`\`\`css
${input.currentCss}
\`\`\`

Task:
Return exactly one CSS declaration change for the current stylesheet that is most likely to reduce this regression.
Prefer one of the candidate selectors/properties when possible.
If the fix should apply only inside a media query, return the matching media condition.

Respond in this EXACT format:
SELECTOR: <css selector>
PROPERTY: <css property>
VALUE: <css value>
MEDIA: <media condition or none>`;
}

export function parseMigrationFixResponse(response: string): MigrationFix | null {
  const selectorMatch = response.match(/SELECTOR:\s*(.+)/);
  const propertyMatch = response.match(/PROPERTY:\s*(.+)/);
  const valueMatch = response.match(/VALUE:\s*(.+)/);
  if (!selectorMatch || !propertyMatch || !valueMatch) return null;
  const mediaMatch = response.match(/MEDIA:\s*(.+)/);
  const mediaValue = mediaMatch?.[1]?.trim() ?? "none";
  return {
    selector: selectorMatch[1].trim(),
    property: propertyMatch[1].trim(),
    value: valueMatch[1].trim(),
    mediaCondition: mediaValue === "none" ? null : mediaValue,
  };
}

/**
 * Multi-fix prompt for `migration-fix-loop --max-fixes N`. Same context as
 * the single-fix prompt but asks for up to N JSON-shaped fix proposals,
 * which lets the LLM emit every high-confidence universal pair the diff
 * report surfaced rather than one declaration per round-trip.
 */
export function buildMigrationFixLoopMultiPrompt(input: {
  baselineFile: string;
  variantFile: string;
  target: SelectedMigrationFixTarget;
  currentCss: string;
  maxFixes: number;
}): string {
  const candidateLines = input.target.fixCandidates.length === 0
    ? ["(no heuristic candidates)"]
    : input.target.fixCandidates.slice(0, 12).map((candidate, index) => {
      const mediaSuffix = candidate.mediaCondition ? ` @media ${candidate.mediaCondition}` : "";
      return `${index + 1}. ${candidate.selector} { ${candidate.property}: ${candidate.value}; }${mediaSuffix} [score=${candidate.score}; ${candidate.reasoning}]`;
    });

  return `You are fixing a CSS migration regression.

Baseline file: ${input.baselineFile}
Current file: ${input.variantFile}
Viewport: ${input.target.viewport} (${input.target.viewportWidth}px)
Diff ratio: ${(input.target.diffRatio * 100).toFixed(2)}%
Diff pixels: ${input.target.diffPixels}
Dominant category: ${input.target.dominantCategory}
Category summary: ${input.target.categorySummary}
Paint tree summary: ${input.target.paintTreeSummary}

Top fix candidates:
${candidateLines.join("\n")}

Current CSS:
\`\`\`css
${input.currentCss}
\`\`\`

Task:
Return up to ${input.maxFixes} high-confidence CSS declaration changes that together would reduce this regression. Prefer authoritative universal pairs (every-viewport differences) and explicit color tokens over sub-pixel widths. Skip any candidate whose computed-style value already matches the baseline.

Viewport gating (CRITICAL):
- The target viewport above (\`${input.target.viewport}\`, ${input.target.viewportWidth}px) is the WORST viewport — the other viewports may render correctly.
- If a fix is only meaningful at \`${input.target.viewport}\` (e.g. a layout change for ${input.target.viewportWidth <= 600 ? "mobile" : input.target.viewportWidth <= 1100 ? "desktop" : "wide"} only), wrap it in an appropriate media condition.
- Use \`"mediaCondition": "(max-width: 700px)"\` for mobile-only, \`"(min-width: 980px)"\` for desktop, \`"(min-width: 1200px)"\` for wide. Use \`null\` ONLY for true universal pairs that should apply everywhere.
- A base-CSS change that fixes mobile but breaks desktop is worse than no change.

Output VALID JSON with this exact shape — no prose, no markdown fences:
{
  "fixes": [
    { "selector": "<css selector>", "property": "<css property>", "value": "<css value>", "mediaCondition": null | "<media condition>" }
  ]
}`;
}

export function parseMigrationFixMultiResponse(response: string): MigrationFix[] {
  const stripped = response.replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/, "$1");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const fixesRaw = (parsed as { fixes?: unknown }).fixes;
  if (!Array.isArray(fixesRaw)) return [];
  const fixes: MigrationFix[] = [];
  for (const entry of fixesRaw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const selector = typeof item.selector === "string" ? item.selector.trim() : "";
    const property = typeof item.property === "string" ? item.property.trim() : "";
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (!selector || !property || !value) continue;
    let mediaCondition: string | null = null;
    const rawMedia = item.mediaCondition;
    if (typeof rawMedia === "string") {
      const trimmed = rawMedia.trim();
      mediaCondition = (trimmed === "" || trimmed.toLowerCase() === "none") ? null : trimmed;
    }
    fixes.push({ selector, property, value, mediaCondition });
  }
  return fixes;
}

export function resolveMigrationFixFromBaselineHtml(
  baselineHtml: string,
  candidate: Pick<MigrationFixCandidate, "selector" | "property" | "mediaCondition">,
): MigrationFix | null {
  const css = extractCss(baselineHtml);
  if (!css) return null;
  const declaration = parseCssDeclarations(css).find((entry) =>
    entry.selector === candidate.selector
    && entry.property === candidate.property
    && entry.mediaCondition === candidate.mediaCondition
  );
  if (!declaration) return null;
  return {
    selector: declaration.selector,
    property: declaration.property,
    value: declaration.value,
    mediaCondition: declaration.mediaCondition,
  };
}

export interface ApplyMigrationFixOptions {
  /**
   * When true, append a brand-new declaration block (or `@media` wrapper)
   * if the (selector, mediaCondition) pair is not already in the stylesheet.
   * Used by the multi-fix path where the LLM may legitimately propose
   * media-gated fixes for which no existing block exists yet.
   */
  appendIfMissing?: boolean;
}

export function applyMigrationFixToHtml(
  html: string,
  fix: MigrationFix,
  options: ApplyMigrationFixOptions = {},
): string {
  const css = extractCss(html);
  if (!css) return html;
  const nextCss = applyMigrationFixToCss(css, fix, options);
  return nextCss === css ? html : replaceCss(html, css, nextCss);
}

export function applyMigrationFixToCss(
  css: string,
  fix: MigrationFix,
  options: ApplyMigrationFixOptions = {},
): string {
  const lines = css.split("\n");
  let currentMedia: string | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    const mediaMatch = trimmed.match(/^@media\s+(.+?)\s*\{$/);
    if (mediaMatch) {
      currentMedia = mediaMatch[1];
      continue;
    }
    if (trimmed === "}" && currentMedia !== null) {
      currentMedia = null;
      continue;
    }
    const ruleMatch = trimmed.match(/^([^{]+)\{([^}]+)\}\s*$/);
    if (!ruleMatch) continue;
    if (ruleMatch[1].trim() !== fix.selector) continue;
    if ((currentMedia ?? null) !== fix.mediaCondition) continue;

    const body = upsertDeclaration(ruleMatch[2].trim(), fix.property, fix.value);
    const indent = line.match(/^\s*/)?.[0] ?? "";
    lines[index] = `${indent}${fix.selector} { ${body} }`;
    return lines.join("\n");
  }

  if (!options.appendIfMissing) return css;

  // No existing matching rule — append a new block.
  const declaration = `${fix.selector} { ${fix.property}: ${fix.value}; }`;
  const appended = fix.mediaCondition
    ? `${css.replace(/\s*$/, "")}\n@media ${fix.mediaCondition} {\n  ${declaration}\n}\n`
    : `${css.replace(/\s*$/, "")}\n${declaration}\n`;
  return appended;
}

export function shouldIgnoreMigrationRerunError(error: unknown): boolean {
  return isPlaywrightSandboxRestrictionError(error);
}

function summarizeMigrationVariantConvergence(
  variant: string,
  results: MigrationCompareReportResult[],
): MigrationVariantConvergence {
  const cleanResults = results.filter((result) => result.diffPixels === 0 && !result.approved).length;
  const approvedResults = results.filter((result) => result.diffPixels === 0 && !!result.approved).length;
  const remainingResults = results.filter((result) => result.diffPixels > 0 || result.partiallyApproved).length;
  return {
    variant,
    totalResults: results.length,
    cleanResults,
    approvedResults,
    remainingResults,
    status: summarizeConvergenceStatus(cleanResults, approvedResults, remainingResults),
  };
}

function summarizeConvergenceStatus(
  cleanResults: number,
  approvedResults: number,
  remainingResults: number,
): MigrationConvergenceStatus {
  if (remainingResults > 0) return "remaining";
  if (approvedResults > 0) return "approved";
  return cleanResults > 0 ? "clean" : "remaining";
}

function resolveVariantFile(
  report: MigrationCompareReport,
  result: MigrationCompareReportResult,
): string {
  if (result.variantFile) return result.variantFile;
  return report.variants.find((variantFile) => basename(variantFile, ".html") === result.variant) ?? result.variant;
}

function upsertDeclaration(body: string, property: string, value: string): string {
  const declarations = body
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  let replaced = false;
  const nextDeclarations = declarations.map((entry) => {
    const [entryProperty] = entry.split(":");
    if (entryProperty?.trim() !== property) return entry;
    replaced = true;
    return `${property}: ${value}`;
  });
  if (!replaced) {
    nextDeclarations.push(`${property}: ${value}`);
  }
  return `${nextDeclarations.join("; ")};`;
}
