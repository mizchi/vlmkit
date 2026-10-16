#!/usr/bin/env node
/**
 * Jev box bench: how well does TypeSafe's Jev (a System One model: typed answers, no prose)
 * locate things on a UI screenshot, and can a vlmkit loop use what it returns?
 *
 * Four measurements, each against a truth read from the DOM or the pixels, never drawn by hand:
 *
 *   ground   one `box` question per named element (link / button / heading / field) of each
 *            CSS-challenge fixture's viewport. IoU, click hit (box centre on the element), cover.
 *   refine   the same targets asked again on a crop around the first answer, magnified — Jev
 *            answers edges to two decimals, 12.8px on a 1280px screenshot, so a crop is the
 *            only way to a finer box. Same metrics, paired with `ground`.
 *   present  a `noul` per target ("the screenshot contains …") and per decoy (a label from a
 *            different fixture), because `box` always returns a box: there is no "not found".
 *   diff     zoom-accuracy's planted changes (a digit, a seeded hue, a 1-6px shift, nothing),
 *            windowed to Jev's limits: a `noul` "current differs from baseline" and a `box`
 *            "where", scored against the changed pixels.
 *   classify the vlmkit split: the pixel diff gives the region, Jev a `choice` of what changed
 *            (text / colour / position, and the direction of a shift) on a magnified crop.
 *   regions  `diff png --kind` end to end: the regions compareScreenshots finds, each labelled by
 *            `labelRegionKinds` (four options, + appear/disappear cases planted by hiding a target).
 *
 * Usage:
 *   node --experimental-strip-types src/experiments/benchmark/jev-box/jev-box.ts \
 *     [--model jev-1.14.0] [--fixtures page,dashboard] [--per-fixture 12] [--seed 1] \
 *     [--out test-results/jev-box] [--md report.md] [--executable-path /path/to/chromium] \
 *     [--only ground,refine,present,diff,classify,regions] [--rescore]
 *
 * Environment: TYPESAFEAI_API_KEY. `--rescore` reads saved answers and needs no key or browser.
 */
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { getArg, getIntArg, hasFlag } from "@mizchi/vlmkit-core/cli-args.ts";
import {
  askJev,
  JEV_DEFAULT_MODEL,
  JEV_IMAGE_LIMITS,
  jevBoxToPixels,
  pngImage,
  type JevAnswer,
  type JevBox,
  type JevQuestion,
} from "@mizchi/vlmkit-ai/jev-client.ts";
import { cropImage, decodeImage, encodePngImage, resample } from "@mizchi/vlmkit-ai/zoom-image.ts";
import { buildCases } from "../zoom-accuracy/cases.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import type { DiffRegion } from "@mizchi/vlmkit-core/types.ts";
import { jevRegionKindAsker, labelRegionKinds, type RegionKindOutcome } from "@mizchi/vlmkit-ai/region-kind.ts";
import {
  buildGround,
  buildPresenceCases,
  windowDiffCase,
  type DiffCase,
  type GroundShot,
  type GroundTarget,
} from "./cases.ts";
import {
  auroc,
  centre,
  contains,
  edgeResolution,
  mean,
  median,
  padBox,
  refineWindow,
  scoreBox,
  sizeBucket,
  summarizeBoxes,
  type BoxScore,
  type BoxSummary,
  type PxBox,
  type SizeBucket,
} from "./score.ts";

const ROOT = resolve(import.meta.dirname, "../../../..");
const FIXTURE_DIR = join(ROOT, "fixtures/css-challenge");
const STAGES = ["ground", "refine", "present", "diff", "classify", "regions"] as const;
type Stage = (typeof STAGES)[number];

interface Call {
  stage: Stage;
  key: string;
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  questions: number;
  servedModel: string;
}

interface Saved {
  model: string;
  ground?: { shot: GroundShot; answers: Record<string, Extract<JevAnswer, { type: "box" }>> }[];
  refine?: {
    targetId: string;
    window: PxBox;
    scale: number;
    answer: Extract<JevAnswer, { type: "box" }>;
  }[];
  present?: { fixture: string; label: string; positive: boolean; noul: number }[];
  diff?: { case: DiffCase; changed: number; where: Extract<JevAnswer, { type: "box" }> }[];
  classify?: {
    caseId: string;
    kind: Extract<JevAnswer, { type: "choice" }>;
    direction?: Extract<JevAnswer, { type: "choice" }>;
  }[];
  /** The cases the `regions` stage ran on, with their planted element's box. */
  diffCases?: DiffCase[];
  regions?: {
    caseId: string;
    kind: DiffCase["kind"];
    regions: { region: DiffRegion; outcome: RegionKindOutcome }[];
  }[];
  calls: Call[];
}

