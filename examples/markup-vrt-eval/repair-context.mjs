import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PNG } from "pngjs";
import { findErrorContext, findVrtArtifacts } from "../../packages/vlmkit-heal/src/capture.ts";
import {
  matchRegionBboxToElement,
  parseRegionElementsJson,
} from "../../packages/vlmkit-markup/src/region-selector-match.ts";

const STYLE_PROPERTIES = [
  "display",
  "position",
  "top",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "align-content",
  "align-items",
  "justify-content",
  "background-color",
  "color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-color",
  "box-shadow",
  "font-size",
  "line-height",
];

const LAYOUT_PROPERTIES = new Set([
  "display",
  "position",
  "top",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "align-content",
  "align-items",
  "justify-content",
]);

const PAINT_PROPERTIES = new Set([
  "background-color",
  "color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-color",
  "box-shadow",
]);

export async function buildRepairContext(options) {
  const root = options.root ?? process.cwd();
  const outputDir = options.outputDir;
  const artifactPaths = await findLatestVrtArtifactPaths(resolve(root, outputDir));
  const artifacts = findVrtArtifacts(root, outputDir);
  const errorContext = findErrorContext(root, outputDir);
  const visualContext = await readVisualContext(options.visualContextPath);
  const visualElements = parseRegionElementsJson(JSON.stringify(visualContext ?? {}));
  const imageDiff = artifacts.baseline && artifacts.actual
    ? analyzePngDiff(artifacts.baseline, artifacts.actual, visualElements)
    : null;
  const playwrightFailure = await readPlaywrightFailure(options.playwrightReportPath);
  const stableVisual = visualContext?.variants?.stable ?? visualContext;
  const regressionVisual = visualContext?.variants?.regression ?? null;
  const styleAttribution = imageDiff
    ? attributeCssProperties(imageDiff, stableVisual?.elements ?? [], regressionVisual?.elements ?? [])
    : emptyStyleAttribution();
  const semanticDiff = diffSemanticSnapshots(stableVisual?.semantic ?? null, regressionVisual?.semantic ?? null);
  const drift = classifyDrift({ imageDiff, semanticDiff, styleAttribution });

  return {
    generatedAt: new Date().toISOString(),
    tools: [
      "@mizchi/vlmkit-heal/findVrtArtifacts",
      "@mizchi/vlmkit-heal/findErrorContext",
      "@mizchi/vlmkit-markup/matchRegionBboxToElement",
      "pngjs",
      "playwright-json-reporter",
      "computed-style-attribution",
      "semantic-snapshot-diff",
    ],
    failure: {
      kind: classifyFailure(playwrightFailure, imageDiff),
      title: playwrightFailure?.title ?? null,
      message: firstLine(playwrightFailure?.message ?? ""),
      location: playwrightFailure?.location ?? null,
      screenshotName: playwrightFailure?.screenshotName ?? null,
      regressionExitCode: options.regression?.exitCode ?? null,
    },
    artifacts: {
      playwrightReport: options.playwrightReportPath,
      visualContext: options.visualContextPath,
      expectedPng: artifactPaths.expected ?? null,
      actualPng: artifactPaths.actual ?? null,
      diffPng: artifactPaths.diff ?? null,
      errorContext: artifactPaths.errorContext ?? null,
    },
    imageDiff,
    styleAttribution,
    semanticDiff,
    drift,
    locatorContext: await readJsonIfExists(options.locatorsPath),
    visualElementCount: visualElements.length,
    errorContextExcerpt: excerptErrorContext(errorContext),
    repairHints: buildRepairHints({
      imageDiff,
      playwrightFailure,
      generatedTestPath: options.generatedTestPath,
      requestPath: options.requestPath,
      planPath: options.planPath,
      rulesPath: options.rulesPath,
      styleAttribution,
      drift,
    }),
  };
}

