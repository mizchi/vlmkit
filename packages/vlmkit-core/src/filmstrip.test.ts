import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { boxOnSheet, composeFilmstrip, filmstripLayout, strokeOutside } from "./filmstrip.ts";
import type { PngData } from "./png-utils.ts";

/** A solid frame, so a composited pixel's origin is unambiguous. */
function solid(width: number, height: number, rgb: [number, number, number], alpha = 255): PngData {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = alpha;
  }
  return { width, height, data };
}

function pixel(img: PngData, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
}

const RED: [number, number, number] = [255, 0, 0];
const BLUE: [number, number, number] = [0, 0, 255];

describe("filmstrip geometry", () => {
  it("lays a sequence out in one row by default", () => {
    const sheet = composeFilmstrip([solid(10, 6, RED), solid(10, 6, BLUE)], { gap: 4, padding: 2 });
    // 2 + 10 + 4 + 10 + 2
    assert.equal(sheet.width, 28);
    assert.equal(sheet.height, 10);
    assert.equal(sheet.layout.rows, 1);
    assert.deepEqual(pixel(sheet, 2, 2).slice(0, 3), RED);
    assert.deepEqual(pixel(sheet, 16, 2).slice(0, 3), BLUE);
  });

  it("wraps into a grid when columns is set, filling the last row short", () => {
    const frames = [solid(10, 6, RED), solid(10, 6, RED), solid(10, 6, BLUE)];
    const sheet = composeFilmstrip(frames, { columns: 2, gap: 2, padding: 0 });
    assert.equal(sheet.layout.rows, 2);
    assert.equal(sheet.width, 22);
    assert.equal(sheet.height, 14);
    // Third frame starts the second row.
    assert.deepEqual(sheet.layout.positions[2], { x: 0, y: 8 });
    assert.deepEqual(pixel(sheet, 0, 8).slice(0, 3), BLUE);
    // The unfilled half of the last row stays background.
    assert.deepEqual(pixel(sheet, 21, 13).slice(0, 3), [96, 96, 96]);
  });

  it("shows through as background where a frame is smaller than the cell", () => {
    // The gap is not the only place the sheet colour appears; a short frame
    // leaves its cell partly empty, and that has to read as "this frame is
    // smaller", not as a layout bug.
    const sheet = composeFilmstrip([solid(10, 10, RED), solid(4, 4, BLUE)], { gap: 0, padding: 0 });
    assert.deepEqual(sheet.layout.cell, { width: 10, height: 10 });
    assert.deepEqual(pixel(sheet, 10, 0).slice(0, 3), BLUE);
    assert.deepEqual(pixel(sheet, 19, 9).slice(0, 3), [96, 96, 96], "unused cell area is background");
  });
});

describe("filmstrip alignment", () => {
  it("places differently-sized frames top-left, never centred", () => {
    // The property the whole module exists for. A `translateX` filmstrip is read
    // by comparing where the element sits from cell to cell; centring each frame
    // in its cell subtracts exactly that offset and turns motion into a still.
    // Frames here are 20x4 and 8x4 — if the small one were centred it would start
    // at x = 20 + 6, not x = 20.
    const sheet = composeFilmstrip([solid(20, 4, RED), solid(8, 4, BLUE)], { gap: 0, padding: 0 });
    assert.deepEqual(sheet.layout.positions[1], { x: 20, y: 0 });
    assert.deepEqual(pixel(sheet, 20, 0).slice(0, 3), BLUE, "second frame must start at the cell's left edge");
    // 8px wide from x=20 means it ends at x=27; the rest of the 20px cell is
    // background. Under centring it would have started at 20 + (20-8)/2 = 26.
    assert.deepEqual(pixel(sheet, 25, 0).slice(0, 3), BLUE, "still inside the frame");
    assert.deepEqual(pixel(sheet, 28, 0).slice(0, 3), [96, 96, 96], "and must not be stretched or pushed right");
  });
});

