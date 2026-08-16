/**
 * The paste-ready kickback, and the terminal report — the text a `verify markup`
 * run hands back.
 *
 * Split out of `markup-verify.ts`, which pairs a Playwright orchestrator with this.
 * Importing that module costs 627ms because of what the orchestrator needs; these
 * are string builders over a report object and need none of it. Its own tests for
 * `kickbackForComposition` were already pure and were paying that cost to run.
 *
 * The verdict types stay in `markup-verify.ts`: they are that module's public data
 * model, the same reason `ComponentFromImageReport` stayed put when the component
 * formatter moved. Type-only imports back are erased, so the runtime dependency
 * runs one way.
 */
import { basename } from "node:path";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { kindLabel } from "../component/component-classify.ts";
import type { PageComponent, PageComposition, PageMatch } from "../component/page-compose-diff.ts";
import {
  matchRegionBboxToElement,
  type RegionElementRect,
} from "../region-selector-match.ts";
import type { MarkupVerifyReport } from "./markup-verify.ts";

/** "[text] " style prefix when the pixel-stat kind is informative. */
function kindTag(c: PageComponent): string {
  const label = kindLabel(c.kind);
  return label ? `${label} ` : "";
}

function fillDistanceHex(a: string, b: string): number {
  const p = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ] as const;
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

/**
 * Kickback lines for one target's composition: every missing / extra /
 * ordering / gap residual, with the displacement interpretation applied
 * (a missing paired with a same-fill extra is one element in the wrong
 * place — the agent must move it, not add/remove it).
 *
 * When `elements` (attempt DOM rects) are provided, residuals carry a
 * deterministic selector attribution — the `diff png --elements-html`
 * pattern both A/B validation agents asked for, ported to this loop.
 * Current-side boxes name the element that RENDERS the residual;
 * target-side (missing) boxes name the attempt element the target box
 * falls into, i.e. where to build.
 */
export interface KickbackContext {
  /** Attempt DOM rects for selector attribution. */
  elements?: RegionElementRect[];
  /**
   * Pixel-presence probe over the two images: fraction of `box` pixels
   * within fill tolerance of `hex` on the given side. Enables the
   * near-miss and grouping-mismatch caveats (S9-replay findings) —
   * both exist so a Stage-2 consumer never obeys a misleading number
   * a stronger model would have refuted with its own sampling.
   */
  presence?: (
    side: "target" | "current",
    box: { left: number; top: number; width: number; height: number },
    hex: string,
  ) => number;
}

