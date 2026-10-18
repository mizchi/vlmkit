#!/usr/bin/env node
/**
 * Does `inspect motion` tell a broken CSS animation from an intact one? `fixtures/motion-defects/`
 * holds seven animations an author gets wrong, each intact and broken by the one mistake, with
 * the rule a correct check must report (`cases.json`).
 *
 * Each page is captured as `inspect motion` captures it (held clock, 11 instants across the
 * animations, one at rest) and asked through `checkMotionFrames`. Beside it, for each frame, the
 * DOM's truth: the target's rect, and whether its centre is the topmost element there (covered
 * or clipped otherwise). Scored: the expected rule found on the broken page, no fail on the
 * intact one; Jev's box against the DOM rect. And the deterministic gates on the same 14 pages
 * (`check animation`, `check integrity --timeline`), to say what Jev adds.
 *
 * Usage:
 *   node --experimental-strip-types src/experiments/benchmark/jev-motion/jev-motion.ts \
 *     [--out test-results/jev-motion] [--md report.md] [--only snap-back,clipped] [--no-gates] [--rescore]
 *
 * Environment: TYPESAFEAI_API_KEY. `--rescore` reads saved answers and needs no key or browser.
 * The gates run the built CLI (`dist/vlmkit.mjs`): `pnpm build` first.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { getArg, hasFlag } from "@mizchi/vlmkit-core/cli-args.ts";
import { checkMotionFrames, type MotionCheckReport } from "@mizchi/vlmkit-ai/motion-check.ts";
import type { EasingName } from "@mizchi/vlmkit-judge/motion-path.ts";
import { motionInstants } from "@mizchi/vlmkit-markup/inspect/motion-cli.ts";

const FIXTURES = resolve("fixtures/motion-defects");
/** The claims round's measured wording, and a narrower one: letters over letters, not a menu over a page. */
const OVERLAP = "text overlapping other text so that it is hard to read";
const OVERLAP_GLYPHS = "two lines of text printed on top of each other, their letters crossing";

interface Case {
  file: string;
  id: string;
  broken: boolean;
  target: string;
  selector: string;
  expectEasing?: EasingName;
  expect: string | null;
  note?: string;
}

interface DomFrame {
  atMs: number;
  rect: { x: number; y: number; width: number; height: number } | null;
  /** The target (or a descendant) is the topmost element at its centre, and it is not transparent. */
  visible: boolean;
}

interface GateRun {
  gate: string;
  exit: number;
  rules: string[];
}

interface Result {
  case: Case;
  startMs: number;
  endMs: number;
  dom: DomFrame[];
  report: MotionCheckReport;
  gates?: GateRun[];
}

async function capture(c: Case, framesDir: string) {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { openHeldTimeline, captureStable, frameWriter, frameSourceFacts } =
    await import("@mizchi/vlmkit-animation-eval/frames-capture.ts");
  const url = pathToFileURL(join(FIXTURES, c.file)).href;
  const viewport = { width: 1280, height: 800 };
  return withBrowser(
    async (browser) => {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const timeline = await openHeldTimeline(page, url);
      const finite = (await timeline.animations()).filter((a) => a.iterations !== null && a.durationMs > 0);
      const startMs = Math.min(...finite.map((a) => a.startMs));
      const endMs = Math.max(...finite.map((a) => a.startMs + a.durationMs * (a.iterations ?? 1)));
      const { motion, rest } = motionInstants(startMs, endMs);
      const writer = await frameWriter(framesDir, {
        tool: "jev-motion bench",
        url,
        viewport,
        ...(await frameSourceFacts(page)),
        clock: "held",
      });
      const frames: { atMs: number; png: Uint8Array }[] = [];
      const dom: DomFrame[] = [];
      for (const atMs of [...motion, rest]) {
        await timeline.at(atMs);
        const { png, stable } = await captureStable(page);
        await writer.add(png, { atMs, stable, ...(atMs > endMs ? { label: "rest" } : {}) });
        frames.push({ atMs, png: new Uint8Array(png) });
        dom.push({
          atMs,
          ...(await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return { rect: null, visible: false };
            const r = el.getBoundingClientRect();
            const cx = r.x + r.width / 2;
            const cy = r.y + r.height / 2;
            const top = document.elementFromPoint(cx, cy);
            const opacity = Number(getComputedStyle(el).opacity);
            const inView = cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight;
            return {
              rect: { x: r.x, y: r.y, width: r.width, height: r.height },
              visible: inView && opacity > 0.3 && !!top && (top === el || el.contains(top)),
            };
          }, c.selector)),
        });
      }
      await writer.finish();
      await page.close();
      return { frames, dom, startMs, endMs };
    },
    getArg("--executable-path") ? { launch: { executablePath: getArg("--executable-path")! } } : {},
  );
}

