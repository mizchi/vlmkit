/**
 * Self-contained HTML flipbook generator.
 *
 * Bundles a sequence of PNGs (each inlined as base64) plus tiny vanilla-JS
 * playback controls (play/pause/step/scrub/label) into a single static HTML
 * file. No external runtime deps; opens cleanly in any modern browser or
 * embedded in a PR description via attachment.
 *
 * Used by:
 *   - `vlmkit snapshot flipbook` (diff three-frame + stability iterations)
 *   - `vlmkit snapshot flipbook <pngs...>`   (free-form sequence, e.g. fix-loop rounds)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export interface FlipbookFrame {
  /** File path to the frame PNG (resolved at write time). */
  path: string;
  /** Short label shown in the player (e.g. "round 0", "baseline", "iter 3"). */
  label: string;
  /** Optional sub-label / metadata (e.g. "31.06% diff"). */
  sublabel?: string;
}

export interface FlipbookOptions {
  title: string;
  /** Per-frame display duration in ms (default 700). */
  delayMs?: number;
  /** Whether to autoplay on open (default true). */
  autoplay?: boolean;
  /** Whether to loop after the last frame (default true). */
  loop?: boolean;
}

const DEFAULTS = { delayMs: 700, autoplay: true, loop: true } as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render the HTML string. Caller supplies frames already encoded as data URIs;
 * keeps this function pure + testable.
 */
export function renderFlipbookHtml(
  encodedFrames: Array<{ dataUrl: string; label: string; sublabel?: string }>,
  options: FlipbookOptions,
): string {
  const cfg = { ...DEFAULTS, ...options };
  const framesJson = JSON.stringify(encodedFrames.map((f) => ({
    src: f.dataUrl,
    label: f.label,
    sublabel: f.sublabel ?? "",
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(cfg.title)}</title>
<style>
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
  header { padding: 12px 20px; background: #1e293b; display: flex; align-items: center; gap: 16px; }
  header h1 { font-size: 14px; margin: 0; font-weight: 600; }
  header .meta { font-size: 12px; opacity: 0.7; margin-left: auto; }
  main { display: grid; grid-template-rows: 1fr auto; min-height: calc(100vh - 50px); }
  .stage { display: flex; align-items: center; justify-content: center; padding: 16px; overflow: auto; }
  .stage img { max-width: 100%; max-height: calc(100vh - 160px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); background: #fff; }
  .controls { background: #1e293b; padding: 10px 20px; display: flex; align-items: center; gap: 12px; }
  .controls button { background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 4px 10px; border-radius: 4px; cursor: pointer; font: inherit; font-size: 12px; }
  .controls button:hover { background: #475569; }
  .controls input[type=range] { flex: 1; }
  .controls .info { font-size: 12px; font-variant-numeric: tabular-nums; min-width: 110px; }
  .controls .label { font-size: 12px; opacity: 0.9; min-width: 120px; }
  .controls .sublabel { font-size: 11px; opacity: 0.6; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(cfg.title)}</h1>
  <span class="meta" id="meta"></span>
</header>
<main>
  <div class="stage"><img id="stage" alt="frame"></div>
  <div class="controls">
    <button id="prev" title="Previous (←)">&laquo;</button>
    <button id="play">Pause</button>
    <button id="next" title="Next (→)">&raquo;</button>
    <input type="range" id="scrub" min="0" value="0" step="1">
    <span class="info" id="info"></span>
    <span class="label" id="label"></span>
    <span class="sublabel" id="sublabel"></span>
  </div>
</main>
<script>
  const frames = ${framesJson};
  const cfg = { delayMs: ${cfg.delayMs}, autoplay: ${cfg.autoplay}, loop: ${cfg.loop} };
  const stage = document.getElementById('stage');
  const scrub = document.getElementById('scrub');
  const info = document.getElementById('info');
  const labelEl = document.getElementById('label');
  const sublabelEl = document.getElementById('sublabel');
  const meta = document.getElementById('meta');
  const playBtn = document.getElementById('play');
  scrub.max = frames.length - 1;
  meta.textContent = frames.length + ' frame' + (frames.length === 1 ? '' : 's');
  let idx = 0;
  let playing = cfg.autoplay && frames.length > 1;
  let timer = null;
  function render() {
    const f = frames[idx];
    stage.src = f.src;
    info.textContent = (idx + 1) + ' / ' + frames.length;
    labelEl.textContent = f.label;
    sublabelEl.textContent = f.sublabel;
    scrub.value = String(idx);
  }
  function step(d) {
    idx += d;
    if (idx >= frames.length) idx = cfg.loop ? 0 : frames.length - 1;
    if (idx < 0) idx = cfg.loop ? frames.length - 1 : 0;
    render();
  }
  function tick() {
    if (!playing) return;
    step(1);
    if (!cfg.loop && idx === frames.length - 1) { playing = false; playBtn.textContent = 'Play'; return; }
    timer = setTimeout(tick, cfg.delayMs);
  }
  function togglePlay() {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
    if (playing) timer = setTimeout(tick, cfg.delayMs);
    else clearTimeout(timer);
  }
  playBtn.addEventListener('click', togglePlay);
  document.getElementById('prev').addEventListener('click', () => { step(-1); });
  document.getElementById('next').addEventListener('click', () => { step(1); });
  scrub.addEventListener('input', () => { idx = Number(scrub.value); render(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  });
  render();
  if (playing) timer = setTimeout(tick, cfg.delayMs);
</script>
</body>
</html>`;
}

export async function writeFlipbook(
  outPath: string,
  frames: FlipbookFrame[],
  options: FlipbookOptions,
): Promise<{ outPath: string; bytes: number; frameCount: number }> {
  if (frames.length === 0) {
    throw new Error("Cannot write flipbook with zero frames");
  }
  const encoded = await Promise.all(frames.map(async (f) => {
    const buf = await readFile(f.path);
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return { dataUrl, label: f.label, sublabel: f.sublabel };
  }));
  const html = renderFlipbookHtml(encoded, options);
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await writeFile(outPath, html);
  return { outPath: resolve(outPath), bytes: html.length, frameCount: frames.length };
}

/**
 * Build a {@link FlipbookFrame} list from a path sequence, defaulting the
 * label to the basename.
 */
export function framesFromPaths(paths: string[], labels?: string[]): FlipbookFrame[] {
  return paths.map((p, i) => ({
    path: p,
    label: labels?.[i] ?? basename(p).replace(/\.png$/i, ""),
  }));
}
