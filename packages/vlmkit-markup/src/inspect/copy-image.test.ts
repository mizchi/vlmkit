/**
 * Element-rect `check copy` (vlmkit#118).
 *
 * `analyzeCopy` is reused unchanged, so what needs testing is the **adapter**: does element
 * text reach it split into the right three pools (visible / raw / invisible-with-reason), and
 * does the truncation pass fire where a canvas actually cuts a string off?
 *
 * Every fixture below is deliberately broken in one specific way — a manifest line the
 * renderer never draws, an untranslated source string where the manifest wants the localized
 * one, a `TODO` shipped, a number wider than its clip, a label the frame never painted — and
 * each is paired with the inverse fixture that must report nothing. A gate that finds nothing
 * on a clean frame has only proved that it is quiet; the failures are what give the passes
 * their meaning.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PNG } from "pngjs";
import { COPY_IMAGE_SKIPPED_RULES, runImageCopyCheck } from "./copy-image.ts";
import { formatCopyCheckReport } from "./copy-check.ts";

async function dir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vlmkit-copy-image-"));
}

async function fixture(
  elements: unknown[],
  manifest?: string,
): Promise<{ elementsPath: string; manifestPath?: string; dir: string }> {
  const base = await dir();
  const elementsPath = join(base, "elements.json");
  await writeFile(elementsPath, JSON.stringify({ elements }));
  if (manifest === undefined) return { elementsPath, dir: base };
  const manifestPath = join(base, "copy.txt");
  await writeFile(manifestPath, manifest);
  return { elementsPath, manifestPath, dir: base };
}

const ROOT = { path: "hud[0]", tag: "hud", classes: "hud-root", top: 0, left: 0, width: 640, height: 360 };

const kinds = (report: { issues: { kind: string }[] }) => report.issues.map((i) => i.kind);

/**
 * A frame filled with one flat colour, with `painted` boxes given per-pixel noise.
 *
 * Noise rather than a second flat colour: `inkVerdict` asks whether the region varies at all,
 * so a solid rectangle of a different colour is still "unpainted" — correctly, since a solid
 * fill contains no glyphs.
 */
async function frame(
  base: string,
  painted: { top: number; left: number; width: number; height: number }[],
): Promise<string> {
  const png = new PNG({ width: 640, height: 360 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0x20;
    png.data[i + 1] = 0x20;
    png.data[i + 2] = 0x20;
    png.data[i + 3] = 0xff;
  }
  for (const box of painted) {
    for (let y = box.top; y < box.top + box.height; y++) {
      for (let x = box.left; x < box.left + box.width; x++) {
        const offset = (y * png.width + x) * 4;
        const value = (x * 7 + y * 13) % 256;
        png.data[offset] = value;
        png.data[offset + 1] = value;
        png.data[offset + 2] = value;
      }
    }
  }
  const path = join(base, "frame.png");
  await writeFile(path, PNG.sync.write(png));
  return path;
}

describe("manifest lines against renderer text", () => {
  it("reports a manifest line the renderer never draws", async () => {
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20, text: "HP 120/120" },
      { path: "hud[0]>a[1]", tag: "label", classes: "start", top: 200, left: 16, width: 200, height: 24, text: "Start Game" },
    ], "HP 120/120\nStart Game\nOptions\n");
    const report = await runImageCopyCheck({ elementsPath, manifestPath: manifestPath! });
    assert.deepEqual(report.missingLines, ["Options"]);
    assert.ok(kinds(report).includes("copy-missing"), kinds(report).join(", "));
  });

  it("reports nothing when every line is drawn", async () => {
    // The inverse of the case above, same fixture minus the one absent line.
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20, text: "HP 120/120" },
      { path: "hud[0]>a[1]", tag: "label", classes: "start", top: 200, left: 16, width: 200, height: 24, text: "Start Game" },
    ], "HP 120/120\nStart Game\n");
    const report = await runImageCopyCheck({ elementsPath, manifestPath: manifestPath! });
    assert.deepEqual(report.issues, []);
    assert.equal(report.manifestLines, 2);
    assert.equal(report.textElements, 2);
  });

  it("catches an untranslated string shipped in place of the localized one", async () => {
    // The engine drew the source-language fallback. Casing and spelling are spec in copy, so
    // the manifest's localized line simply is not there.
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "start", top: 200, left: 16, width: 200, height: 24, text: "Start Game" },
    ], "はじめる\n");
    const report = await runImageCopyCheck({ elementsPath, manifestPath: manifestPath! });
    assert.deepEqual(report.missingLines, ["はじめる"]);
    assert.match(report.issues[0]!.message, /はじめる/);
  });

  it("matches a line spanning two adjacent strings in reading order", async () => {
    // The DOM path lets one manifest line span several text nodes; element rects have no
    // document order, so the adapter sorts by (top, left). Out of that order this fails.
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      { path: "hud[0]>b[0]", tag: "label", classes: "score-value", top: 16, left: 120, width: 80, height: 20, text: "1200" },
      { path: "hud[0]>a[0]", tag: "label", classes: "score-label", top: 16, left: 16, width: 100, height: 20, text: "Score:" },
    ], "Score: 1200\n");
    const report = await runImageCopyCheck({ elementsPath, manifestPath: manifestPath! });
    assert.deepEqual(report.missingLines, []);
  });
});

