import { execSync } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { extractDiffSemantics } from "@mizchi/vlmkit-ai/intent.ts";
import { diffA11yTrees, parsePlaywrightA11ySnapshot } from "@mizchi/vlmkit-core/a11y-semantic.ts";
import { introspect, introspectToSpec, verifySpec } from "@mizchi/vlmkit-markup/inspect/introspect.ts";
import type { UiSpec, A11yNode } from "@mizchi/vlmkit-core/types.ts";

export interface SpecPaths {
  projectRoot: string;
  baselinesDir: string;
  snapshotsDir: string;
  specPath: string;
  expectationPath: string;
}

async function listFiles(dir: string, suffix: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith(suffix));
  } catch {
    return [];
  }
}

export async function runIntrospect(paths: SpecPaths) {
  const dir = existsSync(paths.snapshotsDir) ? paths.snapshotsDir : paths.baselinesDir;
  if (!existsSync(dir)) {
    console.error("No snapshots or baselines found. Run `vrt workflow init` or `vrt workflow capture` first.");
    process.exit(1);
  }

  console.log(`=== Introspect: ${dir} ===\n`);
  const result = await introspect(dir);

  for (const page of result.pages) {
    console.log(`## ${page.testId}`);
    console.log(`  ${page.description}`);
    console.log(`  Landmarks: ${page.landmarks.map((l) => `${l.role}(${l.name || "-"})`).join(", ") || "none"}`);
    console.log(`  Interactive: ${page.stats.interactiveCount} (${page.stats.unlabeledCount} unlabeled)`);
    console.log(`  Invariants: ${page.suggestedInvariants.length}`);
    console.log();
  }

  const spec = introspectToSpec(result);
  await writeFile(paths.specPath, JSON.stringify(spec, null, 2));
  console.log(`Spec written to: ${paths.specPath}`);
  console.log(`${spec.pages.length} page(s), ${spec.pages.reduce((s, p) => s + p.invariants.length, 0)} invariants`);
}

export async function runSpecVerify(paths: SpecPaths) {
  if (!existsSync(paths.specPath)) {
    console.error("No spec.json found. Run `vrt workflow introspect` first.");
    process.exit(1);
  }

  const dir = existsSync(paths.snapshotsDir) ? paths.snapshotsDir : paths.baselinesDir;
  if (!existsSync(dir)) {
    console.error("No snapshots or baselines found.");
    process.exit(1);
  }

  console.log("=== Spec Verify ===\n");
  const spec: UiSpec = JSON.parse(await readFile(paths.specPath, "utf-8"));
  console.log(`Spec: "${spec.description}"`);
  console.log(`${spec.pages.length} page(s), ${spec.global?.length ?? 0} global invariant(s)\n`);

  const pageData = new Map<string, { a11yTree?: A11yNode; screenshotExists: boolean }>();
  const a11yFiles = await listFiles(dir, ".a11y.json");
  for (const file of a11yFiles) {
    const testId = file.replace(/\.a11y\.json$/, "");
    try {
      const tree = JSON.parse(await readFile(join(dir, file), "utf-8"));
      const png = join(dir, `${testId}.png`);
      pageData.set(testId, { a11yTree: tree, screenshotExists: existsSync(png) });
    } catch {
      // skip
    }
  }

  let changedFiles: string[] | undefined;
  try {
    const diff = execSync("git diff --name-only HEAD", { cwd: paths.projectRoot, encoding: "utf-8" });
    changedFiles = diff.trim().split("\n").filter(Boolean);
  } catch {
    // no git
  }

  const result = verifySpec(spec, pageData, changedFiles);

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const page of result.results) {
    const passed = page.checked.filter((c) => c.passed).length;
    const failed = page.checked.filter((c) => !c.passed).length;
    totalPassed += passed;
    totalFailed += failed;
    totalSkipped += page.skipped.length;

    const icon = failed === 0 ? "OK" : "NG";
    console.log(`[${icon}] ${page.testId}: ${passed} passed, ${failed} failed, ${page.skipped.length} skipped`);

    for (const c of page.checked.filter((c) => !c.passed)) {
      console.log(`  FAIL: ${c.invariant.description} — ${c.reasoning}`);
    }
    for (const s of page.skipped) {
      console.log(`  SKIP: ${s.invariant.description} — ${s.reason}`);
    }
  }

  console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

