#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const defaultOutDir = resolve(repoRoot, "design-runs/game-assets-20260520/external/vrma/tk256ailab");
const repo = "tk256ailab/vrm-viewer";
const branch = "main";
const licenseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/LICENSE`;

function parseArgs(argv) {
  const args = {
    sample: "LookAround",
    outDir: defaultOutDir,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--sample") args.sample = stripVrma(required(argv, ++i, arg));
    else if (arg === "--out-dir") args.outDir = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/fetch-external-vrma-sample.mjs [options]

Options:
  --sample <name>     VRMA sample name from tk256ailab/vrm-viewer (default: LookAround)
  --out-dir <path>    Download directory (default: design-runs/.../external/vrma/tk256ailab)
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function stripVrma(value) {
  return value.replace(/\.vrma$/i, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const vrmaUrl = `https://raw.githubusercontent.com/${repo}/${branch}/VRMA/${encodeURIComponent(args.sample)}.vrma`;
  await mkdir(args.outDir, { recursive: true });
  const vrmaPath = join(args.outDir, `${args.sample}.vrma`);
  const licensePath = join(args.outDir, "LICENSE");
  const sourcePath = join(args.outDir, `${args.sample}.source.json`);

  const [vrma, license] = await Promise.all([
    download(vrmaUrl, "application/octet-stream"),
    download(licenseUrl, "text/plain"),
  ]);
  await writeFile(vrmaPath, Buffer.from(await vrma.arrayBuffer()));
  await writeFile(licensePath, await license.text());
  await writeFile(sourcePath, `${JSON.stringify({
    sample: args.sample,
    sourceRepository: `https://github.com/${repo}`,
    sourcePath: `VRMA/${args.sample}.vrma`,
    sourceUrl: vrmaUrl,
    licenseUrl,
    localPath: relative(repoRoot, vrmaPath),
  }, null, 2)}\n`);
  console.log(`Wrote ${relative(repoRoot, vrmaPath)}`);
  console.log(`Wrote ${relative(repoRoot, sourcePath)}`);
}

async function download(url, accept) {
  const response = await fetch(url, { headers: { accept } });
  if (!response.ok) throw new Error(`download failed ${response.status} ${response.statusText}: ${url}`);
  return response;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
