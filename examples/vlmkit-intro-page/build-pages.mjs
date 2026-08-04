import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const exampleDir = dirname(scriptPath);

export const pageAssets = Object.freeze([
  "app.js",
  "content.js",
  "index.html",
  "preferences.js",
  "proof-diff.png",
  "proof-implementation.png",
  "proof-target.png",
  "scenarios.js",
  "styles.css",
]);

export async function buildPages({
  sourceDir = exampleDir,
  outputDir = join(exampleDir, ".pages"),
} = {}) {
  const resolvedSourceDir = resolve(sourceDir);
  const resolvedOutputDir = resolve(outputDir);

  if (basename(resolvedOutputDir) !== ".pages" || resolvedOutputDir === resolvedSourceDir) {
    throw new Error('Pages output must be an isolated directory named ".pages".');
  }

  await rm(resolvedOutputDir, { recursive: true, force: true });
  await mkdir(resolvedOutputDir, { recursive: true });
  await Promise.all(
    pageAssets.map((asset) =>
      copyFile(join(resolvedSourceDir, asset), join(resolvedOutputDir, asset)),
    ),
  );
  await writeFile(join(resolvedOutputDir, ".nojekyll"), "", "utf8");

  return { assets: [...pageAssets], outputDir: resolvedOutputDir };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const result = await buildPages();
  console.log(`GitHub Pages artifact: ${result.outputDir}`);
}
