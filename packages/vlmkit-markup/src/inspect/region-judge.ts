#!/usr/bin/env node
/**
 * Visual equivalence judge for residual regions (issue #88, item 4).
 *
 * Two measured failure classes sit OUTSIDE the composition/height gates:
 * a paragraph reflow that is visually equivalent but keeps one "extra"
 * alive (S9), and metric-fitting fixes that satisfy the extractor while
 * drifting from the design (Sonnet's letter-spacing 0.2px). Both need a
 * judgment call — "does this region LOOK the same?" — which is exactly
 * the kind of task vision is for and pixel math is not.
 *
 * The judge never trusts vision alone (gemini-2.5-flash returned
 * no-diff on a 6% palette shift, 05/23; `diff region` needed the
 * refutation gate, 06/08):
 *
 *   - The measured mean per-channel delta over the region is computed
 *     deterministically and is part of every verdict.
 *   - `--vlm`: a forced-choice SAME/DIFFERENT read of the pair crop is
 *     cross-checked against the measurement. DIFFERENT below the
 *     refutation floor is REFUTED (hallucinated difference); SAME above
 *     the contradiction ceiling is CONTRADICTED (missed difference).
 *     Only agreement produces a confident verdict.
 *   - Keyless: pair crops (A above B) are written for a second reader —
 *     the S9-fresh lesson applies here too: the reader must not be the
 *     author of the pixels being judged.
 *
 * CLI:
 *   vlmkit check equivalence <attempt.html|png> --target <png>
 *     --region "x,y,WxH" [--region ...] [--out <dir>] [--json]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PNG } from "pngjs";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { ruleTier } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";

export interface JudgeRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Mean per-channel delta below this refutes a VLM "different" claim. */
export const REFUTE_FLOOR = 3;
/** Mean per-channel delta above this contradicts a VLM "same" claim. */
export const CONTRADICT_CEILING = 25;

/**
 * Accepts "x,y,WxH" and "x,y,w,h"; also tolerates the kickback shape
 * "(x,y) WxH" so residual lines can be pasted with minimal editing.
 */
export function parseRegionSpec(spec: string): JudgeRegion {
  const normalized = spec.replace(/[()]/g, " ").trim();
  const m = normalized.match(/^(-?\d+)\s*,\s*(-?\d+)[\s,]+(\d+)\s*[x,]\s*(\d+)$/);
  if (!m) throw new Error(`Bad region "${spec}" — expected "x,y,WxH" (e.g. "505,865,98x15")`);
  const [, x, y, w, h] = m;
  return { left: Number(x), top: Number(y), width: Number(w), height: Number(h) };
}

/** Mean per-channel absolute delta over the region (0..255). */
export function measureRegionDelta(
  a: { data: Uint8Array; width: number; height: number },
  b: { data: Uint8Array; width: number; height: number },
  region: JudgeRegion,
): number {
  let sum = 0;
  let n = 0;
  for (let y = region.top; y < region.top + region.height; y++) {
    for (let x = region.left; x < region.left + region.width; x++) {
      if (y < 0 || x < 0 || y >= a.height || y >= b.height || x >= a.width || x >= b.width) continue;
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + x) * 4;
      sum += Math.abs(a.data[i]! - b.data[j]!)
        + Math.abs(a.data[i + 1]! - b.data[j + 1]!)
        + Math.abs(a.data[i + 2]! - b.data[j + 2]!);
      n += 3;
    }
  }
  return n === 0 ? 0 : sum / n;
}

const PAIR_SEPARATOR = 8;

/** Stack the region's crop from A above the crop from B, gray bar between. */
export function buildPairImage(
  a: { data: Uint8Array; width: number; height: number },
  b: { data: Uint8Array; width: number; height: number },
  region: JudgeRegion,
  pad = 8,
): PNG {
  const crop = (src: { data: Uint8Array; width: number; height: number }): PNG => {
    const x1 = Math.max(0, region.left - pad);
    const y1 = Math.max(0, region.top - pad);
    const x2 = Math.min(src.width, region.left + region.width + pad);
    const y2 = Math.min(src.height, region.top + region.height + pad);
    const w = Math.max(1, x2 - x1);
    const h = Math.max(1, y2 - y1);
    const out = new PNG({ width: w, height: h });
    out.data.fill(0xff);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const si = ((y1 + dy) * src.width + (x1 + dx)) * 4;
        const di = (dy * w + dx) * 4;
        out.data[di] = src.data[si]!;
        out.data[di + 1] = src.data[si + 1]!;
        out.data[di + 2] = src.data[si + 2]!;
        out.data[di + 3] = 0xff;
      }
    }
    return out;
  };
  const ca = crop(a);
  const cb = crop(b);
  const width = Math.max(ca.width, cb.width);
  const pair = new PNG({ width, height: ca.height + PAIR_SEPARATOR + cb.height });
  pair.data.fill(0xff);
  const blit = (src: PNG, yOff: number) => {
    for (let dy = 0; dy < src.height; dy++) {
      src.data.copy(pair.data, ((yOff + dy) * width) * 4, dy * src.width * 4, (dy + 1) * src.width * 4);
    }
  };
  blit(ca, 0);
  for (let dy = 0; dy < PAIR_SEPARATOR; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const o = ((ca.height + dy) * width + dx) * 4;
      pair.data[o] = 0x80;
      pair.data[o + 1] = 0x80;
      pair.data[o + 2] = 0x80;
      pair.data[o + 3] = 0xff;
    }
  }
  blit(cb, ca.height + PAIR_SEPARATOR);
  return pair;
}

