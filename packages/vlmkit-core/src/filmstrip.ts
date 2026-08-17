/**
 * Composite a numbered sequence of frames into ONE image.
 *
 * `snapshot flipbook` already bundles a sequence into a self-contained HTML
 * player, which is the right shape when a human is going to sit and scrub. It is
 * the wrong shape for the two cases this module serves: a diff you want to read
 * at a glance without opening anything, and a sequence you want to hand to a
 * model, which sees one image and cannot press play.
 *
 * Pure pixel arithmetic — no browser, no I/O. That is deliberate: rendering the
 * sheet in Chromium would give labels for free and make the output depend on font
 * rendering, which is precisely the kind of platform-dependent pixel this toolkit
 * exists to catch elsewhere. Labels still happen, from `bitmap-font.ts` — glyphs
 * we own, identical on every platform — because a sheet with no labels is only
 * readable next to the terminal that produced it, and its whole job is to be
 * pasted somewhere else.
 */
import type { PngData } from "./png-utils.ts";
import { drawText, fitText, textHeight } from "./bitmap-font.ts";

export interface FilmstripOptions {
  /**
   * Cells per row. Omit for a single row (a filmstrip); set it to wrap into a
   * grid (a contact sheet).
   */
  columns?: number;
  /** Gap between cells, in px. Default 8. */
  gap?: number;
  /** Margin around the whole sheet, in px. Defaults to `gap`. */
  padding?: number;
  /**
   * Sheet background, RGB. Default is a mid grey.
   *
   * Not white and not black on purpose: the frames being composited are
   * screenshots of UI, which is usually one or the other, and a background that
   * matches the content makes the cell boundaries invisible — so a frame that
   * came back blank looks like a gap in the sheet rather than like a blank frame.
   */
  background?: readonly [number, number, number];
  /**
   * Downscale every frame by this factor before compositing (2 = half size).
   * Applied per cell, so the grid geometry below is computed on the scaled sizes.
   */
  scale?: number;
  /**
   * Cap the sheet's width in px by downscaling further. Applied after `scale`.
   * A 4-sample strip of 1280x720 frames is 5192px wide untouched.
   *
   * `0` disables the cap, matching `snapshot strip --max-width 0`.
   */
  maxWidth?: number;
  /**
   * One label per column, drawn in a band above the grid. For a shared-clock strip
   * these are the sample times, which is the axis the sheet is read along.
   */
  columnLabels?: readonly string[];
  /**
   * One label per row, drawn in a band above that row's cells — above rather than
   * in a left gutter, because a row label is a CSS selector and a gutter wide
   * enough for one would dominate a sheet of 200px cells.
   */
  rowLabels?: readonly string[];
  /** Integer pixel size of one font unit. Default 2, i.e. 10x14 glyphs. */
  labelScale?: number;
  /** Label ink, RGB. Default near-white, for the default grey sheet. */
  labelColor?: readonly [number, number, number];
}

export interface FilmstripLayout {
  /**
   * Cell box, i.e. the largest frame after scaling.
   *
   * Uniform across the sheet, and a per-row box was tried and rejected — see the measurement in
   * `composeFilmstrip`'s header.
   */
  cell: { width: number; height: number };
  columns: number;
  rows: number;
  /** Top-left of each frame in sheet coordinates, in input order. */
  positions: readonly { x: number; y: number }[];
  /** Scale actually applied, after `maxWidth` was taken into account. */
  scale: number;
  /** Height reserved above the grid for column labels; 0 when there are none. */
  columnLabelBand: number;
  /** Height reserved above each row for its label; 0 when there are none. */
  rowLabelBand: number;
}

const DEFAULT_BACKGROUND = [96, 96, 96] as const;
const DEFAULT_LABEL_COLOR = [240, 240, 240] as const;
/** Breathing room under a label band, so ink does not touch the frame below it. */
const LABEL_PAD = 3;

/** Nearest-neighbour, matching `image-resize.ts`: hard edges stay legible small. */
/**
 * Exported for the animated-strip path, which downscales the same frames the sheet would and must
 * shrink them the same way — two nearest-neighbour implementations would drift on which pixel wins.
 */
