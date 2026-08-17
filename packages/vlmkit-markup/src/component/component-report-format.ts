/**
 * Rendering a component-from-image run as Markdown, and the summaries it prints.
 *
 * Extracted from `component-from-image.ts`, which was 1,867 lines containing two
 * unrelated things: a 729-line Playwright orchestrator (launch a browser, capture,
 * diff, write files) and this — 700 lines of pure formatting over the report the
 * orchestrator produced. Sharing a file meant none of the formatting could be
 * exercised without a browser, so in practice it was covered only through
 * end-to-end runs of the whole loop.
 *
 * Everything here is pure: a report in, a string out. No filesystem, no browser,
 * no clock. `node:path`'s `join` is string manipulation, not IO.
 *
 * The two types come back from `component-from-image.ts` as `import type`, which
 * is erased at compile time — the runtime dependency runs one way only, from the
 * orchestrator to this module. `ComponentFromImageReport` stays there because it
 * is that module's public output type and other files import it from there.
 */

import { join } from "node:path";
import type { HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import type {
  MatchedTextRow,
  RowGapDelta,
  TypographyMismatch,
} from "@mizchi/vlmkit-core/text-rows.ts";
import type { UiExpectedScrollportContract } from "../contract/ui-contract.ts";
import type { LandscapeDiffResult } from "../landscape-diff.ts";
import type { DominantBackgrounds } from "../style/palette-extract.ts";
import type { PaletteDiff } from "../style/palette-diff.ts";
import type { MatchedBbox } from "./component-bbox.ts";
import type { ComponentProbeState } from "./component-contract-plan.ts";
import type {
  ComponentCanvasEvidence,
  ComponentExpectedScrollportEvidence,
  ComponentExpressiveMenuEvidence,
  ComponentGoalEvaluation,
  ComponentLandingEvidence,
  ComponentScrollportEvidence,
} from "./component-goal.ts";
import type { ComponentFromImageReport, DeviceScaleFactorSuggestion } from "./component-from-image.ts";
import {
  describeLandmarkLayoutContract,
  describeScrollportStatus,
  selectNextSemanticDrilldown,
  type LandmarkRegion,
  type ScrollportRegion,
  type SemanticDrilldownEntry,
} from "./semantic-drilldown.ts";

export function summarizeScrollportEvidence(
  regions: ScrollportRegion[],
  expectedScrollports: UiExpectedScrollportContract[] = [],
): ComponentScrollportEvidence {
  const evidence: ComponentScrollportEvidence = {
    total: regions.length,
    ok: 0,
    broken: 0,
    empty: 0,
  };
  for (const region of regions) {
    const status = describeScrollportStatus(region).status;
    evidence[status]++;
  }
  if (expectedScrollports.length > 0) {
    evidence.expected = summarizeExpectedScrollports(regions, expectedScrollports);
  }
  return evidence;
}

export function formatScrollportEvidence(evidence: ComponentScrollportEvidence): string {
  const parts = [`${evidence.ok}/${evidence.total} ok`];
  if (evidence.broken > 0) parts.push(`${evidence.broken} broken`);
  if (evidence.empty > 0) parts.push(`${evidence.empty} empty`);
  if (evidence.expected && evidence.expected.total > 0) {
    parts.push(`expected ${evidence.expected.ok}/${evidence.expected.total} ok`);
    if (evidence.expected.missing > 0) parts.push(`${evidence.expected.missing} expected missing`);
    if (evidence.expected.broken > 0) parts.push(`${evidence.expected.broken} expected broken`);
    if (evidence.expected.empty > 0) parts.push(`${evidence.expected.empty} expected empty`);
  }
  return parts.join(", ");
}

function summarizeExpectedScrollports(
  regions: ScrollportRegion[],
  expectedScrollports: UiExpectedScrollportContract[],
): ComponentExpectedScrollportEvidence {
  const evidence: ComponentExpectedScrollportEvidence = {
    total: expectedScrollports.length,
    ok: 0,
    missing: 0,
    broken: 0,
    empty: 0,
    missingNames: [],
    brokenNames: [],
    emptyNames: [],
  };

  for (let i = 0; i < expectedScrollports.length; i++) {
    const expected = expectedScrollports[i]!;
    const label = expectedScrollportLabel(expected, i);
    const region = regions.find((candidate) => matchesExpectedScrollport(candidate, expected));
    if (!region) {
      evidence.missing++;
      evidence.missingNames.push(label);
      continue;
    }
    const status = expectedScrollportStatus(region, expected);
    if (status === "ok") evidence.ok++;
    else if (status === "broken") {
      evidence.broken++;
      evidence.brokenNames.push(label);
    } else {
      evidence.empty++;
      evidence.emptyNames.push(label);
    }
  }

  return evidence;
}

function matchesExpectedScrollport(region: ScrollportRegion, expected: UiExpectedScrollportContract): boolean {
  const candidates = new Set<string>();
  if (expected.name) candidates.add(expected.name);
  if (expected.id) candidates.add(expected.id);
  const selectorName = scrollportNameFromSelector(expected.selector);
  if (selectorName) candidates.add(selectorName);
  return candidates.has(region.name);
}

function expectedScrollportStatus(
  region: ScrollportRegion,
  expected: UiExpectedScrollportContract,
): "ok" | "broken" | "empty" {
  const status = describeScrollportStatus(region);
  if (status.status !== "ok") return status.status;
  if (!expected.axis) return "ok";
  if (expected.axis === "x") return status.scroll === "x" || status.scroll === "xy" ? "ok" : "broken";
  if (expected.axis === "y") return status.scroll === "y" || status.scroll === "xy" ? "ok" : "broken";
  return status.scroll === "xy" ? "ok" : "broken";
}

function expectedScrollportLabel(expected: UiExpectedScrollportContract, index: number): string {
  // `??` treats an empty string as present, so a contract entry with `id: ""` — which
  // the type permits, `id` being required — produced a BLANK label and the report read
  // `1 expected missing` with nothing named. The positional fallback exists for exactly
  // that case and was unreachable.
  const named = [expected.name, expected.id, scrollportNameFromSelector(expected.selector)]
    .find((candidate) => candidate !== undefined && candidate.trim() !== "");
  return named ?? `expected-${index + 1}`;
}

function scrollportNameFromSelector(selector: string | undefined): string | undefined {
  if (!selector) return undefined;
  const match = selector.match(/\bdata-(?:vlmkit-scrollport|ui-scrollport|scroll-region|scrollport)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\]\s]+))/u);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

