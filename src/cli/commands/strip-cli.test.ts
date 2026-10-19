import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PNG } from "pngjs";
import { describe, it } from "vite-plus/test";
import { FRAMES_FORMAT, frameFileName } from "@mizchi/vlmkit-judge/frames.ts";
import { framesFromManifest, numericOrder, parseArgs } from "./strip-cli.ts";

describe("snapshot strip: argument parsing", () => {
  it("takes positional frames and defaults the output", () => {
    const args = parseArgs(["a.png", "b.png"]);
    assert.deepEqual(args.paths, ["a.png", "b.png"]);
    assert.equal(args.out, "strip.png");
    assert.equal(args.columns, undefined);
  });

  it("takes --crop x,y,w,h and refuses a malformed one", () => {
    assert.deepEqual(parseArgs(["a.png", "--crop", "10,20,300,200"]).crop, { x: 10, y: 20, width: 300, height: 200 });
    assert.throws(() => parseArgs(["a.png", "--crop", "10,20,0,200"]), /--crop expects x,y,w,h/);
    assert.throws(() => parseArgs(["a.png", "--crop", "10,20"]), /--crop expects x,y,w,h/);
  });

  it("reads the layout flags", () => {
    const args = parseArgs([
      "a.png",
      "--columns",
      "3",
      "--gap",
      "0",
      "--scale",
      "2",
      "--max-width",
      "900",
      "--out",
      "s.png",
    ]);
    assert.equal(args.columns, 3);
    assert.equal(args.gap, 0);
    assert.equal(args.scale, 2);
    assert.equal(args.maxWidth, 900);
    assert.equal(args.out, "s.png");
  });

  it("distinguishes `--gap 0` from an omitted --gap", () => {
    // `0` is falsy, so a truthiness check here would silently substitute the
    // 8px default and produce a sheet with gaps the caller asked to remove.
    assert.equal(parseArgs(["a.png", "--gap", "0"]).gap, 0);
    assert.equal(parseArgs(["a.png"]).gap, undefined);
  });

  it("rejects a non-numeric flag value instead of composing with NaN", () => {
    assert.throws(() => parseArgs(["a.png", "--columns", "three"]), /--columns expects a number, got "three"/);
    assert.throws(() => parseArgs(["a.png", "--gap"]), /--gap expects a number, got nothing/);
  });

  it("rejects an unknown option and an empty frame list", () => {
    assert.throws(() => parseArgs(["a.png", "--rows", "2"]), /unknown option --rows/);
    assert.throws(() => parseArgs([]), /no frames given/);
  });
});

describe("snapshot strip: numeric order detection", () => {
  it("catches the glob order that reads backwards", () => {
    // Exactly what `frames/anim-0-*.png` expanded to for this repo's own
    // `check animation --frames` output before it wrote vlmkit-frames/1 names:
    // the 100% frame lands first.
    const given = ["anim-0-100.png", "anim-0-20.png", "anim-0-40.png", "anim-0-60.png", "anim-0-80.png"];
    assert.deepEqual(numericOrder(given), [
      "anim-0-20.png",
      "anim-0-40.png",
      "anim-0-60.png",
      "anim-0-80.png",
      "anim-0-100.png",
    ]);
  });

  it("stays quiet when the given order is already numeric", () => {
    assert.equal(numericOrder(["f-1.png", "f-2.png", "f-10.png"]), null);
    assert.equal(
      numericOrder(["f-001.png", "f-002.png", "f-010.png"]),
      null,
      "zero-padded names sort correctly already",
    );
  });

  it("compares every digit run, so animation 0 sorts before animation 1", () => {
    // A flat "last number wins" comparison would interleave the two animations:
    // 0-100 would sort after 1-20.
    const given = ["anim-1-20.png", "anim-0-100.png"];
    assert.deepEqual(numericOrder(given), ["anim-0-100.png", "anim-1-20.png"]);
  });

  it("reads digits from the filename, not from the directory", () => {
    // The directory this repo's scratchpad lives in contains digits, so scanning
    // the whole path warned about ordering two files that carry no number at all.
    assert.equal(numericOrder(["/tmp/claude-0/abc123/rest.png", "/tmp/claude-0/abc123/rest-recheck.png"]), null);
    // And a numeric name still sorts even under a digit-laden directory.
    assert.deepEqual(numericOrder(["/tmp/x-9/f-10.png", "/tmp/x-9/f-2.png"]), [
      "/tmp/x-9/f-2.png",
      "/tmp/x-9/f-10.png",
    ]);
  });

  it("declines to guess when a filename carries no number", () => {
    // `rest.png` / `rest-recheck.png` are in the same directory as the numbered
    // frames; there is no numeric order to suggest for them.
    assert.equal(numericOrder(["rest.png", "anim-0-20.png"]), null);
  });
});

