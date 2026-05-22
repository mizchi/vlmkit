#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { PNG } from "pngjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);

function parseArgs(argv) {
  const args = {
    rendersDir: "",
    quality: "",
    motion: "",
    contract: "",
    model: "bytedance/ui-tars-1.5-7b",
    models: [],
    out: "",
    promptOut: "",
    contactSheet: "",
    dryRun: false,
    maxFrames: 8,
    cellSize: 320,
    maxTokens: 700,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--renders-dir" || arg === "--dir") args.rendersDir = resolve(required(argv, ++i, arg));
    else if (arg === "--quality") args.quality = resolve(required(argv, ++i, arg));
    else if (arg === "--motion") args.motion = resolve(required(argv, ++i, arg));
    else if (arg === "--contract") args.contract = resolve(required(argv, ++i, arg));
    else if (arg === "--model") args.model = required(argv, ++i, arg);
    else if (arg === "--models") args.models = csv(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--prompt-out") args.promptOut = resolve(required(argv, ++i, arg));
    else if (arg === "--contact-sheet") args.contactSheet = resolve(required(argv, ++i, arg));
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--max-frames") args.maxFrames = positiveInt(required(argv, ++i, arg), arg);
    else if (arg === "--cell-size") args.cellSize = positiveInt(required(argv, ++i, arg), arg);
    else if (arg === "--max-tokens") args.maxTokens = positiveInt(required(argv, ++i, arg), arg);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/review-motion-with-vlm.mjs --renders-dir <dir> --quality <quality.json> [options]

Options:
  --renders-dir <path>       Render frame directory
  --quality <path>           Motion quality JSON
  --motion <path>            Motion IR JSON
  --contract <path>          Asset contract JSON excerpt source
  --model <id>               OpenRouter VLM model (default: bytedance/ui-tars-1.5-7b)
  --models <csv>             Run multiple OpenRouter reviewers
  --out <path>               Review result JSON
  --prompt-out <path>        Prompt artifact path
  --contact-sheet <path>     Contact sheet PNG path
  --dry-run                  Build artifacts but skip API call
  --max-frames <n>           Max frames in contact sheet (default: 8)
  --cell-size <px>           Contact sheet cell size (default: 320)
  --max-tokens <n>           OpenRouter max_tokens (default: 700)
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.rendersDir) throw new Error("--renders-dir is required");
  if (!args.quality) throw new Error("--quality is required");
  const baseDir = dirname(args.quality);
  const stem = basename(args.quality).replace(/\.json$/, "");
  if (!args.out) args.out = join(baseDir, `${stem}.vlm-review.json`);
  if (!args.promptOut) args.promptOut = join(baseDir, `${stem}.vlm-review.prompt.md`);
  if (!args.contactSheet) args.contactSheet = join(baseDir, `${stem}.contact-sheet.png`);
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function positiveInt(value, flag) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} must be a positive integer`);
  return n;
}

function csv(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const quality = JSON.parse(await readFile(args.quality, "utf8"));
  const motion = args.motion ? JSON.parse(await readFile(args.motion, "utf8")) : null;
  const contract = args.contract ? JSON.parse(await readFile(args.contract, "utf8")) : null;
  const frames = await selectFrames(args.rendersDir, args.maxFrames);
  await writeContactSheet(frames, args.contactSheet, args.cellSize);
  const prompt = buildPrompt({ quality, motion, contract, frames, args });
  await writeFile(args.promptOut, prompt);

  const models = args.models.length > 0 ? args.models : [args.model];
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (args.dryRun || !apiKey) {
    const result = {
      ok: true,
      status: "skipped",
      reason: args.dryRun ? "dry-run" : "OPENROUTER_API_KEY is not set",
      models,
      deterministicVerdict: quality.verdict,
      consensusVerdict: quality.verdict,
      reviewers: models.map((model) => ({ model, status: "skipped" })),
      artifacts: artifactPaths(args),
    };
    await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`SKIP ${relative(repoRoot, args.out)} (${result.reason})`);
    return;
  }

  const reviewers = [];
  for (const model of models) {
    const response = await callOpenRouter({ ...args, model }, apiKey, prompt);
    const parsed = parseReviewerJson(response.content);
    reviewers.push({
      status: parsed ? "reviewed" : "parse-failed",
      model,
      reviewer: parsed,
      usage: response.usage,
      latencyMs: response.latencyMs,
      costUsd: response.costUsd,
      rawContent: response.content,
    });
  }
  const analysis = analyzeConsensus(quality.verdict, reviewers);
  const consensusVerdict = analysis.verdict;
  const result = {
    ok: consensusVerdict !== "fail",
    status: "reviewed",
    models,
    deterministicVerdict: quality.verdict,
    reviewers,
    consensusVerdict,
    consensusReasons: analysis.reasons,
    totalCostUsd: reviewers.reduce((sum, reviewer) => sum + (reviewer.costUsd ?? 0), 0),
    maxLatencyMs: Math.max(...reviewers.map((reviewer) => reviewer.latencyMs ?? 0)),
    artifacts: artifactPaths(args),
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${consensusVerdict.toUpperCase()} ${relative(repoRoot, args.out)} (${args.model})`);
  if (analysis.reasons.length > 0) {
    for (const reason of analysis.reasons) console.log(`  - ${reason}`);
  }
  if (consensusVerdict === "fail") process.exit(1);
}

