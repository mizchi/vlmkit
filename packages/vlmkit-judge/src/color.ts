/**
 * Colour arithmetic, as pure functions over resolved sRGB.
 *
 * The rule this module exists for: **the collector resolves, the judge decides.**
 * Resolving a colour is the renderer's job — a browser turns `oklch()` / `lab()` /
 * `color-mix()` into the sRGB it paints by rasterising a pixel (`CONTRAST_BACKGROUND_JS`
 * in vlmkit-markup), and a game engine knows the RGBA it draws with. What happens next
 * — compositing translucent layers, WCAG luminance, the large-text floor — is arithmetic,
 * and it belongs here so every snapshot source gets the same answer.
 *
 * Every function mirrors its in-page counterpart in `CONTRAST_BACKGROUND_JS` /
 * `COLLECT_TEXT_CONTRAST` exactly, including the 0.03928 sRGB threshold (WCAG 2.x as
 * written, not the 0.04045 of IEC 61966) and the rounding of the reported values;
 * `contrast-parity.test.ts` in vlmkit-markup holds the two to each other.
 */

/** `[r, g, b]` in 0-255. */
export type Rgb = readonly [number, number, number];
/** `[r, g, b, a]`, channels 0-255 and alpha 0-1. */
export type Rgba = readonly [number, number, number, number];

/**
 * Parse an already-resolved colour: `rgb()` / `rgba()` (comma, space or slash separated)
 * and `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`.
 *
 * Returns null for anything else, deliberately. `oklch()`, `lab()`, named colours and
 * `color-mix()` need a renderer's colour management to become sRGB, and guessing that
 * here would put a second, different answer next to the browser's — the defect
 * `CONTRAST_BACKGROUND_JS` was written to end. A source that has such a colour resolves
 * it before handing it over.
 */
export function parseColor(input: string | undefined | null): Rgba | null {
  const s = (input ?? "").trim();
  if (s === "") return null;
  if (s === "transparent") return [0, 0, 0, 0];
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1]!.split(/[,/\s]+/).map(parseFloat).filter((n) => Number.isFinite(n));
    if (p.length >= 3) return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1];
    return null;
  }
  const hex = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (!hex) return null;
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
  const byte = (i: number) => parseInt(full.slice(i * 2, i * 2 + 2), 16);
  return [byte(0), byte(1), byte(2), full.length === 8 ? byte(3) / 255 : 1];
}

/** `over` painted on opaque `base`, source-over. */
export function blendColor(base: Rgb, over: Rgba): [number, number, number] {
  const a = over[3];
  return [
    base[0] * (1 - a) + over[0] * a,
    base[1] * (1 - a) + over[1] * a,
    base[2] * (1 - a) + over[2] * a,
  ];
}

/** WCAG 2.x relative luminance of an opaque sRGB colour. */
export function relativeLuminance(c: Rgb): number {
  const channel = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

/** WCAG 2.x contrast ratio, 1 to 21. Order does not matter. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Composite a stack of backgrounds, innermost first (the element's own, then each
 * ancestor's), the way `resolveTextBackground` does in the page: the walk stops at the
 * first opaque layer, and what is left is painted over white — the canvas a browser
 * paints on when nothing else does.
 */
export function compositeBackground(innermostFirst: readonly Rgba[]): [number, number, number] {
  const chain: Rgba[] = [];
  for (const c of innermostFirst) {
    if (c[3] > 0) chain.push(c);
    if (c[3] >= 1) break;
  }
  let bg: [number, number, number] = [255, 255, 255];
  for (const c of chain.reverse()) bg = blendColor(bg, c);
  return bg;
}

/** `rgb(r, g, b)` with rounded channels — the form every contrast finding prints. */
export function formatRgb(c: Rgb): string {
  return `rgb(${c.map(Math.round).join(", ")})`;
}

/**
 * WCAG "large text": 24px, or 18.66px at weight 700+ (WCAG 2.2's 18pt / 14pt bold).
 * Large text needs 3:1, everything else 4.5:1.
 */
export function textContrastFloor(fontSizePx: number, fontWeight: number): { large: boolean; floor: 3 | 4.5 } {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  return { large, floor: large ? 3 : 4.5 };
}

export interface TextContrastInput {
  /** Resolved text colour; alpha is honoured. */
  color: Rgba;
  /** Resolved background stack, innermost first. */
  backgrounds: readonly Rgba[];
  /** Product of the element's and its ancestors' opacity. Default 1. */
  opacity?: number;
  fontSizePx?: number;
  fontWeight?: number;
}

export interface TextContrast {
  fg: [number, number, number];
  bg: [number, number, number];
  /** Unrounded. */
  ratio: number;
  fontSizePx: number;
  large: boolean;
  floor: 3 | 4.5;
}

/**
 * The measurement `COLLECT_TEXT_CONTRAST` makes for one text element, from resolved
 * colours rather than from a live page: the text composited over its background at its
 * inherited opacity, the ratio, and the floor that applies at its size.
 */
export function measureTextContrast(input: TextContrastInput): TextContrast {
  const bg = compositeBackground(input.backgrounds);
  const c = input.color;
  const fg = blendColor(bg, [c[0], c[1], c[2], c[3] * (input.opacity ?? 1)]);
  const fontSizePx = input.fontSizePx ?? 16;
  const { large, floor } = textContrastFloor(fontSizePx, input.fontWeight ?? 400);
  return { fg, bg, ratio: contrastRatio(fg, bg), fontSizePx, large, floor };
}
