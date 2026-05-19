export type UiContractVersion = 1;

export type LandmarkRole =
  | "banner"
  | "navigation"
  | "main"
  | "complementary"
  | "contentinfo"
  | "region"
  | "search"
  | "form";

export interface UiContract {
  version: UiContractVersion;
  screens: UiContractScreen[];
}

export interface UiContractScreen {
  id: string;
  viewports: UiContractViewport[];
  landmarks: UiContractLandmark[];
}

export interface UiContractViewport {
  label: string;
  width: number;
  height: number;
  dpr?: number;
}

export interface UiContractLandmark {
  id: string;
  role: LandmarkRole;
  name: string;
  layout: UiLayoutContract;
  responsive?: UiResponsiveRule[];
}

export interface UiLayoutContract {
  width: UiWidthPolicy;
  height: UiHeightPolicy;
  display: UiDisplayPolicy;
  scroll: UiScrollPolicy;
}

export type UiWidthPolicy =
  | { kind: "fluid"; min?: number; max?: number }
  | { kind: "fixed"; value: number }
  | { kind: "intrinsic"; max?: number };

export type UiHeightPolicy =
  | { kind: "content"; min?: number; max?: number }
  | { kind: "fixed"; value: number }
  | { kind: "scrollport"; min?: number; max: number };

export type UiDisplayPolicy =
  | { kind: "block" }
  | { kind: "flex"; direction: "row" | "column"; gap?: number }
  | {
      kind: "grid";
      columns: string[];
      rows: string[];
      areas?: string[][];
      gap?: { row?: number; column?: number };
    }
  | { kind: "subgrid"; axis: "rows" | "columns" | "both" };

export interface UiScrollPolicy {
  x: boolean;
  y: boolean;
}

export interface UiResponsiveRule {
  viewport: string;
  width?: UiWidthPolicy;
  height?: UiHeightPolicy;
  display?: UiDisplayPolicy;
  scroll?: UiScrollPolicy;
}

export interface UiContractIssue {
  path: string;
  message: string;
}

export function validateUiContract(contract: UiContract): UiContractIssue[] {
  const issues: UiContractIssue[] = [];
  if (contract.version !== 1) {
    issues.push({ path: "version", message: "unsupported UI contract version" });
  }
  for (let si = 0; si < contract.screens.length; si++) {
    const screen = contract.screens[si]!;
    const screenPath = `screens[${si}]`;
    if (!screen.id) issues.push({ path: `${screenPath}.id`, message: "screen id is required" });
    const viewportLabels = new Set<string>();
    for (let vi = 0; vi < screen.viewports.length; vi++) {
      const vp = screen.viewports[vi]!;
      const vpPath = `${screenPath}.viewports[${vi}]`;
      if (!vp.label) issues.push({ path: `${vpPath}.label`, message: "viewport label is required" });
      if (viewportLabels.has(vp.label)) issues.push({ path: `${vpPath}.label`, message: "viewport label must be unique" });
      viewportLabels.add(vp.label);
      if (vp.width <= 0 || vp.height <= 0) {
        issues.push({ path: vpPath, message: "viewport width and height must be positive" });
      }
      if (vp.dpr !== undefined && vp.dpr <= 0) {
        issues.push({ path: `${vpPath}.dpr`, message: "viewport dpr must be positive" });
      }
    }
    for (let li = 0; li < screen.landmarks.length; li++) {
      const lm = screen.landmarks[li]!;
      const lmPath = `${screenPath}.landmarks[${li}]`;
      if ((lm.role as string) === "landmark") {
        issues.push({ path: `${lmPath}.role`, message: "abstract landmark role is not allowed; use a concrete landmark role" });
      }
      if (!lm.id) issues.push({ path: `${lmPath}.id`, message: "landmark id is required" });
      if ((lm.role === "region" || lm.role === "form") && !lm.name.trim()) {
        issues.push({ path: `${lmPath}.name`, message: `${lm.role} landmarks require an accessible name` });
      }
      validateWidthPolicy(lm.layout.width, `${lmPath}.layout.width`, issues);
      validateHeightPolicy(lm.layout.height, `${lmPath}.layout.height`, issues);
      validateDisplayPolicy(lm.layout.display, `${lmPath}.layout.display`, issues);
      for (let ri = 0; ri < (lm.responsive?.length ?? 0); ri++) {
        const rule = lm.responsive![ri]!;
        const rulePath = `${lmPath}.responsive[${ri}]`;
        if (!viewportLabels.has(rule.viewport)) {
          issues.push({ path: `${rulePath}.viewport`, message: "responsive rule references an unknown viewport" });
        }
        if (rule.width) validateWidthPolicy(rule.width, `${rulePath}.width`, issues);
        if (rule.height) validateHeightPolicy(rule.height, `${rulePath}.height`, issues);
        if (rule.display) validateDisplayPolicy(rule.display, `${rulePath}.display`, issues);
      }
    }
  }
  return issues;
}