async function selectFrames(rendersDir, maxFrames) {
  const pngFiles = (await readdir(rendersDir)).filter((file) => file.endsWith(".png")).sort();
  const selected = evenlySample(pngFiles, maxFrames);
  return selected.map((file, index) => ({
    id: `f${index + 1}`,
    path: join(rendersDir, file),
    rel: relative(repoRoot, join(rendersDir, file)),
  }));
}

function evenlySample(items, maxItems) {
  if (items.length <= maxItems) return items;
  const out = [];
  for (let i = 0; i < maxItems; i++) {
    out.push(items[Math.round((i * (items.length - 1)) / (maxItems - 1))]);
  }
  return [...new Set(out)];
}

async function writeContactSheet(frames, outPath, cellSize) {
  if (frames.length === 0) throw new Error("no PNG frames found for contact sheet");
  const columns = Math.min(4, frames.length);
  const rows = Math.ceil(frames.length / columns);
  const sheet = new PNG({ width: columns * cellSize, height: rows * cellSize });
  sheet.data.fill(0xe8);
  for (let i = 0; i < frames.length; i++) {
    const src = PNG.sync.read(await readFile(frames[i].path));
    const resized = resizeNearest(src, cellSize, cellSize);
    const ox = (i % columns) * cellSize;
    const oy = Math.floor(i / columns) * cellSize;
    blit(resized, sheet, ox, oy);
  }
  await writeFile(outPath, PNG.sync.write(sheet));
}

function resizeNearest(src, width, height) {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x / width) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / height) * src.height));
      const si = (sy * src.width + sx) * 4;
      const oi = (y * width + x) * 4;
      out.data[oi] = src.data[si];
      out.data[oi + 1] = src.data[si + 1];
      out.data[oi + 2] = src.data[si + 2];
      out.data[oi + 3] = src.data[si + 3];
    }
  }
  return out;
}

function blit(src, dst, ox, oy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      const di = ((oy + y) * dst.width + (ox + x)) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
}

function buildPrompt({ quality, motion, contract, frames, args }) {
  const motionSummary = motion ? {
    id: motion.id,
    source: {
      kind: motion.source?.kind,
      targetSpace: motion.source?.targetSpace,
      vrmcVrmAnimation: motion.source?.vrmcVrmAnimation,
      skippedChannelCount: motion.source?.skippedChannelCount,
      warningSample: (motion.source?.warnings ?? []).slice(0, 8),
    },
    clips: (motion.clips ?? []).map((clip) => ({
      id: clip.id,
      durationSeconds: clip.durationSeconds,
      loop: clip.loop,
      trackCount: clip.tracks?.length ?? 0,
    })),
    retargetCount: Object.keys(motion.retarget ?? {}).length,
  } : null;
  const contractSummary = contract ? {
    asset: contract.asset?.id ?? contract.asset?.name ?? null,
    motionContract: contract.motionContract ?? null,
  } : null;
  return `You are reviewing a game asset motion retarget smoke test.

Return strict JSON only:
{
  "verdict": "pass" | "warn" | "fail",
  "confidence": 0.0,
  "defects": [
    {
      "kind": "off-camera" | "ground-penetration" | "root-drift" | "broken-pose" | "lost-motion" | "scale" | "other",
      "severity": "low" | "medium" | "high",
      "evidenceFrameIds": ["f1"],
      "summary": "short reason"
    }
  ],
  "summary": "one sentence"
}

Judging rules:
- Prefer the deterministic quality report when the image is ambiguous.
- Mark fail only for severe visual breakage, blank/off-camera frames, or unusable pose.
- Mark warn for likely ground penetration, lost fine-grained motion, suspicious scale, or mild pose issues.
- Use the frame ids below as evidence. The contact sheet places frames left-to-right, top-to-bottom in this order.

Model reviewer: ${args.model}
Frame ids:
${frames.map((frame) => `- ${frame.id}: ${frame.rel}`).join("\n")}

Deterministic quality report:
${JSON.stringify(compactQuality(quality), null, 2)}

Motion IR summary:
${JSON.stringify(motionSummary, null, 2)}

Asset contract summary:
${JSON.stringify(contractSummary, null, 2)}
`;
}