async function pool<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await f(items[i]!);
      }
    }),
  );
  return out;
}

const record = (calls: Call[], stage: Stage, key: string, r: Awaited<ReturnType<typeof askJev>>, questions: number) => {
  calls.push({
    stage,
    key,
    latencyMs: r.latencyMs,
    inputTokens: r.usage.input_tokens,
    costUsd: r.costUsd,
    questions,
    servedModel: r.model,
  });
  return r;
};

async function runGround(model: string, shots: GroundShot[], calls: Call[]): Promise<NonNullable<Saved["ground"]>> {
  return pool(shots, 3, async (shot) => {
    if (shot.targets.length === 0) return { shot, answers: {} };
    const questions: Record<string, JevQuestion> = {};
    for (const t of shot.targets)
      questions[t.id] = { type: "box", instructions: `${t.description} in \`screenshot\`.` };
    const r = await askJev({
      model,
      state: { screenshot: "SHOT" },
      assets: { SHOT: pngImage(await readFile(shot.imagePath)) },
      questions,
    });
    record(calls, "ground", shot.fixture, r, shot.targets.length);
    return { shot, answers: r.answers as Record<string, Extract<JevAnswer, { type: "box" }>> };
  });
}

/** The crop's magnification: as large as Jev accepts, at most 4x. */
function refineScale(w: number, h: number): number {
  return Math.min(4, JEV_IMAGE_LIMITS.maxEdge / Math.max(w, h), Math.sqrt(JEV_IMAGE_LIMITS.maxPixels / (w * h)));
}

async function runRefine(model: string, ground: NonNullable<Saved["ground"]>, calls: Call[]) {
  const jobs = ground.flatMap((g) =>
    g.shot.targets.filter((t) => g.answers[t.id]).map((t) => ({ g, t, first: g.answers[t.id]! })),
  );
  const images = new Map<string, ReturnType<typeof decodeImage>>();
  for (const g of ground) images.set(g.shot.fixture, decodeImage(await readFile(g.shot.imagePath)));
  return pool(jobs, 4, async ({ g, t, first }) => {
    const img = images.get(g.shot.fixture)!;
    const firstPx = jevBoxToPixels(first.box, g.shot.width, g.shot.height);
    const window = refineWindow(firstPx, img.width, img.height, JEV_IMAGE_LIMITS.minEdge);
    const crop = cropImage(img, window);
    const scale = refineScale(crop.width, crop.height);
    const view = resample(crop, { width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) });
    const r = await askJev({
      model,
      state: { crop: "CROP" },
      assets: { CROP: pngImage(encodePngImage(view)) },
      questions: { where: { type: "box", instructions: `${t.description} in \`crop\`.` } },
    });
    record(calls, "refine", t.id, r, 1);
    return { targetId: t.id, window, scale, answer: r.answers.where as Extract<JevAnswer, { type: "box" }> };
  });
}

async function runPresent(model: string, shots: GroundShot[], calls: Call[]) {
  const all = shots.flatMap((s) => s.targets);
  const rows: NonNullable<Saved["present"]> = [];
  await pool(shots, 3, async (shot) => {
    const here = new Set(shots.find((s) => s.fixture === shot.fixture)!.targets.map((t) => t.label.toLowerCase()));
    // Decoys: labels from other fixtures that this page does not show, same count as targets.
    const decoys = all.filter((t) => t.fixture !== shot.fixture && !here.has(t.label.toLowerCase()));
    const picked = decoys.filter((_, i) => i % Math.max(1, Math.floor(decoys.length / shot.targets.length)) === 0);
    const asks: { label: string; positive: boolean; t: GroundTarget }[] = [
      ...shot.targets.map((t) => ({ label: t.label, positive: true, t })),
      ...picked.slice(0, shot.targets.length).map((t) => ({ label: t.label, positive: false, t })),
    ];
    if (asks.length === 0) return;
    const questions: Record<string, JevQuestion> = {};
    asks.forEach((a, i) => {
      questions[`q${i}`] = { type: "noul", instructions: `\`screenshot\` shows ${a.t.description}.` };
    });
    const r = await askJev({
      model,
      state: { screenshot: "SHOT" },
      assets: { SHOT: pngImage(await readFile(shot.imagePath)) },
      questions,
    });
    record(calls, "present", shot.fixture, r, asks.length);
    asks.forEach((a, i) => {
      const ans = r.answers[`q${i}`] as Extract<JevAnswer, { type: "noul" }>;
      rows.push({ fixture: shot.fixture, label: a.label, positive: a.positive, noul: ans.noul });
    });
  });
  return rows;
}

