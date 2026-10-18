#!/usr/bin/env node
/**
 * Can Jev name an animation's easing from its frames? A known CSS animation (one object moving
 * 480px in 1000ms under one of seven timing functions) is seeked on the held animation clock to
 * 0, 100, … 1000ms and shot, and the sequence is shown to Jev three ways:
 *
 *   frames  the 11 frames as 11 assets, in order, with their times, and one `choice` of easing
 *   sheet   one image: the band the object travels in, cut from each frame and stacked in
 *           order (rows top to bottom, or columns left to right for vertical motion); one `choice`
 *   box     one `box` per frame, and the easing fitted to the box centres by `fitEasing`
 *
 * and to the pixels with no model (`pixels`: the object's centroid per frame, same fit), which
 * says whether the 11 frames carry the answer at all.
 *
 * Usage:
 *   node --experimental-strip-types src/experiments/benchmark/jev-easing/jev-easing.ts \
 *     [--out test-results/jev-easing] [--md report.md] [--executable-path …] [--rescore]
 *
 * Environment: TYPESAFEAI_API_KEY. `--rescore` reads saved answers and needs no key or browser.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getArg, hasFlag } from "@mizchi/vlmkit-core/cli-args.ts";
import { askJev, JEV_DEFAULT_MODEL, pngImage, type JevAnswer, type JevResponse } from "@mizchi/vlmkit-ai/jev-client.ts";
import { cropImage, decodeImage, encodePngImage, type RgbaImage } from "@mizchi/vlmkit-ai/zoom-image.ts";
import { EASINGS, EASING_NAMES, fitEasing, type EasingName } from "./easing.ts";

const TIMES = Array.from({ length: 11 }, (_, i) => i * 100);
const OBJECT = 48;
const TRAVEL = 480;

interface Variant {
  id: string;
  /** What the object is, as a `box` question names it. */
  noun: string;
  axis: "x" | "y";
  /** -1: moves toward the start of the axis (right to left). */
  dir: 1 | -1;
  stage: { width: number; height: number };
  objectCss: string;
  content?: string;
}

const VARIANTS: Variant[] = [
  {
    id: "square",
    noun: "the blue square",
    axis: "x",
    dir: 1,
    stage: { width: 640, height: 320 },
    objectCss: `left:40px;top:136px;width:${OBJECT}px;height:${OBJECT}px;background:#2563eb;border-radius:6px`,
  },
  {
    id: "circle",
    noun: "the green circle",
    axis: "y",
    dir: 1,
    stage: { width: 320, height: 640 },
    objectCss: `left:136px;top:40px;width:${OBJECT}px;height:${OBJECT}px;background:#16a34a;border-radius:50%`,
  },
  {
    id: "pill",
    noun: 'the red "Save" button',
    axis: "x",
    dir: -1,
    stage: { width: 640, height: 320 },
    objectCss: `left:${640 - 16 - 80}px;top:140px;width:80px;height:40px;background:#dc2626;border-radius:20px;color:#fff;font:600 16px/40px system-ui,sans-serif;text-align:center`,
    content: "Save",
  },
];

/** What a `choice` reads. A description is part of the measurement: change it and re-run. */
export const EASING_CRITERIA: Record<EasingName, string> = {
  linear: "constant speed: the object moves the same distance between every pair of consecutive frames",
  ease: "the CSS default `ease`: a short slow start, then fast, then a long slow finish; most of the distance is covered in the first half",
  "ease-in": "starts slowly and keeps speeding up: the distance between consecutive frames grows until the end",
  "ease-out": "starts fast and keeps slowing down: the distance between consecutive frames shrinks toward the end",
  "ease-in-out": "slow at both ends and fastest in the middle, symmetric in time",
  steps:
    "moves in discrete jumps and stands still between them: several consecutive frames show it at the same position",
  overshoot: "moves fast, passes beyond its final position, then comes back and settles at it",
};

const QUESTION_FRAMES =
  "`frames` show one animation sampled every 100ms, from 0ms (the first) to 1000ms (the last). The object moves from its start to its end position. Which timing function does its position follow over time?";
const QUESTION_SHEET = (v: Variant) =>
  v.axis === "x"
    ? "`sheet` shows one animation: each row is the same strip of the screen at a later time, every 100ms from 0ms (top row) to 1000ms (bottom row). The object moves from its start to its end position. Which timing function does its position follow over time?"
    : "`sheet` shows one animation: each column is the same strip of the screen at a later time, every 100ms from 0ms (left column) to 1000ms (right column). The object moves from its start to its end position. Which timing function does its position follow over time?";

