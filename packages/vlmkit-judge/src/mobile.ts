/**
 * The pure half of `vlmkit check mobile` (issue #219): what a page's viewport meta allows, where
 * a swipe left a carousel, and which boxes the software keyboard or a safe-area inset covers.
 * The browser half (`vlmkit-markup/src/inspect/mobile-check.ts`) measures; these decide.
 *
 * Pure: numbers and strings in, verdicts out.
 */

export interface ViewportMeta {
  /** The tag's `content`, or null when the page has none. */
  content: string | null;
  /** Its directives, names lower-cased. */
  directives: Record<string, string>;
}

/** Read a viewport meta's `content` as browsers do: `,` or `;` between `name=value` pairs. */
export function parseViewportMeta(content: string | null): ViewportMeta {
  const directives: Record<string, string> = {};
  for (const part of (content ?? "").split(/[,;]/)) {
    const [name, ...rest] = part.split("=");
    const key = name?.trim().toLowerCase();
    if (key) directives[key] = rest.join("=").trim().toLowerCase();
  }
  return { content, directives };
}

/**
 * Why the reader cannot zoom to 200% (WCAG 1.4.4), or null. `user-scalable=no` (or `0`) turns
 * pinch-zoom off on Android Chrome; a `maximum-scale` under 2 caps it below what 1.4.4 asks for.
 * iOS Safari has ignored both since iOS 10, so the defect is the Android reader's.
 */
export function zoomBlocked(meta: ViewportMeta): string | null {
  const scalable = meta.directives["user-scalable"];
  if (scalable !== undefined && /^(no|0(\.0*)?)$/.test(scalable))
    return `user-scalable=${scalable} turns pinch-zoom off`;
  const max = meta.directives["maximum-scale"];
  if (max !== undefined) {
    const value = Number(max);
    if (Number.isFinite(value) && value < 2) return `maximum-scale=${max} caps zoom below the 200% WCAG 1.4.4 asks for`;
  }
  return null;
}

/** Whether content may be drawn under the notch and home indicator (`viewport-fit=cover`). */
export const coversSafeArea = (meta: ViewportMeta): boolean => meta.directives["viewport-fit"] === "cover";

/** How the page asked the software keyboard to change the viewports (`interactive-widget`). */
export function keyboardMode(meta: ViewportMeta): "resizes-visual" | "resizes-content" | "overlays-content" {
  const mode = meta.directives["interactive-widget"];
  return mode === "resizes-content" || mode === "overlays-content" ? mode : "resizes-visual";
}

export interface SwipeLanding {
  scrollLeft: number;
  maxScroll: number;
  clientWidth: number;
  /** Each item's left edge and width, relative to the scroller's visible left edge. */
  items: readonly { left: number; width: number }[];
}

/** Within this many px an edge counts as lined up (subpixel layout and rounding). */
export const SWIPE_ALIGN_PX = 2;

/**
 * Where a swipe left a scroller: on an item (its start, centre or end lined up with the
 * scroller's) or between two, with how far the nearest item is from lining up.
 */
export function swipeLanding(s: SwipeLanding): { aligned: boolean; offBy: number } {
  if (s.scrollLeft <= SWIPE_ALIGN_PX || s.scrollLeft >= s.maxScroll - SWIPE_ALIGN_PX)
    return { aligned: true, offBy: 0 };
  let offBy = Infinity;
  for (const item of s.items) {
    const start = Math.abs(item.left);
    const centre = Math.abs(item.left + item.width / 2 - s.clientWidth / 2);
    const end = Math.abs(item.left + item.width - s.clientWidth);
    offBy = Math.min(offBy, start, centre, end);
  }
  return { aligned: offBy <= SWIPE_ALIGN_PX, offBy: Number.isFinite(offBy) ? offBy : 0 };
}

/**
 * A carousel is a scroller whose items are each at least half its width: one swipe is meant to
 * bring the next one in. A row of chips or thumbnails scrolls freely and is not judged.
 */
export function isCarousel(clientWidth: number, itemWidths: readonly number[]): boolean {
  if (itemWidths.length < 2 || clientWidth <= 0) return false;
  const sorted = [...itemWidths].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]! >= 0.5 * clientWidth;
}

export interface Band {
  top: number;
  bottom: number;
}

/** How much of [top, bottom) a band covers, in px. */
export const overlapPx = (box: Band, band: Band): number =>
  Math.max(0, Math.min(box.bottom, band.bottom) - Math.max(box.top, band.top));
