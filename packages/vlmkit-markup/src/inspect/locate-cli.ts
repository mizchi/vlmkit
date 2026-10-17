/**
 * `vlmkit inspect locate <screenshot.png> "<description>"`: where a described element is on a
 * screenshot, with no DOM — a Flutter web canvas, an Android frame, a macOS window capture.
 *
 * Exit 0 found, 1 not found (Jev's presence answer below the threshold), 2 a usage error, so a
 * script can branch on it. The box and point are the screenshot's pixels; `--dpr` also gives them
 * in CSS px (an Android dump's density / 160, a 2x capture's 2). `--mark` writes a copy with the
 * box outlined, to look at before trusting it: the answer is a model's, not a measurement.
 */
import { readFile, writeFile } from "node:fs/promises";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export const LOCATE_USAGE = `Usage: vlmkit inspect locate <screenshot.png> "<description>" [options]

Find one element on a screenshot from a description, with no DOM: a canvas app
(Flutter web), an Android or macOS capture. TypeSafe Jev answers whether it is
shown and where (TYPESAFEAI_API_KEY); the box is asked again on a magnified
crop. ~$0.0003 and under 1s a call.

Describe it by what is drawn: 'the "Save" button', 'the search field labelled
Query'. A field's placeholder text reads as not shown; name its label instead.

Options:
  --json               Print the result as JSON
  --mark <out.png>     Write a copy of the screenshot with the box outlined
  --dpr <n>            Screenshot px per CSS px; adds the box in CSS px
  --threshold <0-1>    Presence below this is "not found" (default 0.5)
  --no-presence        Do not ask whether it is shown; always return a box
  --no-refine          One look only (a 12.8px grid on a 1280px image)
  --model <id>         Jev model (default jev-1.14.0)

Exit: 0 found, 1 not found, 2 usage error.
Measured (85 named elements, 85 decoys on 9 fixtures): 94% found with the point
on the target, 0 decoys found. docs/reports/2026-10-16-jev-box-bench.md`;

export interface LocateCliOptions {
  image: string;
  description: string;
  json: boolean;
  mark?: string;
  dpr?: number;
  threshold: number;
  presence: boolean;
  refine: boolean;
  model?: string;
}

export class LocateUsageError extends Error {}

export function parseLocateArgs(argv: string[]): LocateCliOptions {
  const positional: string[] = [];
  const o: Omit<LocateCliOptions, "image" | "description"> = {
    json: false,
    threshold: 0.5,
    presence: true,
    refine: true,
  };
  const value = (flag: string, v: string | undefined) => {
    if (v === undefined || v.startsWith("--")) throw new LocateUsageError(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--json":
        o.json = true;
        break;
      case "--mark":
        o.mark = value(a, argv[++i]);
        break;
      case "--model":
        o.model = value(a, argv[++i]);
        break;
      case "--dpr": {
        const n = Number(value(a, argv[++i]));
        if (!Number.isFinite(n) || n <= 0) throw new LocateUsageError(`--dpr takes a positive number, got ${argv[i]}`);
        o.dpr = n;
        break;
      }
      case "--threshold": {
        const n = Number(value(a, argv[++i]));
        if (!Number.isFinite(n) || n < 0 || n > 1) throw new LocateUsageError(`--threshold takes 0-1, got ${argv[i]}`);
        o.threshold = n;
        break;
      }
      case "--no-presence":
        o.presence = false;
        break;
      case "--no-refine":
        o.refine = false;
        break;
      default:
        if (a.startsWith("--")) throw new LocateUsageError(`unknown option ${a}`);
        positional.push(a);
    }
  }
  if (positional.length !== 2) {
    throw new LocateUsageError(
      `expected a screenshot and a description, got ${positional.length} argument(s)${positional.length > 2 ? ' (quote the description: "the Save button")' : ""}`,
    );
  }
  const [image, description] = positional as [string, string];
  if (!description.trim()) throw new LocateUsageError("the description is empty");
  return { image, description, ...o };
}

/** Outline `box` (2px, red over light, white over dark) and mark its centre, on an RGBA copy. */
export function markBox(
  img: { width: number; height: number; data: Uint8Array },
  box: { x: number; y: number; width: number; height: number },
): void {
  // Colours are chosen from the pixels as they were: read back after a write, the red reads as
  // dark, and a pixel drawn twice (the crosshair's centre, the outline's corners) turned white.
  const original = img.data.slice();
  const set = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const i = (y * img.width + x) * 4;
    const lum = 0.299 * original[i]! + 0.587 * original[i + 1]! + 0.114 * original[i + 2]!;
    img.data.set(lum < 96 ? [255, 255, 255, 255] : [230, 20, 60, 255], i);
  };
  const x1 = Math.round(box.x) - 2;
  const y1 = Math.round(box.y) - 2;
  const x2 = Math.round(box.x + box.width) + 1;
  const y2 = Math.round(box.y + box.height) + 1;
  for (let t = 0; t < 2; t++) {
    for (let x = x1; x <= x2; x++) {
      set(x, y1 + t);
      set(x, y2 - t);
    }
    for (let y = y1; y <= y2; y++) {
      set(x1 + t, y);
      set(x2 - t, y);
    }
  }
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  for (let d = -4; d <= 4; d++) {
    set(cx + d, cy);
    set(cx, cy + d);
  }
}

