/**
 * Lightweight loader for the YAML-ish front matter Google's
 * `design.md` examples use. Goal: surface spacing + color tokens to
 * `vlmkit`'s fix-candidate and palette-diff layers so an agent can be told
 * "swap `surface-variant` → `surface-container-high`" instead of
 * staring at two hex strings.
 *
 * Scope: enough to parse the
 * https://github.com/google-labs-code/design.md front-matter shape:
 *   ---
 *   colors:
 *     primary: "#855300"
 *   spacing:
 *     md: 24px
 *   ---
 *
 * No external YAML dependency — the front matter is flat-enough that a
 * line-by-line parser handles it. Out of scope: anchors, multiline
 * strings, lists, the full YAML spec.
 */

import { readFile } from "node:fs/promises";

export interface SpacingToken {
  /** Token name (e.g. `md`). */
  name: string;
  /** Resolved value in pixels. */
  px: number;
  /** Raw declared value (e.g. `1.5rem`, `24px`). */
  raw: string;
}

export interface DesignTokens {
  colors: Map<string, string>;
  spacing: SpacingToken[];
  /** Numeric radius tokens (px), keyed by name. */
  rounded: Map<string, { px: number; raw: string }>;
  /** Source path (for diagnostics). */
  sourcePath?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Parse the YAML-ish front matter from a DESIGN.md file. Accepts either
 * a markdown file with front matter or a raw YAML file.
 */
export async function loadDesignTokens(path: string): Promise<DesignTokens> {
  const text = await readFile(path, "utf-8");
  return parseDesignTokens(text, path);
}

export function parseDesignTokens(text: string, sourcePath?: string): DesignTokens {
  const tokens: DesignTokens = {
    colors: new Map(),
    spacing: [],
    rounded: new Map(),
    sourcePath,
  };

  // Extract front matter between leading `---` lines if present; else
  // treat the whole file as YAML.
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const body = fmMatch ? fmMatch[1] : text;

  // Walk the file as an indent-respecting key: value tree. Two-space
  // indent assumed.
  const lines = body.split(/\r?\n/);
  const path: string[] = [];
  const indents: number[] = [];
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const m = raw.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const key = m[2].trim();
    const value = m[3].trim();

    // Pop the path stack until indent < top.
    while (indents.length > 0 && indents[indents.length - 1] >= indent) {
      indents.pop();
      path.pop();
    }

    if (value === "") {
      // Section header — push onto stack.
      indents.push(indent);
      path.push(key);
      continue;
    }

    const fullKey = [...path, key].join(".");
    const unquoted = unquote(value);
    ingest(tokens, fullKey, unquoted);
  }

  // Stable ordering for spacing (ascending px).
  tokens.spacing.sort((a, b) => a.px - b.px);
  return tokens;
}

function unquote(value: string): string {
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value[0] === "'" && value[value.length - 1] === "'") {
    return value.slice(1, -1);
  }
  return value;
}

function ingest(tokens: DesignTokens, fullKey: string, value: string): void {
  // Skip {token.references} — they don't materialize a value here.
  if (value.startsWith("{") && value.endsWith("}")) return;

  if (fullKey.startsWith("colors.")) {
    const name = fullKey.slice("colors.".length);
    if (HEX_RE.test(value)) tokens.colors.set(name, value.toLowerCase());
    return;
  }

  if (fullKey.startsWith("spacing.")) {
    const name = fullKey.slice("spacing.".length);
    const px = parseLengthToPx(value);
    if (px !== null) tokens.spacing.push({ name, px, raw: value });
    return;
  }

  if (fullKey.startsWith("rounded.")) {
    const name = fullKey.slice("rounded.".length);
    const px = parseLengthToPx(value);
    if (px !== null) tokens.rounded.set(name, { px, raw: value });
    return;
  }
}

export function parseLengthToPx(value: string): number | null {
  const m = value.match(/^([\d.]+)\s*(px|rem|em)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  switch (m[2]) {
    case "rem":
    case "em":
      return n * 16;
    case "px":
    case undefined:
      return n;
    default:
      return null;
  }
}

/**
 * Find the spacing token whose px value is closest to `targetPx`.
 * Returns null if no spacing tokens are loaded or the closest delta
 * exceeds `maxDeltaPx`.
 */
export function snapSpacing(
  tokens: DesignTokens,
  targetPx: number,
  maxDeltaPx = 4,
): { token: SpacingToken; delta: number } | null {
  if (tokens.spacing.length === 0) return null;
  let best: SpacingToken | null = null;
  let bestDelta = Infinity;
  for (const t of tokens.spacing) {
    const d = Math.abs(t.px - targetPx);
    if (d < bestDelta) {
      best = t;
      bestDelta = d;
    }
  }
  if (!best || bestDelta > maxDeltaPx) return null;
  return { token: best, delta: bestDelta };
}

/**
 * Find the color token closest to `hex` by CIE76 ΔE in the Lab space.
 * Returns null when no colors are loaded or the closest distance
 * exceeds `maxDeltaE`.
 *
 * CIEDE2000 would be more perceptually accurate but ΔE76 is enough to
 * separate "same token, rounded" from "different token entirely" at
 * the granularity DESIGN.md palettes use.
 */
export function snapColor(
  tokens: DesignTokens,
  hex: string,
  maxDeltaE = 10,
): { name: string; hex: string; deltaE: number } | null {
  if (tokens.colors.size === 0) return null;
  const targetLab = hexToLab(hex);
  if (!targetLab) return null;
  let bestName: string | null = null;
  let bestHex = "";
  let bestDelta = Infinity;
  for (const [name, tokenHex] of tokens.colors) {
    const tokenLab = hexToLab(tokenHex);
    if (!tokenLab) continue;
    const d = deltaE76(targetLab, tokenLab);
    if (d < bestDelta) {
      bestName = name;
      bestHex = tokenHex;
      bestDelta = d;
    }
  }
  if (!bestName || bestDelta > maxDeltaE) return null;
  return { name: bestName, hex: bestHex, deltaE: bestDelta };
}

interface Lab { L: number; a: number; b: number }

function hexToLab(hex: string): Lab | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToLab(rgb);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "");
  if (m.length === 3) {
    return {
      r: parseInt(m[0] + m[0], 16),
      g: parseInt(m[1] + m[1], 16),
      b: parseInt(m[2] + m[2], 16),
    };
  }
  if (m.length === 6 || m.length === 8) {
    return {
      r: parseInt(m.slice(0, 2), 16),
      g: parseInt(m.slice(2, 4), 16),
      b: parseInt(m.slice(4, 6), 16),
    };
  }
  return null;
}

function rgbToLab({ r, g, b }: { r: number; g: number; b: number }): Lab {
  // sRGB → linear RGB
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  // linear RGB → XYZ (D65)
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  // XYZ → Lab
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  const L = 116 * f(Y) - 16;
  const a = 500 * (f(X) - f(Y));
  const bb = 200 * (f(Y) - f(Z));
  return { L, a, b: bb };
}

function deltaE76(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}
