/**
 * Every fixture has its committed sample outputs, and the samples README lists
 * them. The pixels are not compared (font rasterisation differs by machine);
 * a missing file is the reminder to run `pnpm anim:samples` after adding a
 * fixture or changing a compiler.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "vitest";

const PKG = resolve(import.meta.dirname!, "..");
const FIXTURES = join(PKG, "fixtures");
const SAMPLES = join(PKG, "samples");
const sampleName = (f: string) => f.replace(/\.scene\.(m?ts|m?js)$/, "").replace(/\.json$/, "");
const fixtures = readdirSync(FIXTURES).filter((f) => /\.json$|\.scene\.(m?ts|m?js)$/.test(f)).sort();

describe("packages/vlmkit-anim/samples", () => {
  it("holds a GIF and a contact sheet for every fixture, each a real image", () => {
    const missing: string[] = [];
    for (const f of fixtures) {
      for (const out of [`${sampleName(f)}.gif`, `${sampleName(f)}.sheet.png`]) {
        const p = join(SAMPLES, out);
        if (!existsSync(p) || statSync(p).size < 1024) missing.push(out);
      }
    }
    assert.deepEqual(missing, [], `run \`pnpm anim:samples\` — missing or empty: ${missing.join(", ")}`);
    for (const f of fixtures) {
      const gif = readFileSync(join(SAMPLES, `${sampleName(f)}.gif`));
      assert.equal(gif.subarray(0, 6).toString("latin1"), "GIF89a", `${f}: not a GIF`);
      const png = readFileSync(join(SAMPLES, `${sampleName(f)}.sheet.png`));
      assert.equal(png.readUInt32BE(0), 0x89504e47, `${f}: not a PNG`);
    }
  });

  it("README.md embeds each sample and nothing that no longer exists", () => {
    const md = readFileSync(join(SAMPLES, "README.md"), "utf-8");
    for (const f of fixtures) {
      assert.match(md, new RegExp(`^## ${sampleName(f)}$`, "m"), `${f} has no section`);
      assert.ok(md.includes(`](./${sampleName(f)}.gif)`), `${f}: GIF not embedded`);
      assert.ok(md.includes(`](./${sampleName(f)}.sheet.png)`), `${f}: sheet not embedded`);
    }
    const embedded = [...md.matchAll(/\]\(\.\/([^)]+)\)/g)].map((m) => m[1]);
    const stale = embedded.filter((file) => !existsSync(join(SAMPLES, file)));
    assert.deepEqual(stale, [], "README references files that are not in samples/");
    const orphans = readdirSync(SAMPLES).filter((file) => file !== "README.md" && !embedded.includes(file));
    assert.deepEqual(orphans, [], "samples/ holds files the README does not show — a renamed fixture left its old outputs behind");
  });
});
