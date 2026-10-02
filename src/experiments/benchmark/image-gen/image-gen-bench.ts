#!/usr/bin/env node
/**
 * Image-generation bench: which OpenRouter image model draws a figure a document can use?
 *
 * Every model gets the same briefs (`briefs.ts`) through the same client
 * (`@mizchi/vlmkit-ai/image-gen-client.ts`, the route the default model runs on). A run writes
 * the images, one contact sheet per brief, and `evaluation.json` with every verdict still null.
 * A scorer (a person, or an agent looking at the sheets) fills the verdicts in, and `--report`
 * checks the file and prints the ranking. There is no automatic score: what a brief asks is
 * whether the picture says what the brief says, and no pixel metric answers that.
 *
 * Usage:
 *   B="node --experimental-strip-types src/experiments/benchmark/image-gen/image-gen-bench.ts"
 *   $B --list                                        # the Images API catalogue (id + parameters)
 *   $B                                               # re-run every model of the saved evaluation
 *   $B openai/gpt-image-2.5-flare meta/muse-image    # or name the models
 *   $B … --briefs zoom,vrt --out dir --concurrency 8 --no-sheets --chromium /path/to/chrome
 *   $B --report dir/evaluation.json [--md out.md]    # after scoring: validate + rank
 *
 * Environment: OPENROUTER_API_KEY for a run. --report needs none.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { getArg, getIntArg, getPositionalArgs, hasFlag } from "@mizchi/vlmkit-core/cli-args.ts";
import { DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { createImageGenClient } from "@mizchi/vlmkit-ai/image-gen-client.ts";
import { BRIEFS, type Brief } from "./briefs.ts";
import { newEvaluation, problems, renderMarkdown, type Evaluation, type Run } from "./score.ts";

/** The evaluation a bare run re-runs, and the one `score.test.ts` holds to the briefs. */
export const SAVED_EVALUATION = "docs/reports/data/2026-09-30-image-gen/evaluation.json";

const EXT: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/png": "png",
};

async function runOne(model: string, brief: Brief, outDir: string): Promise<Run> {
  const started = Date.now();
  try {
    const client = createImageGenClient(model);
    const res = await client.generate({ prompt: brief.prompt, aspectRatio: brief.aspectRatio });
    if (!res.images[0])
      return {
        model,
        brief: brief.id,
        costUsd: res.costUsd,
        latencyMs: res.latencyMs,
        error: "no image in the response",
      };
    const file = `${brief.id}--${model.replace(/[/:]/g, "__")}.${EXT[res.mediaTypes[0] ?? "image/png"] ?? "png"}`;
    await writeFile(join(outDir, file), res.images[0]);
    return { model, brief: brief.id, costUsd: res.costUsd, latencyMs: res.latencyMs, file };
  } catch (e) {
    return {
      model,
      brief: brief.id,
      costUsd: null,
      latencyMs: Date.now() - started,
      error: (e as Error).message.slice(0, 300),
    };
  }
}

/** One sheet per brief, every model's image labelled with its id, so a scorer compares like with like. */
async function contactSheets(ev: Evaluation, outDir: string, executablePath?: string): Promise<string[]> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const media = (f: string) =>
    ({ svg: "image/svg+xml", jpg: "image/jpeg", webp: "image/webp" })[f.split(".").pop()!] ?? "image/png";
  return withBrowser(
    async (browser) => {
      const page = await browser.newPage({ viewport: { width: 1600, height: 600 } });
      const written: string[] = [];
      for (const brief of Object.keys(ev.briefs)) {
        const runs = ev.runs.filter((r) => r.brief === brief && r.file).sort((a, b) => a.model.localeCompare(b.model));
        if (!runs.length) continue;
        const tiles = await Promise.all(
          runs.map(async (r) => {
            const src = `data:${media(r.file!)};base64,${(await readFile(join(outDir, r.file!))).toString("base64")}`;
            return `<div style="background:#fff"><div style="padding:3px;background:#222;color:#ff0">${r.model}</div><img src="${src}" style="width:100%;display:block"></div>`;
          }),
        );
        await page.setContent(
          `<body style="margin:0;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:#999;font:bold 14px sans-serif">${tiles.join("")}</body>`,
        );
        await page.waitForLoadState("networkidle");
        const path = join(outDir, `sheet-${brief}.jpg`);
        await page.screenshot({ path, fullPage: true, type: "jpeg", quality: 72 });
        written.push(path);
      }
      return written;
    },
    executablePath ? { launch: { executablePath } } : {},
  );
}

