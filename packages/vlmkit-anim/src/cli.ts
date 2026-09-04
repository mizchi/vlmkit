/**
 * `vlmkit anim <verb> <file>` — the writer's loop for the animation IR.
 *
 *   check     validate + compile + semantic checks + stats, one report   ← the loop
 *   validate  schema/reference validation only
 *   compile   Scene → Timeline JSON
 *   explain   the narration as a numbered list of steps
 *   render    one frame as SVG at --at <ms> (or --step <n>)
 *   frames    every step (or --samples N) as SVG files, --png through Playwright
 *   html      a self-contained page with the <vlm-anim> runtime inline
 *   runtime   write the runtime JS to a file (or stdout)
 *   schema    the cheat sheet for one kind, or the index
 *
 * `check` is the command an agent runs after every edit; everything it prints
 * is phrased for the next edit. Exit 1 on any error-severity diagnostic.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleCliError, UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { hasFlag, readFlag, readInt, readPositionals } from "@mizchi/vlmkit-core/arg-reader.ts";
import { animStats, checkAnimation, explain } from "./check.ts";
import { compileScene, SceneValidationError } from "./compile/index.ts";
import { renderFrameSvg, sampleTimes } from "./render-svg.ts";
import { RUNTIME_SOURCE, renderEmbedHtml } from "./runtime.ts";
import { currentStep, timelineDuration } from "./timeline.ts";
import { SCENE_FORMAT, SCENE_KINDS, TIMELINE_FORMAT, type Diagnostic, type Scene, type Timeline } from "./types.ts";
import { formatDiagnostics, hasErrors, validateDocument, validateTimeline } from "./validate.ts";
import { schemaIndex, schemaSheet } from "./schema-sheet.ts";

const VALUE_FLAGS = ["--out", "--at", "--step", "--samples", "--kind", "--title", "--max-ms"];

function usage(): string {
  return `Usage: vlmkit anim <command> <file.json> [options]

Commands
  check <scene|timeline>          Validate, compile, run semantic checks, print stats. Exit 1 on errors.
        [--max-ms N]              …and fail when the animation runs longer than N ms.
  validate <scene|timeline>       Schema and reference validation only.
  compile <scene> [--out t.json]  Lower a scene to its timeline (stdout when no --out).
  explain <scene|timeline>        Print the narration: one line per step.
  render <file> --at <ms>|--step <n> [--out frame.svg]
                                  One frame as SVG (stdout when no --out).
  frames <file> --out <dir> [--samples N] [--png]
                                  Every step marker (plus N evenly spaced samples) as SVG files; --png also rasterises.
  html <file> [--out page.html] [--no-autoplay] [--loop] [--title T]
                                  Self-contained page embedding the <vlm-anim> runtime and the timeline.
  runtime [--out vlm-anim.js]     The runtime script alone, for a site that embeds many animations.
  schema [--kind <kind>]          The writing guide: field list and a minimal example for a kind, or the index.

Options
  --json                          Machine-readable output for check / validate / explain.

Kinds: ${SCENE_KINDS.join(", ")}. A scene is {"format": "${SCENE_FORMAT}", "kind": ...}; a
compiled timeline is {"format": "${TIMELINE_FORMAT}", ...} and every command that takes a scene also takes one.`;
}

interface Loaded {
  path: string;
  doc: unknown;
  layer: "scene" | "timeline";
  scene?: Scene;
  timeline: Timeline;
  diagnostics: Diagnostic[];
}

/** Read, validate, and (for a scene) compile. Diagnostics are collected, not thrown. */
async function load(path: string): Promise<Loaded | { path: string; diagnostics: Diagnostic[]; layer: "scene" | "timeline" | "unknown" }> {
  let doc: unknown;
  const raw = await readFile(path, "utf-8");
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    return { path, layer: "unknown", diagnostics: [{ severity: "error", path: "", message: `not valid JSON: ${(e as Error).message}`, hint: "the file must be a single JSON object; check for trailing commas and comments" }] };
  }
  const { layer, diagnostics } = validateDocument(doc);
  if (layer === "unknown" || hasErrors(diagnostics)) return { path, layer, diagnostics };
  if (layer === "timeline") return { path, doc, layer, timeline: doc as Timeline, diagnostics };
  const scene = doc as Scene;
  let timeline: Timeline;
  try {
    timeline = compileScene(scene);
  } catch (e) {
    if (e instanceof SceneValidationError) return { path, layer, diagnostics: [...diagnostics, ...e.diagnostics] };
    throw e;
  }
  // The compiler's output must itself validate; a failure here is a compiler bug, reported as such.
  const tlDiags = validateTimeline(timeline).map((d) => ({ ...d, path: `compiled:${d.path}`, message: `compiler produced an invalid timeline: ${d.message}` }));
  return { path, doc, layer, scene, timeline, diagnostics: [...diagnostics, ...tlDiags] };
}