interface Case {
  variant: string;
  easing: EasingName;
  frames: string[];
  sheet: string;
}

interface Call {
  arm: "frames" | "sheet" | "box";
  key: string;
  inputTokens: number;
  costUsd: number;
  latencyMs: number;
}

interface Saved {
  model: string;
  cases: Case[];
  calls: Call[];
  answers: Record<
    string,
    {
      frames?: { choice: string; confidence: number; probabilities: Record<string, number> };
      sheet?: { choice: string; confidence: number; probabilities: Record<string, number> };
      /** Box centre on the motion axis, px, per frame. */
      box?: number[];
      /** Object centroid on the motion axis, px, per frame. */
      pixels?: number[];
    }
  >;
}

const caseKey = (c: { variant: string; easing: string }) => `${c.variant}-${c.easing}`;

function pageHtml(v: Variant, easing: string): string {
  const to = v.axis === "x" ? `translateX(${v.dir * TRAVEL}px)` : `translateY(${v.dir * TRAVEL}px)`;
  return `<!doctype html><html><head><style>
html,body{margin:0;background:#f8fafc}
#stage{position:relative;width:${v.stage.width}px;height:${v.stage.height}px;background:#f8fafc;overflow:hidden}
#o{position:absolute;${v.objectCss};animation:move 1000ms ${easing} both paused}
@keyframes move{from{transform:none}to{transform:${to}}}
</style></head><body><div id="stage"><div id="o">${v.content ?? ""}</div></div></body></html>`;
}

/** Centroid on the motion axis of the pixels that are not the background. */
function centroid(img: RgbaImage, axis: "x" | "y"): number {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const d = Math.abs(img.data[i]! - 0xf8) + Math.abs(img.data[i + 1]! - 0xfa) + Math.abs(img.data[i + 2]! - 0xfc);
      if (d < 90) continue;
      sum += axis === "x" ? x : y;
      n++;
    }
  }
  return n === 0 ? NaN : sum / n;
}

/** The band the object travels in, from every frame, stacked with 2px rules between. */
function buildSheet(frames: RgbaImage[], v: Variant): RgbaImage {
  const band = 64;
  const gap = 2;
  const n = frames.length;
  const across = v.axis === "x" ? v.stage.width : v.stage.height;
  // Every variant's object is centred 160px across its motion axis.
  const centre = 160;
  const along = n * band + (n - 1) * gap;
  const width = v.axis === "x" ? across : along;
  const height = v.axis === "x" ? along : across;
  const data = new Uint8Array(width * height * 4).fill(0xcb);
  const out: RgbaImage = { width, height, data };
  frames.forEach((f, k) => {
    const cut =
      v.axis === "x"
        ? cropImage(f, { x1: 0, y1: centre - band / 2, x2: f.width, y2: centre + band / 2 })
        : cropImage(f, { x1: centre - band / 2, y1: 0, x2: centre + band / 2, y2: f.height });
    const ox = v.axis === "x" ? 0 : k * (band + gap);
    const oy = v.axis === "x" ? k * (band + gap) : 0;
    for (let y = 0; y < cut.height; y++) {
      data.set(cut.data.subarray(y * cut.width * 4, (y + 1) * cut.width * 4), ((oy + y) * width + ox) * 4);
    }
  });
  return out;
}

async function capture(out: string, executablePath?: string): Promise<Case[]> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  await mkdir(join(out, "frames"), { recursive: true });
  return withBrowser(
    async (browser) => {
      const cases: Case[] = [];
      const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
      for (const v of VARIANTS) {
        for (const e of EASING_NAMES) {
          await page.setContent(pageHtml(v, EASINGS[e]));
          const frames: string[] = [];
          const imgs: RgbaImage[] = [];
          for (const t of TIMES) {
            await page.evaluate((ms) => {
              const a = document.getElementById("o")!.getAnimations()[0]!;
              a.currentTime = ms;
            }, t);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            const png = await page.locator("#stage").screenshot({ type: "png", animations: "allow" });
            const file = join(out, "frames", `${v.id}-${e}-t${String(t).padStart(4, "0")}.png`);
            await writeFile(file, png);
            frames.push(file);
            imgs.push(decodeImage(png));
          }
          const sheet = join(out, "frames", `${v.id}-${e}-sheet.png`);
          await writeFile(sheet, encodePngImage(buildSheet(imgs, v)));
          cases.push({ variant: v.id, easing: e, frames, sheet });
        }
      }
      return cases;
    },
    executablePath ? { launch: { executablePath } } : {},
  );
}

