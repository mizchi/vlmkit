/**
 * Minimal TOML parser — just enough for `vrt.config.toml`.
 *
 * Supports: comments (`#`), bare/quoted keys, string ("..." / '...'),
 * integer / float / boolean values, single-line arrays of scalars, nested
 * tables (`[a.b]`), and arrays of tables (`[[routes]]`) with dotted
 * sub-tables (`[routes.thresholds]` attaches to the last array element).
 *
 * Deliberately NOT supported (throws or ignores): multi-line arrays /
 * strings, inline tables, datetimes. A config file never needs them, and a
 * tiny strict parser beats pulling in a dependency for this one surface.
 */

type TomlValue = string | number | boolean | TomlValue[] | TomlObject;
interface TomlObject {
  [key: string]: TomlValue;
}

export function parseToml(src: string): TomlObject {
  const root: TomlObject = {};
  let current: TomlObject = root;

  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i]!).trim();
    if (line === "") continue;

    if (line.startsWith("[[") && line.endsWith("]]")) {
      const path = splitKeyPath(line.slice(2, -2).trim());
      current = pushArrayTable(root, path);
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      const path = splitKeyPath(line.slice(1, -1).trim());
      current = ensureTable(root, path);
      continue;
    }

    const eq = line.indexOf("=");
    if (eq < 0) throw new Error(`Invalid TOML line ${i + 1}: ${lines[i]!.trim()}`);
    const keyPath = splitKeyPath(line.slice(0, eq).trim());
    const value = parseValue(line.slice(eq + 1).trim(), i + 1);
    const target = keyPath.length > 1 ? ensureTable(current, keyPath.slice(0, -1)) : current;
    target[keyPath[keyPath.length - 1]!] = value;
  }
  return root;
}

/** Remove a trailing `#` comment that is not inside a quoted string. */
function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

function splitKeyPath(raw: string): string[] {
  // Dotted keys; segments may be bare or quoted. Quoted segments can contain
  // dots, but the config never needs that, so a simple split is enough while
  // still stripping surrounding quotes per segment.
  return raw.split(".").map((seg) => {
    const s = seg.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  });
}

function ensureTable(base: TomlObject, path: string[]): TomlObject {
  let node = base;
  for (const seg of path) {
    const existing = node[seg];
    if (existing === undefined) {
      const next: TomlObject = {};
      node[seg] = next;
      node = next;
    } else if (Array.isArray(existing)) {
      // Dotted sub-table under an array of tables → last element.
      const last = existing[existing.length - 1];
      if (!isTomlObject(last)) throw new Error(`Cannot descend into ${seg}`);
      node = last;
    } else if (isTomlObject(existing)) {
      node = existing;
    } else {
      throw new Error(`Key ${seg} is not a table`);
    }
  }
  return node;
}

function pushArrayTable(base: TomlObject, path: string[]): TomlObject {
  const parent = ensureTable(base, path.slice(0, -1));
  const key = path[path.length - 1]!;
  const arr = parent[key];
  const entry: TomlObject = {};
  if (arr === undefined) {
    parent[key] = [entry];
  } else if (Array.isArray(arr)) {
    arr.push(entry);
  } else {
    throw new Error(`Key ${key} is not an array of tables`);
  }
  return entry;
}

function parseValue(raw: string, lineNo: number): TomlValue {
  const v = raw.trim();
  if (v === "") throw new Error(`Missing value on line ${lineNo}`);
  if (v.startsWith('"') || v.startsWith("'")) return parseString(v, lineNo);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v.startsWith("[")) return parseArray(v, lineNo);
  if (v.startsWith("{")) throw new Error(`Inline tables are not supported (line ${lineNo})`);
  const num = Number(v);
  if (!Number.isNaN(num) && /^[+-]?(\d|\.)/.test(v)) return num;
  throw new Error(`Unsupported TOML value on line ${lineNo}: ${raw}`);
}

function parseString(v: string, lineNo: number): string {
  const quote = v[0]!;
  if (!v.endsWith(quote) || v.length < 2) {
    throw new Error(`Unterminated string on line ${lineNo}: ${v}`);
  }
  const body = v.slice(1, -1);
  // Basic escapes only for double-quoted strings.
  if (quote === '"') return body.replace(/\\(["\\nt])/g, (_, c) => ({ '"': '"', "\\": "\\", n: "\n", t: "\t" }[c as string] ?? c));
  return body;
}

function parseArray(v: string, lineNo: number): TomlValue[] {
  if (!v.endsWith("]")) throw new Error(`Multi-line arrays are not supported (line ${lineNo})`);
  const inner = v.slice(1, -1).trim();
  if (inner === "") return [];
  return splitTopLevel(inner).map((item) => parseValue(item.trim(), lineNo));
}

/** Split on top-level commas, respecting quotes and nested brackets. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (!inSingle && !inDouble) {
      if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") depth--;
      else if (ch === "," && depth === 0) {
        out.push(s.slice(start, i));
        start = i + 1;
      }
    }
  }
  const tail = s.slice(start).trim();
  if (tail !== "") out.push(tail);
  return out;
}

function isTomlObject(value: unknown): value is TomlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