export function kickbackForComposition(
  label: string,
  c: PageComposition,
  context?: KickbackContext,
): string[] {
  const lines: string[] = [];
  const elements = context?.elements;
  const probe = context?.presence;
  const selectorNote = (
    box: { left: number; top: number; width: number; height: number },
    phrase: string,
  ): string => {
    if (!elements || elements.length === 0) return "";
    const m = matchRegionBboxToElement(box, elements);
    if (!m) return "";
    return ` [${phrase} \`${m.selector}\`]`;
  };
  const renderedBy = (p: PageComponent): string =>
    selectorNote(p, "rendered by");
  const buildSite = (p: PageComponent): string =>
    selectorNote(p, "target box falls in your");
  // Near-miss: an extra whose fill exists in the target a few px away
  // (or a missing whose fill exists in the render a few px away) is a
  // small displacement, not a build/remove. The extractor misses these
  // when the counterpart never got its own component (top-N slot or
  // minArea), so the S9 replay saw a correctly-added hairline reported
  // as "extra — not in target" until the next round. Smallest offset
  // wins; vertical only (stacking errors dominate this class).
  const nearMissNote = (side: "target" | "current", comp: PageComponent): string => {
    if (!probe) return "";
    const ownSide = side === "target" ? "current" : "target";
    const own = probe(ownSide, comp, comp.hex);
    if (own <= 0) return "";
    for (const dy of [4, -4, 8, -8, 12, -12, 16, -16, 20, -20, 24, -24]) {
      const shifted = { left: comp.left, top: comp.top + dy, width: comp.width, height: comp.height };
      if (probe(side, shifted, comp.hex) >= 0.6 * own) {
        const where = side === "target" ? "the target has this fill" : "your render has this fill";
        return ` [near-miss: ${where} ${Math.abs(dy)}px ${dy < 0 ? "higher" : "lower"} — likely a small vertical displacement, move it instead]`;
      }
    }
    return "";
  };
  // Grouping-mismatch caveat: when a matched pair's size delta is large
  // but the render already carries the target's fill across the FULL
  // target box, the two sides probably segmented different groupings of
  // the same pixels (S9 replay: whole-card target component vs
  // image-only current component read as "dSize -92"). Following the
  // literal number would regress; say so on the line itself.
  const groupingNote = (m: PageMatch): string => {
    if (!probe) return "";
    const bigH = Math.abs(m.deltaHeight) >= Math.max(30, 0.25 * m.target.height);
    const bigW = Math.abs(m.deltaWidth) >= Math.max(30, 0.25 * m.target.width);
    if (!bigH && !bigW) return "";
    const tgt = probe("target", m.target, m.target.hex);
    if (tgt <= 0) return "";
    if (probe("current", m.target, m.target.hex) >= 0.6 * tgt) {
      return " [size-delta caveat: your render already shows the target fill across the full target box — the delta may be segmentation grouping, not CSS; verify with a crop before resizing]";
    }
    return "";
  };
  // Catastrophically mis-sized matched components go FIRST: in S5-r5 a
  // collapsed hero (IoU 0.04, dSize -280px) was the root cause of most of
  // the missing/extra list, but it was buried below them — the agent fixed
  // debris for rounds while the cause stood. Order = priority.
  for (const m of c.matches) {
    if (m.iou < 0.5 && Math.min(m.target.height, m.current.height) > 4) {
      lines.push(
        `${label}: ROOT-CAUSE CANDIDATE — matched #${m.target.index} has collapsed geometry (IoU ${m.iou}, dPos (${m.deltaLeft},${m.deltaTop}), dSize (${m.deltaWidth},${m.deltaHeight})). Target box: (${m.target.left},${m.target.top}) ${m.target.width}x${m.target.height}. Restore this FIRST — the missing/extra items below are often its debris.${renderedBy(m.current)}${groupingNote(m)}`,
      );
    }
  }
  const claimedExtra = new Set<number>();
  for (const m of c.missing) {
    const twin = c.extra.find((e) =>
      !claimedExtra.has(e.index)
      && fillDistanceHex(m.hex, e.hex) < 40
      && Math.max(m.area, e.area) / Math.max(1, Math.min(m.area, e.area)) < 3
    );
    if (twin) {
      claimedExtra.add(twin.index);
      lines.push(
        `${label}: missing #${m.index} (${m.left},${m.top}) ${m.width}x${m.height} ${m.hex} is likely your own element DISPLACED to (${twin.left},${twin.top}) ${twin.width}x${twin.height} — move/resize it (fix the space above it), do not add a new element.${renderedBy(twin)}`,
      );
    } else {
      lines.push(
        `${label}: missing #${m.index} ${kindTag(m)}(${m.left},${m.top}) ${m.width}x${m.height} fill ${m.hex} — genuinely absent; build it.${buildSite(m)}${nearMissNote("current", m)}`,
      );
    }
  }
  for (const e of c.extra) {
    if (claimedExtra.has(e.index)) continue;
    const advice = e.kind?.kind === "text"
      ? "this is a TEXT block — read the crop before touching it; the fix is usually its color/weight or the space around it, NEVER deleting visible text"
      : "remove, merge, or restyle (a too-dark fill can make an interior crest as a component)";
    lines.push(
      `${label}: extra ${kindTag(e)}(${e.left},${e.top}) ${e.width}x${e.height} fill ${e.hex} — not in target; ${advice}.${renderedBy(e)}${nearMissNote("target", e)}`,
    );
  }
  for (const v of c.orderViolations) {
    lines.push(
      `${label}: ordering violation — target #${v.first} (y=${v.targetTops[0]}) should be above #${v.second} (y=${v.targetTops[1]}) but current renders them at y=${v.currentTops[0]} / y=${v.currentTops[1]}.`,
    );
  }
  for (const g of c.gapDeltas) {
    const dir = g.delta > 0 ? `reduce ${g.delta}px` : `add ${-g.delta}px`;
    lines.push(
      `${label}: gap #${g.above} -> #${g.below} is ${g.currentGap}px vs target ${g.targetGap}px — ${dir} of vertical space between them.${(() => { const below = c.matches.find((x) => x.target.index === g.below); return below ? selectorNote(below.current, "the gap sits above") : ""; })()}`,
    );
  }
  for (const m of c.matches) {
    // < 0.5 already reported up top as a root-cause candidate.
    if (m.iou >= 0.5 && m.iou < 0.9 && Math.min(m.target.height, m.current.height) > 4) {
      lines.push(
        `${label}: matched #${m.target.index} IoU ${m.iou} — dPos (${m.deltaLeft},${m.deltaTop}), dSize (${m.deltaWidth},${m.deltaHeight}); converge size/position.${renderedBy(m.current)}${groupingNote(m)}`,
      );
    }
  }
  return lines;
}