/** A sequence on disk: solid frames, one per instant, and the frames.json that lists them. */
async function sequence(atMs: number[], label?: (i: number) => string | undefined) {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-strip-manifest-"));
  const frames = [];
  for (const [n, t] of atMs.entries()) {
    const png = new PNG({ width: 8, height: 6 });
    png.data.fill(40 + n * 20);
    const file = frameFileName(n, t);
    await writeFile(join(dir, file), PNG.sync.write(png));
    const own = label?.(n);
    frames.push({ n, file, atMs: t, stable: true, ...(own ? { label: own } : {}) });
  }
  const manifest = {
    format: FRAMES_FORMAT,
    source: { tool: "test", url: "x", viewport: { width: 8, height: 6 }, deviceScaleFactor: 1, clock: "held" },
    frames,
  };
  await writeFile(join(dir, "frames.json"), JSON.stringify(manifest));
  return join(dir, "frames.json");
}

describe("snapshot strip --manifest", () => {
  it("takes the manifest instead of paths, and --max-frames only with it", () => {
    assert.equal(parseArgs(["--manifest", "f.json"]).manifest, "f.json");
    assert.throws(() => parseArgs(["a.png", "--manifest", "f.json"]), /not both/);
    assert.throws(() => parseArgs(["a.png", "--max-frames", "3"]), /thins a --manifest/);
    assert.throws(() => parseArgs(["--manifest", "f.json", "--max-frames", "0"]), /whole number/);
    assert.throws(() => parseArgs(["--manifest"]), /expects a frames.json/);
  });

  it("lists the frames in manifest order, labelled with the time each shows, thinned evenly", async () => {
    const path = await sequence([0, 1000 / 60, 250, 500, 2001], (n) => (n === 4 ? "rest" : undefined));
    const all = await framesFromManifest(path);
    assert.deepEqual(all.labels, ["0ms", "16.67ms", "250ms", "500ms", "2001ms rest"]);
    assert.deepEqual(
      all.paths,
      [0, 1000 / 60, 250, 500, 2001].map((t, n) => resolve(path, "..", frameFileName(n, t))),
    );
    const three = await framesFromManifest(path, 3);
    assert.deepEqual(three.labels, ["0ms", "250ms", "2001ms rest"], "both ends kept");
  });

  it("--animated plays the gaps between the times the frames show", async () => {
    const path = await sequence([0, 100, 400]);
    const out = join(resolve(path, ".."), "anim.png");
    const r = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        join(import.meta.dirname, "strip-cli.ts"),
        "--manifest",
        path,
        "--animated",
        "--out",
        out,
      ],
      { encoding: "utf-8", env: { ...process.env, NO_COLOR: "1" }, timeout: 30_000 },
    );
    assert.equal(r.status, 0, r.stderr);
    const bytes = await readFile(out);
    // fcTL: delay_num at payload offset 20, delay_den at 22 (APNG spec).
    const delays: number[] = [];
    for (let i = bytes.indexOf("fcTL"); i >= 0; i = bytes.indexOf("fcTL", i + 4)) {
      delays.push((bytes.readUInt16BE(i + 4 + 20) * 1000) / bytes.readUInt16BE(i + 4 + 22));
    }
    assert.deepEqual(delays, [100, 300, 200], "the last frame holds for the average gap");
  });
});
