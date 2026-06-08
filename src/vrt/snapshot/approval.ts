import { readFile } from "node:fs/promises";
import type { PaintTreeChange } from "@mizchi/vlmkit-capture/crater-client.ts";
import type { PropertyCategory } from "../../experiments/css-challenge/css-challenge-core.ts";
import type { DiffRegion, VrtDiff } from "@mizchi/vlmkit-core/types.ts";
import { createScopedVrtDiff, normalizeVrtDiffRegions } from "@mizchi/vlmkit-core/diff-regions.ts";

export interface ApprovalManifest {
  rules: ApprovalRule[];
}

export type ApprovalRuleKind =
  | "visual"
  | "a11y-contrast"
  | "a11y-touch"
  | "a11y-focus-order"
  | "a11y-semantic"
  | "media-variant"
  | "cross-browser";

export interface ApprovalRule {
  /**
   * Sub-categorizes the rule. Default ("visual") suppresses pixel /
   * paint diffs as before. "a11y-contrast" / "a11y-touch" suppress
   * findings from the matching a11y checker (see `vrt diff-pr`'s
   * a11y gate). The default keeps the schema backward-compatible —
   * existing manifests don't carry `kind`.
   */
  kind?: ApprovalRuleKind;
  selector?: string;
  property?: string;
  category?: PropertyCategory;
  changeType?: string;
  /**
   * Approve any diff region whose bbox falls within this zone. Unlike the
   * selector matcher, this needs no DOM — an operator draws a box around an
   * area (e.g. a marquee) they accept as intentionally dynamic. Optionally
   * scoped to a single viewport.
   */
  region?: ApprovalRegionMatch;
  tolerance?: ApprovalTolerance;
  reason: string;
  issue?: string;
  expires?: string;
  /** Audit trail: who signed off on this approval (vrt baseline approve). */
  acknowledgedBy?: string;
  /** Audit trail: when the rule was authored (ISO date or datetime). */
  createdAt?: string;
}

export interface ApprovalTolerance {
  pixels?: number;
  ratio?: number;
  geometryDelta?: number;
  colorDelta?: number;
}

export interface ApprovalRegionMatch {
  x: number;
  y: number;
  width: number;
  height: number;
  /** When set, the rule only applies on this viewport label. */
  viewport?: string;
  /** Px the approved zone is inflated by before the coverage test (default 8). */
  tolerance?: number;
}

/** Fraction of a diff region that must fall inside the approved zone. */
const REGION_APPROVAL_COVERAGE = 0.8;
const REGION_APPROVAL_DEFAULT_TOLERANCE = 8;

/**
 * True when `region` (a measured diff region) is covered by the approved
 * `zone` on the current `viewport`. Coverage = fraction of the diff region's
 * area inside the zone (inflated by the zone's px tolerance). A viewport-
 * scoped zone only matches its viewport.
 */
export function matchesApprovalRegion(
  zone: ApprovalRegionMatch,
  region: { x: number; y: number; width: number; height: number },
  viewport?: string,
): boolean {
  if (zone.viewport !== undefined && zone.viewport !== viewport) return false;
  const tol = zone.tolerance ?? REGION_APPROVAL_DEFAULT_TOLERANCE;
  const zx = zone.x - tol;
  const zy = zone.y - tol;
  const zr = zone.x + zone.width + tol;
  const zb = zone.y + zone.height + tol;

  const ix = Math.max(region.x, zx);
  const iy = Math.max(region.y, zy);
  const ir = Math.min(region.x + region.width, zr);
  const ib = Math.min(region.y + region.height, zb);
  const interArea = Math.max(0, ir - ix) * Math.max(0, ib - iy);
  const regionArea = Math.max(1, region.width * region.height);
  return interArea / regionArea >= REGION_APPROVAL_COVERAGE;
}

export interface ApprovalContext {
  selector?: string;
  property?: string;
  category?: PropertyCategory;
  changeType?: string;
}

export type ApprovalChangeType = "geometry" | "paint" | "text";

export interface ApprovalWarning {
  rule: ApprovalRule;
  message: string;
}

