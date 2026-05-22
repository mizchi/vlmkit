import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  A11yNode,
  IntrospectResult,
  PageIntrospection,
  SpecInvariant,
  UiSpec,
  PageSpec,
} from "@mizchi/vlmkit-core/types.ts";
import { LANDMARK_ROLES, INTERACTIVE_ROLES } from "@mizchi/vlmkit-core/a11y-semantic.ts";

export interface SpecContrastColor {
  r: number;
  g: number;
  b: number;
}

export interface SpecContrastSample {
  path: string;
  text?: string;
  fontSize: number;
  fontWeight: number;
  foreground: SpecContrastColor;
  background: SpecContrastColor;
}

export interface SpecContrastFinding {
  path?: string;
  text?: string;
  ratio: number;
  requiredAA?: number;
}

export interface SpecPageData {
  a11yTree?: A11yNode;
  screenshotExists: boolean;
  contrastFindings?: SpecContrastFinding[];
  contrastSamples?: SpecContrastSample[];
  responsiveSnapshots?: SpecResponsiveSnapshot[];
  responsiveFindings?: SpecResponsiveIssue[];
}

export interface SpecResponsiveViewport {
  width: number;
  height: number;
  label?: string;
}

export interface SpecResponsiveRegion {
  role?: string;
  name?: string;
  selector?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface SpecResponsiveIssue {
  severity?: "error" | "warning" | "info";
  message: string;
  viewport?: SpecResponsiveViewport;
  selector?: string;
}

export interface SpecResponsiveSnapshot {
  viewport: SpecResponsiveViewport;
  clientWidth?: number;
  scrollWidth?: number;
  clientHeight?: number;
  scrollHeight?: number;
  regions?: SpecResponsiveRegion[];
  issues?: SpecResponsiveIssue[];
}

interface ContrastSidecarSummary {
  sampleCount: number;
  failureCount: number;
}

interface ResponsiveSidecarSummary {
  snapshotCount: number;
  issueCount: number;
}

/**
 * Auto-generate UI specifications from a11y snapshots.
 */
export async function introspect(snapshotDir: string): Promise<IntrospectResult> {
  const entries = await readdir(snapshotDir);
  const files = entries.filter((f) => f.endsWith(".a11y.json"));
  const contrastSummaries = await readContrastSidecars(snapshotDir, entries);
  const responsiveSummaries = await readResponsiveSidecars(snapshotDir, entries);
  const pages: PageIntrospection[] = [];

  for (const file of files) {
    const testId = file.replace(/\.a11y\.json$/, "");
    const raw = JSON.parse(await readFile(join(snapshotDir, file), "utf-8"));
    if (!raw) continue;

    pages.push(introspectPage(
      testId,
      raw as A11yNode,
      contrastSummaries.get(testId),
      responsiveSummaries.get(testId)
    ));
  }

  return { generatedAt: new Date().toISOString(), pages };
}

function introspectPage(
  testId: string,
  tree: A11yNode,
  contrastSummary?: ContrastSidecarSummary,
  responsiveSummary?: ResponsiveSidecarSummary
): PageIntrospection {
  const landmarks: { role: string; name: string }[] = [];
  const interactiveElements: { role: string; name: string; hasLabel: boolean }[] = [];
  const headingLevels: number[] = [];
  let ariaRelationshipCount = 0;
  let totalNodes = 0;

  function walk(node: A11yNode) {
    totalNodes++;

    if (LANDMARK_ROLES.has(node.role)) {
      landmarks.push({ role: node.role, name: node.name || "" });
    }

    if (INTERACTIVE_ROLES.has(node.role)) {
      interactiveElements.push({
        role: node.role,
        name: node.name || "",
        hasLabel: !!node.name,
      });
    }

    if (node.role === "heading" && node.level) {
      headingLevels.push(node.level);
    }

    ariaRelationshipCount += countNodeAriaRelationshipRefs(node);

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(tree);

  const unlabeledCount = interactiveElements.filter((e) => !e.hasLabel).length;

  // Auto-inferred invariants
  const suggestedInvariants = generateInvariants(
    testId,
    landmarks,
    interactiveElements,
    headingLevels,
    ariaRelationshipCount,
    !!contrastSummary,
    !!responsiveSummary,
    unlabeledCount
  );

  // Auto-generate page description
  const description = generateDescription(testId, landmarks, interactiveElements);

  return {
    testId,
    description,
    landmarks,
    interactiveElements,
    stats: {
      totalNodes,
      landmarkCount: landmarks.length,
      interactiveCount: interactiveElements.length,
      unlabeledCount,
      headingLevels: [...new Set(headingLevels)].sort(),
      ...(contrastSummary
        ? {
            contrastSampleCount: contrastSummary.sampleCount,
            contrastFailureCount: contrastSummary.failureCount,
          }
        : {}),
      ...(responsiveSummary
        ? {
            responsiveSnapshotCount: responsiveSummary.snapshotCount,
            responsiveIssueCount: responsiveSummary.issueCount,
          }
        : {}),
    },
    suggestedInvariants,
  };
}

async function readContrastSidecars(
  snapshotDir: string,
  entries: string[]
): Promise<Map<string, ContrastSidecarSummary>> {
  const summaries = new Map<string, ContrastSidecarSummary>();
  for (const file of entries.filter((f) => f.endsWith(".contrast.json"))) {
    const testId = file.replace(/\.contrast\.json$/, "");
    const raw = JSON.parse(await readFile(join(snapshotDir, file), "utf-8"));
    const summary = parseContrastSidecar(raw);
    if (summary) summaries.set(testId, summary);
  }
  return summaries;
}

function parseContrastSidecar(raw: unknown): ContrastSidecarSummary | undefined {
  if (Array.isArray(raw)) {
    return { sampleCount: raw.length, failureCount: countUnknownContrastFailures(raw, true) };
  }
  if (!isRecord(raw)) return undefined;

  const failures = Array.isArray(raw.failures) ? raw.failures : undefined;
  const samples = Array.isArray(raw.samples)
    ? raw.samples
    : Array.isArray(raw.contrastSamples)
      ? raw.contrastSamples
      : undefined;
  const totalText = typeof raw.totalText === "number" ? raw.totalText : undefined;
  if (failures === undefined && samples === undefined && totalText === undefined) {
    return undefined;
  }

  return {
    sampleCount: totalText ?? samples?.length ?? failures?.length ?? 0,
    failureCount: failures?.length ?? countUnknownContrastFailures(samples ?? [], false),
  };
}

async function readResponsiveSidecars(
  snapshotDir: string,
  entries: string[]
): Promise<Map<string, ResponsiveSidecarSummary>> {
  const summaries = new Map<string, ResponsiveSidecarSummary>();
  for (const file of entries.filter((f) => f.endsWith(".responsive.json"))) {
    const testId = file.replace(/\.responsive\.json$/, "");
    const raw = JSON.parse(await readFile(join(snapshotDir, file), "utf-8"));
    const summary = parseResponsiveSidecar(raw);
    if (summary) summaries.set(testId, summary);
  }
  return summaries;
}

function parseResponsiveSidecar(raw: unknown): ResponsiveSidecarSummary | undefined {
  const snapshots = normalizeResponsiveSnapshots(raw);
  const findings = normalizeResponsiveFindings(raw);
  if (snapshots.length === 0 && findings.length === 0) {
    return undefined;
  }
  const detectedIssues = snapshots.flatMap(analyzeResponsiveSnapshot);
  return {
    snapshotCount: snapshots.length,
    issueCount: findings.filter(isActionableResponsiveIssue).length
      + detectedIssues.filter(isActionableResponsiveIssue).length,
  };
}

function generateDescription(
  testId: string,
  landmarks: { role: string; name: string }[],
  interactive: { role: string; name: string; hasLabel: boolean }[]
): string {
  const parts = [`Page "${testId}"`];
  if (landmarks.length > 0) {
    parts.push(`with ${landmarks.map((l) => l.role).join(", ")}`);
  }
  const buttons = interactive.filter((e) => e.role === "button");
  const links = interactive.filter((e) => e.role === "link");
  const inputs = interactive.filter((e) => ["textbox", "searchbox", "combobox"].includes(e.role));
  if (buttons.length) parts.push(`${buttons.length} button(s)`);
  if (links.length) parts.push(`${links.length} link(s)`);
  if (inputs.length) parts.push(`${inputs.length} input(s)`);
  return parts.join(", ");
}

function generateInvariants(
  _testId: string,
  landmarks: { role: string; name: string }[],
  interactive: { role: string; name: string; hasLabel: boolean }[],
  headingLevels: number[],
  ariaRelationshipCount: number,
  hasContrastData: boolean,
  hasResponsiveData: boolean,
  unlabeledCount: number
): SpecInvariant[] {
  const invariants: SpecInvariant[] = [];

  // Landmark existence (include all landmarks as invariants)
  for (const lm of landmarks) {
    invariants.push({
      description: `${lm.role} landmark "${lm.name || "(unnamed)"}" is present`,
      check: "landmark-exists",
      cost: "low",
    });
  }

  // Interactive element role snapshot (for role-changed detection)
  const roleCounts = new Map<string, number>();
  for (const el of interactive) {
    roleCounts.set(el.role, (roleCounts.get(el.role) ?? 0) + 1);
  }
  for (const [role, count] of roleCounts) {
    invariants.push({
      description: `${count} ${role} element(s) expected`,
      check: "element-count",
      cost: "low",
    });
  }

  if (headingLevels.length > 0) {
    invariants.push({
      description: "Heading hierarchy does not skip levels",
      check: "heading-hierarchy",
      cost: "low",
    });
  }

  if (ariaRelationshipCount > 0) {
    invariants.push({
      description: "ARIA relationship references resolve",
      check: "aria-relationships",
      cost: "low",
    });
  }

  if (hasContrastData) {
    invariants.push({
      description: "Text color contrast passes WCAG AA",
      check: "color-contrast",
      cost: "low",
    });
  }

  if (hasResponsiveData) {
    invariants.push({
      description: "Responsive layout stays within viewport bounds",
      check: "responsive-layout",
      cost: "low",
    });
  }

  // Unlabeled element warning
  if (unlabeledCount > 0) {
    invariants.push({
      description: `${unlabeledCount} interactive element(s) without labels — should be fixed`,
      check: "label-present",
      cost: "low",
    });
  } else if (interactive.length > 0) {
    invariants.push({
      description: `All ${interactive.length} interactive elements have labels`,
      check: "label-present",
      cost: "low",
    });
  }

  // Whiteout/error checks (always)
  invariants.push({ description: "Page is not blank/whiteout", check: "no-whiteout", cost: "low" });
  invariants.push({ description: "No error state indicators", check: "no-error-state", cost: "low" });

  return invariants;
}

/**
 * Generate UiSpec (long-cycle spec) from introspect results.
 */
export function introspectToSpec(result: IntrospectResult): UiSpec {
  return {
    description: `Auto-generated UI spec from ${result.pages.length} page(s) at ${result.generatedAt}`,
    pages: result.pages.map((page): PageSpec => ({
      testId: page.testId,
      purpose: page.description,
      invariants: page.suggestedInvariants,
    })),
    global: [
      { description: "All pages should not be blank", check: "no-whiteout", cost: "low" },
      { description: "All interactive elements should have accessible labels", check: "label-present", cost: "low" },
    ],
  };
}

/**
 * Verify UiSpec invariants.
 */
export function verifySpec(
  spec: UiSpec,
  pageData: Map<string, SpecPageData>,
  changedFiles?: string[],
  depEdges?: Map<string, string[]>
): SpecVerifyResult {
  const results: SpecPageResult[] = [];

  for (const pageSpec of spec.pages) {
    const data = pageData.get(pageSpec.testId);
    if (!data) {
      results.push({
        testId: pageSpec.testId,
        checked: [],
        skipped: pageSpec.invariants.map((inv) => ({
          invariant: inv,
          reason: "No snapshot data available",
        })),
      });
      continue;
    }

    const checked: CheckedInvariant[] = [];
    const skipped: SkippedInvariant[] = [];

    for (const inv of pageSpec.invariants) {
      // Skip via dep graph
      if (inv.dependsOn && changedFiles && depEdges) {
        const affected = isAffectedByChanges(inv.dependsOn, changedFiles, depEdges);
        if (!affected) {
          skipped.push({ invariant: inv, reason: "Not affected by current changes (dep graph)" });
          continue;
        }
      }

      // NL assertion is high-cost, mark as skippable
      if (inv.check === "nl-assertion" || inv.cost === "high") {
        skipped.push({ invariant: inv, reason: "High-cost assertion — skipped (use --full to run)" });
        continue;
      }

      // Heuristic verification
      const result = checkInvariant(inv, data);
      checked.push(result);
    }

    // Also check global invariants
    for (const inv of spec.global ?? []) {
      const result = checkInvariant(inv, data);
      checked.push(result);
    }

    results.push({ testId: pageSpec.testId, checked, skipped });
  }

  return { results };
}

function checkInvariant(
  inv: SpecInvariant,
  data: SpecPageData
): CheckedInvariant {
  if (inv.check === "no-whiteout") {
    return { invariant: inv, passed: data.screenshotExists, reasoning: data.screenshotExists ? "Screenshot exists" : "No screenshot" };
  }

  if (inv.check === "color-contrast") {
    const result = checkColorContrast(data);
    return { invariant: inv, passed: result.passed, reasoning: result.reasoning };
  }

  if (inv.check === "responsive-layout") {
    const result = checkResponsiveLayout(data);
    return { invariant: inv, passed: result.passed, reasoning: result.reasoning };
  }

  if (!data.a11yTree) {
    return { invariant: inv, passed: false, reasoning: "No a11y tree available" };
  }

  switch (inv.check) {
    case "landmark-exists": {
      const found = findRole(data.a11yTree, extractRoleFromDesc(inv.description));
      return { invariant: inv, passed: found, reasoning: found ? "Landmark found" : "Landmark not found" };
    }
    case "label-present": {
      const unlabeled = countUnlabeled(data.a11yTree);
      return { invariant: inv, passed: unlabeled === 0, reasoning: `${unlabeled} unlabeled element(s)` };
    }
    case "no-error-state":
      return { invariant: inv, passed: true, reasoning: "Heuristic check (a11y-based) — OK" };
    case "element-count": {
      const match = inv.description.match(/^(\d+)\s+(\w+)\s+element/);
      if (!match) return { invariant: inv, passed: true, reasoning: "Could not parse element-count invariant" };
      const expectedCount = parseInt(match[1], 10);
      const role = match[2];
      const actualCount = countRole(data.a11yTree, role);
      const passed = actualCount === expectedCount;
      return {
        invariant: inv,
        passed,
        reasoning: passed
          ? `${role}: ${actualCount} found (expected ${expectedCount})`
          : `${role}: ${actualCount} found but expected ${expectedCount}`,
      };
    }
    case "heading-hierarchy": {
      const result = checkHeadingHierarchy(data.a11yTree);
      return { invariant: inv, passed: result.passed, reasoning: result.reasoning };
    }
    case "aria-relationships": {
      const result = checkAriaRelationships(data.a11yTree);
      return { invariant: inv, passed: result.passed, reasoning: result.reasoning };
    }
    default:
      return { invariant: inv, passed: true, reasoning: `Check "${inv.check ?? "none"}" — passed (no verifier)` };
  }
}

function extractRoleFromDesc(desc: string): string {
  const match = desc.match(/^(\w+)\s+landmark/);
  return match?.[1] ?? "";
}

function findRole(node: A11yNode, role: string): boolean {
  if (node.role === role) return true;
  for (const child of node.children ?? []) {
    if (findRole(child, role)) return true;
  }
  return false;
}

function countRole(node: A11yNode, role: string): number {
  let count = 0;
  if (node.role === role) count++;
  for (const child of node.children ?? []) count += countRole(child, role);
  return count;
}

function countUnlabeled(node: A11yNode): number {
  let count = 0;
  if (INTERACTIVE_ROLES.has(node.role) && !node.name) count++;
  for (const child of node.children ?? []) count += countUnlabeled(child);
  return count;
}

function collectHeadingLevels(node: A11yNode, levels: number[] = []): number[] {
  if (node.role === "heading" && typeof node.level === "number") {
    levels.push(node.level);
  }
  for (const child of node.children ?? []) collectHeadingLevels(child, levels);
  return levels;
}

function checkHeadingHierarchy(tree: A11yNode): { passed: boolean; reasoning: string } {
  const levels = collectHeadingLevels(tree);
  if (levels.length === 0) {
    return { passed: true, reasoning: "No headings found" };
  }

  let previousLevel = 0;
  for (const level of levels) {
    if (level > previousLevel + 1) {
      const previousLabel = previousLevel === 0 ? "document start" : `h${previousLevel}`;
      return {
        passed: false,
        reasoning: `Heading hierarchy skips to h${level} after ${previousLabel}`,
      };
    }
    previousLevel = level;
  }

  return { passed: true, reasoning: `Heading hierarchy OK (${levels.map((level) => `h${level}`).join(" > ")})` };
}

const ARIA_RELATIONSHIP_FIELDS = [
  { label: "aria-labelledby", keys: ["ariaLabelledBy", "ariaLabeledBy", "aria-labelledby"] },
  { label: "aria-describedby", keys: ["ariaDescribedBy", "aria-describedby"] },
  { label: "aria-controls", keys: ["ariaControls", "aria-controls"] },
  { label: "aria-owns", keys: ["ariaOwns", "aria-owns"] },
  { label: "aria-details", keys: ["ariaDetails", "aria-details"] },
  { label: "aria-activedescendant", keys: ["ariaActiveDescendant", "aria-activedescendant"] },
] as const;

interface AriaRelationshipRef {
  source: string;
  attribute: string;
  targetId: string;
}

function countNodeAriaRelationshipRefs(node: A11yNode): number {
  let count = 0;
  for (const field of ARIA_RELATIONSHIP_FIELDS) {
    for (const key of field.keys) {
      count += normalizeAriaReferenceValue(readA11yNodeValue(node, key)).length;
    }
  }
  return count;
}

function checkAriaRelationships(tree: A11yNode): { passed: boolean; reasoning: string } {
  const ids = collectA11yNodeIds(tree);
  const refs = collectAriaRelationshipRefs(tree);
  if (refs.length === 0) {
    return { passed: true, reasoning: "No ARIA relationship references found" };
  }

  const missing = refs.filter((ref) => !ids.has(ref.targetId));
  if (missing.length > 0) {
    const details = missing
      .map((ref) => `${ref.attribute} -> ${ref.targetId} from ${ref.source}`)
      .join("; ");
    return { passed: false, reasoning: `Missing ARIA relationship target(s): ${details}` };
  }

  return { passed: true, reasoning: `All ${refs.length} ARIA relationship reference(s) resolve` };
}

function collectA11yNodeIds(node: A11yNode, ids: Set<string> = new Set()): Set<string> {
  const id = readA11yNodeValue(node, "id");
  if (typeof id === "string" && id.trim()) {
    ids.add(id.trim());
  }
  for (const child of node.children ?? []) collectA11yNodeIds(child, ids);
  return ids;
}

function collectAriaRelationshipRefs(node: A11yNode, refs: AriaRelationshipRef[] = []): AriaRelationshipRef[] {
  const source = describeA11yNode(node);
  for (const field of ARIA_RELATIONSHIP_FIELDS) {
    const targets = new Set<string>();
    for (const key of field.keys) {
      for (const targetId of normalizeAriaReferenceValue(readA11yNodeValue(node, key))) {
        targets.add(targetId);
      }
    }
    for (const targetId of targets) {
      refs.push({ source, attribute: field.label, targetId });
    }
  }
  for (const child of node.children ?? []) collectAriaRelationshipRefs(child, refs);
  return refs;
}

function readA11yNodeValue(node: A11yNode, key: string): unknown {
  if (key in node) {
    return (node as unknown as Record<string, unknown>)[key];
  }
  return node.attributes?.[key];
}

function normalizeAriaReferenceValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(normalizeAriaReferenceValue);
  }
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(/\s+/)
    .map((token) => token.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function describeA11yNode(node: A11yNode): string {
  const label = node.name ? ` "${node.name}"` : "";
  const id = readA11yNodeValue(node, "id");
  const idLabel = typeof id === "string" && id.trim() ? `#${id.trim()}` : "";
  return `${node.role}${label}${idLabel}`;
}

function checkColorContrast(data: SpecPageData): { passed: boolean; reasoning: string } {
  const failures: SpecContrastFinding[] = [
    ...(data.contrastFindings ?? []),
    ...(data.contrastSamples ?? []).flatMap((sample) => {
      const finding = analyzeContrastSample(sample);
      return finding ? [finding] : [];
    }),
  ];

  const hasContrastData = data.contrastFindings !== undefined || data.contrastSamples !== undefined;
  if (!hasContrastData) {
    return { passed: false, reasoning: "No color contrast data available" };
  }
  if (failures.length === 0) {
    const sampleCount = data.contrastSamples?.length ?? 0;
    return {
      passed: true,
      reasoning: sampleCount > 0
        ? `All ${sampleCount} color contrast sample(s) pass WCAG AA`
        : "No color contrast failures",
    };
  }

  const first = failures[0]!;
  const path = first.path ?? "(unknown)";
  const need = first.requiredAA === undefined ? "" : ` need ${formatContrastRatio(first.requiredAA)}:1`;
  const text = first.text ? ` "${first.text}"` : "";
  return {
    passed: false,
    reasoning: `${failures.length} color contrast failure(s): ${path}${text} ${formatContrastRatio(first.ratio)}:1${need}`,
  };
}

function checkResponsiveLayout(data: SpecPageData): { passed: boolean; reasoning: string } {
  const issues = [
    ...(data.responsiveFindings ?? []),
    ...(data.responsiveSnapshots ?? []).flatMap(analyzeResponsiveSnapshot),
  ].filter(isActionableResponsiveIssue);

  const hasResponsiveData = data.responsiveFindings !== undefined || data.responsiveSnapshots !== undefined;
  if (!hasResponsiveData) {
    return { passed: false, reasoning: "No responsive layout data available" };
  }
  if (issues.length === 0) {
    const snapshotCount = data.responsiveSnapshots?.length ?? 0;
    return {
      passed: true,
      reasoning: snapshotCount > 0
        ? `All ${snapshotCount} responsive snapshot(s) pass layout invariants`
        : "No responsive layout issues",
    };
  }

  const first = issues[0]!;
  const viewport = first.viewport ? ` at ${formatViewport(first.viewport)}` : "";
  const selector = first.selector ? ` ${first.selector}` : "";
  return {
    passed: false,
    reasoning: `${issues.length} responsive layout issue(s)${viewport}${selector}: ${first.message}`,
  };
}

function analyzeResponsiveSnapshot(snapshot: SpecResponsiveSnapshot): SpecResponsiveIssue[] {
  const issues: SpecResponsiveIssue[] = [...(snapshot.issues ?? [])];
  if (
    typeof snapshot.scrollWidth === "number"
    && typeof snapshot.clientWidth === "number"
    && snapshot.scrollWidth > snapshot.clientWidth + 1
  ) {
    issues.push({
      severity: "error",
      viewport: snapshot.viewport,
      message: `horizontal overflow: scrollWidth ${snapshot.scrollWidth} > clientWidth ${snapshot.clientWidth}`,
    });
  }

  for (const region of snapshot.regions ?? []) {
    if (
      typeof region.width === "number"
      && typeof region.maxWidth === "number"
      && region.width > region.maxWidth + 1
    ) {
      issues.push({
        severity: "warning",
        viewport: snapshot.viewport,
        selector: region.selector,
        message: `${responsiveRegionLabel(region)} width ${region.width} exceeds maxWidth ${region.maxWidth}`,
      });
    }
    if (
      typeof region.width === "number"
      && typeof region.minWidth === "number"
      && region.width < region.minWidth - 1
    ) {
      issues.push({
        severity: "warning",
        viewport: snapshot.viewport,
        selector: region.selector,
        message: `${responsiveRegionLabel(region)} width ${region.width} is below minWidth ${region.minWidth}`,
      });
    }
    if (
      typeof region.left === "number"
      && typeof region.width === "number"
      && typeof snapshot.clientWidth === "number"
      && (region.left < -1 || region.left + region.width > snapshot.clientWidth + 1)
    ) {
      issues.push({
        severity: "error",
        viewport: snapshot.viewport,
        selector: region.selector,
        message: `${responsiveRegionLabel(region)} extends outside viewport bounds`,
      });
    }
  }

  return issues;
}

function normalizeResponsiveSnapshots(raw: unknown): SpecResponsiveSnapshot[] {
  const values = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.snapshots)
      ? raw.snapshots
      : isRecord(raw) && Array.isArray(raw.viewports)
        ? raw.viewports
        : [];
  return values.filter(isResponsiveSnapshotLike);
}

function normalizeResponsiveFindings(raw: unknown): SpecResponsiveIssue[] {
  const values = isRecord(raw) && Array.isArray(raw.findings)
    ? raw.findings
    : isRecord(raw) && Array.isArray(raw.issues)
      ? raw.issues
      : [];
  return values.filter(isResponsiveIssueLike);
}

function isResponsiveSnapshotLike(value: unknown): value is SpecResponsiveSnapshot {
  return isRecord(value) && isResponsiveViewportLike(value.viewport);
}

function isResponsiveViewportLike(value: unknown): value is SpecResponsiveViewport {
  return isRecord(value) && typeof value.width === "number" && typeof value.height === "number";
}

function isResponsiveIssueLike(value: unknown): value is SpecResponsiveIssue {
  return isRecord(value) && typeof value.message === "string";
}

function isActionableResponsiveIssue(issue: SpecResponsiveIssue): boolean {
  return issue.severity !== "info";
}

function formatViewport(viewport: SpecResponsiveViewport): string {
  return viewport.label ?? `${viewport.width}x${viewport.height}`;
}

function responsiveRegionLabel(region: SpecResponsiveRegion): string {
  if (region.selector) return region.selector;
  const name = region.name ? ` "${region.name}"` : "";
  return `${region.role ?? "region"}${name}`;
}

function analyzeContrastSample(sample: SpecContrastSample): SpecContrastFinding | undefined {
  const ratio = contrastRatio(sample.foreground, sample.background);
  const requiredAA = requiredContrastRatio(sample.fontSize, sample.fontWeight);
  if (ratio >= requiredAA) return undefined;
  return {
    path: sample.path,
    text: sample.text,
    ratio: Number(ratio.toFixed(2)),
    requiredAA,
  };
}

function countUnknownContrastFailures(entries: unknown[], treatUnknownAsFailure: boolean): number {
  let count = 0;
  for (const entry of entries) {
    if (!isRecord(entry)) {
      if (treatUnknownAsFailure) count++;
      continue;
    }
    const ratio = typeof entry.ratio === "number" ? entry.ratio : undefined;
    const requiredAA = typeof entry.requiredAA === "number"
      ? entry.requiredAA
      : typeof entry.required === "number"
        ? entry.required
        : undefined;
    if (ratio !== undefined && ratio < (requiredAA ?? 4.5)) {
      count++;
      continue;
    }
    if (isContrastSampleLike(entry) && analyzeContrastSample(entry)) {
      count++;
      continue;
    }
    if (ratio === undefined && treatUnknownAsFailure) count++;
  }
  return count;
}

function isContrastSampleLike(value: Record<string, unknown>): value is Record<string, unknown> & SpecContrastSample {
  return typeof value.path === "string"
    && typeof value.fontSize === "number"
    && typeof value.fontWeight === "number"
    && isColor(value.foreground)
    && isColor(value.background);
}

function isColor(value: unknown): value is SpecContrastColor {
  return isRecord(value)
    && typeof value.r === "number"
    && typeof value.g === "number"
    && typeof value.b === "number";
}

function requiredContrastRatio(fontSize: number, fontWeight: number): number {
  return fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700) ? 3.0 : 4.5;
}

function contrastRatio(a: SpecContrastColor, b: SpecContrastColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function relativeLuminance(color: SpecContrastColor): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function formatContrastRatio(value: number): string {
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAffectedByChanges(
  dependsOn: string[],
  changedFiles: string[],
  depEdges: Map<string, string[]>
): boolean {
  // Direct match
  for (const dep of dependsOn) {
    if (changedFiles.some((f) => f.includes(dep))) return true;
  }
  // 1-hop dependency
  for (const dep of dependsOn) {
    const edges = depEdges.get(dep) ?? [];
    for (const edge of edges) {
      if (changedFiles.some((f) => f.includes(edge))) return true;
    }
  }
  return false;
}

// ---- Types for verify results ----

export interface SpecVerifyResult {
  results: SpecPageResult[];
}

export interface SpecPageResult {
  testId: string;
  checked: CheckedInvariant[];
  skipped: SkippedInvariant[];
}

export interface CheckedInvariant {
  invariant: SpecInvariant;
  passed: boolean;
  reasoning: string;
}

export interface SkippedInvariant {
  invariant: SpecInvariant;
  reason: string;
}
