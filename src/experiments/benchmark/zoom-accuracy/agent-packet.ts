/**
 * The bench with no API key: the coding agent's own vision is the model under test.
 *
 * An agent that can read `cases.json` — or even a case id like `page-text` — is reading the
 * answer, not the picture. So the agent never sees a case. It gets a **packet**: tasks under
 * shuffled anonymous ids, each holding the two images at exactly the size a provider would be
 * sent (`prepareZoomSource` at the bench's budget) and the bench's own prompt. The map from task
 * to case stays in the bench's output directory, outside the packet.
 *
 * The zoom arm gets one more thing, a helper that does what `runZoomLoop` does with a box —
 * map it onto the full-resolution original, crop, magnify to the budget — and counts calls
 * against the same budget. Answers come back as one JSON file per arm and are turned into the
 * same `SavedAnswer` records a model run writes, so `--rescore` scores both alike.
 *
 * What this cannot enforce is the agent's honesty: it runs with a shell and could open the
 * originals. The packet keeps them out of reach of an honest agent (they are not in it), and
 * the report says the arm was an agent's.
 */
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  prepareZoomSource,
  toViewBox,
  zoomInto,
  type ImageBudget,
  type ZoomCoordinates,
} from "@mizchi/vlmkit-ai/zoom.ts";
import { caseSeed, type BuiltCase } from "./cases.ts";
import { buildPrompt } from "./score.ts";
import type { Arm, SavedAnswer } from "./zoom-accuracy.ts";

export interface PacketOptions {
  budget: ImageBudget;
  coordinates: ZoomCoordinates;
  maxZooms: number;
  seed: number;
}

/** Written into the packet: everything the helper needs, and nothing that names a case. */
interface PacketMeta {
  arm: Arm;
  budget: ImageBudget;
  coordinates: ZoomCoordinates;
  maxZooms: number;
  tasks: string[];
  /** Where the helper finds the task → case map and the originals. Not for the agent. */
  benchDir: string;
}

/** Kept in the bench's output directory, outside the packet. */
interface PacketMap {
  packetDir: string;
  tasks: Record<string, string>;
}

/** One map per arm: the two packets share tasks but log zooms in different places. */
const mapFile = (arm: Arm) => `agent-map-${arm}.json`;

/** Tasks in an order the case ids cannot be read from: sorted by a hash of seed and id. */
export function anonymize(cases: readonly BuiltCase[], seed: number): Record<string, string> {
  const order = [...cases].sort((a, b) => caseSeed(seed ^ 0x5bd1e995, a.id) - caseSeed(seed ^ 0x5bd1e995, b.id));
  const width = String(order.length).length;
  return Object.fromEntries(order.map((c, i) => [`task-${String(i + 1).padStart(width, "0")}`, c.id]));
}

export function agentBrief(meta: Pick<PacketMeta, "maxZooms" | "coordinates">, arm: Arm, helper: string): string {
  const lines = [
    `# Vision tasks`,
    ``,
    `Each directory under \`tasks/\` is one task: \`image0.png\` (baseline), \`image1.png\` (current) and \`prompt.txt\`.`,
    `Look at both images with your image-reading tool, then answer the prompt with the JSON object it asks for.`,
    ``,
    `Rules — the measurement is only worth anything if you keep them:`,
    `- Open only files inside this packet directory, and nothing else on the machine.`,
    `- Answer each task from its own images; do not compare tasks to guess a pattern.`,
    `- Write every answer, even when unsure ("changed": false is a valid answer).`,
  ];
  if (arm === "zoom") {
    lines.push(
      ``,
      `## Zoom`,
      `You may magnify a region of either image, up to ${meta.maxZooms} times per task:`,
      "```",
      `${helper} <task> <image 0|1> <x1> <y1> <x2> <y2>`,
      "```",
      `The box is ${meta.coordinates === "normalized" ? "0-1000 of the image's width and height" : "in pixels of the image as shown"}, origin top-left.`,
      `It prints where the crop came from and the path of a PNG magnified from the full-resolution original; read that PNG.`,
      `Use it for any detail too small to read with confidence: small text, a thin line, an exact colour or edge.`,
    );
  } else {
    lines.push(``, `Answer from the two images as shown. There is no zoom in this run.`);
  }
  lines.push(
    ``,
    `## Answers`,
    `Write \`answers.json\` in this directory: one entry per task, the value being your JSON answer as a string.`,
    "```json",
    `{ "task-01": "{\\"changed\\": true, \\"box\\": [10, 20, 30, 40], \\"kind\\": \\"text\\", \\"old\\": \\"…\\", \\"new\\": \\"…\\"}" }`,
    "```",
  );
  return lines.join("\n") + "\n";
}

/**
 * Write a packet for `arm` into `packetDir` (replaced if present) and the task map into
 * `benchDir`. The images are the views a provider would be sent, not the captures.
 */