export function formatLandingEvidence(evidence: ComponentLandingEvidence): string {
  const parts = [
    evidence.heroVisible ? "hero ok" : "hero missing",
    evidence.primaryCtaVisible ? "CTA ok" : "CTA missing",
    evidence.nextSectionHintVisible ? "next hint ok" : "next hint missing",
    evidence.mediaSlotVisible ? "media slot ok" : "media slot missing",
  ];
  return parts.join(", ");
}

export function formatCanvasEvidence(evidence: ComponentCanvasEvidence): string {
  const input = evidence.inputResponsive === true
    ? "input ok"
    : evidence.inputResponsive === false
      ? "input missing"
      : "input unknown";
  const stateHook = evidence.stateHook
    ? evidence.stateHookPresent === false
      ? `state hook missing: ${evidence.stateHook}`
      : `state hook ok: ${evidence.stateHook}`
    : undefined;
  const stateFields = formatCanvasStateFields(evidence);
  const parts = [
    evidence.nonblank ? "nonblank ok" : "blank",
    evidence.frameDelta ? "frame delta ok" : "frame delta missing",
    input,
    stateHook,
    stateFields,
  ].filter((part): part is string => part !== undefined);
  return parts.join(", ");
}

function formatCanvasStateFields(evidence: ComponentCanvasEvidence): string | undefined {
  if (evidence.missingStateFields && evidence.missingStateFields.length > 0) {
    return `state fields missing: ${evidence.missingStateFields.join("/")}`;
  }
  if (evidence.requiredStateFields && evidence.requiredStateFields.length > 0) {
    return `state fields ok: ${evidence.requiredStateFields.join("/")}`;
  }
  if (evidence.observedStateFields && evidence.observedStateFields.length > 0) {
    return `state fields observed: ${evidence.observedStateFields.join("/")}`;
  }
  return undefined;
}

function mdCodeList(values: string[]): string {
  return values.map((value) => `\`${value.replaceAll("`", "\\`")}\``).join(", ");
}

export function formatExpressiveMenuEvidence(evidence: ComponentExpressiveMenuEvidence): string {
  const parts = [
    evidence.selectedVisible ? "selected ok" : "selected missing",
    evidence.semanticMenuText ? "menu text ok" : "menu text missing",
    `items ${evidence.focusableItemCount}`,
    `composition ${evidence.compositionLayers}/${evidence.compositionShapes}`,
    evidence.diagonalEvidence ? "diagonal ok" : "diagonal missing",
    evidence.highContrast ? "contrast ok" : "contrast missing",
    `contrast min ${formatContrastRatio(evidence.minMenuContrastRatio)}`,
    `${evidence.lowContrastItemCount} low contrast`,
    formatStateSummary("hover", evidence.hoverChanged),
    formatStateSummary("focus", evidence.focusVisibleChanged),
  ];
  return parts.join(", ");
}

function formatStateSummary(label: string, value: boolean | null): string {
  if (value === true) return `${label} changed`;
  if (value === false) return `${label} inert`;
  return `${label} unprobed`;
}

function formatOptionalGate(value: boolean | null): string {
  if (value === true) return "ok";
  if (value === false) return "missing";
  return "not probed";
}

