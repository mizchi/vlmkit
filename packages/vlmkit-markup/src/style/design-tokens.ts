#!/usr/bin/env node
/**
 * Design-token / scale-conformance check.
 *
 * Renders an HTML page, walks every visible element, samples
 * computed-style values for tokenized properties, and flags values
 * not on the configured design scale:
 *
 *   - `border-radius`  — should be on a discrete scale (e.g.,
 *                        0, 4, 8, 12, 16, 24)
 *   - `padding` / `margin` (spacing) — on a 4 px / 8 px grid
 *   - `box-shadow` — limited number of distinct shadow tiers
 *   - `z-index` — on a layered scale (e.g., 0, 1, 10, 100, 1000)
 *
 * Per-property: list each element using a value not on the scale,
 * the value itself, and the nearest in-scale value (= suggested
 * replacement).
 *
 * Defaults are common conservative scales; override per check with
 * flags or a JSON config file.
 *
 * Usage:
 *   vlmkit check tokens <html-or-url>
 *   vlmkit check tokens <url> --radius-scale 0,4,8,12,16,24
 *   vlmkit check tokens <url> --config tokens.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";

export interface DesignTokenConfig {
  radius?: number[];
  spacing?: number[];
  zIndex?: number[];
  /** Max number of distinct non-trivial box-shadow values across the page. */
  shadowTiers?: number;
  /** Tolerance in px for "on the scale" (default 0.5). */
  tolerance?: number;
}

const DEFAULT_CONFIG: Required<Omit<DesignTokenConfig, "tolerance">> & { tolerance: number } = {
  radius: [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 48, 999],
  spacing: [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96],
  zIndex: [0, 1, 10, 100, 1000, 9999],
  shadowTiers: 5,
  tolerance: 0.5,
};

export interface DesignTokensOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  viewport?: { width: number; height: number };
  config?: DesignTokenConfig;
}

export interface ScaleViolation {
  property: "border-radius" | "padding" | "margin" | "z-index";
  path: string;
  tag: string;
  /** Actual computed value as a number (px or unit-less for z-index). */
  value: number;
  /** Closest in-scale value. */
  nearest: number;
  /** Per-side suffix for padding/margin diagnostics — top/right/bottom/left. */
  side?: "top" | "right" | "bottom" | "left";
}

export interface ShadowFinding {
  /** Distinct shadow values found on the page. */
  distinctShadows: string[];
  allowedTiers: number;
}

export interface DesignTokensReport {
  source: string;
  viewport: { width: number; height: number };
  config: Required<DesignTokenConfig>;
  inspectedCount: number;
  violations: ScaleViolation[];
  shadow: ShadowFinding;
  reportPath: string;
}

const SAMPLE_SCRIPT = `
(function sample() {
  function shortPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let p = cur.tagName.toLowerCase();
      if (cur.id) p += "#" + cur.id;
      else if (cur.className && typeof cur.className === "string") {
        const cls = cur.className.trim().split(/\\s+/).slice(0, 2).join(".");
        if (cls) p += "." + cls;
      }
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(">");
  }
  function px(v) {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  const out = [];
  const allEls = document.body.querySelectorAll("*");
  let n = 0;
  for (const el of allEls) {
    if (n > 800) break;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    n++;
    out.push({
      path: shortPath(el),
      tag: el.tagName.toLowerCase(),
      borderRadius: {
        tl: px(cs.borderTopLeftRadius),
        tr: px(cs.borderTopRightRadius),
        br: px(cs.borderBottomRightRadius),
        bl: px(cs.borderBottomLeftRadius),
      },
      padding: {
        top: px(cs.paddingTop), right: px(cs.paddingRight),
        bottom: px(cs.paddingBottom), left: px(cs.paddingLeft),
      },
      margin: {
        top: px(cs.marginTop), right: px(cs.marginRight),
        bottom: px(cs.marginBottom), left: px(cs.marginLeft),
      },
      zIndex: cs.zIndex,
      boxShadow: cs.boxShadow,
    });
  }
  return out;
})()
`;

interface RawSample {
  path: string;
  tag: string;
  borderRadius: { tl: number; tr: number; br: number; bl: number };
  padding: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
  zIndex: string;
  boxShadow: string;
}