describe("placeholder copy", () => {
  it("reports a TODO shipped in a drawn string", async () => {
    const { elementsPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "title", top: 40, left: 16, width: 300, height: 32, text: "TODO title" },
    ]);
    const report = await runImageCopyCheck({ elementsPath });
    assert.deepEqual(report.placeholders, ["TODO"]);
    assert.ok(kinds(report).includes("placeholder-text"));
  });

  it("stays quiet on real copy", async () => {
    const { elementsPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "title", top: 40, left: 16, width: 300, height: 32, text: "Chapter 3: The Ashfall" },
    ]);
    const report = await runImageCopyCheck({ elementsPath });
    assert.deepEqual(report.placeholders, []);
    assert.deepEqual(report.issues, []);
  });
});

describe("truncation", () => {
  it("reports the px actually cut, and names the manifest line it only appears to satisfy", async () => {
    // The reported pain in #118: a number outgrew its box. Matching the manifest against the
    // renderer's `text` alone would call this satisfied — the user reads a cut-off string.
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      {
        path: "hud[0]>a[0]", tag: "label", classes: "score", top: 16, left: 16, width: 200, height: 20,
        text: "Score: 1234567890",
        text_measured: { width: 320, height: 18 },
        clip: { top: 16, left: 16, width: 200, height: 20 },
      },
    ], "Score: 1234567890\n");
    const report = await runImageCopyCheck({ elementsPath, manifestPath: manifestPath! });
    assert.deepEqual(report.missingLines, [], "the string IS drawn; it is only unreadable");
    const issue = report.issues.find((i) => i.kind === "copy-truncated");
    assert.ok(issue, kinds(report).join(", "));
    // 320 measured - 200 clip = 120. Not 16 (the `left`), the mistake image-mode integrity made.
    assert.match(issue!.message, /120px horizontally/);
    assert.match(issue!.message, /"Score: 1234567890" on paper/);
    assert.deepEqual(report.truncated.map((t) => t.selector), [".score"]);
  });

  it("does not report text that fits its clip", async () => {
    const { elementsPath } = await fixture([
      ROOT,
      {
        path: "hud[0]>a[0]", tag: "label", classes: "score", top: 16, left: 16, width: 200, height: 20,
        text: "Score: 1200",
        text_measured: { width: 90, height: 18 },
        clip: { top: 16, left: 16, width: 200, height: 20 },
      },
    ]);
    const report = await runImageCopyCheck({ elementsPath });
    assert.deepEqual(report.truncated, []);
    assert.deepEqual(kinds(report), []);
  });

  it("does not call oversized text without a clip rect truncated", async () => {
    // On a canvas that overdraws its neighbours — a collision, not a cut-off string. Calling
    // it "cut off" would send the reader after the wrong repair.
    const { elementsPath } = await fixture([
      ROOT,
      {
        path: "hud[0]>a[0]", tag: "label", classes: "score", top: 16, left: 16, width: 200, height: 20,
        text: "Score: 1234567890",
        text_measured: { width: 320, height: 18 },
      },
    ]);
    const report = await runImageCopyCheck({ elementsPath });
    assert.deepEqual(report.truncated, []);
    assert.ok(
      report.inertRules.some((r) => r.rule === "copy-truncated" && /overdraws/.test(r.reason)),
      JSON.stringify(report.inertRules),
    );
  });
});