export interface ApprovalSuggestionInput {
  selector: string;
  property: string;
  category: PropertyCategory;
  maxDiffPixels?: number;
  maxDiffRatio?: number;
  paintTreeChanges?: PaintTreeChange[];
  reason?: string;
  issue?: string;
  expires?: string;
}

export type ApprovalDecision = "approve" | "reject" | "skip";

export interface VrtApprovalResult {
  diff: VrtDiff;
  approved: boolean;
  matchedRules: ApprovalRule[];
  warnings: ApprovalWarning[];
}

export interface VrtRegionApprovalResult extends VrtApprovalResult {
  approvedRegions: DiffRegion[];
  remainingRegions: DiffRegion[];
}

export interface PaintTreeApprovalMatch {
  change: PaintTreeChange;
  rule: ApprovalRule;
}

export interface PaintTreeApprovalResult {
  approvedChanges: PaintTreeChange[];
  remainingChanges: PaintTreeChange[];
  matches: PaintTreeApprovalMatch[];
  warnings: ApprovalWarning[];
}

export async function loadApprovalManifest(path: string): Promise<ApprovalManifest> {
  return parseApprovalManifest(await readFile(path, "utf-8"));
}

export function parseApprovalManifest(raw: string): ApprovalManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid approval manifest JSON: ${String(error)}`);
  }
  return validateApprovalManifest(parsed);
}

export function validateApprovalManifest(value: unknown): ApprovalManifest {
  const manifest = asRecord(value, "Approval manifest must be an object");
  const rawRules = manifest.rules;
  if (!Array.isArray(rawRules)) {
    throw new Error("Approval manifest must have a rules array");
  }
  return {
    rules: rawRules.map((rule, index) => validateApprovalRule(rule, index)),
  };
}

export function collectApprovalWarnings(
  manifest: ApprovalManifest,
  opts: { now?: Date } = {},
): ApprovalWarning[] {
  const now = opts.now ?? new Date();
  return manifest.rules
    .filter((rule) => isApprovalRuleExpired(rule, now))
    .map((rule) => ({
      rule,
      message: `Approval rule expired: ${describeApprovalRule(rule)}`,
    }));
}

export function isApprovalRuleExpired(rule: ApprovalRule, now: Date = new Date()): boolean {
  if (!rule.expires) return false;
  return now.getTime() > parseExpiry(rule.expires).getTime();
}

export function applyApprovalToVrtDiff(
  diff: VrtDiff,
  manifest: ApprovalManifest,
  context: ApprovalContext = {},
  opts: { strict?: boolean; now?: Date } = {},
): VrtApprovalResult {
  const warnings = collectApprovalWarnings(manifest, opts);
  if (opts.strict) {
    return { diff, approved: false, matchedRules: [], warnings };
  }

  const matchedRules = manifest.rules.filter((rule) =>
    !isApprovalRuleExpired(rule, opts.now) &&
    matchesApprovalRule(rule, context) &&
    approvesVrtDiff(rule, diff)
  );

  if (matchedRules.length === 0) {
    return { diff, approved: false, matchedRules: [], warnings };
  }

  return {
    diff: {
      ...diff,
      diffPixels: 0,
      diffRatio: 0,
      regions: [],
      heatmapPath: undefined,
    },
    approved: true,
    matchedRules,
    warnings,
  };
}

export function filterApprovedVrtRegions(
  diff: VrtDiff,
  manifest: ApprovalManifest,
  contexts: ApprovalContext[] = [],
  opts: { strict?: boolean; now?: Date; viewport?: string } = {},
): VrtRegionApprovalResult {
  const warnings = collectApprovalWarnings(manifest, opts);
  if (opts.strict) {
    return {
      diff,
      approved: false,
      matchedRules: [],
      warnings,
      approvedRegions: [],
      remainingRegions: diff.regions,
    };
  }

  const approvedRegions: DiffRegion[] = [];
  const remainingRegions: DiffRegion[] = [];
  const matchedRules: ApprovalRule[] = [];
  const normalizedRegions = normalizeVrtDiffRegions(diff);

  for (const [index, region] of normalizedRegions.entries()) {
    const context = contexts[index] ?? {};
    const regionDiff = createScopedVrtDiff(diff, region);
    const rules = manifest.rules.filter((rule) => {
      if (isApprovalRuleExpired(rule, opts.now)) return false;
      // A region-bbox rule approves any diff inside its zone — no DOM context
      // needed. An optional tolerance still bounds the scoped diff.
      if (rule.region) {
        return matchesApprovalRegion(rule.region, region, opts.viewport) &&
          approvesVrtDiff(rule, regionDiff);
      }
      return matchesApprovalRule(rule, context) && approvesVrtDiff(rule, regionDiff);
    });

    if (rules.length === 0) {
      remainingRegions.push(region);
      continue;
    }

    approvedRegions.push(region);
    matchedRules.push(...rules);
  }

  const remainingDiffPixels = remainingRegions.reduce((sum, region) => sum + region.diffPixelCount, 0);
  const hasApprovedRegions = approvedRegions.length > 0;
  return {
    diff: {
      ...diff,
      diffPixels: remainingDiffPixels,
      diffRatio: remainingDiffPixels / Math.max(diff.totalPixels, 1),
      regions: remainingRegions,
      heatmapPath: hasApprovedRegions ? undefined : diff.heatmapPath,
    },
    approved: hasApprovedRegions && remainingDiffPixels === 0,
    matchedRules: dedupeApprovalRules(matchedRules),
    warnings,
    approvedRegions,
    remainingRegions,
  };
}

export function filterApprovedPaintTreeChanges(
  changes: PaintTreeChange[],
  manifest: ApprovalManifest,
  context: ApprovalContext = {},
  opts: { strict?: boolean; now?: Date } = {},
): PaintTreeApprovalResult {
  const warnings = collectApprovalWarnings(manifest, opts);
  if (opts.strict) {
    return { approvedChanges: [], remainingChanges: changes, matches: [], warnings };
  }

  const approvedChanges: PaintTreeChange[] = [];
  const remainingChanges: PaintTreeChange[] = [];
  const matches: PaintTreeApprovalMatch[] = [];

  for (const change of changes) {
    const rules = manifest.rules.filter((rule) =>
      !isApprovalRuleExpired(rule, opts.now) &&
      matchesApprovalRule(rule, {
        selector: context.selector,
        property: context.property ?? change.property,
        category: context.category,
        changeType: change.type,
      }) &&
      approvesPaintTreeChange(rule, change)
    );

    if (rules.length === 0) {
      remainingChanges.push(change);
      continue;
    }

    approvedChanges.push(change);
    for (const rule of rules) {
      matches.push({ change, rule });
    }
  }

  return { approvedChanges, remainingChanges, matches, warnings };
}

export function matchesApprovalRule(rule: ApprovalRule, context: ApprovalContext): boolean {
  if (rule.selector !== undefined && rule.selector !== context.selector) return false;
  if (rule.property !== undefined && rule.property !== context.property) return false;
  if (rule.category !== undefined && rule.category !== context.category) return false;
  if (rule.changeType !== undefined && rule.changeType !== context.changeType) return false;
  return true;
}

export function inferApprovalChangeType(
  property: string,
  category: PropertyCategory | undefined,
): ApprovalChangeType {
  if (category === "layout" || category === "spacing" || category === "sizing") {
    return "geometry";
  }

  if (TEXTUAL_PROPERTIES.has(property)) {
    return "text";
  }

  return "paint";
}

export function suggestApprovalRule(input: ApprovalSuggestionInput): ApprovalRule {
  const changeType = inferApprovalChangeType(input.property, input.category);
  const tolerance: ApprovalTolerance = {};

  if (input.maxDiffPixels !== undefined) {
    tolerance.pixels = Math.ceil(input.maxDiffPixels);
  }
  if (input.maxDiffRatio !== undefined) {
    tolerance.ratio = roundUp(input.maxDiffRatio, 4);
  }

  const paintTreeChanges = input.paintTreeChanges ?? [];
  if (changeType === "geometry") {
    const geometryDelta = getMaxGeometryDelta(paintTreeChanges);
    if (geometryDelta !== null) tolerance.geometryDelta = geometryDelta;
  } else if (changeType === "paint") {
    const colorDelta = getMaxColorDelta(paintTreeChanges);
    if (colorDelta !== null) tolerance.colorDelta = colorDelta;
  }

  return {
    selector: input.selector,
    property: input.property,
    category: input.category,
    changeType,
    tolerance: Object.keys(tolerance).length > 0 ? tolerance : undefined,
    reason: input.reason ?? `TODO: explain why ${input.selector} { ${input.property} } is acceptable`,
    issue: input.issue,
    expires: input.expires,
  };
}

export function mergeApprovalManifest(
  manifest: ApprovalManifest,
  rules: ApprovalRule[],
): ApprovalManifest {
  const merged = [...manifest.rules];
  for (const rule of rules) {
    const index = merged.findIndex((existing) => isSameApprovalIdentity(existing, rule));
    if (index >= 0) {
      merged[index] = rule;
    } else {
      merged.push(rule);
    }
  }
  return { rules: merged };
}

export function normalizeApprovalDecision(input: string): ApprovalDecision | null {
  const normalized = input.trim().toLowerCase();
  if (normalized === "" || normalized === "s" || normalized === "skip") return "skip";
  if (normalized === "a" || normalized === "approve") return "approve";
  if (normalized === "r" || normalized === "reject") return "reject";
  return null;
}

function validateApprovalRule(value: unknown, index: number): ApprovalRule {
  const rule = asRecord(value, `Approval rule at index ${index} must be an object`);

  const reason = asRequiredString(rule.reason, `Approval rule at index ${index} must have a reason`);
  const selector = asOptionalString(rule.selector, `approval.rules[${index}].selector`);
  const property = asOptionalString(rule.property, `approval.rules[${index}].property`);
  const category = asOptionalString(rule.category, `approval.rules[${index}].category`) as PropertyCategory | undefined;
  const changeType = asOptionalString(rule.changeType, `approval.rules[${index}].changeType`);
  const issue = asOptionalString(rule.issue, `approval.rules[${index}].issue`);
  const expires = asOptionalString(rule.expires, `approval.rules[${index}].expires`);
  if (expires) parseExpiry(expires);
  const acknowledgedBy = asOptionalString(rule.acknowledgedBy, `approval.rules[${index}].acknowledgedBy`);
  const createdAt = asOptionalString(rule.createdAt, `approval.rules[${index}].createdAt`);
  const kindRaw = asOptionalString(rule.kind, `approval.rules[${index}].kind`);
  const VALID_KINDS = new Set([
    "visual", "a11y-contrast", "a11y-touch", "a11y-focus-order", "a11y-semantic",
    "media-variant", "cross-browser",
  ]);
  if (kindRaw !== undefined && !VALID_KINDS.has(kindRaw)) {
    throw new Error(`approval.rules[${index}].kind must be one of: ${[...VALID_KINDS].join(", ")}`);
  }
  const kind = kindRaw as ApprovalRuleKind | undefined;

  return {
    kind,
    selector,
    property,
    category,
    changeType,
    region: validateRegionMatch(rule.region, index),
    tolerance: validateTolerance(rule.tolerance, index),
    reason,
    issue,
    expires,
    acknowledgedBy,
    createdAt,
  };
}

function validateRegionMatch(value: unknown, index: number): ApprovalRegionMatch | undefined {
  if (value === undefined) return undefined;
  const region = asRecord(value, `approval.rules[${index}].region must be an object`);
  const num = (key: keyof ApprovalRegionMatch) => {
    const v = region[key];
    if (typeof v !== "number" || Number.isNaN(v)) {
      throw new Error(`approval.rules[${index}].region.${String(key)} must be a number`);
    }
    return v;
  };
  return {
    x: num("x"),
    y: num("y"),
    width: num("width"),
    height: num("height"),
    viewport: asOptionalString(region.viewport, `approval.rules[${index}].region.viewport`),
    tolerance: asOptionalNumber(region.tolerance, `approval.rules[${index}].region.tolerance`),
  };
}

export interface AuthorApprovalRuleInput {
  /** Approve by DOM selector. Mutually exclusive with `region`. */
  selector?: string;
  /** Approve by bbox zone. Mutually exclusive with `selector`. */
  region?: ApprovalRegionMatch;
  reason: string;
  /** Pixel tolerance — diff is suppressed when diffPixels ≤ maxPx. */
  maxPx?: number;
  /** Ratio tolerance — diff is suppressed when diffRatio ≤ maxRatio. */
  maxRatio?: number;
  kind?: ApprovalRuleKind;
  expires?: string;
  acknowledgedBy?: string;
  /** ISO date/datetime; the CLI defaults this to the current day. */
  createdAt?: string;
}

/**
 * Author a single approval rule from CLI input — scoped either by DOM selector
 * (the pipeline matches selector + optional property/category/changeType with a
 * pixel/ratio tolerance) or by a region bbox zone (matches any diff region
 * inside the zone, optionally viewport-scoped). Exactly one of `selector` /
 * `region` is required. Audit fields (acknowledgedBy / createdAt / expires)
 * are recorded as given.
 */
export function buildApprovalRuleFromInput(input: AuthorApprovalRuleInput): ApprovalRule {
  const hasSelector = typeof input.selector === "string" && input.selector.trim() !== "";
  const hasRegion = input.region !== undefined;
  if (hasSelector && hasRegion) {
    throw new Error("approve: pass either --selector or --region, not both");
  }
  if (!hasSelector && !hasRegion) {
    throw new Error("approve: a --selector or a --region is required");
  }
  const reason = asRequiredString(input.reason, "approve: --reason is required");
  if (input.expires) parseExpiry(input.expires); // throws on invalid expiry

  const tolerance: ApprovalTolerance = {};
  if (input.maxPx !== undefined) tolerance.pixels = Math.ceil(input.maxPx);
  if (input.maxRatio !== undefined) tolerance.ratio = roundUp(input.maxRatio, 6);

  return {
    kind: input.kind ?? "visual",
    selector: hasSelector ? input.selector : undefined,
    region: input.region,
    tolerance: Object.keys(tolerance).length > 0 ? tolerance : undefined,
    reason,
    expires: input.expires,
    acknowledgedBy: input.acknowledgedBy,
    createdAt: input.createdAt,
  };
}

/**
 * Filter a list of a11y findings (paths) against the approval
 * manifest. A finding is suppressed when at least one non-expired
 * rule with the matching `kind` carries a `selector` substring that
 * appears in the finding's path. `selector` is matched as a literal
 * substring — not parsed as a CSS selector — so authors can match
 * either a class name (e.g. ".profile__avatar") or a full bracket
 * path. Out-of-scope: parsing the selector with a real engine.
 */
export function filterA11yFindings<T extends { path: string }>(
  findings: T[],
  manifest: ApprovalManifest | null | undefined,
  kind: "a11y-contrast" | "a11y-touch" | "a11y-focus-order" | "a11y-semantic",
): { kept: T[]; suppressed: Array<{ finding: T; rule: ApprovalRule }> } {
  if (!manifest) return { kept: findings, suppressed: [] };
  const now = new Date();
  const rules = manifest.rules.filter((r) =>
    r.kind === kind && !!r.selector && !isApprovalRuleExpired(r, now),
  );
  if (rules.length === 0) return { kept: findings, suppressed: [] };
  const kept: T[] = [];
  const suppressed: Array<{ finding: T; rule: ApprovalRule }> = [];
  for (const finding of findings) {
    const match = rules.find((r) => finding.path.includes(r.selector!));
    if (match) suppressed.push({ finding, rule: match });
    else kept.push(finding);
  }
  return { kept, suppressed };
}

/**
 * Filter cross-browser findings by manifest. A rule with
 * `kind: "cross-browser"` and `selector: <engine-name>` suppresses
 * findings on that engine by setting `deltaRatio = 0` and tagging
 * the engine's error / note. The audit trail is preserved.
 */
export function filterCrossBrowserFindings<T extends {
  engine: string;
  status: "ok" | "skipped" | "failed";
  deltaRatio: number;
  error?: string;
}>(
  findings: T[],
  manifest: ApprovalManifest | null | undefined,
): { kept: T[]; suppressed: Array<{ finding: T; rule: ApprovalRule }> } {
  if (!manifest) return { kept: findings, suppressed: [] };
  const now = new Date();
  const rules = manifest.rules.filter((r) =>
    r.kind === "cross-browser" && !!r.selector && !isApprovalRuleExpired(r, now),
  );
  if (rules.length === 0) return { kept: findings, suppressed: [] };
  const kept: T[] = [];
  const suppressed: Array<{ finding: T; rule: ApprovalRule }> = [];
  for (const finding of findings) {
    const match = rules.find((r) => r.selector === finding.engine);
    if (match) {
      suppressed.push({ finding, rule: match });
      kept.push({
        ...finding,
        deltaRatio: 0,
        error: `${finding.error ?? ""} (suppressed by manifest rule: ${match.reason})`.trim(),
      });
    } else {
      kept.push(finding);
    }
  }
  return { kept, suppressed };
}

/**
 * Filter media-variant findings by manifest. A rule with
 * `kind: "media-variant"` and `selector: <variant-name>` suppresses
 * findings of that variant by demoting their verdict to "ok"
 * (audit trail preserved in the kept list; the gate counts what's
 * left).
 */
export function filterMediaVariantFindings<T extends { variant: string; verdict: "ok" | "suspect" | "warn" | "skip"; note: string }>(
  findings: T[],
  manifest: ApprovalManifest | null | undefined,
): { kept: T[]; suppressed: Array<{ finding: T; rule: ApprovalRule }> } {
  if (!manifest) return { kept: findings, suppressed: [] };
  const now = new Date();
  const rules = manifest.rules.filter((r) =>
    r.kind === "media-variant" && !!r.selector && !isApprovalRuleExpired(r, now),
  );
  if (rules.length === 0) return { kept: findings, suppressed: [] };
  const kept: T[] = [];
  const suppressed: Array<{ finding: T; rule: ApprovalRule }> = [];
  for (const finding of findings) {
    const match = rules.find((r) => r.selector === finding.variant);
    if (match) {
      suppressed.push({ finding, rule: match });
      kept.push({
        ...finding,
        verdict: "ok",
        note: `${finding.note} (suppressed by manifest rule: ${match.reason})`,
      });
    } else {
      kept.push(finding);
    }
  }
  return { kept, suppressed };
}


function validateTolerance(value: unknown, index: number): ApprovalTolerance | undefined {
  if (value === undefined) return undefined;
  const tolerance = asRecord(value, `approval.rules[${index}].tolerance must be an object`);
  return {
    pixels: asOptionalNumber(tolerance.pixels, `approval.rules[${index}].tolerance.pixels`),
    ratio: asOptionalNumber(tolerance.ratio, `approval.rules[${index}].tolerance.ratio`),
    geometryDelta: asOptionalNumber(tolerance.geometryDelta, `approval.rules[${index}].tolerance.geometryDelta`),
    colorDelta: asOptionalNumber(tolerance.colorDelta, `approval.rules[${index}].tolerance.colorDelta`),
  };
}

function approvesVrtDiff(rule: ApprovalRule, diff: VrtDiff): boolean {
  if (!rule.tolerance) return true;
  const hasPixelTolerance = rule.tolerance.pixels !== undefined || rule.tolerance.ratio !== undefined;
  if (!hasPixelTolerance) return false;
  if (rule.tolerance.pixels !== undefined && diff.diffPixels > rule.tolerance.pixels) return false;
  if (rule.tolerance.ratio !== undefined && diff.diffRatio > rule.tolerance.ratio) return false;
  return true;
}

function approvesPaintTreeChange(rule: ApprovalRule, change: PaintTreeChange): boolean {
  if (!rule.tolerance) return true;

  if (change.type === "geometry" && rule.tolerance.geometryDelta !== undefined) {
    const before = parseBounds(change.before);
    const after = parseBounds(change.after);
    if (!before || !after) return false;
    const maxDelta = Math.max(
      Math.abs(before.x - after.x),
      Math.abs(before.y - after.y),
      Math.abs(before.w - after.w),
      Math.abs(before.h - after.h),
    );
    return maxDelta <= rule.tolerance.geometryDelta;
  }

  if (change.type === "paint" && rule.tolerance.colorDelta !== undefined) {
    const before = parseNumberArray(change.before);
    const after = parseNumberArray(change.after);
    if (!before || !after || before.length !== after.length) return false;
    const maxDelta = Math.max(...before.map((value, index) => Math.abs(value - after[index])));
    return maxDelta <= rule.tolerance.colorDelta;
  }

  return false;
}

function parseBounds(raw: string | undefined): { x: number; y: number; w: number; h: number } | null {
  if (!raw) return null;
  const match = raw.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)x(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    w: Number(match[3]),
    h: Number(match[4]),
  };
}

function parseNumberArray(raw: string | undefined): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "number")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getMaxGeometryDelta(changes: PaintTreeChange[]): number | null {
  let maxDelta = 0;
  let found = false;
  for (const change of changes) {
    if (change.type !== "geometry") continue;
    const before = parseBounds(change.before);
    const after = parseBounds(change.after);
    if (!before || !after) continue;
    found = true;
    maxDelta = Math.max(
      maxDelta,
      Math.abs(before.x - after.x),
      Math.abs(before.y - after.y),
      Math.abs(before.w - after.w),
      Math.abs(before.h - after.h),
    );
  }
  return found ? maxDelta : null;
}

function getMaxColorDelta(changes: PaintTreeChange[]): number | null {
  let maxDelta = 0;
  let found = false;
  for (const change of changes) {
    if (change.type !== "paint") continue;
    const before = parseNumberArray(change.before);
    const after = parseNumberArray(change.after);
    if (!before || !after || before.length !== after.length) continue;
    found = true;
    for (let i = 0; i < before.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(before[i] - after[i]));
    }
  }
  return found ? maxDelta : null;
}

function parseExpiry(expires: string): Date {
  const dateOnly = expires.match(/^\d{4}-\d{2}-\d{2}$/);
  const parsed = dateOnly
    ? new Date(`${expires}T23:59:59.999`)
    : new Date(expires);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid approval expiry date: ${expires}`);
  }
  return parsed;
}

