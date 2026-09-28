#!/usr/bin/env node
/**
 * Zoom accuracy bench: does letting a VLM zoom make its answers RIGHT more often?
 *
 * `vlm-bench --zoom` prints latency, tokens and cost side by side; it cannot say which answer
 * was correct. This bench plants one change with a known answer in a full-page screenshot of
 * each CSS-challenge fixture — a digit in small text, the colour of a short label, an element
 * nudged 3-4px, or nothing at all — and asks each model twice through the SAME driver, images
 * and wording: once with a single look (`runSingleLook`), once with the zoom tool
 * (`runZoomLoop`). Answers are JSON and scored without reading prose.
 *
 * Usage:
 *   node --experimental-strip-types src/experiments/benchmark/zoom-accuracy/zoom-accuracy.ts --render-only
 *   node --experimental-strip-types src/experiments/benchmark/zoom-accuracy/zoom-accuracy.ts \
 *     bytedance/ui-tars-1.5-7b qwen/qwen3-vl-30b-a3b-instruct claude:claude-haiku-4-5-20251001
 *   … --rescore                      # score saved answers again, no API calls
 *   … --self-check                   # render, then score an oracle and an always-unchanged reader
 *   … --fixtures page,dashboard --kinds text,offset --max-zooms 4 --max-edge 1024 --md report.md
 *
 * Environment: the provider key for each model (OPENROUTER_API_KEY / ANTHROPIC_API_KEY /
 * GEMINI_API_KEY). --render-only and --rescore need none.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { getArg, getIntArg, hasFlag, getPositionalArgs } from "@mizchi/vlmkit-core/cli-args.ts";
import { DIM, RESET, GREEN, RED, YELLOW, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { resolveModel, type VlmModel } from "@mizchi/vlmkit-ai/vlm-client.ts";
import {
  createZoomDriver,
  DEFAULT_IMAGE_BUDGET,
  runSingleLook,
  runZoomLoop,
  type ImageBudget,
  type ZoomCoordinates,
} from "@mizchi/vlmkit-ai/zoom.ts";
import { buildCases, loadCases, type BuildOptions, type BuiltCase } from "./cases.ts";
import { agentZoom, exportPacket, importAnswers } from "./agent-packet.ts";
import {
  buildPrompt,
  CASE_KINDS,
  oracleReply,
  pairedFlips,
  scoreAnswer,
  signTestP,
  summarize,
  type ArmSummary,
  type CaseKind,
  type CaseScore,
} from "./score.ts";

export type Arm = "single" | "zoom";

/** One model's reply to one case in one arm, as saved to disk and re-scored from it. */
export interface SavedAnswer {
  model: string;
  arm: Arm;
  caseId: string;
  answer: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  zooms: number;
  turns: number;
  error?: string;
}

export interface ArmReport {
  model: string;
  arm: Arm;
  summary: ArmSummary;
  scores: { caseId: string; score: CaseScore }[];
  costUsd: number;
  avgLatencyMs: number;
  avgZooms: number;
  errors: number;
}

const FIXTURE_DIR = resolve("fixtures/css-challenge");

function safeName(model: string): string {
  return model.replace(/[^a-z0-9._-]+/gi, "_");
}

async function ask(
  model: VlmModel,
  arm: Arm,
  c: BuiltCase,
  opts: { maxZooms: number; maxTokens: number; budget: ImageBudget; coordinates: ZoomCoordinates },
): Promise<SavedAnswer> {
  const driver = createZoomDriver(model);
  const images = [
    { png: await readFile(c.baselinePath), label: "Baseline" },
    { png: await readFile(c.currentPath), label: "Current" },
  ];
  const prompt = buildPrompt(c);
  const start = Date.now();
  const base = { model: model.id, arm, caseId: c.id };
  const cost = (p: number, q: number) => (p / 1000) * model.promptCostPer1k + (q / 1000) * model.completionCostPer1k;
  try {
    if (arm === "single") {
      const r = await runSingleLook(driver, images, prompt, { maxTokens: opts.maxTokens, budget: opts.budget, coordinates: opts.coordinates });
      return { ...base, answer: r.answer, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens,
        costUsd: cost(r.usage.promptTokens, r.usage.completionTokens), latencyMs: Date.now() - start, zooms: 0, turns: 1 };
    }
    const r = await runZoomLoop(driver, images, prompt, {
      maxZooms: opts.maxZooms, maxTokens: opts.maxTokens, budget: opts.budget, coordinates: opts.coordinates,
    });
    return { ...base, answer: r.answer, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens,
      costUsd: cost(r.usage.promptTokens, r.usage.completionTokens), latencyMs: Date.now() - start, zooms: r.zooms.length, turns: r.turns };
  } catch (e) {
    return { ...base, answer: "", promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: Date.now() - start, zooms: 0, turns: 0,
      error: (e as Error).message.slice(0, 300) };
  }
}