export function formatMarkupVerifyReport(report: MarkupVerifyReport, rules?: RuleView): string {
  const lines: string[] = [];
  // This gate states a verdict over three rules, so rule-blindness showed up here as the
  // loudest possible contradiction: `NOT DONE` in red over the runner's `exits 0`. A project
  // that runs the loop with `gate-suspect=off` — the composed gates are checked separately in
  // its CI — was told its markup was not done by the only line an agent reads.
  const off = (rule: string) => ruleTier(rules, rule, "suspect") === "off";
  const offRules: string[] = [];
  if (off("regressed")) offRules.push("regressed");
  if (off("target-failed")) offRules.push("target-failed");
  if (off("gate-suspect")) offRules.push("gate-suspect");
  const liveResiduals = (!off("target-failed") && report.targets.some((t) => !t.pass))
    || (!off("gate-suspect") && report.gates.some((g) => g.suspects > 0))
    || (!off("regressed") && report.trend?.direction === "regressed");
  // `report.done` is the measurement; the word printed is what the settings leave of it. They
  // agree unless a rule is off, and then the runner's exit code agrees with this line.
  const done = report.done || !liveResiduals;
  lines.push(`${BOLD}${CYAN}vlmkit verify markup${RESET}`);
  lines.push(`${DIM}attempt: ${report.attempt}${RESET}`);
  lines.push("");
  lines.push(`verdict: ${done ? `${GREEN}DONE${RESET}` : `${RED}NOT DONE${RESET}`}`
    + (done && !report.done ? ` ${DIM}(residuals remain, but every rule covering them is off)${RESET}` : ""));
  if (report.trend) {
    const t = report.trend;
    const label = t.direction === "regressed"
      ? (off("regressed") ? `${DIM}regressed — NOT reported (regressed off)${RESET}` : `${RED}REGRESSED${RESET}`)
      : t.direction === "improved" ? `${GREEN}improved${RESET}` : `${DIM}flat${RESET}`;
    lines.push(
      `trend vs previous run: ${label} (targets passed ${t.previous.targetsPassed} -> ${t.current.targetsPassed}, residuals ${t.previous.residuals} -> ${t.current.residuals})`,
    );
  }
  lines.push("");
  lines.push("Targets:");
  for (const t of report.targets) {
    const mark = t.pass
      ? `${GREEN}pass${RESET}`
      : off("target-failed") ? `${DIM}fail — NOT reported${RESET}` : `${RED}fail${RESET}`;
    const cal = t.calibration
      ? ` ${DIM}(calibration floor: ${t.calibration.matched} matched, ${t.calibration.missing}/${t.calibration.extra} missing/extra)${RESET}`
      : "";
    const demoted = (t.missing - t.missingBlocking) + (t.extra - t.extraBlocking);
    const demotedNote = (demoted > 0 ? ` ${DIM}(+${demoted} pixel-confirmed, not blocking)${RESET}` : "")
      + (t.degraded ? ` ${DIM}[degraded-capture tolerances]${RESET}` : "");
    lines.push(
      `  - ${basename(t.target)} ${t.width}x${t.height}: ${mark} — matched ${t.matched}, missing ${t.missingBlocking}, extra ${t.extraBlocking}, ordering ${t.orderViolations}, pixel diff ${(t.pixelDiffRatio * 100).toFixed(2)}%, rendered height ${t.renderedHeight}px${demotedNote}${cal}`,
    );
  }
  lines.push("");
  lines.push("Gates:");
  for (const g of report.gates) {
    const mark = g.suspects > 0
      ? (off("gate-suspect") ? `${DIM}suspect x${g.suspects} — NOT reported${RESET}` : `${RED}suspect x${g.suspects}${RESET}`)
      : g.warns > 0 ? `${YELLOW}warn x${g.warns}${RESET}` : `${GREEN}clean${RESET}`;
    lines.push(`  - ${g.gate}: ${mark} — ${g.summary}`);
  }
  if (offRules.length > 0) {
    lines.push("");
    lines.push(`${DIM}rule(s) turned off for this run: ${offRules.join(", ")} — the counts above are still measured${RESET}`);
  }
  if (report.kickback.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Kickback (every residual — paste into the agent's next round):${RESET}`);
    for (const k of report.kickback) lines.push(`  * ${k}`);
  }
  return lines.join("\n");
}