export function scalePngData(src: PngData, factor: number): PngData {
  if (factor === 1) return src;
  const width = Math.max(1, Math.round(src.width / factor));
  const height = Math.max(1, Math.round(src.height / factor));
  const data = new Uint8Array(width * height * 4);
  const xRatio = src.width / width;
  const yRatio = src.height / height;
  for (let y = 0; y < height; y++) {
    const srcY = Math.min(Math.floor(y * yRatio), src.height - 1);
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(Math.floor(x * xRatio), src.width - 1);
      const si = (srcY * src.width + srcX) * 4;
      const di = (y * width + x) * 4;
      data[di] = src.data[si]!;
      data[di + 1] = src.data[si + 1]!;
      data[di + 2] = src.data[si + 2]!;
      data[di + 3] = src.data[si + 3]!;
    }
  }
  return { width, height, data };
}

/**
 * Where each frame lands. Exported so a caller can label the sheet (in Markdown,
 * a report, a PR comment) without re-deriving the arithmetic.
 */
export function filmstripLayout(
  frames: readonly PngData[],
  options: FilmstripOptions = {},
): FilmstripLayout {
  if (frames.length === 0) throw new Error("filmstrip needs at least one frame");
  const gap = options.gap ?? 8;
  const padding = options.padding ?? gap;
  const columns = Math.max(1, Math.min(options.columns ?? frames.length, frames.length));
  const rows = Math.ceil(frames.length / columns);

  let scale = Math.max(1, options.scale ?? 1);
  const cellWidthAt = (s: number) => Math.max(...frames.map((f) => Math.max(1, Math.round(f.width / s))));
  // `maxWidth: 0` means "do not cap", which is what `snapshot strip --max-width 0` documents.
  // Taken literally it solved for a scale that fits a zero-width sheet, hit the 64-step guard, and
  // returned a 132px thumbnail of a 1832px strip. The CLI dodged it by omitting the option
  // entirely; any other caller got the thumbnail.
  if (options.maxWidth !== undefined && options.maxWidth > 0) {
    // Solve for the scale that fits, rather than scaling twice: two successive
    // nearest-neighbour passes lose more detail than one pass at the final factor.
    const sheetWidthAt = (s: number) => padding * 2 + columns * cellWidthAt(s) + gap * (columns - 1);
    let guard = 0;
    while (sheetWidthAt(scale) > options.maxWidth && guard++ < 64) scale += 0.25;
  }

  const scaled = frames.map((f) => ({
    width: Math.max(1, Math.round(f.width / scale)),
    height: Math.max(1, Math.round(f.height / scale)),
  }));
  const cell = {
    width: Math.max(...scaled.map((s) => s.width)),
    height: Math.max(...scaled.map((s) => s.height)),
  };

  // Label bands are part of the geometry, not an overlay: text drawn on top of a
  // frame would cover the pixels the sheet exists to show.
  const labelScale = Math.max(1, Math.round(options.labelScale ?? 2));
  const band = textHeight(labelScale) + LABEL_PAD;
  const columnLabelBand = options.columnLabels && options.columnLabels.length > 0 ? band : 0;
  const rowLabelBand = options.rowLabels && options.rowLabels.length > 0 ? band : 0;

  const positions = frames.map((_, i) => {
    const row = Math.floor(i / columns);
    return {
      x: padding + (i % columns) * (cell.width + gap),
      y: padding + columnLabelBand + row * (cell.height + gap + rowLabelBand) + rowLabelBand,
    };
  });
  return { cell, columns, rows, positions, scale, columnLabelBand, rowLabelBand };
}