export type VlmAnswer = "same" | "different" | "unparseable";

/** Forced-choice extraction: first standalone SAME/DIFFERENT wins. */
export function parseVlmAnswer(text: string): VlmAnswer {
  const m = text.match(/\b(SAME|DIFFERENT)\b/i);
  if (!m) return "unparseable";
  return m[1]!.toLowerCase() as VlmAnswer;
}

export type JudgeOutcome =
  | "same" // agreement: VLM same + measurement quiet
  | "different" // agreement: VLM different + measurement loud enough
  | "refuted" // VLM different, measurement below the floor
  | "contradicted" // VLM same, measurement above the ceiling
  | "pending-review"; // keyless — a second reader owns the call

export interface RegionVerdict {
  region: JudgeRegion;
  measuredDelta: number;
  pairImage: string;
  vlmAnswer?: VlmAnswer;
  vlmEvidence?: string;
  outcome: JudgeOutcome;
}

/** The cross-check that keeps vision honest. */
export function judgeOutcome(answer: VlmAnswer, measuredDelta: number): JudgeOutcome {
  if (answer === "different" && measuredDelta < REFUTE_FLOOR) return "refuted";
  if (answer === "same" && measuredDelta > CONTRADICT_CEILING) return "contradicted";
  if (answer === "different") return "different";
  if (answer === "same") return "same";
  return "pending-review";
}

export const JUDGE_PROMPT =
  "The image stacks TWO renderings of the same page region: version A above the gray bar, version B below it. Decide if a careful human reviewer would accept them as visually equivalent. Answer with exactly one word first — SAME or DIFFERENT — then one sentence naming the concrete pixel evidence (a color, a position shift, a wrapped word, a missing element). Layout shifts of one text line and color changes are DIFFERENT; antialiasing-level noise is SAME.";

export interface RegionJudgeOptions {
  source: string;
  targetPath: string;
  regions: JudgeRegion[];
  outDir?: string;
  /** Injectable VLM read of one pair image; absent = keyless mode. */
  readPair?: (pairPng: Buffer) => Promise<string>;
}

export interface RegionJudgeReport {
  source: string;
  target: string;
  verdicts: RegionVerdict[];
}

async function loadSourcePng(
  source: string,
  viewport: { width: number; height: number },
): Promise<{ data: Uint8Array; width: number; height: number }> {
  if (/\.png$/i.test(source)) {
    const png = PNG.sync.read(await readFile(source) as Buffer);
    return { data: png.data, width: png.width, height: png.height };
  }
  const { renderHtmlToPng } = await import("../component/page-compose.ts");
  // Viewport-bounded at the target's own dimensions — the same render
  // regime the composition gate judges, so region coordinates line up.
  return renderHtmlToPng(source, viewport.width, viewport.height);
}