function isLoaded(x: Awaited<ReturnType<typeof load>>): x is Loaded {
  return "timeline" in x;
}

function printDiagnostics(diags: Diagnostic[], json: boolean): void {
  if (json) return;
  if (diags.length) console.log(formatDiagnostics(diags));
}

async function writeOut(out: string | undefined, content: string, what: string): Promise<void> {
  if (!out) {
    process.stdout.write(content.endsWith("\n") ? content : content + "\n");
    return;
  }
  await mkdir(dirname(resolve(out)), { recursive: true });
  await writeFile(out, content);
  console.log(`${what} → ${out}`);
}

function requireFile(positionals: string[], verb: string): string {
  const file = positionals[0];
  if (!file) throw new UsageError(`vlmkit anim ${verb} needs a file: vlmkit anim ${verb} <scene.json>`);
  return file;
}

function resolveTime(tl: Timeline, argv: string[]): number {
  const at = readFlag(argv, "--at");
  const step = readInt(argv, "--step");
  if (step !== undefined) {
    const steps = tl.steps ?? [];
    if (step < 1 || step > steps.length) throw new UsageError(`--step ${step} is out of range: this timeline has ${steps.length} step(s), numbered 1..${steps.length}`);
    return steps[step - 1].t;
  }
  if (at === undefined) return timelineDuration(tl);
  if (at === "end") return timelineDuration(tl);
  const n = Number(at);
  if (!Number.isFinite(n) || n < 0) throw new UsageError(`--at takes milliseconds (or "end"), got ${JSON.stringify(at)}`);
  return Math.min(n, timelineDuration(tl));
}

