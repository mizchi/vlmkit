/**
 * Embedding in Markdown (v23): a ```vlm-anim fenced block holding a scene becomes
 * the animation — the `<vlm-anim>` runtime inline, or the still SVG when the
 * fence's info string says `still`. `renderFence` is the one function; the
 * remark plugin and the markdown-it / VitePress recipe in the guide both call it,
 * so a site's Markdown carries its animations as data next to the prose and one
 * `check` reads them all.
 *
 * No dependency on unified / remark / mdast: the plugin walks the tree with its
 * own five-line visitor and replaces `code` nodes with `html` nodes.
 */

import { compileScene, SceneValidationError } from "./compile/index.ts";
import { contentBox } from "./layout.ts";
import { renderFrameSvg } from "./render-svg.ts";
import { RUNTIME_SOURCE } from "./runtime.ts";
import { timelineDuration } from "./timeline.ts";
import { type Scene, type Timeline, TIMELINE_FORMAT } from "./types.ts";
import { formatDiagnostics, hasErrors, validateDocument } from "./validate.ts";

export interface FenceOptions {
  /** The final frame as SVG instead of the runtime. The fence's info string `still` sets it too. */
  still?: boolean;
  /** `inline`: the runtime `<script>` before the first element (default). `false`: the page loads `vlm-anim.js` itself. */
  runtime?: "inline" | false;
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
  /** A class on the wrapping element, for the site's CSS. Default `vlm-anim`. */
  className?: string;
}

export interface FenceResult {
  html: string;
  /** True when the block compiled; false when the HTML is an error box. */
  ok: boolean;
  kind?: string;
  diagnostics: string[];
  /** True when this result carries the runtime script (the first animated fence of a document). */
  runtimeIncluded: boolean;
}

const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `still`, `autoplay=false`, `loop`, `nocontrols` from a fence's info string after the language. */
export function parseFenceMeta(meta: string | undefined | null): Partial<FenceOptions> {
  const out: Partial<FenceOptions> = {};
  for (const word of (meta ?? "").split(/\s+/).filter(Boolean)) {
    const [k, v] = word.split("=");
    if (k === "still") out.still = v !== "false";
    else if (k === "autoplay") out.autoplay = v !== "false";
    else if (k === "loop") out.loop = v !== "false";
    else if (k === "nocontrols") out.controls = false;
    else if (k === "controls") out.controls = v !== "false";
  }
  return out;
}

/** Render one fenced block (scene JSON, or an already compiled timeline) to HTML. Never throws: an error is an HTML box. */
export function renderFence(code: string, opts: FenceOptions & { includeRuntime?: boolean } = {}): FenceResult {
  const cls = opts.className ?? "vlm-anim";
  let doc: unknown;
  try {
    doc = JSON.parse(code);
  } catch (e) {
    return errorBox(cls, [`not JSON: ${(e as Error).message}`]);
  }
  const diags = validateDocument(doc).diagnostics;
  if (hasErrors(diags)) return errorBox(cls, formatDiagnostics(diags).split("\n"));
  let tl: Timeline;
  let kind: string | undefined;
  if ((doc as { format?: string }).format === TIMELINE_FORMAT) {
    tl = doc as Timeline;
    kind = String(tl.meta?.kind ?? "timeline");
  } else {
    const scene = doc as Scene;
    kind = scene.kind;
    try {
      tl = compileScene(scene);
    } catch (e) {
      if (e instanceof SceneValidationError) return errorBox(cls, formatDiagnostics(e.diagnostics).split("\n"));
      return errorBox(cls, [(e as Error).message]);
    }
  }
  const warnings = diags.filter((d) => d.severity === "warn").map((d) => `${d.path}: ${d.message}`);
  if (opts.still) {
    const t = timelineDuration(tl);
    const crop = contentBox(tl, t);
    const svg = renderFrameSvg(tl, t, { caption: false, crop });
    return { html: `<figure class="${escapeHtml(cls)} ${escapeHtml(cls)}-still" data-kind="${escapeHtml(kind)}">${svg}</figure>`, ok: true, kind, diagnostics: warnings, runtimeIncluded: false };
  }
  const json = JSON.stringify(tl).replace(/<\//g, "<\\/");
  const attrs = [opts.autoplay !== false ? "autoplay" : "", opts.loop ? "loop" : "", opts.controls === false ? "nocontrols" : ""].filter(Boolean).join(" ");
  const runtime = opts.runtime !== false && opts.includeRuntime !== false ? `<script>${RUNTIME_SOURCE}</script>\n` : "";
  const html = `${runtime}<div class="${escapeHtml(cls)}" data-kind="${escapeHtml(kind)}" style="max-width:${tl.canvas.width + 2}px"><vlm-anim ${attrs}><script type="application/json">${json}</script></vlm-anim></div>`;
  return { html, ok: true, kind, diagnostics: warnings, runtimeIncluded: runtime !== "" };
}

function errorBox(cls: string, lines: string[]): FenceResult {
  return {
    html: `<pre class="${escapeHtml(cls)} ${escapeHtml(cls)}-error">vlm-anim: the scene did not compile\n${lines.map(escapeHtml).join("\n")}</pre>`,
    ok: false,
    diagnostics: lines,
    runtimeIncluded: false,
  };
}

// ---- remark -------------------------------------------------------------------------------

/** The subset of mdast the plugin touches. */
interface MdNode {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: MdNode[];
}

export interface RemarkVlmAnimOptions extends FenceOptions {
  /** The fence language that marks a scene. Default `vlm-anim`. */
  lang?: string;
}

/**
 * `unified().use(remarkParse).use(remarkVlmAnim).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true })`
 * — every ```vlm-anim fence becomes an `html` node: the runtime once, then one `<vlm-anim>` per fence; ```vlm-anim still
 * becomes the figure. Errors become a visible `<pre>` rather than a build failure, so one bad scene does not take the page down.
 */
export default function remarkVlmAnim(options: RemarkVlmAnimOptions = {}): (tree: MdNode) => void {
  const lang = options.lang ?? "vlm-anim";
  return (tree: MdNode): void => {
    let runtimeDone = options.runtime === false;
    const visit = (node: MdNode): void => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === "code" && child.lang === lang) {
          const meta = parseFenceMeta(child.meta);
          const res = renderFence(child.value ?? "", { ...options, ...meta, includeRuntime: !runtimeDone });
          if (res.runtimeIncluded) runtimeDone = true;
          return { type: "html", value: res.html };
        }
        visit(child);
        return child;
      });
    };
    visit(tree);
  };
}