export async function runExpect(paths: SpecPaths) {
  console.log("=== Generate expectation.json from current state ===\n");

  if (!existsSync(paths.baselinesDir)) {
    console.error("No baselines found. Run `vrt workflow init` first.");
    process.exit(1);
  }
  if (!existsSync(paths.snapshotsDir)) {
    console.error("No snapshots found. Run `vrt workflow capture` first.");
    process.exit(1);
  }

  // 1. Infer intent from git diff
  let intentSummary = "unknown change";
  let changeType: string = "unknown";
  try {
    const semantics = await extractDiffSemantics(paths.projectRoot);
    intentSummary = semantics.intent.summary;
    changeType = semantics.intent.changeType;
    console.log(`Intent: ${intentSummary} (${changeType})`);
  } catch {
    console.log("(no git diff available)");
  }

  // 2. Compute a11y diff between baseline and snapshot
  const baseA11yFiles = await listFiles(paths.baselinesDir, ".a11y.json");
  const pages: Array<{
    testId: string;
    hasA11yDiff: boolean;
    hasRegression: boolean;
    changes: Array<{ type: string; description: string }>;
  }> = [];

  for (const file of baseA11yFiles) {
    const testId = file.replace(/\.a11y\.json$/, "");
    const snapFile = join(paths.snapshotsDir, file);
    if (!existsSync(snapFile)) continue;

    try {
      const baseRaw = JSON.parse(await readFile(join(paths.baselinesDir, file), "utf-8"));
      const snapRaw = JSON.parse(await readFile(snapFile, "utf-8"));
      if (!baseRaw || !snapRaw) continue;

      const baseSnap = parsePlaywrightA11ySnapshot(testId, testId, baseRaw);
      const snapSnap = parsePlaywrightA11ySnapshot(testId, testId, snapRaw);
      const diff = diffA11yTrees(baseSnap, snapSnap);

      pages.push({
        testId,
        hasA11yDiff: diff.changes.length > 0,
        hasRegression: diff.hasRegression,
        changes: diff.changes.map((c) => ({ type: c.type, description: c.description })),
      });
    } catch {
      pages.push({ testId, hasA11yDiff: false, hasRegression: false, changes: [] });
    }
  }

  // 3. Build expectation.json
  const expectation: Record<string, unknown> = {
    description: intentSummary,
    intent: {
      summary: intentSummary,
      changeType,
    },
    pages: pages.map((p) => {
      if (!p.hasA11yDiff) {
        return { testId: p.testId, expect: "No changes" };
      }

      const expect = p.hasRegression
        ? `A11y regression expected: ${p.changes.map((c) => c.description).join("; ")}`
        : `A11y changes: ${p.changes.map((c) => c.description).join("; ")}`;

      const a11y = p.hasRegression ? "regression-expected" : "changed";

      return {
        testId: p.testId,
        expect,
        a11y,
        expectedA11yChanges: p.changes.map((c) => ({ description: c.description })),
      };
    }),
  };

  await writeFile(paths.expectationPath, JSON.stringify(expectation, null, 2));

  console.log(`\nGenerated ${paths.expectationPath}:`);
  for (const p of pages) {
    const icon = !p.hasA11yDiff ? "  " : p.hasRegression ? "!!" : "~~";
    console.log(`  [${icon}] ${p.testId}: ${p.changes.length} change(s)`);
  }
  console.log(`\nReview and edit as needed, then run: vrt workflow verify`);
}