describe("filmstrip scaling", () => {
  it("downscales every frame by the requested factor", () => {
    const sheet = composeFilmstrip([solid(20, 10, RED), solid(20, 10, BLUE)], {
      scale: 2,
      gap: 0,
      padding: 0,
    });
    assert.deepEqual(sheet.layout.cell, { width: 10, height: 5 });
    assert.equal(sheet.width, 20);
    assert.deepEqual(pixel(sheet, 10, 0).slice(0, 3), BLUE);
  });

  it("solves for one scale that fits maxWidth instead of scaling twice", () => {
    // Two successive nearest-neighbour passes lose more detail than one pass at
    // the final factor, so the layout picks the factor before any resampling.
    const frames = Array.from({ length: 4 }, () => solid(1280, 720, RED));
    const untouched = filmstripLayout(frames, { gap: 8, padding: 8 });
    assert.equal(untouched.scale, 1);
    // 4 x 1280 + three 8px gaps + 8px padding on each side.
    assert.equal(untouched.cell.width * 4 + 8 * 3 + 16, 5160, "an unscaled 4-up strip of 1280px frames");

    const capped = filmstripLayout(frames, { gap: 8, padding: 8, maxWidth: 1600 });
    assert.ok(capped.scale > 1, "must scale down to fit");
    const width = 16 + capped.columns * capped.cell.width + 8 * (capped.columns - 1);
    assert.ok(width <= 1600, `sheet width ${width} should fit 1600`);
    // And it must not overshoot into illegibility: one step narrower would fail.
    assert.ok(capped.scale <= 4, `scale ${capped.scale} is more aggressive than the cap needs`);
  });
});

describe("filmstrip compositing", () => {
  it("blends a translucent frame onto the sheet rather than punching a hole", () => {
    // A screenshot of an element mid-fade carries alpha. Copying it verbatim would
    // leave transparent pixels in a sheet that is otherwise opaque, and a viewer
    // showing transparency as white would then read the frame as blank.
    const sheet = composeFilmstrip([solid(4, 4, RED, 128)], {
      gap: 0,
      padding: 0,
      background: [0, 0, 0],
    });
    const [r, g, b, a] = pixel(sheet, 0, 0);
    assert.equal(a, 255, "the sheet stays opaque");
    assert.ok(r > 120 && r < 136, `expected ~50% red over black, got ${r}`);
    assert.equal(g, 0);
    assert.equal(b, 0);
  });

  it("refuses an empty sequence rather than emitting a 0x0 image", () => {
    assert.throws(() => composeFilmstrip([]), /at least one frame/);
  });
});

describe("filmstrip labels", () => {
  const RED2: [number, number, number] = [255, 0, 0];

  it("reserves a band instead of drawing over the frames", () => {
    // A label composited on top of a cell would cover the pixels the sheet exists to
    // show. It has to cost height, not content.
    const frames = [solid(10, 10, RED2), solid(10, 10, RED2)];
    const bare = composeFilmstrip(frames, { gap: 0, padding: 0 });
    const labelled = composeFilmstrip(frames, { gap: 0, padding: 0, columnLabels: ["0ms", "1ms"] });
    assert.equal(labelled.width, bare.width, "a column label must not widen the sheet");
    assert.ok(labelled.height > bare.height, "a column label must reserve height");
    assert.equal(labelled.layout.columnLabelBand, labelled.height - bare.height);
    // Every frame pixel still reads as the frame, shifted down by the band.
    assert.deepEqual(pixel(labelled, 0, labelled.layout.positions[0]!.y), [255, 0, 0, 255]);
  });

  it("shifts every row by its own label band, so a row label never overlaps the row above", () => {
    const frames = Array.from({ length: 4 }, () => solid(10, 10, RED2));
    const sheet = composeFilmstrip(frames, {
      columns: 2,
      gap: 0,
      padding: 0,
      rowLabels: ["a", "b"],
    });
    const band = sheet.layout.rowLabelBand;
    assert.ok(band > 0);
    assert.equal(sheet.layout.positions[0]!.y, band);
    assert.equal(sheet.layout.positions[2]!.y, band + sheet.layout.cell.height + band);
    assert.equal(sheet.height, (sheet.layout.cell.height + band) * 2);
  });

  it("draws no band when no labels are given, so existing sheets are byte-identical", () => {
    const frames = [solid(6, 6, RED2)];
    const sheet = composeFilmstrip(frames, { gap: 0, padding: 0 });
    assert.equal(sheet.layout.columnLabelBand, 0);
    assert.equal(sheet.layout.rowLabelBand, 0);
    assert.equal(sheet.width, 6);
    assert.equal(sheet.height, 6);
  });

  it("writes ink into the label band", () => {
    const sheet = composeFilmstrip([solid(40, 10, RED2)], {
      gap: 0,
      padding: 0,
      columnLabels: ["250ms"],
      labelColor: [0, 255, 0],
    });
    let green = 0;
    for (let y = 0; y < sheet.layout.columnLabelBand; y++) {
      for (let x = 0; x < sheet.width; x++) {
        const [r, g, b] = pixel(sheet, x, y);
        if (r === 0 && g === 255 && b === 0) green++;
      }
    }
    assert.ok(green > 0, "the label band contains no label ink");
  });

  it("ignores labels beyond the grid rather than throwing", () => {
    const sheet = composeFilmstrip([solid(8, 8, RED2)], {
      gap: 0,
      padding: 0,
      columnLabels: ["a", "b", "c"],
      rowLabels: ["r1", "r2"],
    });
    assert.equal(sheet.layout.columns, 1);
    assert.equal(sheet.layout.rows, 1);
  });
});