function describeApprovalRule(rule: ApprovalRule): string {
  const parts = [
    rule.selector,
    rule.property,
    rule.category,
    rule.changeType,
    rule.expires ? `expires=${rule.expires}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : rule.reason;
}

function dedupeApprovalRules(rules: ApprovalRule[]): ApprovalRule[] {
  const seen = new Set<string>();
  const deduped: ApprovalRule[] = [];
  for (const rule of rules) {
    const key = JSON.stringify({
      selector: rule.selector,
      property: rule.property,
      category: rule.category,
      changeType: rule.changeType,
      tolerance: rule.tolerance,
      reason: rule.reason,
      issue: rule.issue,
      expires: rule.expires,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(rule);
  }
  return deduped;
}

function isSameApprovalIdentity(a: ApprovalRule, b: ApprovalRule): boolean {
  // Treat absent kind as "visual" so existing manifests without a
  // kind field don't collide with newly-added a11y rules that share
  // a selector with a pre-existing visual rule.
  const ka = a.kind ?? "visual";
  const kb = b.kind ?? "visual";
  return ka === kb &&
    a.selector === b.selector &&
    a.property === b.property &&
    a.category === b.category &&
    a.changeType === b.changeType &&
    JSON.stringify(a.region) === JSON.stringify(b.region);
}

const TEXTUAL_PROPERTIES = new Set([
  "text-align",
  "text-indent",
  "text-transform",
  "white-space",
  "word-spacing",
  "letter-spacing",
  "line-height",
]);

function roundUp(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.ceil(value * factor) / factor;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function asRequiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }
  return value;
}

function asOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
  return value;
}

function asOptionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${path} must be a number`);
  }
  return value;
}