function compactQuality(quality) {
  return {
    verdict: quality.verdict,
    metrics: quality.metrics,
    checks: (quality.checks ?? []).map((check) => ({
      id: check.id,
      verdict: check.verdict,
      reason: check.reason,
      value: check.value,
    })),
  };
}

async function callOpenRouter(args, apiKey, prompt) {
  const start = Date.now();
  const imageBase64 = (await readFile(args.contactSheet)).toString("base64");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/mizchi/vlmkit",
      "X-Title": "vlmkit game asset motion review",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    usage,
    latencyMs: Date.now() - start,
    costUsd: Number(data.usage?.cost ?? 0),
  };
}

function parseReviewerJson(content) {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const json = fenced ? fenced[1] : trimmed;
  try {
    const parsed = JSON.parse(json);
    if (!["pass", "warn", "fail"].includes(parsed.verdict)) return null;
    if (!Array.isArray(parsed.defects)) parsed.defects = [];
    return parsed;
  } catch {
    return null;
  }
}

function reviewerVerdicts(reviewers) {
  return reviewers.map((reviewer) => reviewer.reviewer?.verdict ?? "warn");
}

function combineVerdicts(deterministic, reviewerVerdictsList) {
  if (deterministic === "fail") return "fail";
  if (deterministic === "warn") return "warn";
  const verdicts = new Set(reviewerVerdictsList);
  if (verdicts.has("warn")) return "warn";
  if (verdicts.has("fail")) return "warn";
  if (verdicts.size > 1) return "warn";
  return "pass";
}

/**
 * Detailed consensus analysis on top of the simple verdict-set logic.
 * Produces `consensusReasons[]` strings describing WHY the consensus
 * verdict landed where it did, useful for log + downstream tooling.
 *
 * Triggers:
 *   - Any reviewer below `lowConfidenceThreshold` (default 0.7) →
 *     downgrade to "warn" with a "low-confidence-from-<model>" reason.
 *   - Two reviewers disagree on the *set of defect kinds* (one catches
 *     a defect the other misses) → downgrade to "warn" with a
 *     "defect-disagreement" reason; doesn't penalize when the catching
 *     reviewer's only defect is `severity: low`.
 *   - Reviewer marks `confidence: 1.0` on every reviewed asset → flag
 *     as "rubber-stamp-suspect" (advisory; doesn't change verdict).
 */
function analyzeConsensus(deterministic, reviewers, options = {}) {
  const lowConfidenceThreshold = options.lowConfidenceThreshold ?? 0.7;
  const reasons = [];
  const reviewerVerdictsList = reviewerVerdicts(reviewers);
  let verdict = combineVerdicts(deterministic, reviewerVerdictsList);

  const reviewedOnes = reviewers.filter((r) => r.reviewer);
  for (const reviewer of reviewedOnes) {
    const confidence = reviewer.reviewer?.confidence;
    // Treat missing confidence as "no signal" — not a low-confidence
    // trigger. Some reviewers (ui-tars) omit the field entirely.
    if (typeof confidence !== "number") continue;
    if (confidence < lowConfidenceThreshold) {
      reasons.push(`low-confidence-from-${reviewer.model} (conf=${confidence})`);
      if (verdict === "pass") verdict = "warn";
    }
  }

  if (reviewedOnes.length >= 2) {
    const defectSets = reviewedOnes.map((r) => {
      const defects = r.reviewer?.defects ?? [];
      const meaningfulKinds = defects
        .filter((d) => d.severity !== "low")
        .map((d) => d.kind);
      return new Set(meaningfulKinds);
    });
    const union = new Set(defectSets.flatMap((s) => [...s]));
    for (const kind of union) {
      const reportedBy = reviewedOnes.filter((_, i) => defectSets[i].has(kind)).map((r) => r.model);
      const missedBy = reviewedOnes.filter((_, i) => !defectSets[i].has(kind)).map((r) => r.model);
      if (reportedBy.length > 0 && missedBy.length > 0) {
        reasons.push(`defect-disagreement: ${kind} reported by ${reportedBy.join(",")} but missed by ${missedBy.join(",")}`);
        if (verdict === "pass") verdict = "warn";
      }
    }
  }

  if (reviewedOnes.length >= 2) {
    for (const reviewer of reviewedOnes) {
      if (reviewer.reviewer?.confidence === 1) {
        reasons.push(`rubber-stamp-suspect: ${reviewer.model} returned confidence=1.0`);
      }
    }
  }

  return { verdict, reasons };
}

function artifactPaths(args) {
  return {
    contactSheet: relative(repoRoot, args.contactSheet),
    prompt: relative(repoRoot, args.promptOut),
    quality: relative(repoRoot, args.quality),
    motion: args.motion ? relative(repoRoot, args.motion) : null,
    contract: args.contract ? relative(repoRoot, args.contract) : null,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
