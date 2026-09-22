import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { chromium } from "playwright";
import {
  COLLECT_COLOR_ROLES,
  NON_TEXT_CONTRAST_FLOOR,
  PROSE_FLOOR_CHARS,
  WEIGHT_CUE_STEP,
  type ColorRolesInput,
  type ColorUse,
  type ControlBoundary,
  type LinkCue,
  colorOnlyLinks,
  findBase,
  findBodyInk,
  findLinkInk,
  formatColorRolesReport,
  invisibleControls,
  judgeColorRoles,
} from "./color-roles.ts";

/** Colour caught in floating point out of the palette maps is not the subject here. */
const use = (hex: string, over: Partial<ColorUse> = {}): ColorUse =>
  ({ hex, area: 1000, count: 1, samples: [`div.${hex.slice(1)}`], ...over });

const input = (over: Partial<ColorRolesInput> = {}): ColorRolesInput => ({
  palette: { surfaces: [], ink: [], marks: [] },
  baseHex: "#ffffff",
  interactiveInk: [],
  controls: [],
  controlsSkipped: [],
  links: [],
  unreadable: [],
  boxes: 40,
  viewport: { width: 1280, height: 900 },
  ...over,
});

const control = (over: Partial<ControlBoundary> = {}): ControlBoundary => ({
  selector: "input#email",
  tag: "input",
  onHex: "#ffffff",
  fillHex: "#ffffff",
  fillRatio: 1,
  borderHex: "#6b7280",
  borderRatio: 4.6,
  hasShadow: false,
  hasOutline: false,
  best: 4.6,
  ...over,
});

/** A link inside a sentence, with both cues, which is the passing shape. */
const link = (over: Partial<LinkCue> = {}): LinkCue => ({
  selector: "p>a",
  flow: "div.shell>p",
  proseChars: 80,
  linkHex: "#1145c4",
  bodyHex: "#16233a",
  vsBody: 4.2,
  underlined: true,
  weightStep: 0,
  hasFill: false,
  hasBorder: false,
  sameInk: false,
  ...over,
});

