/**
 * The demo gallery's manifest: one entry per vlmkit feature, each a page with a known defect and
 * the command that finds it.
 *
 * Nothing on a demo page is written by hand except its prose. The page under test is either one
 * of the repository's own test fixtures (copied next to the demo byte for byte, so a visitor can
 * open it) or a page in this directory; the output is what `capture.mjs` got from running the
 * command; the screenshots are taken by the same run. `demos.test.mjs` holds the copies to their
 * fixtures and the published pages to a fresh render.
 *
 * Fields:
 * - `page`      the page under test, repo-relative. Published as `<id>/page.html`.
 * - `run`       argv after the binary (`vlmkit`); `{out}` is a
 *               scratch directory for whatever the command writes. Shown on the page as written.
 * - `extras`    further files published beside the page ({ from, as }), e.g. a copy manifest; one
 *               with a `caption` is also shown as a figure.
 * - `shots`     screenshots of the page: viewport, `full` page or not, and `mark` — selectors to
 *               outline. Every marked selector must appear in the command's output, so a mark can
 *               only point at something the tool itself named (capture.mjs refuses otherwise).
 * - `evidence`  images the command wrote under `{out}` ({ file, caption, clip? }).
 * - `report`    a markdown report the command wrote under `{out}`, shown after the output.
 * - `then`      a second command run after `run` (its output is appended).
 * - `special`   a capture step with no CLI of its own (the zoom demo).
 */

/** @typedef {{ viewport: [number, number], full?: boolean, mark?: string[], caption: string, clip?: { x: number, y: number, width: number, height: number } }} Shot */

export const GROUPS = Object.freeze([
  {
    id: "broken",
    icon: "page-check",
    title: "Is the page broken?",
    blurb: "Reference-free checks for the page you just wrote. No baseline, no design file, no API key.",
  },
  {
    id: "operable",
    icon: "keyboard",
    title: "Can it be operated?",
    blurb: "Keyboards, focus order, and agents that click on a screenshot.",
  },
  {
    id: "readable",
    icon: "contrast",
    title: "Can everyone read it?",
    blurb: "Contrast measured on rendered pixels, including apps with no DOM at all.",
  },
  {
    id: "design",
    icon: "layout-grid",
    title: "Does it look designed?",
    blurb: "Proximity, colour roles and a spacing scale. These report inconsistency, never taste.",
  },
  {
    id: "change",
    icon: "compare",
    title: "What changed?",
    blurb: "Two versions of a page, or one page under a longer language.",
  },
  {
    id: "vision",
    icon: "zoom",
    title: "Vision models",
    blurb: "Letting a VLM zoom into the original, from any provider.",
  },
]);