function isUrl(s: string): boolean { return /^https?:\/\//.test(s); }

function nearestOnScale(value: number, scale: number[]): number {
  let best = scale[0]!;
  let bestDist = Math.abs(value - best);
  for (const s of scale) {
    const d = Math.abs(value - s);
    if (d < bestDist) { best = s; bestDist = d; }
  }
  return best;
}

function isOnScale(value: number, scale: number[], tolerance: number): boolean {
  for (const s of scale) {
    if (Math.abs(value - s) <= tolerance) return true;
  }
  return false;
}

/** Normalize a box-shadow string for grouping. Replaces explicit colors
 * with their hex equivalents so `rgb(0,0,0)` and `#000000` collapse. */
function normalizeShadow(s: string): string {
  if (!s || s === "none") return "none";
  // Collapse whitespace, replace rgb() with hex.
  return s.replace(/\s+/g, " ").replace(/rgba?\(([^)]+)\)/g, (_, body: string) => {
    const parts = body.split(",").map((x: string) => parseFloat(x.trim()));
    const [r, g, b, a] = parts;
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return body;
    const h = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    const hex = `#${h(r as number)}${h(g as number)}${h(b as number)}`;
    return a !== undefined && a !== 1 ? `${hex}@${a}` : hex;
  });
}

export async function runDesignTokens(
  options: DesignTokensOptions,
): Promise<DesignTokensReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const config: Required<DesignTokenConfig> = {
    ...DEFAULT_CONFIG,
    ...options.config,
  };

  const html = isUrl(options.source) ? null : await readFile(resolve(options.source), "utf-8");

  const browser = await chromium.launch();
  let samples: RawSample[];
  try {
    const page = await browser.newPage({ viewport });
    if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.goto(sourceToUrl(options.source), { waitUntil: "networkidle", timeout: 30000 });
    }
    samples = await page.evaluate(SAMPLE_SCRIPT) as RawSample[];
    await page.close();
  } finally {
    await browser.close();
  }

  // Per-element scale checks. Dedupe by path (same element captured
  // once even if reported by multiple text nodes).
  const byPath = new Map<string, RawSample>();
  for (const s of samples) if (!byPath.has(s.path)) byPath.set(s.path, s);

  const violations: ScaleViolation[] = [];
  const distinctShadows = new Set<string>();
  for (const s of byPath.values()) {
    // border-radius — check each corner.
    for (const corner of ["tl", "tr", "br", "bl"] as const) {
      const v = s.borderRadius[corner];
      if (v === 0) continue;
      if (!isOnScale(v, config.radius, config.tolerance)) {
        violations.push({
          property: "border-radius", path: s.path, tag: s.tag,
          value: v, nearest: nearestOnScale(v, config.radius),
        });
        break;  // one report per element is enough
      }
    }
    // padding + margin per side.
    for (const prop of ["padding", "margin"] as const) {
      for (const side of ["top", "right", "bottom", "left"] as const) {
        const v = s[prop][side];
        if (v === 0) continue;
        if (!isOnScale(v, config.spacing, config.tolerance)) {
          violations.push({
            property: prop, path: s.path, tag: s.tag,
            value: v, nearest: nearestOnScale(v, config.spacing),
            side,
          });
        }
      }
    }
    // z-index (only when not "auto").
    if (s.zIndex && s.zIndex !== "auto") {
      const v = parseInt(s.zIndex, 10);
      if (Number.isFinite(v) && !isOnScale(v, config.zIndex, config.tolerance)) {
        violations.push({
          property: "z-index", path: s.path, tag: s.tag,
          value: v, nearest: nearestOnScale(v, config.zIndex),
        });
      }
    }
    // box-shadow — collect distinct normalized values.
    const sh = normalizeShadow(s.boxShadow);
    if (sh !== "none") distinctShadows.add(sh);
  }

  // Sort violations: by property then by largest delta.
  violations.sort((a, b) => {
    if (a.property !== b.property) return a.property.localeCompare(b.property);
    return Math.abs(b.value - b.nearest) - Math.abs(a.value - a.nearest);
  });

  const shadow: ShadowFinding = {
    distinctShadows: [...distinctShadows].sort(),
    allowedTiers: config.shadowTiers,
  };

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source,
    viewport,
    config,
    inspectedCount: byPath.size,
    violations,
    shadow,
  });
  await writeFile(reportPath, md);

  return {
    source: options.source, viewport, config,
    inspectedCount: byPath.size, violations, shadow, reportPath,
  };
}

/**
 * Terminal summary. Extracted from `runDesignTokens`, which used to
 * `console.log` from inside the measurement — that made the function unusable
 * from the MCP server or a test without capturing stdout, and it is why the
 * gate contract keeps `run` and `format` apart.
 */