describe("text the renderer reports but the user cannot see", () => {
  it("calls a manifest line in a zero-area box invisible, not missing", async () => {
    // "Missing" would send the reader to write the string that is already there. The two
    // repairs are different, which is the whole point of the reason classes.
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "toast", top: 100, left: 16, width: 0, height: 0, text: "Saved" },
    ], "Saved\n");
    const report = await runImageCopyCheck({ elementsPath, manifestPath: manifestPath! });
    assert.deepEqual(report.missingLines, []);
    assert.deepEqual(report.invisibleLines, [{ line: "Saved", reason: "zero-size" }]);
    assert.ok(/--allow-invisible zero-size/.test(report.issues[0]!.message));
  });

  it("accepts a zero-size match when the caller allows that class", async () => {
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "toast", top: 100, left: 16, width: 0, height: 0, text: "Saved" },
    ], "Saved\n");
    const report = await runImageCopyCheck({
      elementsPath,
      manifestPath: manifestPath!,
      allowInvisible: ["zero-size"],
    });
    assert.deepEqual(report.issues, []);
    assert.deepEqual(report.allowedInvisibleLines, [{ line: "Saved", reason: "zero-size" }]);
  });

  it("reports a string the frame never painted", async () => {
    // Missing font / alpha 0 / skipped draw call: the renderer is sure it drew "Start Game",
    // and the frame's bbox is flat background. Without --image this passes silently, which is
    // exactly what makes the ink check worth its pixels.
    const base = await dir();
    const elementsPath = join(base, "elements.json");
    await writeFile(elementsPath, JSON.stringify({
      elements: [
        ROOT,
        { path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20, text: "HP 120/120" },
        { path: "hud[0]>a[1]", tag: "label", classes: "start", top: 200, left: 16, width: 200, height: 24, text: "Start Game" },
      ],
    }));
    const manifestPath = join(base, "copy.txt");
    await writeFile(manifestPath, "HP 120/120\nStart Game\n");
    // Only the HP label's bbox got ink; ROOT carries no text, so it is not ink-checked.
    const imagePath = await frame(base, [{ top: 16, left: 16, width: 200, height: 20 }]);

    const withImage = await runImageCopyCheck({ elementsPath, imagePath, manifestPath });
    assert.deepEqual(withImage.invisibleLines, [{ line: "Start Game", reason: "unpainted" }]);
    assert.ok(kinds(withImage).includes("copy-invisible"), kinds(withImage).join(", "));

    // And the same elements without the frame report nothing — the difference the flag buys.
    const withoutImage = await runImageCopyCheck({ elementsPath, manifestPath });
    assert.deepEqual(withoutImage.issues, []);
    assert.ok(withoutImage.coverageNotes.some((n) => /No --image/.test(n)));
  });

  it("does not report a bbox that carries ink", async () => {
    const base = await dir();
    const elementsPath = join(base, "elements.json");
    await writeFile(elementsPath, JSON.stringify({
      elements: [
        ROOT,
        { path: "hud[0]>a[0]", tag: "label", classes: "start", top: 200, left: 16, width: 200, height: 24, text: "Start Game" },
      ],
    }));
    const manifestPath = join(base, "copy.txt");
    await writeFile(manifestPath, "Start Game\n");
    const imagePath = await frame(base, [{ top: 200, left: 16, width: 200, height: 24 }]);
    const report = await runImageCopyCheck({ elementsPath, imagePath, manifestPath });
    assert.deepEqual(report.issues, []);
    assert.ok(report.coverageNotes.some((n) => /Ink checked in 1 text bbox/.test(n)), report.coverageNotes.join(" | "));
  });

  it("counts off-frame elements instead of guessing why they are off-frame", async () => {
    // Element rects carry no scroll or clip chain, so "never drawn" and "scrolled out of this
    // frame" are indistinguishable. Reporting either would be a guess; the count is not.
    const base = await dir();
    const elementsPath = join(base, "elements.json");
    await writeFile(elementsPath, JSON.stringify({
      elements: [
        ROOT,
        { path: "hud[0]>a[0]", tag: "row", classes: "row-9", top: 900, left: 16, width: 200, height: 24, text: "Row 9" },
      ],
    }));
    const imagePath = await frame(base, []);
    const report = await runImageCopyCheck({ elementsPath, imagePath });
    assert.deepEqual(kinds(report), []);
    assert.ok(
      report.coverageNotes.some((n) => /1 text element\(s\) lie outside the frame/.test(n)),
      report.coverageNotes.join(" | "),
    );
  });
});