export const DEMOS = Object.freeze([
  {
    id: "integrity",
    group: "broken",
    title: "A pricing page that breaks on smaller screens",
    command: "check integrity",
    page: "examples/demos/integrity/page.html",
    run: ["check", "integrity", "examples/demos/integrity/page.html"],
    lead: "Three cards in a row that never wraps, a badge pinned on top of a price, and feature lists cut off by a fixed height. The page looks fine in the editor's preview width.",
    look: "It sweeps 1280, 768 and 375px in one run. The overflow is reported with the element that sticks out and its right edge; the badge is found by sampling the price's glyphs and seeing 75% of them land on the badge instead.",
    fix: "Let `.plans` wrap (or stack below 768px), move the badge out of the price's box, and drop the fixed `height` on `.features`.",
    shots: [
      {
        viewport: [1280, 360],
        mark: ["span.badge"],
        caption: "1280px: the badge covers the $49 price, and each list has lost its third item to the fixed height.",
      },
      {
        viewport: [768, 360],
        mark: ["div.plans > section:nth-of-type(3)"],
        caption: "768px: the third card runs 212px past the viewport.",
      },
    ],
  },
  {
    id: "copy",
    group: "broken",
    title: "Copy that drifted from the spec",
    command: "check copy --manifest",
    page: "examples/demos/copy/page.html",
    extras: [{ from: "examples/demos/copy/copy.txt", as: "manifest.txt" }],
    run: ["check", "copy", "examples/demos/copy/page.html", "--manifest", "examples/demos/copy/copy.txt"],
    lead: "The manifest (`copy.txt`, published here as `manifest.txt`) is the copy the page must show, verbatim. The page reworded the button, hid a pricing note in the page's own colour, and shipped a placeholder quote.",
    look: "The hidden note IS in the DOM, so a text search passes it. The gate reports it as `copy-invisible` with the reason class (`camouflage`) because a user cannot see it.",
    fix: 'Restore "Start a free trial", give `.note` a real colour, and write the testimonial.',
    shots: [
      {
        viewport: [1024, 640],
        caption:
          'What a visitor sees: "Try it free", an empty gap where the note is (white on white), and the placeholder quote.',
      },
    ],
  },
  {
    id: "responsive",
    group: "broken",
    title: "A card grid that needs 826px, switched on at 768px",
    command: "check responsive",
    page: "fixtures/responsive-patterns/mutants/card-grid--fixed-four.html",
    run: ["check", "responsive", "fixtures/responsive-patterns/mutants/card-grid--fixed-four.html"],
    lead: "Every viewport width is a generated test case; the page's own media queries partition them. One of the eleven mutants in the responsive pattern catalog forces four columns from 768px.",
    look: "The failure is shrunk before it is shown: to the exact interval 768-825px, to the declaration that causes it, and to a breakpoint move that was rewritten in the stylesheet and re-checked before the report calls it `verified`.",
    fix: "Move the breakpoint to `(min-width: 826px)`, or let the grid drop a column.",
    shots: [
      {
        viewport: [768, 900],
        mark: ["ol.phases > li:nth-of-type(1) > p:nth-of-type(1)"],
        caption: "768px, the first failing width: 69px-wide columns, eight lines of eight characters.",
      },
    ],
  },
  {
    id: "interactions",
    group: "operable",
    title: "A Save button that does nothing on Enter",
    command: "check interactions",
    page: "fixtures/interact/dropdown-form/page.html",
    run: ["check", "interactions", "fixtures/interact/dropdown-form/page.html"],
    lead: "Every control is focused and pressed from the keyboard, and the page is watched for a response: an ARIA change, a layout change, a navigation.",
    look: "The dropdown answers Enter with a layout change. The Save button answers with nothing, so it is reported as an inert control.",
    fix: "Make Save a real submit (or handle `keydown`), so the keyboard gets what the mouse gets.",
    shots: [
      {
        viewport: [800, 260],
        mark: ["form>button.submit-btn"],
        caption: "Save looks like every other button, and does nothing on Enter.",
      },
    ],
  },
  {
    id: "focus-order",
    group: "operable",
    title: "A toolbar whose Tab order runs backwards",
    command: "check a11y focus",
    page: "fixtures/a11y-focus-order/reversed/page.html",
    run: ["check", "a11y", "focus", "fixtures/a11y-focus-order/reversed/page.html"],
    lead: "Tab is pressed through the page and every focus step is placed on screen. `tabindex` values put Cut, Copy and Paste in reverse.",
    look: "Each finding names the two controls and their x positions, so the jump is visible in numbers rather than by pressing Tab.",
    fix: "Drop the positive `tabindex` values and let DOM order match visual order.",
    shots: [
      {
        viewport: [800, 360],
        mark: ["div.toolbar>button.btn-cut", "div.toolbar>button.btn-copy", "div.toolbar>button.btn-paste"],
        caption: "Visual order Paste · Copy · Cut left to right; focus goes Cut → Copy → Paste.",
      },
    ],
  },
  {
    id: "grounding",
    group: "operable",
    title: "A checkout button an agent would miss",
    command: "check grounding --mark",
    page: "fixtures/grounding/partly-covered.html",
    run: [
      "check",
      "grounding",
      "fixtures/grounding/partly-covered.html",
      "--resolution",
      "1280x720",
      "--mark",
      "{out}/mark.png",
    ],
    lead: "For computer-use agents: an action map in screenshot pixels, and for each target whether a click there actually reaches it. `--mark` draws the numbered overlay an agent would be handed.",
    look: "A transparent veil covers the button's centre. The map moves t1's click point to a spot that does reach it, and still reports the defect, because anything aiming at the centre misses.",
    fix: "Remove the veil, or give it `pointer-events: none`.",
    shots: [],
    evidence: [
      {
        file: "mark.png",
        caption:
          "The numbered overlay, red where the coordinate carries a risk. `--resolution 1280x720` keeps the frame at full size for this page; by default the map is given in the downscaled frame a model is sent (640x360 here).",
        clip: { x: 0, y: 0, width: 520, height: 170 },
      },
    ],
  },
  {
    id: "contrast",
    group: "readable",
    title: "Pale text that fails WCAG contrast",
    command: "check a11y contrast",
    page: "fixtures/a11y-contrast/low-contrast/page.html",
    run: ["check", "a11y", "contrast", "fixtures/a11y-contrast/low-contrast/page.html"],
    lead: "Every text-bearing element's colour against the background actually behind it, with the threshold its size earns (4.5:1, or 3:1 for large text).",
    look: "The large pale line passes at 3:1 only because it is large, and fails anyway at 2.54:1. Colours the browser serialises as `oklch()` or `lab()` are read back from a rasterised pixel, so none are skipped.",
    fix: "Darken the four inks to at least the ratio each needs.",
    shots: [
      {
        viewport: [800, 420],
        mark: ["p.small-pale", "p>a.light-link", "p.too-muted", "p.large-pale"],
        caption: "The four failures, outlined. The first line and the button pass.",
      },
    ],
  },
  {
    id: "a11y-tree",
    group: "readable",
    title: "An app with no DOM to read",
    command: "scan a11y → check a11y tree",
    page: "fixtures/a11y-tree/flutter-like.html",
    run: ["scan", "a11y", "fixtures/a11y-tree/flutter-like.html", "--out", "{out}/a11y.json"],
    then: ["check", "a11y", "tree", "{out}/a11y.json"],
    lead: "A canvas app paints its UI and exposes only an accessibility tree, so DOM contrast rules read every label as 1.00:1. `scan a11y` writes the tree plus the frame; `check a11y tree` judges it, with contrast taken from the frame's pixels.",
    look: "Four kinds of finding from one frame: a text field with no name, content past the bottom that nothing scrolls to, a 2.32:1 hint, and a 20x20 target.",
    fix: "Label the field, make the log scrollable, darken the hint, grow the Info target to 24px.",
    shots: [],
    evidence: [{ file: "a11y.png", caption: "The frame the contrast was measured on (375x812)." }],
  },
  {
    id: "composition",
    group: "design",
    title: "Headings that sit closer to the section above",
    command: "check composition",
    page: "fixtures/composition/proximity-broken.html",
    run: ["check", "composition", "fixtures/composition/proximity-broken.html"],
    lead: "Proximity, alignment and contrast as measurements. This fixture is the intact composition page plus one rule that swaps the gaps around each heading.",
    look: "Each heading is 12px under the block above and 44px over the content it labels, so it reads as belonging upward. The gate reports the ambiguity and the gap that would remove it, never which gap is correct.",
    fix: "Put more space above each heading than below it.",
    shots: [
      {
        viewport: [1024, 900],
        mark: ["div.shell>section>h2", "section>div.subsection>h3"],
        caption: "Each outlined heading is closer to the block above it than to the text it introduces.",
      },
    ],
  },
  {
    id: "color",
    group: "design",
    title: "Links you can only tell apart by colour",
    command: "check color",
    page: "fixtures/color/link-color-only-broken.html",
    run: ["check", "color", "fixtures/color/link-color-only-broken.html"],
    lead: "The palette by role (surfaces, ink, marks, by painted area) and two WCAG rules. Here the links in the prose have no underline and are 2:1 against the text around them.",
    look: "`check a11y contrast` passes these links: they are readable against the background. This is the other criterion (WCAG 1.4.1), the link against the sentence it sits in.",
    fix: "Underline in-prose links, or reach 3:1 against the body ink.",
    shots: [
      { viewport: [1024, 640], mark: ["div.shell>p>a"], caption: "Blue links in dark-blue prose, no underline." },
    ],
  },
  {
    id: "tokens",
    group: "design",
    title: "Spacing and radii off the design scale",
    command: "check tokens",
    page: "fixtures/design-tokens/off-scale/page.html",
    run: ["check", "tokens", "fixtures/design-tokens/off-scale/page.html", "--output-dir", "{out}"],
    report: "report.md",
    lead: "Hard-coded values audited against a spacing, radius, z-index and shadow scale. Nothing on this page looks wrong at a glance, and that is the point.",
    look: "Twenty values off the scale, each with the nearest value on it: 14px and 18px paddings between 12, 16 and 20; radii of 5, 7 and 9px; eight distinct shadows where five tiers are allowed. The markdown report beside the run has one row per value.",
    fix: "Snap each value to the nearest token.",
    shots: [{ viewport: [800, 520], caption: "The page. The defects are in the numbers, not in the picture." }],
  },
  {
    id: "diff",
    group: "change",
    title: "A header that grew 48px and pushed everything down",
    command: "diff html",
    page: "fixtures/shift-patterns/header-grow.html",
    extras: [{ from: "fixtures/shift-patterns/baseline.html", as: "baseline.html" }],
    run: [
      "diff",
      "html",
      "fixtures/shift-patterns/baseline.html",
      "fixtures/shift-patterns/header-grow.html",
      "--output",
      "{out}",
    ],
    lead: "Two versions of one page, compared per viewport: the pixel diff, the computed-style diff that explains it, and a triptych image.",
    look: "A raw pixel diff says 18.9% changed. The shift detector says one thing happened: everything below the header moved +48px, and after undoing the shift only 5.8% differs.",
    fix: "Restore the header's padding (the computed-style diff names `height`, `padding-top`, `padding-bottom`).",
    shots: [],
    evidence: [
      {
        file: "header-grow-mobile-triptych.png",
        caption: "Baseline, variant and heatmap at 375px, as `diff html` writes it.",
        clip: { x: 0, y: 0, width: 1129, height: 620 },
      },
    ],
  },
  {
    id: "i18n",
    group: "change",
    title: "Buttons that overflow when the copy gets longer",
    command: "stress i18n",
    page: "fixtures/i18n-stress/button-overflow/page.html",
    run: ["stress", "i18n", "fixtures/i18n-stress/button-overflow/page.html", "--output-dir", "{out}"],
    lead: "Every text run is lengthened 1.4x, roughly what translating English into German does, and the layout is measured again. No translations needed.",
    look: "A fixed-width button and heading overflow, and a paragraph doubles in height. Each finding carries the scroll width against the box.",
    fix: "Replace the fixed widths with `min-width` and let text wrap.",
    shots: [
      {
        viewport: [640, 360],
        mark: ["div.card>button.btn", "div.card>h2"],
        caption: "Before inflation, everything fits.",
      },
    ],
    evidence: [
      {
        file: "after.png",
        caption:
          "After 1.4x inflation (each word padded with X): the heading ends in an ellipsis, the button label runs past its edge, the line under it takes two.",
        clip: { x: 400, y: 20, width: 480, height: 240 },
      },
    ],
  },
  {
    id: "zoom",
    group: "vision",
    title: "Letting a vision model zoom into the original",
    command: "@mizchi/vlmkit-ai/zoom.ts",
    page: "fixtures/css-challenge/dashboard.html",
    special: "zoom",
    lead: "A full-page 2x capture of a dashboard is shown to a model at a little under its CSS size, and one table header moved 2px. The zoom tool lets the model name a box and get it back cropped from the full-resolution original and magnified, from any provider's model.",
    look: 'In the view the model is sent, the shift is under two pixels. In the zoom it is plain: CUSTOMER starts level with "Alice Johnson" in the baseline and left of it in the current image. In the agent-mode accuracy bench, zoom scored 58/58 against 48/58 for one look, and the whole gain was exact values like this one.',
    fix: "Turn zoom on when the answer is a measurement (a shift in pixels, a colour value), not just to notice a change.",
    shots: [],
  },
]);

/** The files a demo publishes, relative to its directory. Images come from its result. */
export function demoFiles(demo, result) {
  return [
    "index.html",
    demo.pageAs ?? "page.html",
    ...(demo.extras ?? []).map((e) => e.as),
    ...(result?.images ?? []).map((i) => i.file),
  ];
}
