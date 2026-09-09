/**
 * Mermaid → Scene IR (v23). A reader of a repository already has diagrams:
 * `flowchart` / `graph` blocks in READMEs, `sequenceDiagram`s in design notes,
 * `stateDiagram-v2`s in specs. This turns them into scenes — a flowchart with
 * decision diamonds into `flowchart`, one without (a pipeline, an architecture
 * with subgraphs) into `diagram` with groups, a sequence diagram into `sequence`
 * with its loop / alt frames, a state diagram into `state-machine` — and says in
 * one line what it dropped (styles, class defs, clicks, notes it has no place
 * for), so the writer knows what to add by hand: a walk, a trace, captions.
 *
 * It is a line-oriented reader of the common subset, not a mermaid parser:
 * what it does not understand it drops and names.
 */

import { labelWidth } from "../compile/builder.ts";
import { SCENE_FORMAT, type DiagramScene, type FlowchartScene, type FlowShape, type Scene, type SeqItem, type SequenceScene, type StateMachineScene } from "../types.ts";

export type MermaidKind = "flowchart" | "sequence" | "state";
export type ImportAs = "diagram" | "flowchart" | "modules";

export interface MermaidImport {
  /** What the source declared. */
  source: MermaidKind;
  scene: Scene;
  /** One line per thing the scene has no place for, in the source's words. */
  dropped: string[];
  /** What came through but will cost the picture something — a label wider than a box should be. */
  notes: string[];
  /** Counts for the summary line. */
  counts: Record<string, number>;
}

export interface MermaidOptions {
  /** For a flowchart / graph source: force the kind. Default: `flowchart` when a decision `{}` node exists, else `diagram`. */
  as?: ImportAs;
  /** Scene title, when the source has none. */
  title?: string;
}

/** The first ```mermaid fence of a Markdown file, or the whole text when it is not Markdown. */
export function mermaidSource(text: string, nth = 0): string | undefined {
  const fences = [...text.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (fences.length) return fences[nth];
  return /^\s*(flowchart|graph|sequenceDiagram|stateDiagram)/m.test(text) ? text : undefined;
}

export function importMermaid(text: string, opts: MermaidOptions = {}): MermaidImport {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/%%.*$/, "").trim())
    .filter(Boolean);
  const head = lines[0] ?? "";
  if (/^sequenceDiagram\b/.test(head)) return importSequence(lines.slice(1), opts);
  if (/^stateDiagram(-v2)?\b/.test(head)) return importState(lines.slice(1), opts);
  const m = head.match(/^(flowchart|graph)\s*(TB|TD|LR|RL|BT)?/);
  if (m) return importFlow(lines.slice(1), (m[2] ?? "TB").toUpperCase(), opts);
  throw new Error(`not a mermaid diagram this reads: the first line is "${head.slice(0, 40)}"; flowchart / graph, sequenceDiagram and stateDiagram-v2 are read`);
}

// ---- labels ---------------------------------------------------------------------------------

/** `"a<br/>b"`, `a\nb`, `"quoted"` → the label text with real newlines and no quotes. */
function cleanLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^"(.*)"$/s, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\n/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// ---- flowchart / graph ---------------------------------------------------------------------