async function runDiff(model: string, cases: DiffCase[], calls: Call[]) {
  return pool(cases, 4, async (c) => {
    const r = await askJev({
      model,
      state: { baseline: "BASE", current: "CUR" },
      assets: { BASE: pngImage(await readFile(c.baselinePath)), CUR: pngImage(await readFile(c.currentPath)) },
      questions: {
        changed: {
          type: "noul",
          instructions:
            "`current` differs visibly from `baseline` somewhere: a character, a colour, or an element's position.",
        },
        where: { type: "box", instructions: "The region of `current` that differs from `baseline`." },
      },
    });
    record(calls, "diff", c.id, r, 2);
    return {
      case: c,
      changed: (r.answers.changed as Extract<JevAnswer, { type: "noul" }>).noul,
      where: r.answers.where as Extract<JevAnswer, { type: "box" }>,
    };
  });
}

const KIND_OPTIONS = {
  text: "A character or word of text is different",
  color: "A colour is different (text, fill or border); the shapes are the same",
  position: "Something moved: the same content sits a few pixels away from where it was",
} as const;
const DIRECTION_OPTIONS = {
  up: "moved up",
  down: "moved down",
  left: "moved left",
  right: "moved right",
  diagonal: "moved diagonally",
} as const;

export function expectedDirection(dx: number, dy: number): keyof typeof DIRECTION_OPTIONS {
  if (dx !== 0 && dy !== 0) return "diagonal";
  if (dy !== 0) return dy < 0 ? "up" : "down";
  return dx < 0 ? "left" : "right";
}

/**
 * Where vlmkit would use Jev: the pixel diff has already said WHERE (deterministically), so
 * Jev is asked only WHAT, on both captures cropped to the changed region and magnified.
 */
async function runClassify(model: string, cases: DiffCase[], calls: Call[]) {
  const planted = cases.filter((c) => c.diffBox);
  return pool(planted, 4, async (c) => {
    const a = decodeImage(await readFile(c.baselinePath));
    const b = decodeImage(await readFile(c.currentPath));
    const window = refineWindow(c.diffBox!, c.width, c.height, JEV_IMAGE_LIMITS.minEdge, 0.5);
    const scale = refineScale(window.x2 - window.x1, window.y2 - window.y1);
    const view = (img: typeof a) => {
      const crop = cropImage(img, window);
      return pngImage(
        encodePngImage(
          resample(crop, { width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) }),
        ),
      );
    };
    const questions: Record<string, JevQuestion> = {
      kind: {
        type: "choice",
        instructions: "How does `current` differ from `baseline`?",
        criteria: { ...KIND_OPTIONS },
      },
    };
    if (c.expected.kind === "offset")
      questions.direction = {
        type: "choice",
        instructions: "Compared with `baseline`, which way did the content in `current` move?",
        criteria: { ...DIRECTION_OPTIONS },
      };
    const r = await askJev({
      model,
      state: { baseline: "BASE", current: "CUR" },
      assets: { BASE: view(a), CUR: view(b) },
      questions,
    });
    record(calls, "classify", c.id, r, Object.keys(questions).length);
    return {
      caseId: c.id,
      kind: r.answers.kind as Extract<JevAnswer, { type: "choice" }>,
      direction: r.answers.direction as Extract<JevAnswer, { type: "choice" }> | undefined,
    };
  });
}

/**
 * End to end, as `diff png --kind` runs it: the regions `compareScreenshots` finds (not the
 * planted box), each labelled by `labelRegionKinds`. Unchanged cases must yield no region.
 */
