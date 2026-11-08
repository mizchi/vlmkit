/**
 * `vlmkit stress data` (issue #218) on fixtures/data-stress/: an intact product list passes every
 * variant, and each mutant fails by the variant its defect is about.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { BIG_NUMBER, LONG_TOKEN, planVariants, runDataStress, type DataStressReport } from "./data-stress.ts";

const dir = join(import.meta.dirname, "../../../../fixtures/data-stress");
const run = (name: string, only?: string[]) =>
  runDataStress({ source: join(dir, `${name}.html`), ...(only ? { only } : {}) });
const byVariant = (r: DataStressReport) => {
  const out: Record<string, string[]> = {};
  for (const f of r.findings) (out[f.variant.split(":")[0]!] ??= []).push(f.rule);
  return out;
};
const T = { timeout: 180_000 };

describe("planVariants: the variants what the page holds calls for", () => {
  it("empties, thins and multiplies each group; long text, big numbers and broken images when there are any", () => {
    const v = planVariants({
      groups: [{ selector: "#g", name: "ul.grid", items: 6 }],
      textSlots: 4,
      counts: 2,
      images: 1,
    });
    assert.deepEqual(
      v.map((x) => x.id),
      ["empty:ul.grid", "one:ul.grid", "many:ul.grid", "long-text", "big-number", "broken-images"],
    );
    assert.match(v.find((x) => x.kind === "many")!.does, /30 items \(x5\)/);
    assert.deepEqual(planVariants({ groups: [], textSlots: 0, counts: 0, images: 0 }), []);
    assert.ok(LONG_TOKEN.length >= 45 && !/\s/.test(LONG_TOKEN));
    assert.equal(BIG_NUMBER, "9,999,999");
  });
});

describe("stress data on fixtures/data-stress", () => {
  it("passes the intact list in every variant", T, async () => {
    const r = await run("cards");
    assert.equal(r.probe.groups.length, 1);
    assert.equal(r.probe.groups[0]!.items, 6);
    assert.deepEqual(r.findings, [], JSON.stringify(r.findings, null, 2));
    assert.equal(r.variants.length, 6);
  });

  it("a name with nowhere to break pushes past its card: long-text fails", T, async () => {
    const v = byVariant(await run("cards--long-name"));
    assert.ok(
      v["long-text"]?.some((rule) => rule === "container-protrusion" || rule === "text-collision"),
      JSON.stringify(v),
    );
  });

  it("a fixed-width badge cuts 9,999,999 off: big-number fails by text-clipped", T, async () => {
    const v = byVariant(await run("cards--fixed-badge"));
    assert.ok(v["big-number"]?.includes("text-clipped"), JSON.stringify(v));
    assert.equal(v["long-text"], undefined);
  });

  it("an avatar with no size of its own collapses when it fails to load", T, async () => {
    const v = byVariant(await run("cards--avatar"));
    assert.deepEqual(v, { "broken-images": ["broken-image-collapses", "broken-image-collapses"] });
  });

  it("an empty list that shows nothing is empty-collapses, and --variant replays only it", T, async () => {
    const r = await run("cards--no-empty-state", ["empty:main>ul.grid"]);
    assert.deepEqual(
      r.variants.map((v) => v.id),
      ["empty:main>ul.grid"],
    );
    assert.deepEqual(
      r.findings.map((f) => [f.rule, f.viewport]),
      [
        ["empty-collapses", 1280],
        ["empty-collapses", 375],
      ],
    );
  });
});