export function analyzePngDiff(baselineBuffer, actualBuffer, elements = []) {
  const baseline = PNG.sync.read(baselineBuffer);
  const actual = PNG.sync.read(actualBuffer);
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return {
      width: actual.width,
      height: actual.height,
      changedPixels: null,
      totalPixels: actual.width * actual.height,
      diffRatio: null,
      bbox: null,
      averageBaselineColor: null,
      averageActualColor: null,
      selectorMatches: [],
      hints: ["Screenshot dimensions changed; inspect responsive layout, viewport, and page height first."],
    };
  }

  let minX = baseline.width;
  let minY = baseline.height;
  let maxX = -1;
  let maxY = -1;
  let changedPixels = 0;
  const baselineSum = [0, 0, 0, 0];
  const actualSum = [0, 0, 0, 0];

  for (let y = 0; y < baseline.height; y++) {
    for (let x = 0; x < baseline.width; x++) {
      const i = (y * baseline.width + x) * 4;
      const dr = Math.abs(baseline.data[i] - actual.data[i]);
      const dg = Math.abs(baseline.data[i + 1] - actual.data[i + 1]);
      const db = Math.abs(baseline.data[i + 2] - actual.data[i + 2]);
      const da = Math.abs(baseline.data[i + 3] - actual.data[i + 3]);
      if (dr + dg + db + da === 0) continue;
      changedPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let c = 0; c < 4; c++) {
        baselineSum[c] += baseline.data[i + c];
        actualSum[c] += actual.data[i + c];
      }
    }
  }

  const totalPixels = baseline.width * baseline.height;
  const bbox = changedPixels > 0
    ? { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;
  const selectorMatches = bbox
    ? elements
      .map((element) => matchRegionBboxToElement(bbox, [element]))
      .filter(Boolean)
      .sort((a, b) => b.evidence.score - a.evidence.score)
      .slice(0, 5)
    : [];
  const edgeCandidates = bbox ? findEdgeCandidates(bbox, elements).slice(0, 6) : [];
  const result = {
    width: baseline.width,
    height: baseline.height,
    changedPixels,
    totalPixels,
    diffRatio: round(changedPixels / totalPixels),
    bbox,
    averageBaselineColor: changedPixels > 0 ? averageColor(baselineSum, changedPixels) : null,
    averageActualColor: changedPixels > 0 ? averageColor(actualSum, changedPixels) : null,
    selectorMatches,
    edgeCandidates,
    hints: [],
  };
  result.hints = buildImageDiffHints(result);
  return result;
}

export function renderRepairContextMarkdown(context) {
  const lines = [
    "# Repair Context",
    "",
    `- Failure kind: ${context.failure.kind}`,
    `- Screenshot: ${context.failure.screenshotName ?? "unknown"}`,
    `- Message: ${context.failure.message || "n/a"}`,
    "",
    "## Image Diff",
    "",
  ];
  if (context.imageDiff?.bbox) {
    lines.push(
      `- Diff ratio: ${(context.imageDiff.diffRatio * 100).toFixed(2)}%`,
      `- BBox: left ${context.imageDiff.bbox.left}, top ${context.imageDiff.bbox.top}, width ${context.imageDiff.bbox.width}, height ${context.imageDiff.bbox.height}`,
      `- Average baseline color: ${context.imageDiff.averageBaselineColor}`,
      `- Average actual color: ${context.imageDiff.averageActualColor}`,
    );
  } else {
    lines.push("- No comparable PNG diff was found.");
  }
  lines.push("", "## Selector Matches", "");
  if (context.imageDiff?.selectorMatches?.length) {
    for (const match of context.imageDiff.selectorMatches) {
      lines.push(`- ${match.selector} (${match.confidence}, score ${match.evidence.score})`);
    }
  } else {
    lines.push("- No DOM element match.");
  }
  lines.push("", "## Top Edge Candidates", "");
  if (context.imageDiff?.edgeCandidates?.length) {
    for (const candidate of context.imageDiff.edgeCandidates) {
      lines.push(`- ${candidate.selector} (${candidate.reason})`);
    }
  } else {
    lines.push("- No top-edge candidate.");
  }
  lines.push("", "## CSS Property Attribution", "");
  if (context.styleAttribution?.changedProperties?.length) {
    for (const row of context.styleAttribution.changedProperties.slice(0, 10)) {
      lines.push(`- ${row.selector}: ${row.property} \`${row.before}\` -> \`${row.after}\` (${row.category}, score ${row.score})`);
    }
  } else {
    lines.push("- No candidate computed-style delta.");
  }
  lines.push("", "## Drift Classification", "");
  lines.push(`- Kind: ${context.drift?.kind ?? "unknown"}`);
  lines.push(`- Primary cause: ${context.drift?.primaryCause ?? "unknown"}`);
  lines.push(`- Semantic changed: ${context.semanticDiff?.changed ? "yes" : "no"}`);
  lines.push("", "## Repair Hints", "");
  for (const hint of context.repairHints) lines.push(`- ${hint}`);
  lines.push("", "## Artifacts", "");
  for (const [key, value] of Object.entries(context.artifacts)) {
    if (value) lines.push(`- ${key}: \`${value}\``);
  }
  lines.push("");
  return lines.join("\n");
}