async function pool<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await f(items[i]!);
      }
    }),
  );
  return out;
}

const record = (calls: Call[], arm: Call["arm"], key: string, r: JevResponse) => {
  calls.push({ arm, key, inputTokens: r.usage.input_tokens, costUsd: r.costUsd, latencyMs: r.latencyMs });
  return r;
};

async function ask(saved: Saved, model: string) {
  const criteria = { ...EASING_CRITERIA };
  await pool(saved.cases, 3, async (c) => {
    const v = VARIANTS.find((x) => x.id === c.variant)!;
    const a = (saved.answers[caseKey(c)] ??= {});
    const pngs = await Promise.all(c.frames.map((f) => readFile(f)));
    const imgs = pngs.map((p) => decodeImage(p));
    a.pixels = imgs.map((img) => centroid(img, v.axis));

    const assets = Object.fromEntries(pngs.map((p, i) => [`frame_${String(i).padStart(2, "0")}`, pngImage(p)]));
    const fr = record(
      saved.calls,
      "frames",
      caseKey(c),
      await askJev({
        model,
        state: { frames: Object.keys(assets).map((k, i) => ({ time_ms: TIMES[i], image: k })) },
        assets,
        questions: { easing: { type: "choice", instructions: QUESTION_FRAMES, criteria } },
      }),
    );
    const fa = fr.answers.easing as Extract<JevAnswer, { type: "choice" }>;
    a.frames = { choice: fa.choice, confidence: fa.confidence, probabilities: fa.probabilities };

    const sr = record(
      saved.calls,
      "sheet",
      caseKey(c),
      await askJev({
        model,
        state: { sheet: "sheet" },
        assets: { sheet: pngImage(await readFile(c.sheet)) },
        questions: { easing: { type: "choice", instructions: QUESTION_SHEET(v), criteria } },
      }),
    );
    const sa = sr.answers.easing as Extract<JevAnswer, { type: "choice" }>;
    a.sheet = { choice: sa.choice, confidence: sa.confidence, probabilities: sa.probabilities };

    a.box = [];
    for (let i = 0; i < pngs.length; i++) {
      const br = record(
        saved.calls,
        "box",
        `${caseKey(c)}#${i}`,
        await askJev({
          model,
          state: { screenshot: "screenshot" },
          assets: { screenshot: pngImage(pngs[i]!) },
          questions: { where: { type: "box", instructions: `${v.noun} in \`screenshot\`` } },
        }),
      );
      const b = (br.answers.where as Extract<JevAnswer, { type: "box" }>).box;
      a.box.push(
        v.axis === "x" ? ((b.left + b.right) / 2) * imgs[i]!.width : ((b.top + b.bottom) / 2) * imgs[i]!.height,
      );
    }
    console.error(`[jev-easing] ${caseKey(c)}: frames ${a.frames.choice}, sheet ${a.sheet.choice}`);
  });
}

