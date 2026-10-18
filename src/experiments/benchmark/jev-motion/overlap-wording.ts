#!/usr/bin/env node
/**
 * The narrower overlap wording `jev-motion` chose, checked on screenshots it was not chosen on:
 * the claims round's 54 (`jev-box.ts --only claims` writes them to test-results/jev-claims/claims/;
 * 9 fixtures, each clean and with five plants, one of them overlapping text). Both wordings are
 * asked in one request per screenshot. TYPESAFEAI_API_KEY, ~$0.007.
 *
 *   node --experimental-strip-types src/experiments/benchmark/jev-motion/overlap-wording.ts [--dir …] [--out …json]
 */
import { getArg } from "@mizchi/vlmkit-core/cli-args.ts";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { checkClaims } from "@mizchi/vlmkit-ai/claims.ts";
const A = "text overlapping other text so that it is hard to read";
const B = "two lines of text printed on top of each other, their letters crossing";
const dir = getArg("--dir") ?? "test-results/jev-claims/claims";
const files = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();
const rows: { file: string; a: number; b: number }[] = [];
await Promise.all(
  files.map(async (f, i) => {
    await new Promise((r) => setTimeout(r, i * 60));
    const r = await checkClaims(await readFile(`${dir}/${f}`), [
      { statement: A, expect: "absent" },
      { statement: B, expect: "absent" },
    ]);
    rows.push({ file: f, a: r.results[0]!.noul, b: r.results[1]!.noul });
  }),
);
rows.sort((x, y) => x.file.localeCompare(y.file));
await writeFile(getArg("--out") ?? "test-results/jev-motion/overlap-wording.json", JSON.stringify(rows, null, 1));
for (const k of ["a", "b"] as const) {
  const pos = rows.filter((r) => r.file.endsWith("-overlap.png"));
  const neg = rows.filter((r) => !r.file.endsWith("-overlap.png"));
  const negClean = neg.filter((r) => r.file.endsWith("-none.png"));
  console.log(
    k,
    "caught",
    pos.filter((r) => r[k] >= 0.5).length,
    "/",
    pos.length,
    "clean FA",
    negClean.filter((r) => r[k] >= 0.5).length,
    "/",
    negClean.length,
    "other-plant FA",
    neg.filter((r) => !r.file.endsWith("-none.png") && r[k] >= 0.5).length,
    "/",
    neg.length - negClean.length,
  );
}