function validateWidthPolicy(
  width: UiWidthPolicy,
  path: string,
  issues: UiContractIssue[],
): void {
  if (width.kind === "fluid" && width.min === undefined && width.max === undefined) {
    issues.push({ path, message: "fluid width must declare min or max" });
  }
  if (width.kind === "fixed" && width.value <= 0) {
    issues.push({ path, message: "fixed width must be positive" });
  }
}

function validateHeightPolicy(
  height: UiHeightPolicy,
  path: string,
  issues: UiContractIssue[],
): void {
  if (height.kind === "fixed" && height.value <= 0) {
    issues.push({ path, message: "fixed height must be positive" });
  }
  if (height.kind === "scrollport" && height.max <= 0) {
    issues.push({ path, message: "scrollport height must declare a positive max" });
  }
}

function validateDisplayPolicy(
  display: UiDisplayPolicy,
  path: string,
  issues: UiContractIssue[],
): void {
  if (display.kind === "grid") {
    if (display.columns.length === 0) {
      issues.push({ path: `${path}.columns`, message: "grid display requires at least one column track" });
    }
    if (display.rows.length === 0) {
      issues.push({ path: `${path}.rows`, message: "grid display requires at least one row track" });
    }
  }
}

export function summarizeUiContractLandmark(landmark: UiContractLandmark): string {
  const details = [
    summarizeWidth(landmark.layout.width),
    summarizeHeight(landmark.layout.height),
    summarizeScroll(landmark.layout.scroll),
    summarizeDisplay(landmark.layout.display),
  ].filter(Boolean).join(", ");
  return `${landmark.role} "${landmark.name}": ${details}`;
}

function summarizeWidth(width: UiWidthPolicy): string {
  switch (width.kind) {
    case "fixed":
      return `fixed ${width.value}px`;
    case "intrinsic":
      return width.max ? `intrinsic max ${width.max}px` : "intrinsic";
    case "fluid": {
      if (width.min !== undefined && width.max !== undefined) return `fluid ${width.min}px..${width.max}px`;
      if (width.min !== undefined) return `fluid min ${width.min}px`;
      if (width.max !== undefined) return `fluid max ${width.max}px`;
      return "fluid unbounded";
    }
  }
}

function summarizeHeight(height: UiHeightPolicy): string {
  switch (height.kind) {
    case "fixed":
      return `fixed-height ${height.value}px`;
    case "content":
      if (height.max !== undefined) return `content max ${height.max}px`;
      if (height.min !== undefined) return `content min ${height.min}px`;
      return "content";
    case "scrollport":
      return `scrollport max ${height.max}px`;
  }
}

function summarizeScroll(scroll: UiScrollPolicy): string {
  if (scroll.x && scroll.y) return "scroll-xy";
  if (scroll.x) return "scroll-x";
  if (scroll.y) return "scroll-y";
  return "no-scroll";
}

function summarizeDisplay(display: UiDisplayPolicy): string {
  switch (display.kind) {
    case "block":
      return "block";
    case "flex":
      return `flex ${display.direction}`;
    case "grid":
      return `grid ${display.columns.length}x${display.rows.length}`;
    case "subgrid":
      return `subgrid ${display.axis}`;
  }
}