/**
 * One image containing every frame, in order.
 *
 * ## Why the cell stays uniform (measured 2026-08-16, closing the "ragged layout" item)
 *
 * A real sheet is half padding: `check animation --strip` on
 * `fixtures/css-challenge/dashboard.html` is 1532x781 and **49.0% background**. The recorded fix
 * was per-row cell sizes. Implemented and measured, it recovers almost nothing, because the
 * recorded diagnosis was wrong about where the padding is:
 *
 *   - The four rows are all 393px TALL and 916 / 664 / 412 / 244px WIDE, so per-row height changes
 *     nothing on this sheet (byte-identical output).
 *   - Per-row WIDTH cannot help either: the sheet must be as wide as its widest row, so a narrow
 *     row's grey moves from between its cells to the right of them. Measured on a synthetic
 *     three-width sheet: 37.1% uniform against 36.2% ragged.
 *   - And it costs correctness where it does apply: a column label names one instant across every
 *     row, so ragged widths print `150ms` over a cell from a different sample.
 *
 * So the padding is a property of the composition — one grid, rows of very different widths — and
 * not of the cell rule. Fixing it means a different picture (item: "time axis x rows" plus "spatial
 * arrangement" in one artifact), which is the same conclusion the spatial-arrangement item reached.
 * `--strip-animated` is the other half of that answer: no grid at all.
 *
 * Frames of different sizes are placed **top-left inside a uniform cell**, never
 * centred. That matters for the case this exists for: an animation filmstrip of
 * a `translateX` sweep is read by comparing where the element sits across cells,
 * and centring each frame inside its cell would subtract exactly the offset the
 * reader is looking for — turning visible motion into a still. Cells are sized
 * from the largest frame so nothing is cropped.
 */
export function composeFilmstrip(
  frames: readonly PngData[],
  options: FilmstripOptions = {},
): PngData & { layout: FilmstripLayout } {
  const layout = filmstripLayout(frames, options);
  const gap = options.gap ?? 8;
  const padding = options.padding ?? gap;
  const [bgR, bgG, bgB] = options.background ?? DEFAULT_BACKGROUND;

  const width = padding * 2 + layout.columns * layout.cell.width + gap * (layout.columns - 1);
  const height = padding * 2 + layout.columnLabelBand
    + layout.rows * (layout.cell.height + layout.rowLabelBand) + gap * (layout.rows - 1);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bgR;
    data[i + 1] = bgG;
    data[i + 2] = bgB;
    data[i + 3] = 255;
  }

  frames.forEach((frame, index) => {
    const scaled = scalePngData(frame, layout.scale);
    const { x: ox, y: oy } = layout.positions[index]!;
    for (let y = 0; y < scaled.height; y++) {
      const dstRow = (oy + y) * width;
      const srcRow = y * scaled.width;
      for (let x = 0; x < scaled.width; x++) {
        const si = (srcRow + x) * 4;
        const di = (dstRow + ox + x) * 4;
        data[di] = scaled.data[si]!;
        data[di + 1] = scaled.data[si + 1]!;
        data[di + 2] = scaled.data[si + 2]!;
        // Composited onto an opaque sheet, so a partially transparent frame
        // blends with the background instead of punching a hole in it.
        const alpha = scaled.data[si + 3]! / 255;
        if (alpha < 1) {
          data[di] = Math.round(scaled.data[si]! * alpha + bgR * (1 - alpha));
          data[di + 1] = Math.round(scaled.data[si + 1]! * alpha + bgG * (1 - alpha));
          data[di + 2] = Math.round(scaled.data[si + 2]! * alpha + bgB * (1 - alpha));
        }
        data[di + 3] = 255;
      }
    }
  });

  // Labels last, so nothing composited over them. Each is clipped to its own cell
  // width: a selector longer than its column truncates rather than running into the
  // next one, which would make two labels read as one.
  const sheet = { width, height, data };
  const labelScale = Math.max(1, Math.round(options.labelScale ?? 2));
  const ink = options.labelColor ?? DEFAULT_LABEL_COLOR;
  if (layout.columnLabelBand > 0) {
    options.columnLabels!.slice(0, layout.columns).forEach((label, col) => {
      const x = padding + col * (layout.cell.width + gap);
      drawText(sheet, fitText(label, layout.cell.width, labelScale), x, padding, ink, labelScale);
    });
  }
  if (layout.rowLabelBand > 0) {
    // Row labels get the full sheet width, not one cell: a row label names the whole
    // row, and there is nothing to its right to collide with.
    //
    const rowWidth = width - padding * 2;
    options.rowLabels!.slice(0, layout.rows).forEach((label, row) => {
      const y = padding + layout.columnLabelBand
        + row * (layout.cell.height + gap + layout.rowLabelBand);
      drawText(sheet, fitText(label, rowWidth, labelScale), padding, y, ink, labelScale);
    });
  }

  return { width, height, data, layout };
}