const exec = promisify(execFile);
async function runGate(args: string[]): Promise<GateRun> {
  try {
    const r = await exec("node", ["dist/vlmkit.mjs", ...args, "--json"], { maxBuffer: 64 << 20 });
    return {
      gate: args.slice(0, 2).join(" ") + (args.includes("--timeline") ? " --timeline" : ""),
      exit: 0,
      rules: rulesOf(r.stdout),
    };
  } catch (e) {
    const err = e as { code?: number; stdout?: string };
    return {
      gate: args.slice(0, 2).join(" ") + (args.includes("--timeline") ? " --timeline" : ""),
      exit: typeof err.code === "number" ? err.code : -1,
      rules: rulesOf(err.stdout ?? ""),
    };
  }
}

/** Every `rule` / `ruleId` / `kind` string under a `findings` array, deduplicated. */
function rulesOf(stdout: string): string[] {
  const found = new Set<string>();
  const walk = (v: unknown, inFindings: boolean) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, inFindings));
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (inFindings && (k === "rule" || k === "ruleId" || k === "id") && typeof x === "string") found.add(x);
        walk(x, inFindings || k === "findings");
      }
    }
  };
  try {
    walk(JSON.parse(stdout), false);
  } catch {
    // Not JSON: no rules to read.
  }
  return [...found].sort();
}

/** The rules `inspect motion` reported as fails, with `forbid-at-rest` for a statement seen at rest. */
function failRules(r: MotionCheckReport, statement = OVERLAP): string[] {
  const rules = r.targets.flatMap((t) => t.findings.filter((f) => f.severity === "fail").map((f) => f.rule as string));
  if (r.forbidden.some((f) => f.statement === statement && f.severity === "fail")) rules.push("forbid-at-rest");
  return [...new Set(rules)].sort();
}