describe("coverage is reported, not implied", () => {
  it("names every rule it cannot evaluate, with a reason", async () => {
    const { elementsPath } = await fixture([ROOT]);
    const report = await runImageCopyCheck({ elementsPath });
    assert.equal(report.skippedRules.length, COPY_IMAGE_SKIPPED_RULES.length);
    assert.ok(report.skippedRules.every((r) => r.reason.length > 10), JSON.stringify(report.skippedRules));
    for (const needsPage of ["redirected", "copy-image-mismatch"]) {
      assert.ok(report.skippedRules.some((r) => r.rule === needsPage), `${needsPage} must be listed`);
    }
    // The partial rule matters as much as the absent ones: copy-invisible running over 2 of
    // its 7 reason classes is not the same gate as copy-invisible running over all 7.
    assert.ok(report.coverageNotes.some((n) => /copy-invisible covers 2 of its 7/.test(n)));
    assert.ok(report.inertRules.some((r) => r.rule === "copy-missing" && /no --manifest/.test(r.reason)));
  });

  it("prints the coverage block next to a clean verdict, not in a footnote", async () => {
    // The one way this feature could do harm is a clean line reading as full coverage.
    const { elementsPath, manifestPath } = await fixture([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20, text: "HP 120/120" },
    ], "HP 120/120\n");
    const text = formatCopyCheckReport(await runImageCopyCheck({ elementsPath, manifestPath: manifestPath! }));
    assert.match(text, /No copy issues detected/);
    assert.match(text, /Coverage: element-rect mode — 2 rule\(s\) cannot be evaluated without a DOM/);
    assert.match(text, /- redirected: needs a navigation result/);
    assert.match(text, /elements: 2 \(1 carrying text\)/);
  });
});

describe("parsing is the shared one", () => {
  it("throws on a row missing geometry rather than dropping it", async () => {
    // Delegated to `parseIntegrityImageElements`. Asserted here because the consequence in
    // this gate is specific: a dropped row makes its copy read as missing, so a typo in the
    // elements file would look like a copy bug in the game.
    const { elementsPath } = await fixture([{ path: "a[0]", tag: "a", top: 0, left: 0, text: "hi" }]);
    await assert.rejects(
      () => runImageCopyCheck({ elementsPath }),
      /needs path\/top\/left\/width\/height/,
    );
  });
});