async function runRegions(model: string, cases: DiffCase[], calls: Call[]) {
  const ask = jevRegionKindAsker({
    model,
    onResponse: (r) => record(calls, "regions", r.model, r, 1),
  });
  const out: NonNullable<Saved["regions"]> = [];
  for (const c of cases) {
    const diff = await compareScreenshots(
      {
        testId: c.id,
        testTitle: c.id,
        projectName: "jev-box",
        screenshotPath: c.currentPath,
        baselinePath: c.baselinePath,
        status: "changed",
      },
      { skipHeatmap: true, threshold: 0.1 },
    );
    const regions = diff?.regions ?? [];
    const outcomes = await labelRegionKinds(
      decodeImage(await readFile(c.baselinePath)),
      decodeImage(await readFile(c.currentPath)),
      regions,
      ask,
    );
    out.push({ caseId: c.id, kind: c.kind, regions: regions.map((region, i) => ({ region, outcome: outcomes[i]! })) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Report

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : "—");
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "—");
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "—");

const boxRow = (name: string, s: BoxSummary) =>
  `| ${name} | ${s.n} | ${f2(s.meanIou)} | ${f2(s.medianIou)} | ${pct(s.iou50)} | ${pct(s.clickHit)} | ${pct(s.covers)} | ${f1(s.medianEdgePx)} |`;
const BOX_HEAD =
  "| | n | mean IoU | median IoU | IoU≥0.5 | click hit | covers | median edge err px |\n|---|---:|---:|---:|---:|---:|---:|---:|";

function refinedPx(r: NonNullable<Saved["refine"]>[number]): PxBox {
  const w = r.window.x2 - r.window.x1;
  const h = r.window.y2 - r.window.y1;
  const p = jevBoxToPixels(r.answer.box, w, h);
  return { x1: r.window.x1 + p.x1, y1: r.window.y1 + p.y1, x2: r.window.x1 + p.x2, y2: r.window.y1 + p.y2 };
}

export function report(saved: Saved): string {
  const out: string[] = [`# Jev box bench — \`${saved.calls[0]?.servedModel ?? saved.model}\``, ""];
  const targets = new Map<string, { t: GroundTarget; shot: GroundShot }>();
  for (const g of saved.ground ?? []) for (const t of g.shot.targets) targets.set(t.id, { t, shot: g.shot });

  if (saved.ground) {
    const rows: { t: GroundTarget; s: BoxScore; conf: number; box: JevBox }[] = [];
    for (const g of saved.ground)
      for (const t of g.shot.targets) {
        const a = g.answers[t.id];
        if (!a) continue;
        rows.push({
          t,
          s: scoreBox(jevBoxToPixels(a.box, g.shot.width, g.shot.height), t.box),
          conf: a.confidence,
          box: a.box,
        });
      }
    const res = edgeResolution(rows.flatMap((r) => [r.box.left, r.box.right, r.box.top, r.box.bottom]));
    out.push(
      "## Grounding: one `box` per named element",
      "",
      `${rows.length} targets on ${saved.ground.length} fixtures (1280x800 viewport, DPR 1). Edge resolution returned: **${res ?? "—"}** of the image (${res ? (res * 1280).toFixed(1) : "—"}px horizontally on 1280).`,
      "",
      BOX_HEAD,
      boxRow("all", summarizeBoxes(rows.map((r) => r.s))),
    );
    for (const b of ["tiny", "small", "medium", "large"] as SizeBucket[]) {
      const sub = rows.filter((r) => sizeBucket(r.t.box) === b);
      if (sub.length)
        out.push(
          boxRow(
            `${b} (short edge ${{ tiny: "<16", small: "16-27", medium: "28-79", large: "≥80" }[b]}px)`,
            summarizeBoxes(sub.map((r) => r.s)),
          ),
        );
    }
    for (const role of [...new Set(rows.map((r) => r.t.role))].sort()) {
      out.push(boxRow(`role: ${role}`, summarizeBoxes(rows.filter((r) => r.t.role === role).map((r) => r.s))));
    }
    // Padding: the docs suggest padding before cropping. How much makes the box cover the target?
    out.push(
      "",
      "**Padding needed before a crop holds the whole target** (each edge grown by a fraction of the box, min px):",
      "",
    );
    out.push("| pad | covers |", "|---|---:|");
    for (const [frac, minPx] of [
      [0, 0],
      [0.25, 4],
      [0.5, 8],
      [1, 16],
    ] as const) {
      const cov = rows.filter((r) => {
        const g = targets.get(r.t.id)!.shot;
        const p = padBox(jevBoxToPixels(r.box, g.width, g.height), frac, minPx, g.width, g.height);
        return p.x1 <= r.t.box.x1 && p.y1 <= r.t.box.y1 && p.x2 >= r.t.box.x2 && p.y2 >= r.t.box.y2;
      }).length;
      out.push(`| ${frac}x, ≥${minPx}px | ${pct(cov / rows.length)} |`);
    }
    const hitConf = rows.filter((r) => r.s.clickHit).map((r) => r.conf);
    const missConf = rows.filter((r) => !r.s.clickHit).map((r) => r.conf);
    const confAuc = auroc(rows.map((r) => ({ score: r.conf, positive: r.s.clickHit })));
    const confIouAuc = auroc(rows.map((r) => ({ score: r.conf, positive: r.s.iou >= 0.5 })));
    out.push(
      "",
      `**Confidence** — median ${f2(median(hitConf))} on click hits (n=${hitConf.length}), ${f2(median(missConf))} on misses (n=${missConf.length}); AUROC for click hit ${f2(confAuc ?? NaN)}, for IoU≥0.5 ${f2(confIouAuc ?? NaN)}.`,
      "",
    );
    const misses = rows.filter((r) => !r.s.clickHit).sort((a, b) => a.s.iou - b.s.iou);
    if (misses.length) {
      out.push(
        "<details><summary>Click misses</summary>",
        "",
        "| target | truth px | IoU | conf |",
        "|---|---|---:|---:|",
      );
      for (const m of misses)
        out.push(
          `| ${m.t.id}: ${m.t.description.replace(/\|/g, "\\|")} | ${Math.round(m.t.box.x1)},${Math.round(m.t.box.y1)} ${Math.round(m.t.box.x2 - m.t.box.x1)}x${Math.round(m.t.box.y2 - m.t.box.y1)} | ${f2(m.s.iou)} | ${f2(m.conf)} |`,
        );
      out.push("", "</details>", "");
    }
  }

  if (saved.refine && saved.ground) {
    const firstOf = new Map<string, BoxScore>();
    for (const g of saved.ground)
      for (const t of g.shot.targets) {
        const a = g.answers[t.id];
        if (a) firstOf.set(t.id, scoreBox(jevBoxToPixels(a.box, g.shot.width, g.shot.height), t.box));
      }
    const pairs = saved.refine
      .filter((r) => targets.has(r.targetId))
      .map((r) => ({
        first: firstOf.get(r.targetId)!,
        second: scoreBox(refinedPx(r), targets.get(r.targetId)!.t.box),
        r,
      }));
    const better = pairs.filter((p) => p.second.iou > p.first.iou + 0.05).length;
    const worse = pairs.filter((p) => p.second.iou < p.first.iou - 0.05).length;
    out.push(
      "## Refine: ask again on a magnified crop around the first box",
      "",
      `Crop = first box padded 1x (≥16px), grown to ≥${JEV_IMAGE_LIMITS.minEdge}px per edge, magnified up to 4x (median ${f1(median(saved.refine.map((r) => r.scale)))}x). One extra call per target.`,
      "",
      BOX_HEAD,
      boxRow("single look", summarizeBoxes(pairs.map((p) => p.first))),
      boxRow("refined", summarizeBoxes(pairs.map((p) => p.second))),
      "",
      `Paired: IoU up >0.05 on ${better}, down >0.05 on ${worse}, of ${pairs.length}. Click hit flips: ${pairs.filter((p) => !p.first.clickHit && p.second.clickHit).length} fixed, ${pairs.filter((p) => p.first.clickHit && !p.second.clickHit).length} broken.`,
      "",
    );
  }

  if (saved.present) {
    const pos = saved.present.filter((p) => p.positive);
    const neg = saved.present.filter((p) => !p.positive);
    out.push(
      "## Present: `noul` on targets vs decoys",
      "",
      `\`box\` always returns a box, so absence has to be asked separately. ${pos.length} real targets, ${neg.length} decoys (labels from other fixtures).`,
      "",
      `AUROC **${f2(auroc(saved.present.map((p) => ({ score: p.noul, positive: p.positive }))) ?? NaN)}**; at 0.5: ${pct(pos.filter((p) => p.noul >= 0.5).length / pos.length)} of targets accepted, ${pct(neg.filter((p) => p.noul >= 0.5).length / neg.length)} of decoys accepted. Median noul ${f2(median(pos.map((p) => p.noul)))} / ${f2(median(neg.map((p) => p.noul)))}.`,
      "",
    );
    const fps = neg.filter((p) => p.noul >= 0.5);
    if (fps.length)
      out.push(`Decoys accepted: ${fps.map((p) => `"${p.label}" on ${p.fixture} (${f2(p.noul)})`).join(", ")}.`, "");
    const fns = pos.filter((p) => p.noul < 0.5);
    if (fns.length)
      out.push(`Targets rejected: ${fns.map((p) => `"${p.label}" on ${p.fixture} (${f2(p.noul)})`).join(", ")}.`, "");
  }

  if (saved.diff) {
    const changed = saved.diff.filter((d) => d.case.kind !== "none");
    const none = saved.diff.filter((d) => d.case.kind === "none");
    out.push(
      "## Diff: planted changes (zoom-accuracy cases), baseline + current in one state",
      "",
      `${changed.length} planted, ${none.length} unchanged. noul AUROC (changed vs none) **${f2(auroc(saved.diff.map((d) => ({ score: d.changed, positive: d.case.kind !== "none" }))) ?? NaN)}**.`,
      "",
      "| kind | n | noul≥0.5 | median noul | box centre on change (±8px) | mean IoU vs changed px |",
      "|---|---:|---:|---:|---:|---:|",
    );
    for (const kind of ["text", "color", "offset", "none"] as const) {
      const sub = saved.diff.filter((d) => d.case.kind === kind);
      if (!sub.length) continue;
      const loc = sub
        .filter((d) => d.case.diffBox)
        .map((d) => {
          const p = jevBoxToPixels(d.where.box, d.case.width, d.case.height);
          const truth = d.case.diffBox!;
          return {
            hit: contains(padBox(truth, 0, 8, d.case.width, d.case.height), centre(p)),
            iou: scoreBox(p, truth).iou,
          };
        });
      out.push(
        `| ${kind} | ${sub.length} | ${pct(sub.filter((d) => d.changed >= 0.5).length / sub.length)} | ${f2(median(sub.map((d) => d.changed)))} | ${loc.length ? pct(loc.filter((l) => l.hit).length / loc.length) : "—"} | ${loc.length ? f2(mean(loc.map((l) => l.iou))) : "—"} |`,
      );
    }
    out.push("");
  }

  if (saved.classify && saved.diff) {
    const byId = new Map(saved.diff.map((d) => [d.case.id, d.case]));
    const truthKind = (k: string) => (k === "offset" ? "position" : k);
    out.push(
      "## Classify: the pixel diff says where, Jev says what",
      "",
      "Both captures cropped to the changed pixels (padded 0.5x, ≥280px per edge) and magnified up to 4x; one `choice` over text / colour / position, plus direction for shifts.",
      "",
      "| planted | n | text | color | position | right | median confidence when right / wrong |",
      "|---|---:|---:|---:|---:|---:|---|",
    );
    for (const kind of ["text", "color", "offset"] as const) {
      const sub = saved.classify.filter((r) => byId.get(r.caseId)?.kind === kind);
      if (!sub.length) continue;
      const n = (opt: string) => sub.filter((r) => r.kind.choice === opt).length;
      const right = sub.filter((r) => r.kind.choice === truthKind(kind));
      const wrong = sub.filter((r) => r.kind.choice !== truthKind(kind));
      out.push(
        `| ${kind} | ${sub.length} | ${n("text")} | ${n("color")} | ${n("position")} | **${pct(right.length / sub.length)}** | ${f2(median(right.map((r) => r.kind.confidence)))} / ${f2(median(wrong.map((r) => r.kind.confidence)))} |`,
      );
    }
    const dirs = saved.classify.filter((r) => r.direction);
    if (dirs.length) {
      const ok = dirs.filter((r) => {
        const e = byId.get(r.caseId)!.expected as { dx: number; dy: number };
        return r.direction!.choice === expectedDirection(e.dx, e.dy);
      }).length;
      out.push("", `Shift direction right on **${ok}/${dirs.length}** (chance ≈ 1/5).`);
    }
    out.push("");
  }

  if (saved.regions) {
    const truth = (k: string) => (k === "offset" ? "position" : k);
    const LABELS = ["text", "color", "position", "presence"] as const;
    const caseOf = new Map((saved.diffCases ?? []).map((c) => [c.id, c]));
    const planted = saved.regions.filter((r) => r.kind !== "none");
    const none = saved.regions.filter((r) => r.kind === "none");
    const label = (o: RegionKindOutcome) => ("kind" in o ? o.kind.label : null);
    const conf = (o: RegionKindOutcome) => ("kind" in o ? o.kind.confidence : NaN);
    // A region is scored against the planted kind only when it touches the planted element.
    // A digit that widens a badge moves every tab after it: those regions are real position
    // changes, and counting them as mislabelled text was this scorer's error, not Jev's.
    const onTarget = (caseId: string, g: DiffRegion) => {
      const t = caseOf.get(caseId)?.targetBox;
      if (!t) return true;
      return g.x < t.x2 && g.x + g.width > t.x1 && g.y < t.y2 && g.y + g.height > t.y1;
    };
    const all = planted.flatMap((c) => c.regions.map((r) => ({ c, r, on: onTarget(c.caseId, r.region) })));
    const labelled = all.filter((x) => "kind" in x.r.outcome);
    const scored = labelled.filter((x) => x.on);
    const collateral = labelled.filter((x) => !x.on);
    out.push(
      "## Regions: `diff png --kind` end to end",
      "",
      `The regions \`compareScreenshots\` finds on each case (not the planted box), each labelled on its own crop with four options. ${planted.length} planted cases gave ${all.length} regions (${labelled.length} labelled, ${all.length - labelled.length} skipped); ${none.length} unchanged cases gave ${none.reduce((a, c) => a + c.regions.length, 0)} regions. ${scored.length} regions touch the planted element and are scored; ${collateral.length} are collateral (the change moved something else) and listed apart.`,
      "",
      "Per region on the planted element:",
      "",
      "| planted | regions | → text | → color | → position | → presence | right | right at conf ≥ 0.6 |",
      "|---|---:|---:|---:|---:|---:|---:|---|",
    );
    for (const kind of ["text", "color", "offset", "presence"] as const) {
      const sub = scored.filter((x) => x.c.kind === kind);
      if (!sub.length) continue;
      const n = (l: string) => sub.filter((x) => label(x.r.outcome) === l).length;
      const sure = sub.filter((x) => conf(x.r.outcome) >= 0.6);
      const sureOk = sure.filter((x) => label(x.r.outcome) === truth(kind)).length;
      out.push(
        `| ${kind} | ${sub.length} | ${LABELS.map((l) => n(l)).join(" | ")} | **${pct(n(truth(kind)) / sub.length)}** | ${sureOk}/${sure.length} |`,
      );
    }
    const ok = scored.filter((x) => label(x.r.outcome) === truth(x.c.kind));
    const bad = scored.filter((x) => label(x.r.outcome) !== truth(x.c.kind));
    const below = (xs: typeof scored) => xs.filter((x) => conf(x.r.outcome) < 0.6).length;
    out.push(
      "",
      `Confidence: ${below(bad)}/${bad.length} wrong labels and ${below(ok)}/${ok.length} right ones are below 0.6. AUROC of confidence for a right label ${f2(auroc(scored.map((x) => ({ score: conf(x.r.outcome), positive: label(x.r.outcome) === truth(x.c.kind) }))) ?? NaN)}.`,
      "",
      "Per case, the label of its largest region on the planted element:",
      "",
      "| planted | cases | right |",
      "|---|---:|---:|",
    );
    for (const kind of ["text", "color", "offset", "presence"] as const) {
      const sub = planted
        .filter((c) => c.kind === kind)
        .map((c) => c.regions.filter((r) => onTarget(c.caseId, r.region)))
        .filter((rs) => rs.length > 0);
      if (!sub.length) continue;
      const right = sub.filter((rs) => {
        const top = [...rs].sort((a, b) => b.region.diffPixelCount - a.region.diffPixelCount)[0]!;
        return label(top.outcome) === truth(kind);
      }).length;
      out.push(`| ${kind} | ${sub.length} | **${right}/${sub.length}** |`);
    }
    const table = (title: string, rows: typeof labelled) => {
      if (!rows.length) return;
      out.push(
        "",
        `<details><summary>${title}</summary>`,
        "",
        "| case | region | px | regionType | shift | label (conf) |",
        "|---|---|---:|---|---|---|",
      );
      for (const w of rows) {
        const g = w.r.region;
        const k = (w.r.outcome as { kind: { label: string; confidence: number } }).kind;
        out.push(
          `| ${w.c.caseId} | ${g.x},${g.y} ${g.width}x${g.height} | ${g.diffPixelCount} | ${g.regionType ?? ""} | ${g.shift ? `${g.shift.dx},${g.shift.dy}` : ""} | ${k.label} (${f2(k.confidence)}) |`,
        );
      }
      out.push("", "</details>");
    };
    table("Mislabelled regions on the planted element", bad);
    table("Collateral regions (off the planted element), as labelled", collateral);
    const skipped = all.filter((x) => "skipped" in x.r.outcome);
    if (skipped.length)
      out.push(
        "",
        `Skipped: ${skipped.map((x) => `${x.c.caseId} (${(x.r.outcome as { skipped: string }).skipped})`).join("; ")}.`,
      );
    out.push("");
  }

  out.push(
    "## Cost and latency",
    "",
    "| stage | calls | questions | median latency ms | input tokens / call | USD total |",
    "|---|---:|---:|---:|---:|---:|",
  );
  for (const st of STAGES) {
    const cs = saved.calls.filter((c) => c.stage === st);
    if (!cs.length) continue;
    out.push(
      `| ${st} | ${cs.length} | ${cs.reduce((a, c) => a + c.questions, 0)} | ${Math.round(median(cs.map((c) => c.latencyMs)))} | ${Math.round(mean(cs.map((c) => c.inputTokens)))} | ${cs.reduce((a, c) => a + c.costUsd, 0).toFixed(5)} |`,
    );
  }
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const model = getArg("--model", JEV_DEFAULT_MODEL);
  const outDir = resolve(getArg("--out", "test-results/jev-box"));
  const seed = getIntArg("--seed", 1);
  const perFixture = getIntArg("--per-fixture", 12, { min: 1 });
  const only = new Set((getArg("--only") ?? STAGES.join(",")).split(",") as Stage[]);
  const executablePath = getArg("--executable-path");
  const fixtures = (
    getArg("--fixtures") ??
    readdirSync(FIXTURE_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((f) => f.replace(/\.html$/, ""))
      .join(",")
  )
    .split(",")
    .map((f) => join(FIXTURE_DIR, `${f}.html`));
  const savedPath = join(outDir, "answers.json");
  await mkdir(outDir, { recursive: true });

  let saved: Saved;
  if (hasFlag("--rescore")) {
    if (!existsSync(savedPath)) throw new Error(`${savedPath} not found; run without --rescore first`);
    saved = JSON.parse(await readFile(savedPath, "utf8"));
  } else {
    const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
    const { shots, diffCases, presenceCases } = await withBrowser(
      async (browser) => {
        const shots = await buildGround(browser, {
          fixtures,
          seed,
          perFixture,
          viewport: { width: 1280, height: 800 },
          outDir,
        });
        let diffCases: DiffCase[] = [];
        const presenceCases = only.has("regions")
          ? await buildPresenceCases(browser, {
              fixtures,
              seed,
              perFixture,
              viewport: { width: 1280, height: 800 },
              outDir,
            })
          : [];
        if (only.has("diff") || only.has("regions")) {
          // Per fixture: buildCases refuses a fixture whose unchanged captures differ (at DPR 1,
          // ecommerce-catalog has a 2x6px region that does), and that should drop that fixture only.
          for (const fixture of fixtures) {
            try {
              const built = await buildCases(browser, {
                fixtures: [fixture],
                kinds: ["text", "color", "offset", "none"],
                seed,
                deviceScaleFactor: 1,
                viewportWidth: 1280,
                outDir: join(outDir, "zoom-cases"),
                variants: 2,
              });
              for (const c of built.cases) {
                const w = await windowDiffCase(c, outDir);
                if (w) diffCases.push(w);
              }
            } catch (e) {
              console.error(`diff: skipping ${fixture}: ${(e as Error).message}`);
            }
          }
        }
        return { shots, diffCases, presenceCases };
      },
      executablePath ? { launch: { executablePath } } : {},
    );
    saved = { model, calls: [] };
    console.log(
      `${shots.reduce((a, s) => a + s.targets.length, 0)} targets on ${shots.length} fixtures; ${diffCases.length} diff cases`,
    );
    if (only.has("ground") || only.has("refine")) saved.ground = await runGround(model, shots, saved.calls);
    if (only.has("refine")) saved.refine = await runRefine(model, saved.ground!, saved.calls);
    if (only.has("present")) saved.present = await runPresent(model, shots, saved.calls);
    if (only.has("diff")) saved.diff = await runDiff(model, diffCases, saved.calls);
    if (only.has("classify") && only.has("diff")) saved.classify = await runClassify(model, diffCases, saved.calls);
    if (only.has("regions")) {
      saved.diffCases = [...diffCases, ...presenceCases];
      saved.regions = await runRegions(model, saved.diffCases, saved.calls);
    }
    await writeFile(savedPath, JSON.stringify(saved, null, 2));
  }
  const md = report(saved);
  console.log(md);
  const mdPath = getArg("--md");
  if (mdPath) await writeFile(mdPath, md);
}

if (isCliEntry(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