export interface RenderInput {
  targetImage: string;
  currentHtml: string;
  viewport: { width: number; height: number };
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  landscapeDiff: LandscapeDiffResult;
  goalEvaluation: ComponentGoalEvaluation;
  landmarkRegions: LandmarkRegion[];
  scrollportRegions: ScrollportRegion[];
  landingEvidence?: ComponentLandingEvidence;
  canvasEvidence?: ComponentCanvasEvidence;
  expressiveMenuEvidence?: ComponentExpressiveMenuEvidence;
  semanticDrilldown: SemanticDrilldownEntry[];
  heatmapPath?: string;
  currentPath: string;
  bboxMatches: MatchedBbox[];
  heatmapRegions: HeatmapRegion[];
  textRowMatches: MatchedTextRow[];
  rowGapDeltas: RowGapDelta[];
  typographyMismatches: TypographyMismatch[];
  baselineRowCount: number;
  variantRowCount: number;
  paletteDiff: PaletteDiff;
  targetBg?: DominantBackgrounds;
  currentBg?: DominantBackgrounds;
  stateResults: NonNullable<ComponentFromImageReport["states"]>;
  dpr: number;
  dprSuggestion?: DeviceScaleFactorSuggestion;
}

export function renderReportMarkdown(r: RenderInput): string {
  const lines: string[] = [];
  lines.push("# Component-from-image report");
  lines.push("");
  lines.push(`Target:  \`${r.targetImage}\` (${r.viewport.width}×${r.viewport.height})`);
  lines.push(`Current: \`${r.currentHtml}\``);
  if (r.dpr > 1) {
    lines.push(`Capture: DPR ${r.dpr} (${Math.round(r.viewport.width / r.dpr)}×${Math.round(r.viewport.height / r.dpr)} CSS px)`);
  }
  if (r.dprSuggestion) {
    lines.push(`DPR hint: ${r.dprSuggestion.reason}; try \`--dpr ${r.dprSuggestion.deviceScaleFactor}\` ` +
      `to render at ${r.dprSuggestion.cssViewport.width}×${r.dprSuggestion.cssViewport.height} CSS px.`);
  }
  lines.push("");
  const pct = (r.diffRatio * 100).toFixed(2);
  lines.push(`**Pixel diff**: ${pct}% (${r.diffPixels} of ${r.totalPixels} pixels)`);
  lines.push("");
  lines.push(`**Landscape diff**: ${(r.landscapeDiff.score * 100).toFixed(2)}% coarse ` +
    `(${(r.landscapeDiff.similarity * 100).toFixed(2)}% similarity, ` +
    `${r.landscapeDiff.changedCells}/${r.landscapeDiff.totalCells} changed cells, ` +
    `${r.landscapeDiff.grid.cols}×${r.landscapeDiff.grid.rows} grid)`);
  lines.push("");
  lines.push(`**Goal**: \`${r.goalEvaluation.goal}\` (${r.goalEvaluation.label}) — ` +
    `**${r.goalEvaluation.status}**`);
  lines.push("");
  lines.push(r.goalEvaluation.summary);
  lines.push("");
  if (r.heatmapPath) {
    lines.push("- Target:   `" + r.targetImage + "`");
    lines.push("- Current:  `" + r.currentPath + "`");
    lines.push("- Heatmap:  `" + r.heatmapPath + "`");
    lines.push("");
  }

  if (r.landscapeDiff.topCells.length > 0) {
    lines.push("## Landscape cell diff");
    lines.push("");
    lines.push("Coarse grid comparison of average color + ink density. Use this " +
      "before pixel-perfect work: it answers whether the large page regions " +
      "land in roughly the same places.");
    lines.push("");
    lines.push("| Cell | Box | Score | Target | Current |");
    lines.push("|---|---|---:|---|---|");
    for (const c of r.landscapeDiff.topCells) {
      lines.push(`| r${c.row} c${c.col} | ${c.x},${c.y} ${c.width}×${c.height} | ` +
        `${(c.score * 100).toFixed(1)}% | \`${c.baseline.hex}\` ink ${c.baseline.ink.toFixed(2)} | ` +
        `\`${c.current.hex}\` ink ${c.current.ink.toFixed(2)} |`);
    }
    lines.push("");
  }

  if (r.semanticDrilldown.length > 0) {
    lines.push("## Landmark drilldown");
    lines.push("");
    lines.push("Current DOM landmarks are used as semantic lenses over the visual " +
      "diff. This follows ARIA landmark practice: concrete roles such as " +
      "`banner`, `navigation`, `main`, `complementary`, `contentinfo`, " +
      "`region`, `search`, and named `form` are used; `role=\"landmark\"` " +
      "itself is ignored.");
    lines.push("");
    lines.push("The lanes are intentionally separate. Run the layout lane first " +
      "until section placement is stable, then use the decoration lane for " +
      "paint, media, and local text details.");
    lines.push("");
    const renderDrilldownRows = (rows: SemanticDrilldownEntry[], flow: "layout" | "decoration") => {
      const title = flow === "layout" ? "Layout lane" : "Decoration lane";
      const next = flow === "layout"
        ? "fix landmark geometry / spacing / section placement"
        : "fix colors / media / text styling after layout stabilizes";
      lines.push(`### ${title}`);
      lines.push("");
      if (rows.length === 0) {
        lines.push(`No ${flow} rows detected.`);
        lines.push("");
        return;
      }
      lines.push("| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |");
      lines.push("|---:|---|---|---|---|---|---|---:|---:|---|---|");
      for (const row of rows.slice(0, 8)) {
        const lm = row.landmark;
        const name = lm.name ? ` "${lm.name}"` : "";
        const box = `${lm.bbox.left},${lm.bbox.top} ${lm.bbox.width}×${lm.bbox.height}`;
        const contract = lm.layout ? describeLandmarkLayoutContract(lm.layout) : undefined;
        const evidence = `${row.landscapeCells.length} landscape cell(s), ` +
          `${row.heatmapRegions.length} heatmap region(s)`;
        lines.push(`| ${(row.priorityScore * 100).toFixed(1)} | ` +
          `\`${lm.role}${name}\` | ${box} | ` +
          `${contract?.width ?? "—"} | ${contract?.height ?? "—"} | ` +
          `${contract?.scroll ?? "—"} | ${contract?.grid ?? "—"} | ` +
          `${(row.layoutScore * 100).toFixed(1)}% | ` +
          `${(row.decorationScore * 100).toFixed(1)}% | ${evidence} | ${next} |`);
      }
      lines.push("");
    };
    const layoutRows = r.semanticDrilldown.filter((row) => row.flow === "layout");
    const decorationRows = r.semanticDrilldown.filter((row) => row.flow === "decoration");
    renderDrilldownRows(layoutRows, "layout");
    renderDrilldownRows(decorationRows, "decoration");
  } else if (r.landmarkRegions.length === 0) {
    lines.push("## Landmark drilldown");
    lines.push("");
    lines.push("No current DOM landmarks were detected. Add semantic wrappers " +
      "such as `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, " +
      "or named `<section>` regions before relying on visual drilldown.");
    lines.push("");
  }

  if (r.scrollportRegions.length > 0) {
    lines.push("## Scrollport inspector");
    lines.push("");
    lines.push("Explicit scrollport candidates from `data-scrollport`, " +
      "`data-vlmkit-scrollport`, `data-ui-scrollport`, or " +
      "`data-scroll-region`. This is separate from visual matching: an app " +
      "shell can pass landscape diff while the actual scroll container is wrong.");
    lines.push("");
    lines.push("| Status | Name | Box | Overflow | Client | Scroll | Reason |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const region of r.scrollportRegions.slice(0, 12)) {
      const status = describeScrollportStatus(region);
      const box = `${region.bbox.left},${region.bbox.top} ${region.bbox.width}×${region.bbox.height}`;
      const overflow = `${region.overflowX}/${region.overflowY}`;
      const client = `${region.clientWidth}×${region.clientHeight}`;
      const scroll = `${region.scrollWidth}×${region.scrollHeight}`;
      lines.push(`| ${status.status} | \`${region.name}\` | ${box} | ` +
        `${overflow} | ${client} | ${scroll} | ${status.reason} |`);
    }
    lines.push("");
  }

  if (r.landingEvidence) {
    lines.push("## Landing inspector");
    lines.push("");
    lines.push("Current DOM evidence for landing-page first-viewport gates. Use " +
      "`data-primary-cta`, `data-next-section`, and `data-media-slot` to make " +
      "the intended regions explicit.");
    lines.push("");
    lines.push("| Gate | Status |");
    lines.push("|---|---|");
    lines.push(`| Hero visible | ${r.landingEvidence.heroVisible ? "ok" : "missing"} |`);
    lines.push(`| Primary CTA visible | ${r.landingEvidence.primaryCtaVisible ? "ok" : "missing"} |`);
    lines.push(`| Next section hint visible | ${r.landingEvidence.nextSectionHintVisible ? "ok" : "missing"} |`);
    lines.push(`| Media slot visible | ${r.landingEvidence.mediaSlotVisible ? "ok" : "missing"} |`);
    lines.push("");
  }

  if (r.canvasEvidence) {
    lines.push("## Canvas inspector");
    lines.push("");
    lines.push("Current DOM canvas evidence for interactive/game-like surfaces. " +
      "This checks the rendered canvas, a short frame delta, and optional " +
      "`window.__gameState` response to `ArrowRight`.");
    lines.push("");
    lines.push("| Gate | Status |");
    lines.push("|---|---|");
    lines.push(`| Canvas count | ${r.canvasEvidence.canvasCount} |`);
    lines.push(`| Nonblank canvas | ${r.canvasEvidence.nonblank ? "ok" : "blank"} |`);
    lines.push(`| Frame delta | ${r.canvasEvidence.frameDelta ? "ok" : "missing"} |`);
    const input = r.canvasEvidence.inputResponsive === true
      ? "ok"
      : r.canvasEvidence.inputResponsive === false
        ? "missing"
        : "unknown";
    lines.push(`| Input response | ${input} |`);
    if (r.canvasEvidence.stateHook) {
      const hookStatus = r.canvasEvidence.stateHookPresent === false ? "missing" : "ok";
      lines.push(`| State hook | ${hookStatus}: \`${r.canvasEvidence.stateHook}\` |`);
    }
    if (r.canvasEvidence.requiredStateFields && r.canvasEvidence.requiredStateFields.length > 0) {
      const fieldStatus = r.canvasEvidence.missingStateFields && r.canvasEvidence.missingStateFields.length > 0
        ? `missing: ${mdCodeList(r.canvasEvidence.missingStateFields)}`
        : `ok: ${mdCodeList(r.canvasEvidence.requiredStateFields)}`;
      lines.push(`| Required state fields | ${fieldStatus} |`);
    } else if (r.canvasEvidence.observedStateFields && r.canvasEvidence.observedStateFields.length > 0) {
      lines.push(`| Observed state fields | ${mdCodeList(r.canvasEvidence.observedStateFields)} |`);
    }
    lines.push("");
  }

  if (r.expressiveMenuEvidence) {
    lines.push("## Expressive menu inspector");
    lines.push("");
    lines.push("Current DOM evidence for poster-like menu surfaces. This checks " +
      "semantic menu text and explicit composition metadata instead of asking " +
      "pixel diff to reproduce every slash, sticker, and overlap exactly.");
    lines.push("");
    lines.push("| Gate | Status |");
    lines.push("|---|---|");
    lines.push(`| Selected state visible | ${r.expressiveMenuEvidence.selectedVisible ? "ok" : "missing"} |`);
    lines.push(`| Focusable menu items | ${r.expressiveMenuEvidence.focusableItemCount} |`);
    lines.push(`| Semantic menu text | ${r.expressiveMenuEvidence.semanticMenuText ? "ok" : "missing"} |`);
    lines.push(`| Composition layers | ${r.expressiveMenuEvidence.compositionLayers} |`);
    lines.push(`| Composition shapes | ${r.expressiveMenuEvidence.compositionShapes} |`);
    lines.push(`| Diagonal / layered evidence | ${r.expressiveMenuEvidence.diagonalEvidence ? "ok" : "missing"} |`);
    lines.push(`| High contrast | ${r.expressiveMenuEvidence.highContrast ? "ok" : "missing"} |`);
    lines.push(`| Minimum menu contrast | ${formatContrastRatio(r.expressiveMenuEvidence.minMenuContrastRatio)} |`);
    lines.push(`| Low-contrast menu items | ${r.expressiveMenuEvidence.lowContrastItemCount} |`);
    lines.push(`| Contrast source | ${r.expressiveMenuEvidence.contrastSource ?? "unknown"} |`);
    lines.push(`| Hover state changes | ${formatOptionalGate(r.expressiveMenuEvidence.hoverChanged)} |`);
    lines.push(`| Focus-visible state changes | ${formatOptionalGate(r.expressiveMenuEvidence.focusVisibleChanged)} |`);
    lines.push("");
  }

  const meaningfulBboxes = r.bboxMatches.filter((m) =>
    Math.abs(m.deltaTop) > 1 || Math.abs(m.deltaLeft) > 1
    || Math.abs(m.deltaWidth) > 1 || Math.abs(m.deltaHeight) > 1,
  );
  if (meaningfulBboxes.length > 0) {
    lines.push("## Component bbox diff");
    lines.push("");
    lines.push("Largest non-background regions, matched by area-rank between " +
      "target and current. Δ shows position / size differences.");
    lines.push("");
    lines.push("| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |");
    lines.push("|---|---|---|---|---|");
    for (const m of meaningfulBboxes.slice(0, 8)) {
      const t = `${m.baseline.left},${m.baseline.top} ${m.baseline.width}×${m.baseline.height}`;
      const c = `${m.variant.left},${m.variant.top} ${m.variant.width}×${m.variant.height}`;
      const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
      lines.push(`| #${m.rank} | ${t} | ${c} | ${sign(m.deltaTop)} / ${sign(m.deltaLeft)} / ${sign(m.deltaWidth)} / ${sign(m.deltaHeight)} | ${m.iou} |`);
    }
    lines.push("");
  }

  if (r.heatmapRegions.length > 0) {
    lines.push("## Heatmap region clusters");
    lines.push("");
    lines.push("Each cluster is a contiguous run of differing pixels. `Fill` is " +
      "the dominant color sampled from the target inside the region. `Kind` " +
      "is a pixel-only content-type guess (text / filled-rect / icon / image).");
    lines.push("");
    lines.push("| Top-Left | Size | Hot pixels | Fill | Kind |");
    lines.push("|---|---|---|---|---|");
    for (const reg of r.heatmapRegions.slice(0, 8)) {
      const fill = reg.dominantColor ? `\`${reg.dominantColor.hex}\`` : "—";
      const kind = reg.kind ? `\`${reg.kind}\`${reg.kindConfidence !== undefined && reg.kindConfidence < 0.6 ? "?" : ""}` : "—";
      lines.push(`| ${reg.left},${reg.top} | ${reg.width}×${reg.height} | ${reg.area} | ${fill} | ${kind} |`);
    }
    lines.push("");
  }

  if (r.baselineRowCount !== r.variantRowCount || r.textRowMatches.length > 0) {
    lines.push("## Text-row Δy");
    lines.push("");
    lines.push(`Target has ${r.baselineRowCount} text rows; current has ${r.variantRowCount}.`);
    if (r.baselineRowCount !== r.variantRowCount) {
      lines.push("");
      lines.push("**Count mismatch** — current is missing rows of content " +
        "(or has spurious extras). Add the missing elements before tweaking CSS.");
    }
    if (r.textRowMatches.length > 0) {
      lines.push("");
      lines.push("| Rank | Target y | Current y | Δy |");
      lines.push("|---|---|---|---|");
      for (const m of r.textRowMatches.slice(0, 12)) {
        const signed = m.deltaY > 0 ? `+${m.deltaY}` : `${m.deltaY}`;
        lines.push(`| #${m.rank} | ${m.baseline.yCenter} | ${m.variant.yCenter} | ${signed}px |`);
      }
    }
    if (r.typographyMismatches.length > 0) {
      lines.push("");
      lines.push("**Typography mismatches** — per-row font-size / weight " +
        "estimated from band height and ink density. Estimates are " +
        "heuristic (snapped to nearest UI bucket); large jumps " +
        "(e.g. 16px → 24px, regular → bold) are reliable.");
      lines.push("");
      lines.push("| Rank | Target | Current | Kind |");
      lines.push("|---|---|---|---|");
      for (const m of r.typographyMismatches.slice(0, 12)) {
        const tgt = `${m.baselineFontSize ?? "?"}px ${m.baselineWeight ?? "?"}`;
        const cur = `${m.variantFontSize ?? "?"}px ${m.variantWeight ?? "?"}`;
        lines.push(`| #${m.rank} | ${tgt} | ${cur} | ${m.kind} |`);
      }
    }
    if (r.rowGapDeltas.length > 0) {
      lines.push("");
      lines.push("**Spacing fixes** — per-gap delta between consecutive text rows. " +
        "The fix is on the *preceding* element: if the gap above row #N is +6px, " +
        "reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.");
      lines.push("");
      lines.push("| Above → Below | Target gap | Current gap | Δgap | Suggested fix |");
      lines.push("|---|---|---|---|---|");
      for (const g of r.rowGapDeltas.slice(0, 12)) {
        const signed = g.delta > 0 ? `+${g.delta}` : `${g.delta}`;
        const fix = g.delta > 0
          ? `reduce preceding element's bottom space by ${g.delta}px`
          : `add ${Math.abs(g.delta)}px to preceding element's bottom space`;
        lines.push(`| #${g.aboveRank} → #${g.belowRank} | ${g.baselineGap}px | ${g.variantGap}px | ${signed}px | ${fix} |`);
      }
    }
    lines.push("");
  }

  if (r.targetBg) {
    lines.push("## Backgrounds");
    lines.push("");
    lines.push("Direct samples of the page bg (image perimeter) and inner bg " +
      "(central rectangle) — start here when setting `body` and content " +
      "container background colors.");
    lines.push("");
    lines.push("| Layer | Target | Current |");
    lines.push("|---|---|---|");
    const currOuter = r.currentBg ? `\`${r.currentBg.outer.hex}\`` : "—";
    const currInner = r.currentBg ? `\`${r.currentBg.inner.hex}\`` : "—";
    lines.push(`| outer (page) | \`${r.targetBg.outer.hex}\` | ${currOuter} |`);
    if (!r.targetBg.same) {
      lines.push(`| inner (content) | \`${r.targetBg.inner.hex}\` | ${currInner} |`);
    } else {
      lines.push("");
      lines.push("_(target outer and inner are the same; page is a single solid background.)_");
    }
    lines.push("");
  }

  if (r.paletteDiff.onlyInBaseline.length > 0 || r.paletteDiff.onlyInVariant.length > 0) {
    lines.push("## Palette diff");
    lines.push("");
    lines.push("`Nearest` column: Euclidean RGB distance to the closest color on " +
      "the other side. ≤ 30 = likely AA / quantization noise; > 60 = real palette gap.");
    lines.push("");
    lines.push("| Side | Color | Share | Nearest |");
    lines.push("|---|---|---|---|");
    const fmtNear = (d: number) => {
      if (!Number.isFinite(d)) return "—";
      const v = d.toFixed(0);
      if (d <= 30) return `${v} (near, likely AA)`;
      if (d <= 60) return `${v} (close)`;
      return v;
    };
    for (const c of r.paletteDiff.onlyInBaseline.slice(0, 8)) {
      lines.push(`| missing | \`${c.hex}\` | ${(c.share * 100).toFixed(1)}% | ${fmtNear(c.nearestNeighborDistance)} |`);
    }
    for (const c of r.paletteDiff.onlyInVariant.slice(0, 8)) {
      lines.push(`| extra | \`${c.hex}\` | ${(c.share * 100).toFixed(1)}% | ${fmtNear(c.nearestNeighborDistance)} |`);
    }
    lines.push("");
  }

  if (r.stateResults.length > 0) {
    lines.push("## State diff");
    lines.push("");
    lines.push("Each row: current HTML rendered with the named state applied, " +
      "diffed against the default render. Pseudo-classes are forced on " +
      "interactive elements; `scrolled` scrolls contract-targeted scrollports.");
    lines.push("");
    lines.push("- **Perceptual %**: pixelmatch at threshold 0.03 — what the eye " +
      "would notice. Filters anti-aliasing and subpixel jitter.");
    lines.push("- **Raw %**: any pixel where any RGB channel changed by ≥ 4. " +
      "Catches subtle hover effects (Δ10/channel shifts) that the perceptual " +
      "filter swallows.");
    lines.push("- **Edge %**: of all diff pixels, fraction within 4px of any " +
      "applied target bbox perimeter. High = outline-only change (likely UA default focus " +
      "ring); low = interior fill/text changed (author CSS).");
    lines.push("- **ΔLuma**: change in mean interior luminance of the applied " +
      "elements (state minus default). Negative = elements got darker; positive = " +
      "lighter. Typical `:hover` darkens (−5 to −30); a *large positive ΔLuma* on " +
      "an already-light state is a wrong-direction-shift suspect.");
    lines.push("- **Note**: `suspect` when both diff metrics are essentially zero. " +
      "`ua-likely` when only the outline changed and the interior is untouched " +
      "(catches missing author `:focus-visible` rules that the UA default hides). " +
      "`direction?` when ΔLuma > +15 on a state that conventionally darkens.");
    lines.push("");
    lines.push("| State | Perceptual % | Raw % | Edge % | ΔLuma | Applied | Note |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const s of r.stateResults) {
      const perceptZero = s.inducedDiffRatio < 0.0005;
      const rawZero = s.rawInducedDiffRatio < 0.0005;
      const uaLikely = s.forcedCount > 0 && !rawZero
        && s.edgeFraction > 0.85 && s.interiorPixels < 50;
      // Wrong-direction heuristic: hover/active are conventionally
      // darkening states. If they lighten by > 15 luma units on a
      // styled state (rawZero false), flag for verification. focus
      // and focus-visible may legitimately lighten via outline, so
      // skip them.
      const wrongDir = !rawZero
        && !uaLikely
        && (s.state === "hover" || s.state === "active")
        && s.lumaDelta !== null && s.lumaDelta > 15
        && s.lumaBefore !== null && s.lumaBefore > 160;
      const note = s.forcedCount > 0 && perceptZero && rawZero
        ? "**suspect** — state did not change rendering"
        : s.forcedCount > 0 && perceptZero && !rawZero
          ? "_subtle_ — only raw-pixel diff registers (check below the perceptual threshold)"
          : uaLikely
            ? "**ua-likely** — only the perimeter changed; author rule likely missing"
            : wrongDir
              ? `**direction?** — \`:${s.state}\` lightened by ${s.lumaDelta!.toFixed(0)} luma; verify this matches the intended hover direction`
              : "";
      const edgePct = s.edgeFraction > 0 ? (s.edgeFraction * 100).toFixed(0) + "%" : "—";
      const luma = s.lumaDelta === null
        ? "—"
        : (s.lumaDelta > 0 ? `+${s.lumaDelta.toFixed(1)}` : s.lumaDelta.toFixed(1));
      lines.push(`| \`${formatProbeState(s.state)}\` | ${(s.inducedDiffRatio * 100).toFixed(2)}% | ${(s.rawInducedDiffRatio * 100).toFixed(2)}% | ${edgePct} | ${luma} | ${s.forcedCount} | ${note} |`);
    }
    lines.push("");
  }

  // Suggested CSS patch — aggregates all actionable signals into one
  // paste-ready code block. Each line is either a hint comment or a
  // ready-to-paste declaration; the agent reads top-down.
  const cssHints: string[] = [];
  if (r.targetBg && r.currentBg) {
    if (r.targetBg.outer.hex.toLowerCase() !== r.currentBg.outer.hex.toLowerCase()) {
      cssHints.push(`body { background: ${r.targetBg.outer.hex}; }`);
    }
    if (!r.targetBg.same && r.targetBg.inner.hex.toLowerCase() !== r.currentBg.inner.hex.toLowerCase()) {
      cssHints.push(`/* content container should use background: ${r.targetBg.inner.hex} */`);
    }
  }
  if (r.baselineRowCount !== r.variantRowCount) {
    const diff = r.baselineRowCount - r.variantRowCount;
    cssHints.push(`/* HTML: ${diff > 0 ? "add" : "remove"} ${Math.abs(diff)} row(s) of content — target has ${r.baselineRowCount}, current has ${r.variantRowCount} */`);
  }
  for (const m of r.typographyMismatches.slice(0, 6)) {
    const props: string[] = [];
    if (m.baselineFontSize !== m.variantFontSize) props.push(`font-size: ${m.baselineFontSize}px`);
    if (m.baselineWeight !== m.variantWeight) {
      const weightMap: Record<string, string> = { light: "300", regular: "400", medium: "500", bold: "700" };
      const v = weightMap[m.baselineWeight ?? "regular"] ?? "400";
      props.push(`font-weight: ${v}`);
    }
    if (props.length > 0) {
      cssHints.push(`/* row #${m.rank}: ${props.join("; ")}; */`);
    }
  }
  for (const g of r.rowGapDeltas.slice(0, 6)) {
    const dir = g.delta > 0 ? "reduce" : "add";
    const amt = Math.abs(g.delta);
    cssHints.push(`/* row #${g.aboveRank}: ${dir} margin-bottom by ~${amt}px (target gap ${g.baselineGap}, current ${g.variantGap}) */`);
  }
  for (const reg of r.heatmapRegions.slice(0, 6)) {
    if (!reg.dominantColor || !reg.kind) continue;
    if (reg.kind === "filled-rect") {
      cssHints.push(`/* region ${reg.left},${reg.top} ${reg.width}×${reg.height}: background: ${reg.dominantColor.hex} */`);
    } else if (reg.kind === "text") {
      cssHints.push(`/* region ${reg.left},${reg.top} ${reg.width}×${reg.height}: color: ${reg.dominantColor.hex} (text) */`);
    } else if (reg.kind === "icon") {
      cssHints.push(`/* region ${reg.left},${reg.top} ${reg.width}×${reg.height}: icon — fill: ${reg.dominantColor.hex} */`);
    }
  }
  if (cssHints.length > 0) {
    lines.push("## Suggested CSS patch");
    lines.push("");
    lines.push("Aggregated from every actionable signal above. Each line is " +
      "either a paste-ready declaration or a `/* hint */` describing the " +
      "delta. Selectors are intentionally omitted (the tool can't see your " +
      "DOM); apply each declaration to whichever element matches the " +
      "described region or row.");
    lines.push("");
    lines.push("```css");
    for (const h of cssHints) lines.push(h);
    lines.push("```");
    lines.push("");
  }

  lines.push("## Suggested next step");
  lines.push("");
  const topDrilldown = selectNextSemanticDrilldown(r.semanticDrilldown);
  if (topDrilldown?.flow === "layout") {
    const lm = topDrilldown.landmark;
    const name = lm.name ? ` "${lm.name}"` : "";
    lines.push(`1. Start with the \`${lm.role}${name}\` landmark. Its coarse ` +
      "landscape cells changed, so fix section geometry, spacing, and " +
      "placement before chasing local colors.");
  } else if (topDrilldown?.flow === "decoration") {
    const lm = topDrilldown.landmark;
    const name = lm.name ? ` "${lm.name}"` : "";
    lines.push(`1. Start with decoration inside the \`${lm.role}${name}\` ` +
      "landmark. The coarse layout is relatively stable; fix local " +
      "paint, media, and text details.");
  } else if (r.baselineRowCount > r.variantRowCount) {
    lines.push("1. The current rendering is missing text rows — add the missing " +
      "HTML elements first. Bbox / palette tables tell you what styling they need.");
  } else {
    lines.push("1. Open the target and current PNGs side-by-side. Use the heatmap " +
      "region table to localize diff areas.");
  }
  lines.push("2. Cross-check the palette table — missing colors are the design tokens " +
    "the current rendering doesn't have (paste the hex values into your CSS).");
  lines.push("3. If bbox deltas are large, the current element's dimensions don't " +
    "match the target — adjust `width` / `padding` / `font-size` until they converge.");
  lines.push("4. Re-run `vlmkit build component` and check that diff %, bbox " +
    "deltas, heatmap regions, palette deltas all shrink toward zero.");
  lines.push("");
  return lines.join("\n");
}

function formatContrastRatio(value: number | null): string {
  return value === null ? "unknown" : value.toFixed(2);
}

export function formatProbeState(state: ComponentProbeState): string {
  return state === "scrolled" ? "scrolled" : `:${state}`;
}