describe("findBase / findBodyInk / findLinkInk", () => {
  it("takes the base from the largest declared surface", () => {
    const base = findBase(input({
      palette: { surfaces: [use("#ffffff", { area: 100 }), use("#f7f7f7", { area: 9000 })], ink: [], marks: [] },
    }));
    assert.equal(base?.hex, "#f7f7f7");
  });

  it("falls back to the composited page background when nothing declares one", () => {
    // danluu.com: 625 boxes, ZERO declared backgrounds, and still a base a
    // reader sees. Returning null here would make the extraction unusable on
    // any page that leaves the background to the UA.
    const base = findBase(input({ palette: { surfaces: [], ink: [], marks: [] }, baseHex: "#fefefe" }));
    assert.equal(base?.hex, "#fefefe");
    assert.equal(base?.count, 0, "count 0 marks it as undeclared rather than painted by an element");
  });

  it("does not report the body ink as the link ink", () => {
    // The correction this rule needed. Ranking interactive ink by count alone
    // named the BODY ink on 7 of the 14 corpus pages, because nav items, card
    // titles and logos are links set in the body colour on purpose — they are
    // marked by position, not by hue. MDN: 275 interactive elements at #000000
    // against 46 at #044c9f, and #044c9f is MDN's link colour.
    const report = input({
      palette: { surfaces: [], ink: [use("#000000", { area: 90_000, count: 400 })], marks: [] },
      interactiveInk: [
        use("#000000", { count: 275, area: 50_000 }),
        use("#044c9f", { count: 46, area: 9_000 }),
      ],
    });
    assert.equal(findBodyInk(report)?.hex, "#000000");
    assert.equal(findLinkInk(report)?.hex, "#044c9f");
  });

  it("returns no link ink when every link is set in the body ink", () => {
    // Saying "none" is better than naming the page's body grey as its accent.
    const report = input({
      palette: { surfaces: [], ink: [use("#828282", { area: 90_000 })], marks: [] },
      interactiveInk: [use("#828282", { count: 120 })],
    });
    assert.equal(findLinkInk(report), null);
  });

  it("ranks the palette by painted area and drops the trace colours", () => {
    const report = judgeColorRoles(input({
      palette: {
        surfaces: [use("#ffffff", { area: 100_000 }), use("#ff0000", { area: 1 })],
        ink: [], marks: [],
      },
    }));
    const text = formatColorRolesReport(report).replace(/\u001B\[[0-9;]*m/g, "");
    assert.match(text, /#ffffff/);
    assert.doesNotMatch(text, /#ff0000/, "a colour under 0.5% of its role is not the palette");
  });
});

describe("invisibleControls", () => {
  it("passes a field whose border clears the floor", () => {
    assert.deepEqual(invisibleControls([control()]), []);
  });

  it("reports a field whose fill and border are both under the floor", () => {
    // chromedev's book-nav filter: #f5f6f7 on #ffffff is 1.08:1 with no border.
    const found = invisibleControls([control({
      fillHex: "#f5f6f7", fillRatio: 1.08, borderHex: null, borderRatio: 0, best: 1.08,
    })]);
    assert.equal(found.length, 1);
  });

  it("reports a field that draws nothing at all", () => {
    // NN/g's newsletter input on its dark footer: no fill, no border, no shadow,
    // no outline. The screenshot shows a caret and nothing else.
    const found = invisibleControls([control({
      onHex: "#2c1111", fillHex: null, fillRatio: 0, borderHex: null, borderRatio: 0, best: 0,
    })]);
    assert.equal(found.length, 1);
  });

  it("does not report a field marked by a shadow or an outline", () => {
    // Both draw an edge, and WCAG 1.4.11 asks for a visible boundary rather than
    // for a border specifically. Wikipedia and Smashing both mark their search
    // fields this way and measured 4.5 / 4.8 on the border anyway.
    const shadow = control({ fillRatio: 1, borderRatio: 0, best: 1, hasShadow: true });
    const outline = control({ fillRatio: 1, borderRatio: 0, best: 1, hasOutline: true });
    assert.deepEqual(invisibleControls([shadow, outline]), []);
  });

  it("uses the WCAG number rather than one of its own", () => {
    assert.equal(NON_TEXT_CONTRAST_FLOOR, 3);
    const just = invisibleControls([control({ best: 3 })]);
    const under = invisibleControls([control({ best: 2.99 })]);
    assert.deepEqual(just, []);
    assert.equal(under.length, 1);
  });
});

describe("colorOnlyLinks", () => {
  it("passes a link that carries an underline as well as a colour", () => {
    const { weak, none } = colorOnlyLinks([link({ vsBody: 1.2 })]);
    assert.deepEqual([weak.length, none.length], [0, 0], "one non-colour cue is enough");
  });

  it("passes a link that clears 3:1 against the prose with no other cue", () => {
    const { weak } = colorOnlyLinks([link({ underlined: false, vsBody: 4.1 })]);
    assert.equal(weak.length, 0);
  });

  it("reports a colour-only link under 3:1 against the prose", () => {
    // caniuse's note links: #0046d1 in #000000 prose at 2.8:1, no underline.
    const { weak } = colorOnlyLinks([link({
      underlined: false, linkHex: "#0046d1", bodyHex: "#000000", vsBody: 2.8,
    })]);
    assert.equal(weak.length, 1);
  });

  it("does not judge a link in a flow with no prose of its own", () => {
    // The whole rule. danluu.com is 210 undecorated #0000ee links at 1.7:1
    // against its body colour and is not a finding: every row is a link, so
    // there is no sentence for one to hide inside. A list of links is a list.
    const { weak } = colorOnlyLinks([link({ underlined: false, vsBody: 1.7, proseChars: 0 })]);
    assert.equal(weak.length, 0);
    // …and the floor is where the two populations separate, not a round number
    // picked afterwards: MDN's breadcrumb separators carry 1-3 characters and
    // the shortest real sentence-with-a-link on the corpus carries 24.
    assert.equal(PROSE_FLOOR_CHARS, 15);
    assert.equal(colorOnlyLinks([link({ underlined: false, vsBody: 1.7, proseChars: 14 })]).weak.length, 0);
    assert.equal(colorOnlyLinks([link({ underlined: false, vsBody: 1.7, proseChars: 15 })]).weak.length, 1);
  });

  it("treats a weight step, a border or a fill as the non-colour cue too", () => {
    const base = { underlined: false, vsBody: 1.2 } as const;
    assert.equal(colorOnlyLinks([link({ ...base, weightStep: WEIGHT_CUE_STEP })]).weak.length, 0);
    assert.equal(colorOnlyLinks([link({ ...base, hasBorder: true })]).weak.length, 0);
    assert.equal(colorOnlyLinks([link({ ...base, hasFill: true })]).weak.length, 0);
    // …and one notch of weight is not a cue: 400 to 500 is not reliably visible.
    assert.equal(colorOnlyLinks([link({ ...base, weightStep: 99 })]).weak.length, 1);
  });

  it("separates a link in exactly the body ink from one merely too close to it", () => {
    const { weak, none } = colorOnlyLinks([
      link({ underlined: false, sameInk: true, linkHex: "#16233a", bodyHex: "#16233a", vsBody: 1 }),
      link({ underlined: false, vsBody: 2.4 }),
    ]);
    assert.equal(none.length, 1, "no signal at all is a stronger claim than not enough");
    assert.equal(weak.length, 1);
  });

  it("does not judge a link whose prose sits on a gradient", () => {
    // `vsBody: null` is the refusal CONTRAST_BACKGROUND_JS reports for a
    // background image. Guessing white there is how a contrast check reports
    // near-white on near-black as 1.08:1.
    const { weak } = colorOnlyLinks([link({ underlined: false, vsBody: null })]);
    assert.equal(weak.length, 0);
  });
});

describe("judgeColorRoles", () => {
  it("returns consistent on a page whose links and fields both carry a second cue", () => {
    const report = judgeColorRoles(input({ controls: [control()], links: [link()] }));
    assert.equal(report.verdict, "consistent");
    assert.deepEqual(report.findings, []);
  });

  it("groups colour-only links by colour pair rather than by element", () => {
    // One stylesheet rule produces as many rows as it has links, and
    // "3 findings" reads as three fixes. web.dev's content footer has three.
    const links = [1, 2, 3].map((i) => link({
      selector: `p>a:nth-child(${i})`, underlined: false, linkHex: "#185abc", bodyHex: "#202124", vsBody: 2.47,
    }));
    const report = judgeColorRoles(input({ links }));
    const rows = report.findings.filter((f) => f.kind === "color-only-link");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.evidence?.elements, 3);
  });

  it("reports colours it could not read rather than dropping them", () => {
    // The rule exists because of a measured failure: the shared parser
    // understood rgb() only, Chromium serialises oklch() as lab(), and
    // `check a11y contrast` inspected 10 of 1068 elements on the Tailwind docs
    // page and called it clean.
    const report = judgeColorRoles(input({
      controls: [control()],
      unreadable: [{ property: "color", count: 783, samples: ["lab(1.90334 0.278696 -5.48866)"] }],
    }));
    const row = report.findings.find((f) => f.kind === "unreadable-color");
    assert.ok(row, "an unreadable colour is never silent");
    assert.equal(row?.severity, "info");
    assert.match(row?.message ?? "", /783/);
    assert.equal(report.verdict, "consistent", "info never carries the verdict");
  });

  it("says so when neither rule had anything to measure", () => {
    const report = judgeColorRoles(input({ controls: [], links: [] }));
    assert.equal(report.verdict, "not-judged");
    assert.ok(report.findings.some((f) => f.kind === "nothing-judged"));
  });

  it("honours --allow, and the exempted row still exists in the input", () => {
    const bad = control({ selector: "input#search", best: 0, fillHex: null, borderHex: null });
    const report = judgeColorRoles(
      input({ controls: [bad], links: [link()] }),
      { allow: ["input#search;the search field is marked by its icon"] },
    );
    assert.deepEqual(report.findings.filter((f) => f.kind === "control-boundary-invisible"), []);
    assert.equal(report.controls.length, 1, "an exemption hides the finding, not the measurement");
  });
});

describe("COLLECT_COLOR_ROLES", () => {
  it("carries the invariants it is interpolated under", () => {
    // It embeds CONTRAST_BACKGROUND_JS, so the same two rules apply to the
    // whole string. One backtick ends the script.
    assert.equal(COLLECT_COLOR_ROLES.includes("`"), false);
    assert.ok(COLLECT_COLOR_ROLES.includes("function resolveTextBackground"), "background resolution is shared, not reimplemented");
    assert.ok(COLLECT_COLOR_ROLES.includes("function parseColor"), "and so is colour parsing");
  });

  /**
   * The collector against a real browser, for the decisions it makes that the
   * pure judge cannot see: which suppressors count as a boundary, and whether a
   * modern colour syntax resolves at all.
   */
  it("reads boundaries, cues and modern colour off a rendered page", async () => {
    const page = `<!doctype html><meta charset="utf-8"><title>t</title><style>
      body { margin: 0; font: 16px/1.6 sans-serif; color: #16233a; background: oklch(0.99 0.002 250); }
      .panel { padding: 20px; background: #ffffff; }
      /* A reset that reserves the focus ring's space with a TRANSPARENT outline.
         It paints nothing, so it must not stand in for a boundary. */
      #ghost { background: #ffffff; border: 0; outline: 1px solid transparent; }
      #marked { background: #ffffff; border: 1px solid #6b7280; }
      #shadowed { background: #ffffff; border: 0; box-shadow: 0 0 0 1px #6b7280; }
      p a { color: #1145c4; text-decoration: none; }
      p.cued a { text-decoration: underline; }
    </style>
    <div class="panel">
      <input id="ghost" type="email"><input id="marked" type="email"><input id="shadowed" type="email">
      <p>A sentence long enough to count as prose with <a href="#x">a bare link</a> in it.</p>
      <p class="cued">A sentence long enough to count as prose with <a href="#y">an underlined link</a> in it.</p>
    </div>`;
    const browser = await chromium.launch();
    try {
      const tab = await browser.newPage({ viewport: { width: 800, height: 600 } });
      await tab.setContent(page);
      const input = await tab.evaluate(COLLECT_COLOR_ROLES) as ColorRolesInput;

      // oklch() on the body resolves, which is the whole of the parser fix.
      assert.equal(input.baseHex, "#fbfcfd");
      assert.deepEqual(input.unreadable, [], "nothing on this page is unreadable");

      const byId = new Map(input.controls.map((c) => [c.selector.replace(/^.*#/, "#"), c]));
      const ghost = byId.get("#ghost");
      assert.ok(ghost, "the bare field was collected");
      assert.equal(ghost.hasOutline, false, "a transparent outline paints nothing and is not a boundary");
      assert.equal(ghost.hasShadow, false);
      assert.equal(invisibleControls([ghost]).length, 1);
      assert.equal(byId.get("#marked")?.hasShadow, false);
      assert.ok((byId.get("#marked")?.best ?? 0) > 3, "a real border clears the floor");
      assert.equal(byId.get("#shadowed")?.hasShadow, true, "a shadow does draw an edge");
      assert.equal(invisibleControls([byId.get("#shadowed")!]).length, 0);

      const { weak } = colorOnlyLinks(input.links);
      assert.equal(weak.length, 1, "the bare link fires, the underlined one does not");
      assert.match(weak[0]?.selector ?? "", /a$/);
      assert.ok((weak[0]?.proseChars ?? 0) >= PROSE_FLOOR_CHARS);
    } finally {
      await browser.close();
    }
  }, 60_000);
});