async function list(): Promise<void> {
  const key = process.env.OPENROUTER_API_KEY;
  const res = await fetch("https://openrouter.ai/api/v1/images/models", {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  });
  if (!res.ok) throw new Error(`images/models: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const { data } = (await res.json()) as { data: { id: string; supported_parameters?: Record<string, unknown> }[] };
  for (const m of data) console.log(`${m.id}  ${DIM}${Object.keys(m.supported_parameters ?? {}).join(",")}${RESET}`);
}

async function report(path: string): Promise<void> {
  const ev = JSON.parse(await readFile(path, "utf8")) as Evaluation;
  const found = problems(ev);
  const md = renderMarkdown(ev);
  console.log(md);
  const out = getArg("md", "");
  if (out) await writeFile(out, md);
  if (found.length) {
    for (const p of found) console.error(`  ${YELLOW}${p}${RESET}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  if (hasFlag("list")) return list();
  const reportPath = getArg("report", "");
  if (reportPath) return report(reportPath);

  const valueFlags = ["briefs", "out", "concurrency", "md", "report", "chromium"];
  let models = getPositionalArgs(valueFlags);
  if (!models.length) {
    const saved = JSON.parse(await readFile(SAVED_EVALUATION, "utf8")) as Evaluation;
    models = [...new Set(saved.runs.map((r) => r.model))];
    console.log(`  ${DIM}No models named: re-running the ${models.length} of ${SAVED_EVALUATION}${RESET}`);
  }
  const wanted = getArg("briefs", "");
  const briefs = wanted ? BRIEFS.filter((b) => wanted.split(",").includes(b.id)) : BRIEFS;
  if (!briefs.length) throw new Error(`--briefs matched none of ${BRIEFS.map((b) => b.id).join(", ")}`);
  if (!process.env.OPENROUTER_API_KEY)
    throw new Error("OPENROUTER_API_KEY is required for a run (--report needs none)");

  const date = new Date().toISOString().slice(0, 10);
  const outDir = resolve(getArg("out", `test-results/image-gen/${date}`));
  await mkdir(outDir, { recursive: true });
  const jobs = models.flatMap((m) => briefs.map((b) => [m, b] as const));
  const runs: Run[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: getIntArg("concurrency", 8, { min: 1, max: 32 }) }, async () => {
      while (next < jobs.length) {
        const [model, brief] = jobs[next++];
        const run = await runOne(model, brief, outDir);
        runs.push(run);
        const cost = run.costUsd === null ? "?" : `$${run.costUsd.toFixed(3)}`;
        console.log(
          run.error
            ? `  ${RED}✗${RESET} ${model} ${brief.id}: ${run.error}`
            : `  ${GREEN}✓${RESET} ${model} ${brief.id}  ${cost}  ${(run.latencyMs / 1000).toFixed(1)}s`,
        );
      }
    }),
  );
  runs.sort((a, b) => a.model.localeCompare(b.model) || a.brief.localeCompare(b.brief));
  const ev = newEvaluation(date, runs, briefs);
  await writeFile(join(outDir, "evaluation.json"), `${JSON.stringify(ev, null, 1)}\n`);
  // The images and evaluation.json are already on disk; a browser that will not start costs the
  // sheets, not the money spent on the run.
  let sheets: string[] = [];
  if (!hasFlag("no-sheets")) {
    try {
      sheets = await contactSheets(ev, outDir, getArg("chromium", "") || undefined);
    } catch (e) {
      console.error(
        `  ${YELLOW}contact sheets skipped: ${(e as Error).message.split("\n")[0]} (try --chromium <path>)${RESET}`,
      );
    }
  }
  const spent = runs.reduce((a, r) => a + (r.costUsd ?? 0), 0);
  console.log(`\n  ${runs.filter((r) => r.file).length}/${runs.length} images, $${spent.toFixed(2)} → ${outDir}`);
  for (const s of sheets) console.log(`  ${DIM}sheet${RESET} ${s}`);
  console.log(`  Next: look at every sheet, fill in "scorer" and each verdict (pass / partial / fail, with a note unless pass)
  in evaluation.json against the checks in briefs.ts, then: --report ${join(outDir, "evaluation.json")}`);
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => {
    console.error(`  ${RED}${(e as Error).message}${RESET}`);
    process.exit(1);
  });
}