async function readVisualContext(path) {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonIfExists(path) {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8"));
}

async function readPlaywrightFailure(path) {
  if (!path || !existsSync(path)) return null;
  const report = JSON.parse(await readFile(path, "utf8"));
  for (const suite of report.suites ?? []) {
    const failure = findFailureInSuite(suite, []);
    if (failure) return failure;
  }
  return null;
}

function findFailureInSuite(suite, parents) {
  const nextParents = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        const error = result.errors?.[0] ?? result.error;
        if (!error) continue;
        return {
          title: [...nextParents, spec.title].filter(Boolean).join(" > "),
          message: error.message ?? "",
          location: error.location ?? null,
          screenshotName: extractScreenshotName(error.message ?? error.stack ?? ""),
        };
      }
    }
  }
  for (const child of suite.suites ?? []) {
    const failure = findFailureInSuite(child, nextParents);
    if (failure) return failure;
  }
  return null;
}

async function findLatestVrtArtifactPaths(outputDir) {
  const candidates = {
    expected: await newestPath(outputDir, "-expected.png"),
    actual: await newestPath(outputDir, "-actual.png"),
    diff: await newestPath(outputDir, "-diff.png"),
    errorContext: await newestPath(outputDir, "error-context.md"),
  };
  return candidates;
}

async function newestPath(dir, suffix) {
  let best = null;
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith(suffix)) {
        const fileStat = await stat(path);
        if (!best || fileStat.mtimeMs > best.mtimeMs) best = { path, mtimeMs: fileStat.mtimeMs };
      }
    }
  }
  await walk(dir);
  return best?.path ? relative(process.cwd(), best.path) : null;
}

function classifyFailure(playwrightFailure, imageDiff) {
  const message = playwrightFailure?.message ?? "";
  if (/toHaveScreenshot|pixels? .*different|Screenshot/i.test(message)) return "vrt-diff";
  if (imageDiff?.changedPixels > 0) return "image-diff";
  return "unknown";
}

function buildRepairHints({
  imageDiff,
  playwrightFailure,
  generatedTestPath,
  requestPath,
  planPath,
  rulesPath,
  styleAttribution,
  drift,
}) {
  const hints = [];
  const line = playwrightFailure?.location?.line;
  if (generatedTestPath) {
    hints.push(`Start from the generated assertion at ${generatedTestPath}${line ? `:${line}` : ""}.`);
  }
  if (imageDiff?.hints?.length) hints.push(...imageDiff.hints);
  if (imageDiff?.selectorMatches?.length) {
    const selectors = imageDiff.selectorMatches.map((match) => match.selector).join(", ");
    hints.push(`Inspect CSS for matched selector candidates: ${selectors}.`);
  }
  if (imageDiff?.edgeCandidates?.length) {
    const selectors = imageDiff.edgeCandidates.slice(0, 4).map((candidate) => candidate.selector).join(", ");
    hints.push(`Also inspect elements near the first changed row: ${selectors}.`);
  }
  if (styleAttribution?.changedProperties?.length) {
    const props = styleAttribution.changedProperties.slice(0, 4)
      .map((row) => `${row.selector} ${row.property}`)
      .join(", ");
    hints.push(`Prioritize computed-style deltas: ${props}.`);
  }
  if (drift?.kind === "visual-only") {
    hints.push(`Semantic snapshot is unchanged; repair should target visual CSS or baseline approval, not locator semantics.`);
  } else if (drift?.kind === "semantic-regression") {
    hints.push(`Semantic snapshot changed; inspect accessible text, roles, and test-id state before approving screenshots.`);
  }
  if (requestPath && planPath && rulesPath) {
    hints.push(`Keep any fix aligned with ${requestPath}, ${planPath}, and ${rulesPath}; do not weaken the generated scenario.`);
  }
  return [...new Set(hints)];
}