function report(saved: Saved): string {
  const arms = ["frames", "sheet", "box", "pixels"] as const;
  const named = (c: Case, arm: (typeof arms)[number]): string | undefined => {
    const a = saved.answers[caseKey(c)];
    if (!a) return undefined;
    if (arm === "frames" || arm === "sheet") return a[arm]?.choice;
    const xs = a[arm];
    return xs ? fitEasing(xs).best : undefined;
  };
  const lines: string[] = [];
  const n = saved.cases.length;
  lines.push(
    `${n} cases: ${VARIANTS.length} objects x ${EASING_NAMES.length} easings, 11 frames each. Model ${saved.model}.`,
    "",
  );
  lines.push("| arm | right | by easing (right of " + VARIANTS.length + ") |", "|---|---:|---|");
  for (const arm of arms) {
    const right = saved.cases.filter((c) => named(c, arm) === c.easing).length;
    const by = EASING_NAMES.map(
      (e) => `${e} ${saved.cases.filter((c) => c.easing === e && named(c, arm) === e).length}`,
    ).join(", ");
    lines.push(`| ${arm} | **${right}/${n}** | ${by} |`);
  }
  // Fewer frames: the same answers, every 2nd (6 frames) and every 5th (3 frames).
  for (const step of [2, 5]) {
    const right = saved.cases.filter((c) => {
      const xs = saved.answers[caseKey(c)]?.box?.filter((_, i) => i % step === 0);
      return xs && fitEasing(xs).best === c.easing;
    }).length;
    lines.push(
      `| box, every ${step === 2 ? "2nd frame (6)" : "5th frame (3)"} | ${right}/${n} | same answers, subsampled |`,
    );
  }
  lines.push("");
  for (const arm of ["frames", "sheet", "box"] as const) {
    lines.push(`### ${arm}: what each easing was named`, "");
    lines.push(
      `| truth \\ answer | ${EASING_NAMES.join(" | ")} |`,
      `|---|${EASING_NAMES.map(() => "---:").join("|")}|`,
    );
    for (const e of EASING_NAMES) {
      const row = EASING_NAMES.map(
        (g) => saved.cases.filter((c) => c.easing === e && named(c, arm) === g).length || "",
      );
      lines.push(`| ${e} | ${row.join(" | ")} |`);
    }
    lines.push("");
  }
  for (const arm of ["frames", "sheet"] as const) {
    const conf = saved.cases.map((c) => ({
      ok: named(c, arm) === c.easing,
      p: saved.answers[caseKey(c)]?.[arm]?.confidence ?? NaN,
      pTrue: saved.answers[caseKey(c)]?.[arm]?.probabilities?.[c.easing] ?? NaN,
    }));
    const med = (xs: number[]) => {
      const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
      return s.length ? s[s.length >> 1]!.toFixed(2) : "—";
    };
    lines.push(
      `- ${arm}: median confidence right ${med(conf.filter((x) => x.ok).map((x) => x.p))}, wrong ${med(conf.filter((x) => !x.ok).map((x) => x.p))}; median probability of the true easing ${med(conf.map((x) => x.pTrue))}`,
    );
  }
  const boxErr: number[] = [];
  for (const c of saved.cases) {
    const a = saved.answers[caseKey(c)];
    if (a?.box && a.pixels) a.box.forEach((b, i) => boxErr.push(Math.abs(b - a.pixels![i]!)));
  }
  boxErr.sort((x, y) => x - y);
  if (boxErr.length)
    lines.push(
      `- box centre vs pixel centroid on the motion axis: median ${boxErr[boxErr.length >> 1]!.toFixed(1)}px, p90 ${boxErr[Math.floor(boxErr.length * 0.9)]!.toFixed(1)}px, max ${boxErr[boxErr.length - 1]!.toFixed(1)}px`,
    );
  lines.push("");
  lines.push("| arm | requests | input tokens per case | $ per case | median latency |", "|---|---:|---:|---:|---:|");
  for (const arm of ["frames", "sheet", "box"] as const) {
    const cs = saved.calls.filter((c) => c.arm === arm);
    if (!cs.length) continue;
    const lat = cs.map((c) => c.latencyMs).sort((a, b) => a - b);
    lines.push(
      `| ${arm} | ${cs.length} | ${Math.round(cs.reduce((s, c) => s + c.inputTokens, 0) / n)} | $${(cs.reduce((s, c) => s + c.costUsd, 0) / n).toFixed(5)} | ${Math.round(lat[lat.length >> 1]!)}ms |`,
    );
  }
  return lines.join("\n");
}

async function main() {
  const out = resolve(getArg("--out") ?? "test-results/jev-easing");
  const md = getArg("--md");
  const answersPath = join(out, "answers.json");
  let saved: Saved;
  if (hasFlag("--rescore")) {
    saved = JSON.parse(await readFile(answersPath, "utf-8"));
  } else {
    if (!process.env.TYPESAFEAI_API_KEY && !process.env.TYPESAFE_API_KEY) {
      console.error("error: needs TYPESAFEAI_API_KEY");
      process.exit(2);
    }
    const model = getArg("--model") ?? JEV_DEFAULT_MODEL;
    await mkdir(out, { recursive: true });
    const cases = await capture(out, getArg("--executable-path"));
    saved = { model, cases, calls: [], answers: {} };
    if (hasFlag("--capture-only")) {
      for (const c of cases) {
        const v = VARIANTS.find((x) => x.id === c.variant)!;
        const px = await Promise.all(c.frames.map(async (f) => centroid(decodeImage(await readFile(f)), v.axis)));
        saved.answers[caseKey(c)] = { pixels: px };
      }
      console.log(report(saved));
      return;
    }
    await ask(saved, model);
    await writeFile(answersPath, JSON.stringify(saved, null, 1));
  }
  const text = report(saved);
  console.log(text);
  if (md) await writeFile(md, text + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