export function formatDesignTokensReport(report: DesignTokensReport): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit check tokens${RESET}`);
  lines.push(`  ${DIM}source: ${report.source}  inspected: ${report.inspectedCount} element(s)${RESET}`);
  const byProperty = new Map<string, number>();
  for (const v of report.violations) byProperty.set(v.property, (byProperty.get(v.property) ?? 0) + 1);
  const shadowOver = report.shadow.distinctShadows.length > report.shadow.allowedTiers;
  const totalFindings = report.violations.length + (shadowOver ? 1 : 0);
  const icon = totalFindings === 0 ? `${GREEN}\u2713${RESET}` : `${RED}\u2717${RESET}`;
  lines.push(`  ${icon} ${totalFindings} finding(s)`);
  for (const [prop, n] of byProperty) {
    lines.push(`    ${DIM}${prop.padEnd(15)} ${n} violation(s)${RESET}`);
  }
  if (shadowOver) {
    lines.push(
      `    ${DIM}box-shadow      ${report.shadow.distinctShadows.length} distinct`
      + ` (allowed: ${report.shadow.allowedTiers})${RESET}`,
    );
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<DesignTokensReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Design-token conformance report");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push(`Inspected **${r.inspectedCount}** visible element(s).`);
  lines.push("");
  lines.push("## Scales");
  lines.push("");
  lines.push(`- radius:  \`${r.config.radius.join(", ")}\``);
  lines.push(`- spacing: \`${r.config.spacing.join(", ")}\``);
  lines.push(`- z-index: \`${r.config.zIndex.join(", ")}\``);
  lines.push(`- shadow tiers (max distinct): \`${r.config.shadowTiers}\``);
  lines.push(`- tolerance: \`±${r.config.tolerance}px\``);
  lines.push("");

  const byProperty = new Map<string, ScaleViolation[]>();
  for (const v of r.violations) {
    const list = byProperty.get(v.property) ?? [];
    list.push(v);
    byProperty.set(v.property, list);
  }

  if (r.violations.length === 0 && r.shadow.distinctShadows.length <= r.shadow.allowedTiers) {
    lines.push("## ✓ All values conform to the configured scales.");
    return lines.join("\n");
  }

  lines.push(`## Violations: ${r.violations.length} scale + ${r.shadow.distinctShadows.length > r.shadow.allowedTiers ? "1" : "0"} shadow-tier`);
  lines.push("");

  for (const [prop, list] of byProperty) {
    lines.push(`### ${prop}: ${list.length} violation(s)`);
    lines.push("");
    lines.push("| Element | Side | Value | Nearest in-scale | Δ |");
    lines.push("|---|---|---|---|---|");
    for (const v of list.slice(0, 20)) {
      const side = v.side ?? "—";
      const delta = (v.value - v.nearest).toFixed(2);
      lines.push(`| \`${v.path}\` | ${side} | ${v.value.toFixed(2)} | ${v.nearest} | ${delta} |`);
    }
    if (list.length > 20) lines.push(`| _…${list.length - 20} more_ | | | | |`);
    lines.push("");
  }

  if (r.shadow.distinctShadows.length > r.shadow.allowedTiers) {
    lines.push(`### box-shadow: ${r.shadow.distinctShadows.length} distinct tier(s) (allowed: ${r.shadow.allowedTiers})`);
    lines.push("");
    lines.push("Distinct normalized shadow values found:");
    lines.push("");
    for (const s of r.shadow.distinctShadows.slice(0, 12)) {
      lines.push(`- \`${s}\``);
    }
    lines.push("");
  }

  lines.push("## Suggested next step");
  lines.push("");
  lines.push("1. Replace each violating value with its nearest in-scale equivalent (the \"Nearest in-scale\" column).");
  lines.push("2. If a value needs to be off-scale (intentional outlier), document why in a comment — the violation is a code smell, not a hard ban.");
  lines.push("3. Consolidate `box-shadow` values into a small named tier set (e.g., `--shadow-sm`, `--shadow-md`, `--shadow-lg`) and reference the variables instead of inline values.");
  lines.push("4. Re-run `vlmkit check tokens`. The violation count should drop.");
  lines.push("");
  return lines.join("\n");
}

async function loadConfig(path: string | undefined): Promise<DesignTokenConfig | undefined> {
  if (!path) return undefined;
  const raw = await readFile(resolve(path), "utf-8");
  return JSON.parse(raw) as DesignTokenConfig;
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check tokens` is declared in `../gates/tokens.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