export function attributeCssProperties(imageDiff, baselineElements = [], actualElements = []) {
  const baselineCandidates = selectCandidateElements(imageDiff, baselineElements);
  const actualByKey = new Map(actualElements.map((element) => [elementKey(element), element]));
  const actualByPath = new Map(actualElements.map((element) => [element.path, element]));
  const actualBySelector = groupBy(actualElements, (element) => selectorHintForElement(element));
  const changedProperties = [];
  const rectDeltas = [];

  for (const base of baselineCandidates) {
    const actual = actualByKey.get(elementKey(base))
      ?? actualByPath.get(base.path)
      ?? nearestElement(base, actualBySelector.get(selectorHintForElement(base)) ?? []);
    if (!actual) continue;
    const rectDelta = buildRectDelta(base, actual);
    if (hasRectDelta(rectDelta)) rectDeltas.push(rectDelta);
    for (const property of STYLE_PROPERTIES) {
      const before = styleValue(base, property);
      const after = styleValue(actual, property);
      if (!before && !after) continue;
      if (normalizeStyleValue(before) === normalizeStyleValue(after)) continue;
      const category = propertyCategory(property);
      changedProperties.push({
        selector: selectorHintForElement(base),
        path: base.path,
        property,
        category,
        before,
        after,
        score: scoreStyleDelta({ property, category, base, actual, imageDiff, rectDelta }),
      });
    }
  }

  changedProperties.sort((a, b) =>
    b.score - a.score
    || propertyRank(a.property) - propertyRank(b.property)
    || a.selector.localeCompare(b.selector)
    || a.property.localeCompare(b.property)
  );
  rectDeltas.sort((a, b) => b.score - a.score || a.selector.localeCompare(b.selector));
  return {
    changedProperties: changedProperties.slice(0, 16),
    rectDeltas: rectDeltas.slice(0, 8),
    hints: buildStyleAttributionHints(changedProperties, rectDeltas),
  };
}

export function diffSemanticSnapshots(baseline, actual) {
  if (!baseline || !actual) {
    return {
      changed: false,
      missingContext: true,
      additions: [],
      removals: [],
      changedValues: [],
    };
  }
  const before = flattenSemanticSnapshot(baseline);
  const after = flattenSemanticSnapshot(actual);
  const beforeMap = new Map(before.map((entry) => [entry.key, entry.value]));
  const afterMap = new Map(after.map((entry) => [entry.key, entry.value]));
  const additions = [];
  const removals = [];
  const changedValues = [];
  for (const [key, value] of beforeMap) {
    if (!afterMap.has(key)) removals.push({ key, value });
    else if (afterMap.get(key) !== value) changedValues.push({ key, before: value, after: afterMap.get(key) });
  }
  for (const [key, value] of afterMap) {
    if (!beforeMap.has(key)) additions.push({ key, value });
  }
  return {
    changed: additions.length > 0 || removals.length > 0 || changedValues.length > 0,
    missingContext: false,
    additions,
    removals,
    changedValues,
  };
}

export function classifyDrift({ imageDiff, semanticDiff, styleAttribution }) {
  if (semanticDiff?.changed) {
    return {
      kind: "semantic-regression",
      primaryCause: "semantic",
      reason: "semantic snapshot changed between stable and regression variants",
    };
  }
  if (!imageDiff || !imageDiff.changedPixels) {
    return {
      kind: "no-diff",
      primaryCause: "none",
      reason: "no changed image pixels were measured",
    };
  }
  const topCategory = styleAttribution?.changedProperties?.[0]?.category ?? null;
  if (topCategory) {
    return {
      kind: "visual-only",
      primaryCause: topCategory,
      reason: `image changed while semantic snapshot stayed stable; top style category is ${topCategory}`,
    };
  }
  return {
    kind: "visual-only",
    primaryCause: "unknown-css",
    reason: "image changed while semantic snapshot stayed stable, but no computed-style delta was attributed",
  };
}

function emptyStyleAttribution() {
  return {
    changedProperties: [],
    rectDeltas: [],
    hints: [],
  };
}

function selectCandidateElements(imageDiff, elements) {
  const candidateKeys = new Set();
  const candidateSelectors = new Set();
  for (const match of imageDiff?.selectorMatches ?? []) {
    if (match.evidence?.path) candidateKeys.add(match.evidence.path);
    if (match.selector) candidateSelectors.add(match.selector);
  }
  for (const candidate of imageDiff?.edgeCandidates ?? []) {
    if (candidate.path) candidateKeys.add(candidate.path);
    if (candidate.selector) candidateSelectors.add(candidate.selector);
  }
  const candidates = elements.filter((element) =>
    candidateKeys.has(element.key)
    || candidateKeys.has(element.path)
    || candidateSelectors.has(selectorHintForElement(element))
  );
  return candidates.length > 0 ? uniqueElements(candidates) : elements.slice(0, 12);
}