/** Score saved answers against the cases. A case with no saved answer is left out of that arm. */
export function report(cases: readonly BuiltCase[], answers: readonly SavedAnswer[]): ArmReport[] {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const groups = new Map<string, SavedAnswer[]>();
  for (const a of answers) {
    const key = `${a.model}\u0000${a.arm}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const out: ArmReport[] = [];
  for (const [key, list] of groups) {
    const [model, arm] = key.split("\u0000") as [string, Arm];
    const rows = list.flatMap((a) => {
      const c = byId.get(a.caseId);
      return c ? [{ case: c as BuiltCase, score: scoreAnswer(c, a.answer), answer: a }] : [];
    }).sort((x, y) => x.case.id.localeCompare(y.case.id));
    out.push({
      model,
      arm,
      summary: summarize(rows),
      scores: rows.map((r) => ({ caseId: r.case.id, score: r.score })),
      costUsd: rows.reduce((s, r) => s + r.answer.costUsd, 0),
      avgLatencyMs: rows.length ? rows.reduce((s, r) => s + r.answer.latencyMs, 0) / rows.length : 0,
      avgZooms: rows.length ? rows.reduce((s, r) => s + r.answer.zooms, 0) / rows.length : 0,
      errors: rows.filter((r) => r.answer.error).length,
    });
  }
  return out.sort((a, b) => a.model.localeCompare(b.model) || a.arm.localeCompare(b.arm));
}

/** The single-vs-zoom comparison for each model that has both arms, paired on the same cases. */
export function comparisons(reports: readonly ArmReport[]) {
  const models = [...new Set(reports.map((r) => r.model))];
  return models.flatMap((model) => {
    const single = reports.find((r) => r.model === model && r.arm === "single");
    const zoom = reports.find((r) => r.model === model && r.arm === "zoom");
    if (!single || !zoom) return [];
    const zoomById = new Map(zoom.scores.map((s) => [s.caseId, s.score]));
    const paired = single.scores.filter((s) => zoomById.has(s.caseId));
    const flips = pairedFlips(paired.map((s) => s.score), paired.map((s) => zoomById.get(s.caseId)!));
    return [{ model, pairs: paired.length, ...flips, p: signTestP(flips.fixed, flips.broke) }];
  });
}

/** Scores for the two readers whose results are known in advance; see `oracleReply`. */
export function selfCheck(cases: readonly BuiltCase[]): { oracle: number; blind: number; none: number } {
  const blindReply = JSON.stringify({ changed: false, kind: "none" });
  return {
    oracle: cases.filter((c) => scoreAnswer(c, oracleReply(c)).correct).length,
    blind: cases.filter((c) => scoreAnswer(c, blindReply).correct).length,
    none: cases.filter((c) => c.expected.kind === "none").length,
  };
}

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

export function markdownReport(cases: readonly BuiltCase[], reports: readonly ArmReport[], meta: Record<string, unknown>): string {
  const kinds = CASE_KINDS.filter((k) => cases.some((c) => c.expected.kind === k));
  const lines: string[] = [];
  lines.push(`# Zoom accuracy bench`, "");
  lines.push(`${cases.length} cases (${kinds.map((k) => `${cases.filter((c) => c.expected.kind === k).length} ${k}`).join(", ")}). `
    + Object.entries(meta).map(([k, v]) => `${k}: \`${typeof v === "string" ? v : JSON.stringify(v)}\``).join(", "), "");
  lines.push(`| model | arm | correct | ${kinds.join(" | ")} | detected | located | zooms/case | latency | cost | errors |`);
  lines.push(`|---|---|---:|${kinds.map(() => "---:").join("|")}|---:|---:|---:|---:|---:|---:|`);
  for (const r of reports) {
    const s = r.summary;
    lines.push(`| ${r.model} | ${r.arm} | ${s.correct}/${s.cases} (${pct(s.correct, s.cases)}) | `
      + kinds.map((k) => `${s.byKind[k].correct}/${s.byKind[k].cases}`).join(" | ")
      + ` | ${pct(s.detected, s.cases)} | ${pct(s.located, s.locatable)} | ${r.avgZooms.toFixed(1)} | ${(r.avgLatencyMs / 1000).toFixed(1)}s | $${r.costUsd.toFixed(4)} | ${r.errors} |`);
  }
  const comp = comparisons(reports);
  if (comp.length) {
    lines.push("", "## Single look → zoom, paired on the same cases", "");
    lines.push("| model | pairs | fixed by zoom | broken by zoom | both right | both wrong | sign test p |");
    lines.push("|---|---:|---:|---:|---:|---:|---:|");
    for (const c of comp) lines.push(`| ${c.model} | ${c.pairs} | ${c.fixed} | ${c.broke} | ${c.bothRight} | ${c.bothWrong} | ${c.p.toFixed(3)} |`);
    lines.push("", "_p is the exact two-sided sign test on the discordant pairs: the chance of a split at least this lopsided if zoom made no difference._");
  }
  lines.push("", "## Misses", "");
  for (const r of reports) {
    const misses = r.scores.filter((s) => !s.score.correct);
    if (!misses.length) continue;
    lines.push(`- **${r.model} / ${r.arm}**: ` + misses.map((m) => `\`${m.caseId}\` ${m.score.note ?? ""}`.trim()).join("; "));
  }
  return lines.join("\n") + "\n";
}

async function loadAnswers(outDir: string): Promise<SavedAnswer[]> {
  const root = join(outDir, "answers");
  if (!existsSync(root)) return [];
  const out: SavedAnswer[] = [];
  for (const model of await readdir(root)) {
    for (const arm of await readdir(join(root, model))) {
      for (const f of await readdir(join(root, model, arm))) {
        if (f.endsWith(".json")) out.push(JSON.parse(await readFile(join(root, model, arm, f), "utf8")));
      }
    }
  }
  return out;
}

function printTable(reports: readonly ArmReport[]) {
  console.log();
  console.log(`  ${"model".padEnd(44)} ${"arm".padEnd(6)} ${"correct".padStart(12)} ${"zooms".padStart(6)} ${"latency".padStart(8)} ${"cost".padStart(10)}`);
  for (const r of reports) {
    const s = r.summary;
    const color = s.correct === s.cases ? GREEN : s.correct === 0 ? RED : YELLOW;
    console.log(`  ${r.model.padEnd(44)} ${r.arm.padEnd(6)} ${color}${`${s.correct}/${s.cases} ${pct(s.correct, s.cases)}`.padStart(12)}${RESET} `
      + `${r.avgZooms.toFixed(1).padStart(6)} ${`${(r.avgLatencyMs / 1000).toFixed(1)}s`.padStart(8)} ${`$${r.costUsd.toFixed(4)}`.padStart(10)}`
      + (r.errors ? ` ${RED}${r.errors} error(s)${RESET}` : ""));
  }
  for (const c of comparisons(reports)) {
    console.log(`  ${DIM}${c.model}: zoom fixed ${c.fixed}, broke ${c.broke} of ${c.pairs} paired cases (sign test p=${c.p.toFixed(3)})${RESET}`);
  }
  console.log();
}

const SELF = "node --experimental-strip-types src/experiments/benchmark/zoom-accuracy/zoom-accuracy.ts";

async function exportAgent(cases: readonly BuiltCase[], outDir: string, to: string, opts: { maxZooms: number; budget: ImageBudget; coordinates: ZoomCoordinates }) {
  const arm = getArg("arm", "") as Arm;
  if (arm !== "single" && arm !== "zoom") throw new Error("--export-agent needs --arm single|zoom (one packet per arm, answered by separate agents)");
  const packet = resolve(to);
  const helper = `${SELF} --agent-zoom ${packet}`;
  const r = await exportPacket(cases, outDir, packet, arm, { ...opts, seed: getIntArg("seed", 1) }, helper);
  await writeFile(join(outDir, "run-options.json"), JSON.stringify({ maxZooms: opts.maxZooms, budget: opts.budget, coordinates: opts.coordinates, maxTokens: 0 }, null, 2));
  console.log(`  ${CYAN}${r.tasks} task(s)${RESET} for the ${arm} arm in ${packet} — hand the agent ${join(packet, "BRIEF.md")}, then:`);
  console.log(`  ${DIM}${SELF} --import-agent ${join(packet, "answers.json")} --arm ${arm} --model agent --out ${outDir}${RESET}`);
}

async function main() {
  // The zoom helper an agent runs from inside a packet: no browser, no case build.
  const zi = process.argv.indexOf("--agent-zoom");
  if (zi >= 0) {
    const [packet, task, image, ...box] = process.argv.slice(zi + 1, zi + 8);
    const nums = box.map(Number);
    if (!packet || !task || image === undefined || nums.length !== 4 || !nums.every(Number.isFinite)) {
      console.error(`usage: ${SELF} --agent-zoom <packet> <task> <image 0|1> <x1> <y1> <x2> <y2>`);
      process.exit(2);
    }
    const r = await agentZoom(resolve(packet), task, Number(image), nums as [number, number, number, number]);
    console.log(r.text);
    if (r.png) console.log(r.png);
    return;
  }
  const outDir = resolve(getArg("out", "test-results/zoom-accuracy"));
  const models = getPositionalArgs(["out", "fixtures", "kinds", "seed", "scale", "width", "max-zooms", "max-tokens", "max-edge", "max-pixels", "coordinates", "md", "arms", "arm", "export-agent", "import-agent", "model"]);
  const fixtureNames = getArg("fixtures", "");
  const fixtures = (fixtureNames ? fixtureNames.split(",").map((f) => (f.endsWith(".html") ? f : `${f}.html`)) : readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".html")).sort())
    .map((f) => join(FIXTURE_DIR, f));
  const kinds = (getArg("kinds", CASE_KINDS.join(","))).split(",") as CaseKind[];
  for (const k of kinds) if (!CASE_KINDS.includes(k)) throw new Error(`unknown kind "${k}" (${CASE_KINDS.join(", ")})`);
  const arms = getArg("arms", "single,zoom").split(",") as Arm[];
  const budget: ImageBudget = {
    maxEdge: getIntArg("max-edge", DEFAULT_IMAGE_BUDGET.maxEdge, { min: 64 }),
    maxPixels: getIntArg("max-pixels", DEFAULT_IMAGE_BUDGET.maxPixels, { min: 4096 }),
  };
  const coordinates = getArg("coordinates", "normalized") as ZoomCoordinates;
  const opts = { maxZooms: getIntArg("max-zooms", 6, { min: 0 }), maxTokens: getIntArg("max-tokens", 1024, { min: 64 }), budget, coordinates };

  await mkdir(outDir, { recursive: true });
  let cases: BuiltCase[];
  const exportTo = getArg("export-agent", "");
  const importFrom = getArg("import-agent", "");
  if (hasFlag("rescore") || importFrom || (exportTo && hasFlag("reuse"))) {
    cases = (await loadCases(outDir)).cases;
    if (importFrom) {
      const arm = getArg("arm", "") as Arm;
      if (arm !== "single" && arm !== "zoom") throw new Error("--import-agent needs --arm single|zoom");
      const model = getArg("model", "agent");
      const r = await importAnswers(outDir, resolve(importFrom), arm, model);
      console.log(`  imported ${r.imported} answer(s) as ${model} / ${arm}${r.missing.length ? `  ${YELLOW}missing: ${r.missing.join(", ")}${RESET}` : ""}`);
    }
    if (exportTo) {
      await exportAgent(cases, outDir, exportTo, opts);
      return;
    }
  } else {
    const buildOptions: BuildOptions = {
      fixtures, kinds, seed: getIntArg("seed", 1), deviceScaleFactor: getIntArg("scale", 2, { min: 1, max: 4 }),
      viewportWidth: getIntArg("width", 1440, { min: 320 }), outDir,
    };
    const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
    console.log(`  ${DIM}Rendering ${fixtures.length} fixture(s) × ${kinds.length} kind(s)…${RESET}`);
    const built = await withBrowser((browser) => buildCases(browser, buildOptions));
    cases = built.cases;
    console.log(`  ${CYAN}${cases.length} case(s)${RESET} in ${outDir}${built.skipped.length ? `  ${YELLOW}skipped: ${built.skipped.map((s) => `${s.id} (${s.reason})`).join("; ")}${RESET}` : ""}`);
    if (hasFlag("self-check")) {
      const check = selfCheck(cases);
      console.log(`  oracle ${check.oracle}/${cases.length}, always-unchanged ${check.blind}/${cases.length} (expected ${check.none})`);
      if (check.oracle !== cases.length || check.blind !== check.none) process.exit(1);
    }
    if (exportTo) {
      await exportAgent(cases, outDir, exportTo, opts);
      return;
    }
    if (hasFlag("render-only") || hasFlag("self-check")) return;
    if (models.length === 0) {
      console.log(`  ${YELLOW}No models given. Pass model ids, or --render-only / --rescore / --export-agent (no API key: the agent's own vision).${RESET}`);
      process.exit(1);
    }
    // What the answers were collected with, so a later --rescore reports the run, not its own flags.
    await writeFile(join(outDir, "run-options.json"), JSON.stringify({ maxZooms: opts.maxZooms, budget, coordinates, maxTokens: opts.maxTokens }, null, 2));
    for (const id of models) {
      const model = await resolveModel(id);
      createZoomDriver(model); // fail on a missing key before spending on any other model
      for (const arm of arms) {
        const dir = join(outDir, "answers", safeName(model.id), arm);
        await mkdir(dir, { recursive: true });
        for (const c of cases) {
          process.stdout.write(`  ${`${model.id} ${arm}`.padEnd(52)} ${c.id.padEnd(28)} `);
          const a = await ask(model, arm, c, opts);
          await writeFile(join(dir, `${c.id}.json`), JSON.stringify(a, null, 2));
          const s = scoreAnswer(c, a.answer);
          console.log(a.error ? `${RED}ERROR ${a.error.slice(0, 60)}${RESET}` : s.correct ? `${GREEN}✓${RESET}` : `${RED}✗${RESET} ${DIM}${s.note ?? ""}${RESET}`);
        }
      }
    }
  }
  const answers = (await loadAnswers(outDir)).filter((a) => models.length === 0 || models.some((m) => a.model === m || a.model.includes(m)));
  const reports = report(cases, answers);
  printTable(reports);
  const ran = existsSync(join(outDir, "run-options.json"))
    ? JSON.parse(await readFile(join(outDir, "run-options.json"), "utf8")) as { maxZooms: number; budget: ImageBudget; coordinates: ZoomCoordinates }
    : { maxZooms: opts.maxZooms, budget, coordinates };
  const meta = { maxZooms: ran.maxZooms, budget: `${ran.budget.maxEdge}px / ${ran.budget.maxPixels}px²`, coordinates: ran.coordinates };
  await writeFile(join(outDir, "report.json"), JSON.stringify({ date: new Date().toISOString(), meta, reports, comparisons: comparisons(reports) }, null, 2));
  const md = getArg("md", "");
  if (md) {
    await writeFile(md, markdownReport(cases, reports, meta));
    console.log(`  ${DIM}Markdown report: ${md}${RESET}`);
  }
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => {
    console.error(`  ${RED}${(e as Error).message}${RESET}`);
    process.exit(1);
  });
}