function report(results: Result[]): string {
  const lines: string[] = [];
  const broken = results.filter((r) => r.case.broken);
  const intact = results.filter((r) => !r.case.broken);
  const caught = broken.filter((r) => failRules(r.report).includes(r.case.expect!)).length;
  const anyFail = broken.filter((r) => failRules(r.report).length > 0).length;
  const falseAlarms = intact.filter((r) => failRules(r.report).length > 0).length;
  lines.push(
    `${results.length} pages (${broken.length} broken, ${intact.length} intact). Broken caught by the expected rule ${caught}/${broken.length} (any fail ${anyFail}/${broken.length}); intact passed ${intact.length - falseAlarms}/${intact.length}.`,
    "",
    "| case | expected | inspect motion: broken | intact | easing fit (broken / intact) | gates on broken: check animation · integrity --timeline | gates on intact |",
    "|---|---|---|---|---|---|---|",
  );
  const ids = [...new Set(results.map((r) => r.case.id))];
  const fit = (r?: Result) => {
    const e = r?.report.targets[0]?.easing;
    return !e ? "—" : "best" in e ? `${e.best} (${e.margin.toFixed(1)}x)` : "skipped";
  };
  const gates = (r?: Result) =>
    r?.gates ? r.gates.map((g) => `${g.exit}${g.rules.length ? ` ${g.rules.join(",")}` : ""}`).join(" · ") : "—";
  for (const id of ids) {
    const b = broken.find((r) => r.case.id === id);
    const i = intact.find((r) => r.case.id === id);
    lines.push(
      `| ${id} | ${b?.case.expect} | ${b ? failRules(b.report).join(", ") || "pass" : "—"} | ${i ? failRules(i.report).join(", ") || "pass" : "—"} | ${fit(b)} / ${fit(i)} | ${gates(b)} | ${gates(i)} |`,
    );
  }
  const g = (rs: Result[]) => rs.filter((r) => failRules(r.report, OVERLAP_GLYPHS).length > 0);
  lines.push(
    "",
    `With the narrower overlap wording ("${OVERLAP_GLYPHS}") in place of the measured one: broken caught by the expected rule ${broken.filter((r) => failRules(r.report, OVERLAP_GLYPHS).includes(r.case.expect!)).length}/${broken.length}, intact with a fail ${g(intact).length}/${intact.length}${
      g(intact).length
        ? ` (${g(intact)
            .map((r) => r.case.id)
            .join(", ")})`
        : ""
    }.`,
  );
  // Jev against the DOM, frame by frame.
  const centreErr: number[] = [];
  let presAgree = 0;
  let presTotal = 0;
  const disagreements: string[] = [];
  for (const r of results) {
    r.dom.forEach((d, k) => {
      const a = r.report.frames[k]!.targets[0];
      if (!a) return;
      const jevShown = a.present >= 0.5;
      presTotal++;
      if (jevShown === d.visible) presAgree++;
      else
        disagreements.push(
          `${r.case.file} @${Math.round(d.atMs)}ms: DOM ${d.visible ? "visible" : "hidden"}, Jev ${a.present.toFixed(2)}`,
        );
      if (d.visible && jevShown && d.rect) {
        const jc = { x: a.box.x + a.box.width / 2, y: a.box.y + a.box.height / 2 };
        centreErr.push(Math.hypot(jc.x - (d.rect.x + d.rect.width / 2), jc.y - (d.rect.y + d.rect.height / 2)));
      }
    });
  }
  centreErr.sort((x, y) => x - y);
  const q = (p: number) =>
    centreErr.length ? centreErr[Math.min(centreErr.length - 1, Math.floor(centreErr.length * p))]!.toFixed(1) : "—";
  lines.push(
    "",
    `- Presence vs the DOM (target topmost at its centre, opacity > 0.3): ${presAgree}/${presTotal} frames agree.`,
    `- Box centre vs the DOM rect's centre, frames both call shown: median ${q(0.5)}px, p90 ${q(0.9)}px, max ${q(1)}px (n=${centreErr.length}).`,
  );
  if (disagreements.length) lines.push("", "Presence disagreements:", "", ...disagreements.map((d) => `- ${d}`));
  const calls = results.reduce((s, r) => s + r.report.calls, 0);
  const cost = results.reduce((s, r) => s + r.report.costUsd, 0);
  lines.push("", `Cost: ${calls} requests, $${cost.toFixed(4)} ($${(cost / results.length).toFixed(5)} per page).`);
  lines.push("", "Findings per page:", "");
  for (const r of results) {
    const fs = [
      ...r.report.targets.flatMap((t) => t.findings.map((f) => `${f.severity} ${f.rule}@${Math.round(f.atMs)}`)),
      ...r.report.forbidden.map((f) => `${f.severity} forbid@${f.frames.map((x) => Math.round(x.atMs)).join("/")}`),
    ];
    lines.push(`- ${r.case.file}: ${fs.join("; ") || "none"}`);
  }
  return lines.join("\n");
}

async function main() {
  const out = resolve(getArg("--out") ?? "test-results/jev-motion");
  const saved = join(out, "results.json");
  let results: Result[];
  if (hasFlag("--rescore")) {
    results = JSON.parse(await readFile(saved, "utf-8"));
  } else {
    if (!process.env.TYPESAFEAI_API_KEY && !process.env.TYPESAFE_API_KEY) {
      console.error("error: needs TYPESAFEAI_API_KEY");
      process.exit(2);
    }
    const only = getArg("--only")?.split(",");
    const cases: Case[] = JSON.parse(await readFile(join(FIXTURES, "cases.json"), "utf-8"));
    results = [];
    for (const c of cases.filter((x) => !only || only.includes(x.id))) {
      const cap = await capture(c, join(out, "frames", c.file.replace(/\.html$/, "")));
      const report = await checkMotionFrames(cap.frames, {
        targets: [c.target],
        forbid: [OVERLAP, OVERLAP_GLYPHS],
        startMs: cap.startMs,
        endMs: cap.endMs,
        ...(c.expectEasing ? { expectEasing: c.expectEasing } : {}),
      });
      const r: Result = { case: c, startMs: cap.startMs, endMs: cap.endMs, dom: cap.dom, report };
      if (!hasFlag("--no-gates")) {
        const file = join(FIXTURES, c.file);
        r.gates = [
          await runGate(["check", "animation", file]),
          await runGate(["check", "integrity", file, "--timeline"]),
        ];
      }
      console.error(
        `[jev-motion] ${c.file}: ${failRules(report).join(", ") || "pass"}${r.gates ? ` | gates ${r.gates.map((g) => g.exit).join("/")}` : ""}`,
      );
      results.push(r);
    }
    await mkdir(out, { recursive: true });
    await writeFile(saved, JSON.stringify(results, null, 1));
  }
  const text = report(results);
  console.log(text);
  const md = getArg("--md");
  if (md) await writeFile(md, text + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