function uniqueElements(elements) {
  const seen = new Set();
  const out = [];
  for (const element of elements) {
    const key = elementKey(element);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(element);
  }
  return out;
}

function elementKey(element) {
  return element.key ?? element.path ?? `${selectorHintForElement(element)}:${element.left}:${element.top}`;
}

function styleValue(element, property) {
  return element.styles?.[property] ?? "";
}

function normalizeStyleValue(value) {
  return String(value ?? "").trim();
}

function propertyCategory(property) {
  if (LAYOUT_PROPERTIES.has(property)) return "layout";
  if (PAINT_PROPERTIES.has(property)) return "paint";
  if (property === "font-size" || property === "line-height") return "text";
  return "style";
}

function propertyRank(property) {
  const ranks = {
    "min-height": 0,
    height: 1,
    "grid-template-columns": 2,
    gap: 3,
    "row-gap": 4,
    "column-gap": 5,
    "padding-top": 6,
    "padding-bottom": 7,
    "margin-top": 8,
    "margin-bottom": 9,
    "background-color": 10,
    "border-color": 11,
    "border-top-color": 12,
    color: 13,
  };
  return ranks[property] ?? 50;
}

function scoreStyleDelta({ property, category, base, actual, imageDiff, rectDelta }) {
  let score = 1;
  score += Math.max(0, 20 - propertyRank(property)) / 10;
  if (category === "layout" && hasRectDelta(rectDelta)) score += 3;
  if (category === "layout" && imageDiff?.bbox && imageDiff.bbox.height / imageDiff.height > 0.25) score += 1;
  if (category === "paint" && colorDistance(imageDiff?.averageBaselineColor, imageDiff?.averageActualColor) > 10) score += 1;
  score += Math.min(2, Math.abs((actual.height ?? 0) - (base.height ?? 0)) / 16);
  return round(score);
}

function buildRectDelta(base, actual) {
  return {
    selector: selectorHintForElement(base),
    path: base.path,
    topDelta: Math.round((actual.top ?? 0) - (base.top ?? 0)),
    leftDelta: Math.round((actual.left ?? 0) - (base.left ?? 0)),
    widthDelta: Math.round((actual.width ?? 0) - (base.width ?? 0)),
    heightDelta: Math.round((actual.height ?? 0) - (base.height ?? 0)),
    score: round(
      Math.abs((actual.top ?? 0) - (base.top ?? 0))
      + Math.abs((actual.left ?? 0) - (base.left ?? 0))
      + Math.abs((actual.width ?? 0) - (base.width ?? 0))
      + Math.abs((actual.height ?? 0) - (base.height ?? 0)),
    ),
  };
}

function hasRectDelta(delta) {
  return !!delta && (
    delta.topDelta !== 0
    || delta.leftDelta !== 0
    || delta.widthDelta !== 0
    || delta.heightDelta !== 0
  );
}

function nearestElement(base, candidates) {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) =>
    elementDistance(base, a) - elementDistance(base, b)
  )[0] ?? null;
}

function elementDistance(a, b) {
  return Math.abs((a.left ?? 0) - (b.left ?? 0)) + Math.abs((a.top ?? 0) - (b.top ?? 0));
}

function groupBy(values, keyFn) {
  const map = new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }
  return map;
}

function buildStyleAttributionHints(changedProperties, rectDeltas) {
  const hints = [];
  const top = changedProperties[0];
  if (top) {
    hints.push(`Top computed-style candidate: ${top.selector} ${top.property} changed from ${top.before} to ${top.after}.`);
  }
  const layout = changedProperties.find((row) => row.category === "layout");
  if (layout) {
    hints.push(`Layout-affecting property changed: ${layout.selector} ${layout.property}.`);
  }
  const paint = changedProperties.find((row) => row.category === "paint");
  if (paint) {
    hints.push(`Paint property also changed: ${paint.selector} ${paint.property}.`);
  }
  const rect = rectDeltas[0];
  if (rect) {
    hints.push(`Largest rect delta: ${rect.selector} height ${rect.heightDelta}px, top ${rect.topDelta}px.`);
  }
  return hints;
}