export async function exportPacket(
  cases: readonly BuiltCase[],
  benchDir: string,
  packetDir: string,
  arm: Arm,
  options: PacketOptions,
  helper: string,
): Promise<{ tasks: number }> {
  await rm(packetDir, { recursive: true, force: true });
  const tasks = anonymize(cases, options.seed);
  const byId = new Map(cases.map((c) => [c.id, c]));
  for (const [task, caseId] of Object.entries(tasks)) {
    const c = byId.get(caseId)!;
    const dir = join(packetDir, "tasks", task);
    await mkdir(dir, { recursive: true });
    for (const [i, path] of [c.baselinePath, c.currentPath].entries()) {
      const src = prepareZoomSource(await readFile(path), options.budget);
      await writeFile(join(dir, `image${i}.png`), src.viewPng);
      // The loop tells the model the size it sees; so does the packet.
      await writeFile(join(dir, `image${i}.txt`), `Image ${i} (${src.view.width}x${src.view.height} pixels) — ${i === 0 ? "Baseline" : "Current"}\n`);
    }
    const coordNote = options.coordinates === "pixels"
      ? "Coordinates are absolute pixels of the image as shown, origin top-left."
      : "Coordinates are 0-1000 of each image's width and height, origin top-left.";
    await writeFile(join(dir, "prompt.txt"), `${buildPrompt(c)}\n\n${coordNote}\n`);
  }
  const meta: PacketMeta = { arm, budget: options.budget, coordinates: options.coordinates, maxZooms: arm === "zoom" ? options.maxZooms : 0, tasks: Object.keys(tasks), benchDir };
  await writeFile(join(packetDir, "packet.json"), JSON.stringify(meta, null, 2));
  await writeFile(join(packetDir, "BRIEF.md"), agentBrief(meta, arm, helper));
  const map: PacketMap = { packetDir, tasks };
  await writeFile(join(benchDir, mapFile(arm)), JSON.stringify(map, null, 2));
  return { tasks: Object.keys(tasks).length };
}

/**
 * The zoom helper: one `runZoomLoop` zoom, by hand. Refuses past the packet's budget and
 * logs every call to `zooms.jsonl` in the task's directory, which the import counts.
 */
export async function agentZoom(packetDir: string, task: string, imageIndex: number, box: [number, number, number, number]): Promise<{ text: string; png?: string }> {
  const meta = JSON.parse(await readFile(join(packetDir, "packet.json"), "utf8")) as PacketMeta;
  if (!meta.tasks.includes(task)) return { text: `Error: no task "${task}"` };
  if (imageIndex !== 0 && imageIndex !== 1) return { text: "Error: image must be 0 or 1" };
  const dir = join(packetDir, "tasks", task);
  const log = join(dir, "zooms.jsonl");
  const done = existsSync(log) ? (await readFile(log, "utf8")).split("\n").filter(Boolean).length : 0;
  if (done >= meta.maxZooms) return { text: "Zoom budget used up; answer from what you have seen." };
  const map = JSON.parse(await readFile(join(meta.benchDir, mapFile(meta.arm)), "utf8")) as PacketMap;
  const { cases } = JSON.parse(await readFile(join(meta.benchDir, "cases.json"), "utf8")) as { cases: BuiltCase[] };
  const c = cases.find((x) => x.id === map.tasks[task]);
  if (!c) return { text: `Error: task "${task}" is not in this bench run` };
  const source = prepareZoomSource(await readFile(imageIndex === 0 ? c.baselinePath : c.currentPath), meta.budget);
  const [x1, y1, x2, y2] = box;
  const outcome = zoomInto(source, toViewBox({ x1, y1, x2, y2 }, source.view, meta.coordinates), meta.budget);
  if (!outcome.ok) return { text: outcome.text };
  const png = join(dir, `zoom-${done + 1}.png`);
  await writeFile(png, outcome.png);
  await writeFile(log, (existsSync(log) ? await readFile(log, "utf8") : "") + JSON.stringify({ imageIndex, box, originalBox: outcome.originalBox }) + "\n");
  return { text: `${outcome.text} (${done + 1}/${meta.maxZooms})`, png };
}

/**
 * Turn an agent's `answers.json` into `SavedAnswer` records under `benchDir/answers/<model>/<arm>/`.
 * A task with no answer is written as an empty reply, so it scores as wrong rather than
 * silently shrinking the arm.
 */
export async function importAnswers(benchDir: string, answersPath: string, arm: Arm, model: string): Promise<{ imported: number; missing: string[] }> {
  const map = JSON.parse(await readFile(join(benchDir, mapFile(arm)), "utf8")) as PacketMap;
  const raw = JSON.parse(await readFile(answersPath, "utf8")) as Record<string, unknown>;
  const dir = join(benchDir, "answers", model.replace(/[^a-z0-9._-]+/gi, "_"), arm);
  await mkdir(dir, { recursive: true });
  const missing: string[] = [];
  for (const [task, caseId] of Object.entries(map.tasks)) {
    const value = raw[task];
    const answer = value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
    if (value === undefined) missing.push(task);
    const log = join(map.packetDir, "tasks", task, "zooms.jsonl");
    const zooms = existsSync(log) ? (await readFile(log, "utf8")).split("\n").filter(Boolean).length : 0;
    const saved: SavedAnswer = {
      model, arm, caseId, answer, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, zooms, turns: zooms + 1,
      ...(value === undefined ? { error: "no answer in answers.json" } : {}),
    };
    await writeFile(join(dir, `${caseId}.json`), JSON.stringify(saved, null, 2));
  }
  return { imported: Object.keys(map.tasks).length - missing.length, missing };
}