export async function runAnimCli(argv: string[]): Promise<number> {
  const help = hasFlag(argv, "--help") || hasFlag(argv, "-h");
  const [verb, ...rest] = argv.filter((a) => a !== "--help" && a !== "-h");
  if (help || !verb) {
    console.log(usage());
    return help || !verb ? 0 : 1;
  }
  const json = hasFlag(rest, "--json");
  const positionals = readPositionals(rest, VALUE_FLAGS);

  if (verb === "schema") {
    const kind = readFlag(rest, "--kind") ?? positionals[0];
    if (!kind) {
      console.log(schemaIndex());
      return 0;
    }
    if (!(SCENE_KINDS as readonly string[]).includes(kind) && kind !== "timeline") {
      throw new UsageError(`unknown kind "${kind}"; kinds are ${SCENE_KINDS.join(", ")} (or "timeline")`);
    }
    console.log(schemaSheet(kind as Scene["kind"] | "timeline"));
    return 0;
  }
  if (verb === "runtime") {
    await writeOut(readFlag(rest, "--out"), RUNTIME_SOURCE.trim(), "runtime");
    return 0;
  }

  const file = requireFile(positionals, verb);
  const loaded = await load(file);

  if (verb === "validate") {
    if (json) console.log(JSON.stringify({ file, layer: loaded.layer, ok: !hasErrors(loaded.diagnostics), diagnostics: loaded.diagnostics }, null, 2));
    else {
      printDiagnostics(loaded.diagnostics, false);
      const errs = loaded.diagnostics.filter((d) => d.severity === "error").length;
      console.log(errs ? `✗ ${errs} error(s) in ${basename(file)}` : `✓ ${basename(file)} is a valid ${loaded.layer}`);
    }
    return hasErrors(loaded.diagnostics) ? 1 : 0;
  }

  if (!isLoaded(loaded)) {
    if (json) console.log(JSON.stringify({ file, ok: false, diagnostics: loaded.diagnostics }, null, 2));
    else {
      printDiagnostics(loaded.diagnostics, false);
      console.log(`✗ ${loaded.diagnostics.filter((d) => d.severity === "error").length} error(s): fix these before ${verb === "check" ? "the semantic checks can run" : `\`${verb}\` can run`}`);
    }
    return 1;
  }
  const { timeline: tl, scene } = loaded;

  switch (verb) {
    case "check": {
      const diags = [...loaded.diagnostics, ...checkAnimation(tl, scene)];
      const stats = animStats(tl, scene);
      const maxMs = readInt(rest, "--max-ms", { min: 1 });
      if (maxMs !== undefined && stats.durationMs > maxMs) {
        diags.push({ severity: "error", path: "duration", message: `the animation runs ${stats.durationMs}ms, over the ${maxMs}ms budget`, hint: 'lower "stepMs", drop beats, or pass a per-op "ms"' });
      }
      const ok = !hasErrors(diags);
      if (json) {
        console.log(JSON.stringify({ file, layer: loaded.layer, ok, diagnostics: diags, stats, explain: (tl.steps ?? []).map((s) => ({ t: s.t, label: s.label, caption: s.caption })) }, null, 2));
      } else {
        printDiagnostics(diags, false);
        const errs = diags.filter((d) => d.severity === "error").length;
        const warns = diags.length - errs;
        console.log(`${ok ? "✓" : "✗"} ${basename(file)} (${stats.kind}): ${errs} error(s), ${warns} warning(s)`);
        console.log(`  ${stats.durationMs}ms · ${stats.steps} steps (${stats.captions} captioned) · ${stats.nodes} nodes · ${stats.tracks} tracks / ${stats.keyframes} keyframes`);
        if (stats.sceneBytes) console.log(`  scene ${stats.sceneBytes} B → timeline ${stats.timelineBytes} B (×${stats.expansion})`);
        console.log(`  next: vlmkit anim explain ${file} · vlmkit anim render ${file} --step N · vlmkit anim html ${file} --out page.html`);
      }
      return ok ? 0 : 1;
    }
    case "compile": {
      printDiagnostics(loaded.diagnostics, json);
      await writeOut(readFlag(rest, "--out"), JSON.stringify(tl, null, 2), "timeline");
      return hasErrors(loaded.diagnostics) ? 1 : 0;
    }
    case "explain": {
      if (json) console.log(JSON.stringify({ file, steps: tl.steps ?? [], durationMs: timelineDuration(tl) }, null, 2));
      else console.log(explain(tl));
      return 0;
    }
    case "render": {
      const t = resolveTime(tl, rest);
      const svg = renderFrameSvg(tl, t);
      const step = currentStep(tl, t);
      const out = readFlag(rest, "--out");
      await writeOut(out, svg, `frame t=${Math.round(t)}${step?.caption ? ` "${step.caption}"` : ""}`);
      return 0;
    }
    case "frames": {
      const out = readFlag(rest, "--out");
      if (!out) throw new UsageError("vlmkit anim frames needs --out <dir>");
      const samples = readInt(rest, "--samples") ?? 0;
      const times = sampleTimes(tl, samples);
      await mkdir(out, { recursive: true });
      const written: { t: number; file: string; caption?: string }[] = [];
      for (const t of times) {
        const name = `frame-${String(Math.round(t)).padStart(6, "0")}.svg`;
        await writeFile(join(out, name), renderFrameSvg(tl, t));
        written.push({ t, file: name, caption: currentStep(tl, t)?.caption });
      }
      if (hasFlag(rest, "--png")) await rasterise(out, written.map((w) => w.file), tl);
      await writeFile(join(out, "frames.json"), JSON.stringify({ source: file, canvas: tl.canvas, frames: written }, null, 2));
      if (json) console.log(JSON.stringify({ out, frames: written }, null, 2));
      else {
        for (const w of written) console.log(`  ${w.file}  ${String(Math.round(w.t)).padStart(6)}ms  ${w.caption ?? ""}`);
        console.log(`${written.length} frame(s) → ${out}${hasFlag(rest, "--png") ? " (svg + png)" : ""}`);
      }
      return 0;
    }
    case "html": {
      const html = renderEmbedHtml(tl, { autoplay: !hasFlag(rest, "--no-autoplay"), loop: hasFlag(rest, "--loop"), title: readFlag(rest, "--title") });
      await writeOut(readFlag(rest, "--out"), html, "page");
      return 0;
    }
    default:
      throw new UsageError(`unknown command "${verb}"\n\n${usage()}`);
  }
}

/** SVG → PNG through Playwright, one page load per frame. Optional dependency: a clear message when absent. */
async function rasterise(dir: string, files: string[], tl: Timeline): Promise<void> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new UsageError("--png needs playwright installed (pnpm add -D playwright && npx playwright install chromium)");
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(tl.canvas.width), height: Math.ceil(tl.canvas.height) } });
    for (const f of files) {
      const svg = await readFile(join(dir, f), "utf-8");
      await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
      await page.screenshot({ path: join(dir, f.replace(/\.svg$/, ".png")), clip: { x: 0, y: 0, width: tl.canvas.width, height: tl.canvas.height } });
    }
  } finally {
    await browser.close();
  }
}

const isCliEntry =
  process.env.__VLMKIT_DISPATCHER_LEAF__ === "anim" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  runAnimCli(process.argv.slice(2))
    .then((code) => {
      if (code !== 0) process.exitCode = code;
    })
    .catch(handleCliError);
}