/** `id`, `id[text]`, `id(text)`, `id([text])`, `id((text))`, `id{text}`, `id[/text/]`, `id>text]`, `id[[text]]`. */
const NODE_RE = /^([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)\s*(?:(\[\[|\[\(|\(\(|\(\[|\[\/|\[\\|\[|\(|\{\{|\{|>)\s*(.*?)\s*(\]\]|\)\]|\)\)|\]\)|\/\]|\\\]|\]|\)|\}\}|\}))?$/s;

function parseNode(chunk: string): { id: string; label?: string; shape: FlowShape } | undefined {
  const m = chunk.trim().match(NODE_RE);
  if (!m) return undefined;
  const [, id, open, text] = m;
  if (!open) return { id, shape: "process" };
  const shape: FlowShape = open === "{" || open === "{{" ? "decision" : open === "([" || open === "((" || open === "[(" ? "terminal" : open === "[/" || open === "[\\" || open === ">" ? "io" : "process";
  return { id, label: cleanLabel(text ?? ""), shape };
}

/** An edge operator, with its label if any: `-->`, `-->|text|`, `-- text -->`, `-.->`, `-.text.->`, `==>`, `==text==>`, `---`. */
// The text forms (`-- text -->`) come first: a bare `--` would otherwise match inside them and the text become a node.
const EDGE_RE = /\s*(--\s[^-]+?\s-->|==\s[^=]+?\s==>|-\.\s[^.]+?\s\.->|<?-{2,}[->]?|<?-\.[^-]*\.->|<?={2,}>?)(?:\|([^|]*)\|)?\s*/;

function importFlow(lines: string[], dir: string, opts: MermaidOptions): MermaidImport {
  const nodes = new Map<string, { id: string; label?: string; shape: FlowShape }>();
  const edges: { from: string; to: string; label?: string }[] = [];
  const groups: { id: string; label?: string; nodes: string[]; parent?: string }[] = [];
  const stack: string[] = [];
  const dropped: string[] = [];
  const counts: Record<string, number> = { styles: 0, classes: 0, clicks: 0, other: 0 };
  const declare = (chunk: string): string | undefined => {
    const n = parseNode(chunk);
    if (!n) return undefined;
    const prev = nodes.get(n.id);
    if (!prev) nodes.set(n.id, n);
    else if (n.label !== undefined && prev.label === undefined) nodes.set(n.id, { ...prev, label: n.label, shape: n.shape });
    else if (n.label !== undefined && n.shape !== "process" && prev.shape === "process") nodes.set(n.id, { ...prev, shape: n.shape });
    if (stack.length) {
      const g = groups.find((x) => x.id === stack[stack.length - 1])!;
      if (!g.nodes.includes(n.id) && !groups.some((x) => x.nodes.includes(n.id))) g.nodes.push(n.id);
    }
    return n.id;
  };
  let innerDirections = 0;
  for (const line of lines) {
    if (/^direction\s/.test(line)) {
      if (stack.length) innerDirections++;
      continue;
    }
    if (/^(style|linkStyle)\s/.test(line)) {
      counts.styles++;
      continue;
    }
    if (/^(classDef|class)\s/.test(line) || /:::/.test(line)) {
      counts.classes++;
      continue;
    }
    if (/^click\s/.test(line)) {
      counts.clicks++;
      continue;
    }
    const sub = line.match(/^subgraph\s+([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)?\s*(?:\[\s*(.*?)\s*\])?\s*(.*)$/);
    if (sub) {
      const id = sub[1] ?? `group${groups.length + 1}`;
      const label = cleanLabel(sub[2] ?? sub[3] ?? id) || id;
      groups.push({ id, label, nodes: [], ...(stack.length ? { parent: stack[stack.length - 1] } : {}) });
      stack.push(id);
      continue;
    }
    if (line === "end") {
      stack.pop();
      continue;
    }
    // A chain: `A --> B -->|yes| C`, with `&` lists on either side.
    const parts: { chunk: string; op?: string; label?: string }[] = [];
    let rest = line;
    let guard = 0;
    while (rest && guard++ < 64) {
      const em = rest.match(EDGE_RE);
      if (!em || em.index === undefined || em.index === 0) {
        parts.push({ chunk: rest });
        break;
      }
      parts.push({ chunk: rest.slice(0, em.index), op: em[1], label: em[2] });
      rest = rest.slice(em.index + em[0].length);
    }
    if (parts.length === 1 && !parts[0].op) {
      // A bare declaration, or several joined by `&`.
      const ids = parts[0].chunk.split("&").map((c) => declare(c)).filter(Boolean);
      if (!ids.length) {
        dropped.push(line.length > 60 ? `${line.slice(0, 57)}…` : line);
        counts.other++;
      }
      continue;
    }
    let prevIds: string[] = [];
    for (let k = 0; k < parts.length; k++) {
      const ids = parts[k].chunk.split("&").map((c) => declare(c)).filter((x): x is string => !!x);
      if (k > 0) {
        const op = parts[k - 1].op ?? "-->";
        const inner = op.match(/^(?:--|==|-\.)\s(.+?)\s(?:-->|==>|\.->)$/);
        const label = parts[k - 1].label ?? inner?.[1];
        const both = op.startsWith("<");
        for (const a of prevIds) for (const b of ids) {
          edges.push({ from: a, to: b, ...(label ? { label: cleanLabel(label) } : {}) });
          if (both) edges.push({ from: b, to: a });
        }
      }
      prevIds = ids;
    }
  }
  const layout = dir === "LR" || dir === "RL" ? "lr" : "tb";
  if (dir === "RL" || dir === "BT") dropped.push(`direction ${dir} is drawn as ${layout === "lr" ? "LR" : "TB"}`);
  if (innerDirections) dropped.push(`${innerDirections} direction line(s) inside a subgraph — a scene has one layout, the outer one`);
  // A label wider than ~300px makes every slot in its layer that wide: the canvas grows to fit it. Named here,
  // before the writer spends rounds shortening labels that were never the widest (pa, pb, v23).
  const wide = [...nodes.values()].filter((n) => Math.max(...(n.label ?? n.id).split("\n").map((l) => labelWidth(l, 14))) > 300).map((n) => n.id);
  const notes = wide.length ? [`${wide.length} label(s) over 300px wide (${wide.join(", ")}) — the canvas grows to fit the widest; a <br/> or a shorter label keeps the picture legible`] : [];
  const hasDecision = [...nodes.values()].some((n) => n.shape === "decision");
  const as: ImportAs = opts.as ?? (hasDecision ? "flowchart" : "diagram");
  const title = opts.title;
  counts.nodes = nodes.size;
  counts.edges = edges.length;
  counts.groups = groups.length;
  if (counts.styles) dropped.push(`${counts.styles} style / linkStyle line(s) — colour with "tone" instead`);
  if (counts.classes) dropped.push(`${counts.classes} classDef / class line(s)`);
  if (counts.clicks) dropped.push(`${counts.clicks} click line(s)`);
  let scene: Scene;
  if (as === "flowchart") {
    if (groups.length) dropped.push(`${groups.length} subgraph(s) — a flowchart has no containers; import --as diagram to keep them`);
    const fc: FlowchartScene = {
      format: SCENE_FORMAT,
      kind: "flowchart",
      ...(title ? { title } : {}),
      nodes: [...nodes.values()].map((n) => (n.label === undefined && n.shape === "process" ? n.id : { id: n.id, ...(n.label !== undefined && n.label !== n.id ? { label: n.label } : {}), ...(n.shape !== "process" ? { shape: n.shape } : {}) })),
      edges: edges.map((e) => (e.label ? e : [e.from, e.to])),
      layout,
    };
    scene = fc;
  } else if (as === "modules") {
    const shaped = [...nodes.values()].filter((n) => n.shape !== "process").length;
    if (shaped) dropped.push(`${shaped} node shape(s) — a module map draws every module as a box`);
    scene = {
      format: SCENE_FORMAT,
      kind: "modules",
      ...(title ? { title } : {}),
      modules: [...nodes.values()].map((n) => (n.label === undefined || n.label === n.id ? n.id : { id: n.id, label: n.label })),
      deps: edges.map((e) => (e.label ? { from: e.from, to: e.to, label: e.label } : [e.from, e.to])),
      ...(groups.length ? { groups: groups.map((g) => ({ id: g.id, label: g.label, modules: g.nodes, ...(g.parent ? { parent: g.parent } : {}) })) } : {}),
      layout,
    };
  } else {
    const shaped = [...nodes.values()].filter((n) => n.shape === "decision" || n.shape === "io").length;
    if (shaped) dropped.push(`${shaped} decision / io shape(s) drawn as boxes — import --as flowchart to keep them`);
    const dg: DiagramScene = {
      format: SCENE_FORMAT,
      kind: "diagram",
      ...(title ? { title } : {}),
      nodes: [...nodes.values()].map((n) => ({ id: n.id, ...(n.label !== undefined && n.label !== n.id ? { label: n.label } : {}), ...(n.shape === "terminal" ? { shape: "ellipse" as const } : {}) })),
      edges: edges.map((e) => ({ from: e.from, to: e.to, ...(e.label ? { label: e.label } : {}) })),
      ...(groups.length ? { groups: groups.map((g) => ({ id: g.id, label: g.label, nodes: g.nodes, ...(g.parent ? { parent: g.parent } : {}) })) } : {}),
      layout,
    };
    scene = dg;
  }
  return { source: "flowchart", scene, dropped, notes, counts };
}

// ---- sequenceDiagram -----------------------------------------------------------------------

function importSequence(lines: string[], opts: MermaidOptions): MermaidImport {
  const participants: { id: string; label?: string; kind?: "actor" | "system" }[] = [];
  const dropped: string[] = [];
  const counts: Record<string, number> = { messages: 0, notes: 0, frames: 0, other: 0 };
  let title = opts.title;
  const declare = (id: string, label?: string, kind?: "actor" | "system") => {
    const p = participants.find((x) => x.id === id);
    if (!p) participants.push({ id, ...(label && label !== id ? { label } : {}), ...(kind === "actor" ? { kind } : {}) });
    else if (label && !p.label && label !== id) p.label = label;
  };
  // Frames nest: a stack of item lists; `alt` opens a branch list.
  type Frame = { kind: "loop" | "alt"; label: string; items: SeqItem[]; branches?: { when: string; items: SeqItem[] }[] };
  const root: SeqItem[] = [];
  const stack: Frame[] = [];
  const target = (): SeqItem[] => {
    const top = stack[stack.length - 1];
    if (!top) return root;
    if (top.kind === "alt") return top.branches![top.branches!.length - 1].items;
    return top.items;
  };
  for (const line of lines) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^title\s*:?\s*(.+)$/))) {
      title = m[1].trim();
      continue;
    }
    if (/^autonumber\b/.test(line)) continue;
    if ((m = line.match(/^(participant|actor)\s+([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)(?:\s+as\s+(.+))?$/))) {
      declare(m[2], m[3] ? cleanLabel(m[3]) : undefined, m[1] === "actor" ? "actor" : "system");
      continue;
    }
    if ((m = line.match(/^(activate|deactivate)\s+/))) continue; // activation is drawn from calls and returns
    if ((m = line.match(/^[Nn]ote\s+(?:(left|right)\s+of|over)\s+([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)(?:\s*,\s*[A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)?\s*:\s*(.+)$/))) {
      declare(m[2]);
      target().push({ note: cleanLabel(m[3]), at: m[2] });
      counts.notes++;
      continue;
    }
    if ((m = line.match(/^loop\s*(.*)$/))) {
      const f: Frame = { kind: "loop", label: cleanLabel(m[1]) || "loop", items: [] };
      stack.push(f);
      counts.frames++;
      continue;
    }
    if ((m = line.match(/^alt\s*(.*)$/))) {
      stack.push({ kind: "alt", label: "", items: [], branches: [{ when: cleanLabel(m[1]) || "alt", items: [] }] });
      counts.frames++;
      continue;
    }
    if ((m = line.match(/^else\s*(.*)$/))) {
      const top = stack[stack.length - 1];
      if (top?.kind === "alt") top.branches!.push({ when: cleanLabel(m[1]) || "else", items: [] });
      else dropped.push(`"${line}" outside an alt`);
      continue;
    }
    if ((m = line.match(/^(opt|par|critical|break|rect)\s*(.*)$/))) {
      // Frames the IR does not have: `opt` and `break` become a loop frame with their word as the label
      // (a box round the items, once); `par` / `critical` / `rect` are flattened.
      if (m[1] === "opt" || m[1] === "break") {
        stack.push({ kind: "loop", label: `${m[1]}: ${cleanLabel(m[2]) || m[1]}`, items: [] });
        counts.frames++;
        dropped.push(`${m[1]} drawn as a loop frame labelled "${m[1]}: …"`);
      } else {
        stack.push({ kind: "loop", label: "", items: [] });
        dropped.push(`${m[1]} flattened — its messages stay, the frame is not drawn`);
      }
      continue;
    }
    if (/^(and|option)\b/.test(line)) continue;
    if (line === "end") {
      const f = stack.pop();
      if (!f) {
        dropped.push('"end" with nothing open');
        continue;
      }
      const into = target();
      if (f.kind === "alt") into.push({ alt: f.branches! });
      else if (f.label) into.push({ loop: f.label, items: f.items });
      else into.push(...f.items); // a flattened par / critical / rect
      continue;
    }
    // A message: `A->>B: text`, `A-->>B: text`, `A-)B: text`, `A->B: text`, `A-->B: text`, `A-xB: text`.
    if ((m = line.match(/^([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)\s*(-->>|->>|-->|->|--\)|-\)|--x|-x)\s*([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)\s*:\s*(.*)$/))) {
      const [, from, op, to, text] = m;
      declare(from);
      declare(to);
      const kind = op === "-->>" || op === "-->" ? "return" : op === "-)" || op === "--)" ? "async" : "call";
      const label = cleanLabel(text);
      target().push({ from, to, ...(label ? { label } : {}), ...(kind !== "call" ? { kind } : {}) });
      counts.messages++;
      if (op === "-x" || op === "--x") dropped.push(`"${line}": a lost message is drawn as a plain one`);
      continue;
    }
    dropped.push(line.length > 60 ? `${line.slice(0, 57)}…` : line);
    counts.other++;
  }
  while (stack.length) {
    const f = stack.pop()!;
    dropped.push(`a ${f.kind} frame never closed with "end"`);
    if (f.kind === "alt") target().push({ alt: f.branches! });
    else target().push(...f.items);
  }
  const scene: SequenceScene = {
    format: SCENE_FORMAT,
    kind: "sequence",
    ...(title ? { title } : {}),
    participants: participants.map((p) => (p.label || p.kind ? p : p.id)),
    messages: root,
  };
  counts.participants = participants.length;
  return { source: "sequence", scene, dropped, notes: [], counts };
}

// ---- stateDiagram-v2 -----------------------------------------------------------------------

function importState(lines: string[], opts: MermaidOptions): MermaidImport {
  const states = new Map<string, { id: string; label?: string; final?: boolean }>();
  const transitions: { from: string; to: string; on: string }[] = [];
  const dropped: string[] = [];
  const counts: Record<string, number> = { composites: 0, notes: 0, other: 0 };
  let initial: string | undefined;
  let title = opts.title;
  const declare = (id: string, label?: string) => {
    const s = states.get(id);
    if (!s) states.set(id, { id, ...(label && label !== id ? { label } : {}) });
    else if (label && !s.label && label !== id) s.label = label;
  };
  let inNote = false;
  for (const line of lines) {
    let m: RegExpMatchArray | null;
    if (inNote) {
      if (/^end note$/.test(line)) inNote = false;
      continue;
    }
    if ((m = line.match(/^title\s*:?\s*(.+)$/))) {
      title = m[1].trim();
      continue;
    }
    if (/^direction\s/.test(line)) continue;
    if ((m = line.match(/^note\b/))) {
      counts.notes++;
      if (!/:\s*.+$/.test(line)) inNote = true;
      continue;
    }
    if ((m = line.match(/^state\s+"(.+?)"\s+as\s+([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)$/))) {
      declare(m[2], cleanLabel(m[1]));
      continue;
    }
    if ((m = line.match(/^state\s+([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)\s*\{$/))) {
      // A composite state: its inner states are read as ordinary states, the box is not drawn.
      declare(m[1]);
      counts.composites++;
      dropped.push(`composite state ${m[1]} flattened — its inner states are drawn beside it`);
      continue;
    }
    if (line === "}") continue;
    if ((m = line.match(/^state\s+([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)(?:\s+<<(fork|join|choice)>>)?$/))) {
      declare(m[1]);
      if (m[2]) dropped.push(`<<${m[2]}>> ${m[1]} drawn as a state`);
      continue;
    }
    if ((m = line.match(/^(\[\*\]|[A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)\s*-->\s*(\[\*\]|[A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)\s*(?::\s*(.*))?$/))) {
      const [, from, to, text] = m;
      const on = text ? cleanLabel(text) : "";
      if (from === "[*]") {
        declare(to);
        if (!initial) initial = to;
        else dropped.push(`a second initial arrow, into ${to}`);
        continue;
      }
      declare(from);
      if (to === "[*]") {
        states.get(from)!.final = true;
        continue;
      }
      declare(to);
      transitions.push({ from, to, on: on || `${from} → ${to}` });
      if (!on) dropped.push(`${from} --> ${to} has no event; named "${from} → ${to}"`);
      continue;
    }
    if ((m = line.match(/^([A-Za-z0-9_.:]+(?:-[A-Za-z0-9_.:]+)*)\s*:\s*(.+)$/))) {
      declare(m[1], cleanLabel(m[2]));
      continue;
    }
    dropped.push(line.length > 60 ? `${line.slice(0, 57)}…` : line);
    counts.other++;
  }
  const all = [...states.values()];
  const scene: StateMachineScene = {
    format: SCENE_FORMAT,
    kind: "state-machine",
    ...(title ? { title } : {}),
    states: all.map((s) => (s.label || s.final ? { id: s.id, ...(s.label ? { label: s.label } : {}), ...(s.final ? { final: true } : {}) } : s.id)),
    initial: initial ?? all[0]?.id ?? "",
    transitions,
    trace: [],
  };
  if (!initial) dropped.push(`no [*] --> initial arrow; "${scene.initial}" is the initial state`);
  dropped.push("no trace: add the events to fire to \"trace\" (the diagram is a still until it has one)");
  counts.states = all.length;
  counts.transitions = transitions.length;
  return { source: "state", scene, dropped, notes: [], counts };
}

/** One line: `flowchart → diagram: 12 nodes · 14 edges · 5 groups · dropped: 5 style lines, …`. */
export function formatImport(r: MermaidImport): string {
  const c = r.counts;
  const parts =
    r.source === "sequence"
      ? [`${c.participants} participants`, `${c.messages} messages`, c.notes ? `${c.notes} notes` : "", c.frames ? `${c.frames} frames` : ""]
      : r.source === "state"
        ? [`${c.states} states`, `${c.transitions} transitions`]
        : [`${c.nodes} nodes`, `${c.edges} edges`, c.groups ? `${c.groups} groups` : ""];
  const head = `${r.source === "flowchart" ? "flowchart / graph" : r.source === "sequence" ? "sequenceDiagram" : "stateDiagram"} → ${r.scene.kind}: ${parts.filter(Boolean).join(" · ")}`;
  const list = (title: string, lines: string[]) => (lines.length ? `\n  ${title}:\n${lines.map((d) => `    - ${d}`).join("\n")}` : "");
  return head + list("dropped / changed", r.dropped) + list("notes", r.notes);
}
