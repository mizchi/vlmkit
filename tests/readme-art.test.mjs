/**
 * The generated art (`scripts/readme-art.mjs`) against its manifest, its lock and the pages that
 * show it. No network and no image model: what can drift without them is checked here.
 *
 * - every icon and the hero exist, as webp, and nothing unlisted sits in the icon directory;
 * - the lock names each one with the hash of the prompt it was made from, so editing a prompt
 *   fails until the art is generated again (the file would otherwise picture a sentence that
 *   is no longer in the repository);
 * - every icon is used, and every icon a README or the demo gallery names is one of them.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { GROUPS } from "../examples/demos/demos.mjs";
import { HERO, HERO_FILE, ICON_DIR, ICONS, LOCK_FILE, artHash, iconFile } from "../scripts/readme-art.manifest.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(repoRoot, p));
const isWebp = (buf) => buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";

const READMES = ["README.md", ...readdirSync(join(repoRoot, "examples"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(repoRoot, "examples", d.name, "README.md")))
  .map((d) => `examples/${d.name}/README.md`)];

test("every icon and the hero exist as webp, and the icon directory holds nothing else", () => {
  for (const icon of ICONS) assert.ok(isWebp(read(iconFile(icon.id))), `${iconFile(icon.id)} is missing or not webp`);
  assert.ok(isWebp(read(HERO_FILE)), `${HERO_FILE} is missing or not webp`);
  const listed = new Set(ICONS.map((i) => iconFile(i.id).split("/").pop()));
  const extra = readdirSync(join(repoRoot, ICON_DIR)).filter((f) => !listed.has(f));
  assert.deepEqual(extra, [], "unlisted files in the icon directory — add them to the manifest or delete them");
  assert.equal(new Set(ICONS.map((i) => i.id)).size, ICONS.length, "icon ids are unique");
});

test("the lock records the prompt each file was made from — regenerate after editing one", () => {
  const lock = JSON.parse(read(LOCK_FILE).toString("utf8"));
  for (const entry of [...ICONS, HERO]) {
    assert.equal(
      lock.entries[entry.id]?.hash,
      artHash(entry),
      `${entry.id}: its prompt changed since it was generated — run node --experimental-strip-types scripts/readme-art.mjs ${entry.id}`,
    );
  }
  assert.deepEqual(Object.keys(lock.entries).sort(), [...ICONS, HERO].map((e) => e.id).sort(), "the lock lists exactly the manifest");
});

test("every icon is used, and every icon a page names exists", () => {
  const ids = new Set(ICONS.map((i) => i.id));
  const used = new Set(GROUPS.map((g) => g.icon));
  for (const g of GROUPS) assert.ok(ids.has(g.icon), `demo group ${g.id} names icon ${g.icon}, which is not in the manifest`);
  for (const file of READMES) {
    for (const [, id] of read(file).toString("utf8").matchAll(/docs\/assets\/icons\/([a-z0-9-]+)\.webp/g)) {
      assert.ok(ids.has(id), `${file} names icon ${id}, which is not in the manifest`);
      used.add(id);
    }
  }
  assert.deepEqual(ICONS.map((i) => i.id).filter((id) => !used.has(id)), [], "icons nothing shows — use them or drop them");
  assert.match(read("README.md").toString("utf8"), new RegExp(HERO_FILE.replace(/\./g, "\\.")), "the README shows the hero");
});
