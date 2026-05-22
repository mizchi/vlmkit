import type { A11yNode, SpecInvariant } from "@mizchi/vlmkit-core/types.ts";
import { INTERACTIVE_ROLES } from "@mizchi/vlmkit-core/a11y-semantic.ts";

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

export interface SpecCheckOutcome {
  passed: boolean;
  reasoning: string;
}

export function checkSpecInvariant(inv: SpecInvariant, data: SpecPageData): SpecCheckOutcome {
  if (inv.check === "no-whiteout") {
    return {
      passed: data.screenshotExists,
      reasoning: data.screenshotExists ? "Screenshot exists" : "No screenshot",
    };
  }

  if (inv.check === "color-contrast") {
    return checkColorContrast(data);
  }

  if (inv.check === "responsive-layout") {
    return checkResponsiveLayout(data);
  }

  if (!data.a11yTree) {
    return { passed: false, reasoning: "No a11y tree available" };
  }

  switch (inv.check) {
    case "landmark-exists": {
      const found = findRole(data.a11yTree, extractRoleFromDesc(inv.description));
      return { passed: found, reasoning: found ? "Landmark found" : "Landmark not found" };
    }
    case "label-present": {
      const unlabeled = countUnlabeled(data.a11yTree);
      return { passed: unlabeled === 0, reasoning: `${unlabeled} unlabeled element(s)` };
    }
    case "no-error-state":
      return { passed: true, reasoning: "Heuristic check (a11y-based) — OK" };
    case "element-count": {
      const match = inv.description.match(/^(\d+)\s+(\w+)\s+element/);
      if (!match) return { passed: true, reasoning: "Could not parse element-count invariant" };
      const expectedCount = parseInt(match[1], 10);
      const role = match[2];
      const actualCount = countRole(data.a11yTree, role);
      const passed = actualCount === expectedCount;
      return {
        passed,
        reasoning: passed
          ? `${role}: ${actualCount} found (expected ${expectedCount})`
          : `${role}: ${actualCount} found but expected ${expectedCount}`,
      };
    }
    case "heading-hierarchy":
      return checkHeadingHierarchy(data.a11yTree);
    case "aria-relationships":
      return checkAriaRelationships(data.a11yTree);
    default:
      return { passed: true, reasoning: `Check "${inv.check ?? "none"}" — passed (no verifier)` };
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

function checkHeadingHierarchy(tree: A11yNode): SpecCheckOutcome {
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

export function countNodeAriaRelationshipRefs(node: A11yNode): number {
  let count = 0;
  for (const field of ARIA_RELATIONSHIP_FIELDS) {
    for (const key of field.keys) {
      count += normalizeAriaReferenceValue(readA11yNodeValue(node, key)).length;
    }
  }
  return count;
}

function checkAriaRelationships(tree: A11yNode): SpecCheckOutcome {
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

function checkColorContrast(data: SpecPageData): SpecCheckOutcome {
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

function checkResponsiveLayout(data: SpecPageData): SpecCheckOutcome {
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

export function analyzeResponsiveSnapshot(snapshot: SpecResponsiveSnapshot): SpecResponsiveIssue[] {
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

export function isResponsiveSnapshotLike(value: unknown): value is SpecResponsiveSnapshot {
  return isRecord(value) && isResponsiveViewportLike(value.viewport);
}

function isResponsiveViewportLike(value: unknown): value is SpecResponsiveViewport {
  return isRecord(value) && typeof value.width === "number" && typeof value.height === "number";
}

export function isResponsiveIssueLike(value: unknown): value is SpecResponsiveIssue {
  return isRecord(value) && typeof value.message === "string";
}

export function isActionableResponsiveIssue(issue: SpecResponsiveIssue): boolean {
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

export function analyzeContrastSample(sample: SpecContrastSample): SpecContrastFinding | undefined {
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

export function countUnknownContrastFailures(entries: unknown[], treatUnknownAsFailure: boolean): number {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
