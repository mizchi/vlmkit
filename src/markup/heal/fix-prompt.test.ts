import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractSnapshotFixTasks,
  formatSnapshotFixPromptJson,
  formatSnapshotFixPromptMarkdown,
  type SnapshotReport,
} from "./fix-prompt.ts";

function sampleReport(outputDir: string): SnapshotReport {
  return {
    timestamp: "2026-05-11T00:00:00Z",
    results: [
      {
        url: "http://localhost:3000/",
        label: "home",
        viewport: "desktop",
        screenshotPath: join(outputDir, "home-desktop-current.png"),
        baselinePath: join(outputDir, "home-desktop-baseline.png"),
        diffRatio: 0.05,
        compensatedDiffRatio: 0.03,
        globalShift: 4,
        shiftOnly: false,
        isNew: false,
      },
      {
        url: "http://localhost:3000/about",
        label: "about",
        viewport: "mobile",
        screenshotPath: join(outputDir, "about-mobile-current.png"),
        baselinePath: join(outputDir, "about-mobile-baseline.png"),
        diffRatio: 0.12,
        compensatedDiffRatio: 0.11,
        globalShift: 0,
        shiftOnly: false,
        isNew: false,
      },
      {
        url: "http://localhost:3000/clean",
        label: "clean",
        viewport: "desktop",
        screenshotPath: join(outputDir, "clean-desktop-current.png"),
        baselinePath: join(outputDir, "clean-desktop-baseline.png"),
        diffRatio: 0,
        isNew: false,
      },
      {
        url: "http://localhost:3000/new",
        label: "new",
        viewport: "desktop",
        screenshotPath: join(outputDir, "new-desktop-current.png"),
        isNew: true,
      },
    ],
  };
}

describe("extractSnapshotFixTasks", () => {
  it("keeps only non-new, above-threshold entries and sorts by diff desc", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-fix-prompt-"));
    try {
      const tasks = extractSnapshotFixTasks(sampleReport(dir), { outputDir: dir });
      assert.equal(tasks.length, 2);
      assert.equal(tasks[0]!.label, "about"); // 0.12 > 0.05
      assert.equal(tasks[1]!.label, "home");
      assert.equal(tasks[0]!.paths.baseline, join(dir, "about-mobile-baseline.png"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("filters by label", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-fix-prompt-"));
    try {
      const tasks = extractSnapshotFixTasks(sampleReport(dir), {
        outputDir: dir,
        labels: ["home"],
      });
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0]!.label, "home");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("applies minDiffRatio threshold", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-fix-prompt-"));
    try {
      const tasks = extractSnapshotFixTasks(sampleReport(dir), {
        outputDir: dir,
        minDiffRatio: 0.1,
      });
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0]!.label, "about");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("includes heatmap path only when the file exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-fix-prompt-"));
    try {
      await writeFile(join(dir, "home-desktop_heatmap.png"), "fake");
      await writeFile(join(dir, "home.html"), "<html></html>");
      const tasks = extractSnapshotFixTasks(sampleReport(dir), { outputDir: dir });
      const home = tasks.find((t) => t.label === "home")!;
      assert.equal(home.paths.heatmap, join(dir, "home-desktop_heatmap.png"));
      assert.equal(home.paths.html, join(dir, "home.html"));

      const about = tasks.find((t) => t.label === "about")!;
      assert.equal(about.paths.heatmap, undefined);
      assert.equal(about.paths.html, undefined);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("formatSnapshotFixPromptMarkdown", () => {
  it("renders task sections with relative paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-fix-prompt-"));
    try {
      const tasks = extractSnapshotFixTasks(sampleReport(dir), { outputDir: dir });
      const md = formatSnapshotFixPromptMarkdown(tasks, { relativeTo: dir });

      assert.match(md, /# VRT Snapshot Fix Tasks/);
      assert.match(md, /## 1\. about — mobile \(12\.00%\)/);
      assert.match(md, /## 2\. home — desktop \(5\.00%\)/);
      assert.match(md, /Baseline: `about-mobile-baseline\.png`/);
      assert.match(md, /Global shift: \+4px/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("notes when there is nothing to fix", () => {
    const md = formatSnapshotFixPromptMarkdown([]);
    assert.match(md, /No diffs above the configured threshold/);
  });

  it("respects the limit option", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-fix-prompt-"));
    try {
      const tasks = extractSnapshotFixTasks(sampleReport(dir), { outputDir: dir });
      const md = formatSnapshotFixPromptMarkdown(tasks, { relativeTo: dir, limit: 1 });
      assert.match(md, /showing top 1 by diff ratio/);
      assert.match(md, /## 1\. about/);
      assert.doesNotMatch(md, /## 2\. /);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("formatSnapshotFixPromptJson", () => {
  it("produces parseable JSON with a tasks array", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vrt-fix-prompt-"));
    try {
      const tasks = extractSnapshotFixTasks(sampleReport(dir), { outputDir: dir });
      const parsed = JSON.parse(formatSnapshotFixPromptJson(tasks));
      assert.ok(Array.isArray(parsed.tasks));
      assert.equal(parsed.tasks.length, 2);
      assert.equal(parsed.tasks[0].label, "about");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