const round = (b: { x: number; y: number; width: number; height: number }, k = 1) => ({
  x: Math.round((b.x / k) * 10) / 10,
  y: Math.round((b.y / k) * 10) / 10,
  width: Math.round((b.width / k) * 10) / 10,
  height: Math.round((b.height / k) * 10) / 10,
});

export async function runLocateCli(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(LOCATE_USAGE);
    return 0;
  }
  let o: LocateCliOptions;
  try {
    o = parseLocateArgs(argv);
  } catch (e) {
    if (!(e instanceof LocateUsageError)) throw e;
    console.error(`error: ${e.message}\n\n${LOCATE_USAGE}`);
    return 2;
  }
  // Refused before reading anything: a run with no key has nothing to answer with.
  if (!process.env.TYPESAFEAI_API_KEY && !process.env.TYPESAFE_API_KEY) {
    console.error(
      "error: inspect locate asks TypeSafe Jev and needs TYPESAFEAI_API_KEY (console.typesafe.ai/keys). With a DOM, use a selector instead.",
    );
    return 2;
  }
  const { locateByDescription, LocateError } = await import("@mizchi/vlmkit-ai/locate.ts");
  const png = new Uint8Array(await readFile(o.image));
  if (png[0] !== 0x89 || png[1] !== 0x50) {
    console.error(`error: ${o.image} is not a PNG (inspect locate reads PNG screenshots)`);
    return 2;
  }
  let r;
  try {
    r = await locateByDescription(png, o.description, {
      presence: o.presence,
      presenceThreshold: o.threshold,
      refine: o.refine,
      ...(o.model ? { model: o.model } : {}),
    });
  } catch (e) {
    if (e instanceof LocateError) {
      console.error(`error: ${e.message}`);
      return 2;
    }
    throw e;
  }
  if (o.mark && r.found) {
    const { decodeImage, encodePngImage } = await import("@mizchi/vlmkit-ai/zoom-image.ts");
    const img = decodeImage(Buffer.from(png));
    markBox(img, r.box);
    await writeFile(o.mark, encodePngImage(img));
  }
  const css = o.dpr ? { box: round(r.box, o.dpr), point: { x: r.point.x / o.dpr, y: r.point.y / o.dpr } } : undefined;
  if (o.json) {
    console.log(
      JSON.stringify(
        {
          description: o.description,
          image: o.image,
          found: r.found,
          presence: r.presence,
          box: round(r.box),
          point: { x: Math.round(r.point.x), y: Math.round(r.point.y) },
          ...(css ? { css: { box: css.box, point: { x: Math.round(css.point.x), y: Math.round(css.point.y) } } } : {}),
          refined: r.refined,
          firstBox: round(r.firstBox),
          ...(o.mark && r.found ? { mark: o.mark } : {}),
          model: r.model,
          calls: r.calls,
          costUsd: r.costUsd,
        },
        null,
        2,
      ),
    );
    return r.found ? 0 : 1;
  }
  const p = r.presence === null ? "" : `, presence ${r.presence.toFixed(2)}`;
  if (!r.found) {
    console.log(`not found: "${o.description}"${p} (below ${o.threshold})`);
    console.log("  describe it by the text drawn on it, or pass --no-presence to get Jev's best box anyway");
    return 1;
  }
  const b = round(r.box);
  console.log(`found: "${o.description}"${p}`);
  console.log(
    `  point: (${Math.round(r.point.x)}, ${Math.round(r.point.y)})  box: ${b.x},${b.y} ${b.width}x${b.height}  (screenshot px)`,
  );
  if (css) {
    console.log(
      `  css:   (${Math.round(css.point.x)}, ${Math.round(css.point.y)})  box: ${css.box.x},${css.box.y} ${css.box.width}x${css.box.height}  (÷ ${o.dpr})`,
    );
  }
  console.log(
    `  ${r.refined ? "refined on a magnified crop" : "one look"}; ${r.model}, ${r.calls} call(s), $${r.costUsd.toFixed(5)}`,
  );
  if (o.mark) console.log(`  marked: ${o.mark} — look at it: the box is a model's answer`);
  return 0;
}

if (isCliEntry(import.meta.url, "locate")) {
  runLocateCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