export async function runRegionJudge(options: RegionJudgeOptions): Promise<RegionJudgeReport> {
  const target = PNG.sync.read(await readFile(options.targetPath) as Buffer);
  const source = await loadSourcePng(options.source, { width: target.width, height: target.height });
  const outDir = options.outDir ?? join(dirname(resolve(options.source)), ".vlmkit-region-judge");
  await mkdir(outDir, { recursive: true });

  const verdicts: RegionVerdict[] = [];
  for (let i = 0; i < options.regions.length; i++) {
    const region = options.regions[i]!;
    const measuredDelta = measureRegionDelta(source, target, region);
    const pair = buildPairImage(source, target, region);
    const pairBuffer = PNG.sync.write(pair);
    const pairImage = join(outDir, `pair-${i + 1}.png`);
    await writeFile(pairImage, pairBuffer);

    if (options.readPair) {
      const raw = await options.readPair(pairBuffer);
      const answer = parseVlmAnswer(raw);
      verdicts.push({
        region,
        measuredDelta,
        pairImage,
        vlmAnswer: answer,
        vlmEvidence: raw.trim().slice(0, 300),
        outcome: judgeOutcome(answer, measuredDelta),
      });
    } else {
      verdicts.push({ region, measuredDelta, pairImage, outcome: "pending-review" });
    }
  }

  appendRunLedger({
    tool: "region-judge",
    source: options.source,
    target: options.targetPath,
    headline: {
      regions: verdicts.length,
      same: verdicts.filter((v) => v.outcome === "same").length,
      different: verdicts.filter((v) => v.outcome === "different").length,
      refuted: verdicts.filter((v) => v.outcome === "refuted").length,
      contradicted: verdicts.filter((v) => v.outcome === "contradicted").length,
      pending: verdicts.filter((v) => v.outcome === "pending-review").length,
    },
  });
  return { source: options.source, target: options.targetPath, verdicts };
}

export function formatRegionJudgeReport(report: RegionJudgeReport, rules?: RuleView): string {
  const lines: string[] = [];
  // The outcome IS the rule id here — `different`, `contradicted`, `refuted`, `pending-review`
  // are both, which is why the mapping is a lookup and not a decision. `../gates/equivalence.gate.ts`
  // emits the first two as suspect and the rest as warn.
  const tierOf = (outcome: string) =>
    ruleTier(rules, outcome, outcome === "different" || outcome === "contradicted" ? "suspect" : "warn");
  const offOutcomes = new Map<string, number>();
  lines.push(`${BOLD}${CYAN}vlmkit check equivalence${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push(`${DIM}target: ${report.target}${RESET}`);
  lines.push("");
  for (const v of report.verdicts) {
    const where = `(${v.region.left},${v.region.top}) ${v.region.width}x${v.region.height}`;
    const tier = v.outcome === "same" ? undefined : tierOf(v.outcome);
    if (tier === "off") offOutcomes.set(v.outcome, (offOutcomes.get(v.outcome) ?? 0) + 1);
    const color = v.outcome === "same"
      ? GREEN
      : tier === "off"
      ? DIM
      : tier === "warn"
      ? YELLOW
      : RED;
    const retuned = tier !== undefined && tier !== "off" && tier !== (v.outcome === "different" || v.outcome === "contradicted" ? "suspect" : "warn")
      ? ` ${DIM}[${v.outcome} re-tuned to ${tier}]${RESET}`
      : "";
    lines.push(`${where}: ${color}${v.outcome.toUpperCase()}${RESET} — measured mean channel delta ${v.measuredDelta.toFixed(2)}${retuned}`
      + (tier === "off" ? ` ${DIM}— NOT reported (${v.outcome} off)${RESET}` : ""));
    if (v.vlmEvidence) lines.push(`  ${DIM}vlm: ${v.vlmEvidence}${RESET}`);
    if (v.outcome === "refuted") {
      lines.push(`  ${DIM}the measured pixels refute the VLM's difference claim (delta < ${REFUTE_FLOOR}) — treat as same${RESET}`);
    }
    if (v.outcome === "contradicted") {
      lines.push(`  ${DIM}the measurement contradicts the VLM's same claim (delta > ${CONTRADICT_CEILING}) — re-read the pair image yourself${RESET}`);
    }
    lines.push(`  pair: ${v.pairImage}`);
  }
  if (offOutcomes.size > 0) {
    const detail = [...offOutcomes].map(([outcome, n]) => `${outcome} x${n}`).join(", ");
    lines.push("");
    lines.push(`${DIM}${[...offOutcomes.values()].reduce((a, b) => a + b, 0)} region verdict(s) measured and NOT reported — rule turned off (${detail})${RESET}`);
  }
  // `pending-review` off means the project accepts unjudged regions, so the block demanding a
  // human reader would be asking for work it has said it does not want.
  const pending = tierOf("pending-review") === "off"
    ? 0
    : report.verdicts.filter((v) => v.outcome === "pending-review").length;
  if (pending > 0) {
    lines.push("");
    lines.push(`${BOLD}ACTION REQUIRED — keyless mode:${RESET} ${pending} pair image(s) need a reader. Version A is above the gray bar, B below. The reader must not be the author of the pixels being judged (S9-fresh: same-eyes review misses its own errors).`);
  }
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check equivalence` is declared in `../gates/equivalence.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