function flattenSemanticSnapshot(value, prefix = "") {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenSemanticSnapshot(item, `${prefix}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.keys(value).sort().flatMap((key) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return flattenSemanticSnapshot(value[key], nextPrefix);
    });
  }
  return [{ key: prefix, value: String(value) }];
}

function buildImageDiffHints(result) {
  if (!result.bbox) return ["No visual diff pixels were measured."];
  const hints = [];
  const bboxBottom = result.bbox.top + result.bbox.height;
  const nearFullWidth = result.bbox.width / result.width > 0.75;
  const tallDiff = result.bbox.height / result.height > 0.35;
  if (nearFullWidth || tallDiff) {
    hints.push("The diff spans a large area; first inspect layout-affecting CSS such as height, min-height, margin, padding, grid, or gap near the top of the bbox.");
  }
  const colorDelta = colorDistance(result.averageBaselineColor, result.averageActualColor);
  if (colorDelta > 20) {
    hints.push("Average changed-pixel color moved noticeably; inspect background-color, color, border-color, fill, and box-shadow before changing layout.");
  }
  if (bboxBottom >= result.height - 2) {
    hints.push("The diff reaches the page bottom; a vertical shift or changed section height may be cascading through later content.");
  }
  for (const match of result.selectorMatches) {
    hints.push(`Diff bbox overlaps ${match.selector} (${match.confidence}, region coverage ${match.evidence.regionCoverage}).`);
  }
  for (const candidate of result.edgeCandidates.slice(0, 3)) {
    hints.push(`Diff begins near ${candidate.selector}; this is a likely upstream layout or paint source.`);
  }
  return hints;
}

function findEdgeCandidates(bbox, elements) {
  const topBand = {
    left: bbox.left,
    top: Math.max(0, bbox.top - 48),
    width: bbox.width,
    height: 96,
  };
  const candidates = [];
  for (const element of elements) {
    if (element.width <= 0 || element.height <= 0) continue;
    const selector = selectorHintForElement(element);
    if (!selector) continue;
    const overlap = intersectionArea(topBand, {
      left: element.left,
      top: element.top,
      width: element.width,
      height: element.height,
    });
    const verticalDistance = Math.min(
      Math.abs(element.top - bbox.top),
      Math.abs(element.top + element.height - bbox.top),
    );
    if (overlap <= 0 && verticalDistance > 48) continue;
    const area = Math.max(1, element.width * element.height);
    candidates.push({
      selector,
      path: element.path,
      tag: element.tag,
      bbox: {
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
      },
      score: round((overlap / area) + Math.max(0, 1 - verticalDistance / 48)),
      reason: `${Math.round(verticalDistance)}px from diff top`,
    });
  }
  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aArea = a.bbox.width * a.bbox.height;
    const bArea = b.bbox.width * b.bbox.height;
    if (aArea !== bArea) return aArea - bArea;
    return a.selector.localeCompare(b.selector);
  });
}

function selectorHintForElement(element) {
  if (element.selector) return element.selector;
  if (element.path?.startsWith("[data-testid=")) return element.path;
  const firstClass = (element.classes ?? "").split(/\s+/).find(Boolean);
  if (firstClass) return `.${firstClass}`;
  if (element.id) return `#${element.id}`;
  return element.tag || null;
}

function intersectionArea(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function excerptErrorContext(value) {
  if (!value) return null;
  return value.split(/\r?\n/).slice(0, 80).join("\n");
}

function extractScreenshotName(text) {
  const match = text.match(/Snapshot:\s*([^\s]+)/);
  return match?.[1] ?? null;
}

function firstLine(value) {
  return stripAnsi(value).split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
}

function stripAnsi(value) {
  return value.replace(/\x1B\[[0-9;]*m/g, "");
}

function averageColor(sum, count) {
  return `rgba(${sum.slice(0, 4).map((value, index) => {
    const avg = Math.round(value / count);
    return index === 3 ? round(avg / 255) : avg;
  }).join(", ")})`;
}

function colorDistance(a, b) {
  const left = parseRgba(a);
  const right = parseRgba(b);
  if (!left || !right) return 0;
  return Math.sqrt(
    (left[0] - right[0]) ** 2
    + (left[1] - right[1]) ** 2
    + (left[2] - right[2]) ** 2,
  );
}

function parseRgba(value) {
  if (!value) return null;
  const match = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function round(value) {
  return Number(value.toFixed(4));
}

export { findLatestVrtArtifactPaths };
