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
    vrmSample: "sample",
    includeVrm: false,
    outDir: defaultOutDir,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--sample") args.sample = stripVrma(required(argv, ++i, arg));
    else if (arg === "--vrm-sample") args.vrmSample = stripVrm(required(argv, ++i, arg));
    else if (arg === "--include-vrm") args.includeVrm = true;
    else if (arg === "--out-dir") args.outDir = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/fetch-external-vrma-sample.mjs [options]

Options:
  --sample <name>     VRMA sample name from tk256ailab/vrm-viewer (default: LookAround)
  --include-vrm       Also download the matching sample VRM from VRM/sample.vrm
  --vrm-sample <name> VRM sample name from tk256ailab/vrm-viewer (default: sample)
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

function stripVrm(value) {
  return value.replace(/\.vrm$/i, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const vrmaUrl = `https://raw.githubusercontent.com/${repo}/${branch}/VRMA/${encodeURIComponent(args.sample)}.vrma`;
  const vrmUrl = `https://raw.githubusercontent.com/${repo}/${branch}/VRM/${encodeURIComponent(args.vrmSample)}.vrm`;
  await mkdir(args.outDir, { recursive: true });
  const vrmaPath = join(args.outDir, `${args.sample}.vrma`);
  const vrmPath = join(args.outDir, `${args.vrmSample}.vrm`);
  const licensePath = join(args.outDir, "LICENSE");
  const sourcePath = join(args.outDir, `${args.sample}.source.json`);

  const [vrma, license, vrm] = await Promise.all([
    download(vrmaUrl, "application/octet-stream"),
    download(licenseUrl, "text/plain"),
    args.includeVrm ? download(vrmUrl, "application/octet-stream") : Promise.resolve(null),
  ]);
  await writeFile(vrmaPath, Buffer.from(await vrma.arrayBuffer()));
  if (vrm) await writeFile(vrmPath, Buffer.from(await vrm.arrayBuffer()));
  await writeFile(licensePath, await license.text());
  await writeFile(sourcePath, `${JSON.stringify({
    sample: args.sample,
    vrmSample: args.includeVrm ? args.vrmSample : null,
    sourceRepository: `https://github.com/${repo}`,
    sourcePath: `VRMA/${args.sample}.vrma`,
    sourceUrl: vrmaUrl,
    vrmSourcePath: args.includeVrm ? `VRM/${args.vrmSample}.vrm` : null,
    vrmSourceUrl: args.includeVrm ? vrmUrl : null,
    licenseUrl,
    localPath: relative(repoRoot, vrmaPath),
    vrmLocalPath: args.includeVrm ? relative(repoRoot, vrmPath) : null,
  }, null, 2)}\n`);
  console.log(`Wrote ${relative(repoRoot, vrmaPath)}`);
  if (vrm) console.log(`Wrote ${relative(repoRoot, vrmPath)}`);
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
