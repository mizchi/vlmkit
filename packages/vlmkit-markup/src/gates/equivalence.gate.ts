/**
 * `check equivalence` as a gate definition. Measurement code in
 * `../inspect/region-judge.ts` is untouched.
 *
 * The rule table is the interesting part here: this gate's outcomes already
 * encode a refutation protocol — a VLM read is cross-checked against the
 * measured pixel delta, and a claim outside the deterministic bounds is
 * REFUTED or CONTRADICTED rather than believed. Those became rules, so a
 * project can decide whether a pending human review blocks (`suspect`) or
 * merely reports (`warn`, the default) without touching the protocol.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readAll, readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { readEnv } from "@mizchi/vlmkit-core/project-config.ts";
import {
  CONTRADICT_CEILING,
  JUDGE_PROMPT,
  type JudgeRegion,
  REFUTE_FLOOR,
  type RegionJudgeOptions,
  type RegionJudgeReport,
  formatRegionJudgeReport,
  parseRegionSpec,
  runRegionJudge,
} from "../inspect/region-judge.ts";
import { firstPositional, vlmFlag, withoutOptionalValue } from "./arg-helpers.ts";

export interface EquivalenceGateOptions extends RegionJudgeOptions {
  vlm?: string | true;
}

export const equivalenceGate = defineGate<RegionJudgeReport, EquivalenceGateOptions>({
  id: "check.equivalence",
  command: ["check", "equivalence"],
  title: "Visual equivalence judge",
  summary:
    "Visual equivalence judge for residual regions (measured delta + refutation-gated VLM or pair sheets)",
  category: "verdict",
  usage: `Visual equivalence judge for residual regions. Crops the region from
both sides into a stacked pair image, measures the mean per-channel
delta deterministically, and (with --vlm) cross-checks a forced-choice
SAME/DIFFERENT read against that measurement: hallucinated differences
below the refutation floor (${REFUTE_FLOOR}) are REFUTED; missed differences above
the ceiling (${CONTRADICT_CEILING}) are CONTRADICTED. Without a key, pair images are
written for a second reader.`,
  rules: [
    {
      id: "different",
      title: "Region judged different, and the pixels agree",
      severity: "suspect",
    },
    {
      id: "contradicted",
      title: "Region read as SAME but measures above the contradiction ceiling",
      severity: "suspect",
      docs: `Measured delta above ${CONTRADICT_CEILING} — the deterministic measurement overrides the read.`,
    },
    {
      id: "refuted",
      title: "Region read as DIFFERENT but measures below the refutation floor",
      severity: "warn",
      docs: `Measured delta below ${REFUTE_FLOOR} — a hallucinated difference, reported rather than trusted.`,
    },
    {
      id: "pending-review",
      title: "No VLM ran; a pair image is waiting for a second reader",
      severity: "warn",
      docs: "Raise to suspect to make an unreviewed region block, or off once sheets are reviewed out of band.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "attempt.html|png", kind: "path", description: "Attempt page or screenshot", positional: 0, required: true },
    { name: "target", placeholder: "png", kind: "path", description: "Target screenshot (defines the viewport for HTML sources)", required: true },
    { name: "region", placeholder: "spec", kind: "string", description: 'Region "x,y,WxH" (kickback "(x,y) WxH" also accepted)', repeatable: true, required: true },
    { name: "out", placeholder: "dir", kind: "path", description: "Pair-image output dir", defaultDescription: ".vlmkit-region-judge next to the source" },
    { name: "vlm", placeholder: "model", kind: "string", description: "Judge with a VLM (optional model id); requires an API key" },
  ],
  parse: (argv) => {
    // Every value-taking flag has to be listed, or a caller who puts the flags
    // first loses the source: `--target t.png --region 0,0,10x10 attempt.html`
    // used to parse `t.png` as the attempt and silently compare it to itself.
    // `--vlm` is optionally-valued and needs the other treatment.
    const source = firstPositional(
      withoutOptionalValue(argv, "vlm"),
      'vlmkit check equivalence <attempt.html|png> --target <png> --region "x,y,WxH"',
      ["--region", "--target", "--out"],
    );
    const targetPath = readFlag(argv, "target");
    if (!targetPath) throw new UsageError("--target <png> is required");
    const specs = readAll(argv, "region");
    if (specs.length === 0) throw new UsageError('--region "x,y,WxH" is required (repeatable)');
    let regions: JudgeRegion[];
    try {
      regions = specs.map(parseRegionSpec);
    } catch (e) {
      throw new UsageError(e instanceof Error ? e.message : String(e));
    }
    const outDir = readFlag(argv, "out");
    const vlm = vlmFlag(argv);
    return {
      source,
      targetPath,
      regions,
      ...(outDir ? { outDir } : {}),
      ...(vlm !== undefined ? { vlm } : {}),
    };
  },
  run: async ({ vlm, ...options }) => {
    if (vlm === undefined) return runRegionJudge(options);
    const { createVlmClient, resolveModel } = await import("@mizchi/vlmkit-ai/vlm-client.ts");
    const modelId = vlm === true ? (readEnv("VLM_MODEL") ?? "anthropic/claude-haiku-4-5") : vlm;
    const client = await createVlmClient(await resolveModel(modelId));
    return runRegionJudge({
      ...options,
      readPair: async (pairPng: Buffer) =>
        (await client!.analyzeImage(pairPng.toString("base64"), JUDGE_PROMPT, { maxTokens: 200 })).content,
    });
  },
  findings: (report): Finding[] =>
    report.verdicts
      .filter((v) => v.outcome !== "same")
      .map((v) => ({
        rule: v.outcome,
        severity: v.outcome === "different" || v.outcome === "contradicted" ? "suspect" : "warn",
        message:
          `region (${v.region.left},${v.region.top}) ${v.region.width}x${v.region.height}:`
          + ` ${v.outcome} — measured mean channel delta ${v.measuredDelta.toFixed(2)}`
          + ` (pair image ${v.pairImage})`,
        evidence: { measuredDelta: v.measuredDelta, pairImage: v.pairImage },
      })),
  format: formatRegionJudgeReport,
  // runRegionJudge appends its own entry.
  ledger: () => null,
});