describe("maxWidth 0 disables the cap", () => {
  const frame = (w: number, h: number): PngData => ({ width: w, height: h, data: new Uint8Array(w * h * 4).fill(200) });

  it("does not solve for a scale that fits a zero-width sheet", () => {
    // `snapshot strip --max-width 0` documents 0 as "do not cap", and the CLI honoured it by
    // OMITTING the option. Taken literally the solver stepped the scale until the sheet fit in
    // 0px, hit its 64-step guard, and returned a 132px thumbnail of an 1832px strip — so any
    // library caller that passed the documented 0 got the thumbnail.
    const uncapped = composeFilmstrip([frame(916, 393), frame(916, 393)], { columns: 2, maxWidth: 0 });
    assert.equal(uncapped.layout.scale, 1, "no downscale at all");
    assert.ok(uncapped.width > 1800, `expected a full-size sheet, got ${uncapped.width}px`);

    // A positive cap still caps, which is what stops this from being a silent removal.
    const capped = composeFilmstrip([frame(916, 393), frame(916, 393)], { columns: 2, maxWidth: 900 });
    assert.ok(capped.layout.scale > 1);
    assert.ok(capped.width <= 900, `expected <=900px, got ${capped.width}px`);
  });
});

describe("cell labels and box outlines (storyboard rows)", () => {
  it("reserves a band above every cell, below the row label, and draws each cell's own text", () => {
    const frames = Array.from({ length: 4 }, () => solid(40, 10, RED));
    const sheet = composeFilmstrip(frames, {
      columns: 2,
      gap: 0,
      padding: 0,
      rowLabels: ["E1", "E2"],
      cellLabels: ["0ms before", "17ms first", "", "33ms back"],
      labelColor: [0, 255, 0],
    });
    const { rowLabelBand, cellLabelBand, cell } = sheet.layout;
    assert.ok(cellLabelBand > 0);
    assert.equal(sheet.layout.positions[0]!.y, rowLabelBand + cellLabelBand);
    assert.equal(sheet.layout.positions[2]!.y, (rowLabelBand + cellLabelBand) * 2 + cell.height);
    assert.equal(sheet.height, (cell.height + rowLabelBand + cellLabelBand) * 2);
    const inkIn = (x0: number, y0: number, w: number, h: number) => {
      let n = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (pixel(sheet, x, y)[1] === 255) n++;
      return n;
    };
    for (const p of sheet.layout.positions)
      assert.equal(inkIn(p.x, p.y, cell.width, cell.height), 0, "no label ink on a frame");
    const row2 = sheet.layout.positions[2]!.y - cellLabelBand - rowLabelBand;
    assert.ok(inkIn(0, row2, sheet.width, rowLabelBand) > 0, "row 2's label sits in the band above its cell labels");
    const y2 = sheet.layout.positions[2]!.y - cellLabelBand;
    assert.equal(inkIn(0, y2, cell.width, cellLabelBand), 0, "an empty label leaves its band blank");
    assert.ok(inkIn(cell.width, y2, cell.width, cellLabelBand) > 0);
  });

  it("no cell labels, no band: a sheet without them is unchanged", () => {
    const frames = [solid(6, 6, RED), solid(6, 6, BLUE)];
    const a = composeFilmstrip(frames, { gap: 0, padding: 0 });
    const b = composeFilmstrip(frames, { gap: 0, padding: 0, cellLabels: ["", ""] });
    assert.equal(b.layout.cellLabelBand, 0);
    assert.deepEqual(b.data, a.data);
  });

  /** The sheet rows (or columns) scalePngData fills from source indices in [start, start + length). */
  const shown = (start: number, length: number, srcLen: number, scale: number) => {
    const dstLen = Math.max(1, Math.round(srcLen / scale));
    const hits: number[] = [];
    for (let i = 0; i < dstLen; i++) {
      const src = Math.min(Math.floor(i * (srcLen / dstLen)), srcLen - 1);
      if (src >= start && src < start + length) hits.push(i);
    }
    return hits;
  };

  it("maps a box onto exactly the sheet pixels that show it, at fractional scales and every edge", () => {
    for (const [w, h, scale] of [
      [320, 200, 1.25],
      [1280, 720, 4.25],
      [2560, 1440, 8.25],
      [100, 50, 2.75],
    ] as const) {
      const layout = filmstripLayout([{ width: w, height: h, data: new Uint8Array(0) }], { scale, gap: 0, padding: 0 });
      for (let k = 0; k < 200; k++) {
        const bx = (k * 37) % w;
        const by = (k * 53) % h;
        const box = { x: bx, y: by, width: 1 + ((k * 11) % (w - bx)), height: 1 + ((k * 7) % (h - by)) };
        const got = boxOnSheet(layout, 0, { width: w, height: h }, box);
        const xs = shown(box.x, box.width, w, layout.scale);
        const ys = shown(box.y, box.height, h, layout.scale);
        if (xs.length > 0)
          assert.deepEqual([got.x, got.x + got.width - 1], [xs[0], xs.at(-1)], `${w} x ${JSON.stringify(box)}`);
        else assert.equal(got.width, 1, "a box between two sheet pixels keeps one");
        if (ys.length > 0)
          assert.deepEqual([got.y, got.y + got.height - 1], [ys[0], ys.at(-1)], `${h} y ${JSON.stringify(box)}`);
        else assert.equal(got.height, 1);
      }
    }
  });

  it("inverts the float sampling, not the exact ratio: 105 * (1440 / 175) is 863.99…", () => {
    const layout = filmstripLayout([{ width: 2560, height: 1440, data: new Uint8Array(0) }], { scale: 8.25 });
    const rows = (y: number, height: number) => {
      const b = boxOnSheet(layout, 0, { width: 2560, height: 1440 }, { x: 0, y, width: 10, height });
      const top = b.y - layout.positions[0]!.y;
      return [top, top + b.height - 1];
    };
    assert.deepEqual(rows(840, 24), [103, 105], "row 102 shows 839, row 105 shows 863");
    // No sheet row shows source rows 864-871; the one showing 863 stands in.
    assert.deepEqual(rows(864, 8), [105, 105]);
  });

  it("outlines outside the box and never over it; a clip grown into the gap keeps an edge box's four sides", () => {
    const frames = [solid(100, 50, RED), solid(100, 50, RED)];
    const sheet = composeFilmstrip(frames, { gap: 8, padding: 8, scale: 2 });
    const cell = { ...sheet.layout.positions[1]!, ...sheet.layout.cell };
    const grown = { x: cell.x - 2, y: cell.y - 2, width: cell.width + 4, height: cell.height + 4 };
    const inner = boxOnSheet(sheet.layout, 1, frames[1]!, { x: 10, y: 10, width: 20, height: 10 });
    assert.deepEqual(inner, { x: cell.x + 5, y: cell.y + 5, width: 10, height: 5 });
    strokeOutside(sheet, inner, [0, 255, 0], 2, grown);
    const GREEN = [0, 255, 0, 255];
    assert.deepEqual(pixel(sheet, inner.x - 1, inner.y), GREEN, "left");
    assert.deepEqual(pixel(sheet, inner.x + inner.width, inner.y), GREEN, "right");
    assert.deepEqual(pixel(sheet, inner.x, inner.y - 1), GREEN, "top");
    assert.deepEqual(pixel(sheet, inner.x, inner.y + inner.height), GREEN, "bottom");
    assert.deepEqual(pixel(sheet, inner.x - 3, inner.y), [255, 0, 0, 255], "two pixels wide, no more");
    for (let y = inner.y; y < inner.y + inner.height; y++) {
      for (let x = inner.x; x < inner.x + inner.width; x++) assert.deepEqual(pixel(sheet, x, y), [255, 0, 0, 255]);
    }
    // A one-pixel bar along the frame's top edge: its outline's top side is in the gap above the
    // cell, and the bar itself is still there to see.
    const bar = boxOnSheet(sheet.layout, 1, frames[1]!, { x: 0, y: 0, width: 100, height: 1 });
    strokeOutside(sheet, bar, [0, 0, 255], 2, grown);
    assert.deepEqual(pixel(sheet, bar.x + 3, bar.y), [255, 0, 0, 255], "the bar is not painted over");
    assert.deepEqual(pixel(sheet, bar.x + 3, bar.y - 1), [0, 0, 255, 255], "its top side, in the gap");
    assert.deepEqual(pixel(sheet, bar.x + 3, bar.y + 1), [0, 0, 255, 255], "its bottom side, in the cell");
    assert.notDeepEqual(pixel(sheet, cell.x - 3, bar.y), [0, 0, 255, 255], "nothing past the grown clip");
    // A box narrower than a sheet pixel keeps one.
    assert.equal(boxOnSheet(sheet.layout, 0, frames[0]!, { x: 51, y: 0, width: 1, height: 1 }).width, 1);
  });
});
