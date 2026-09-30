/**
 * The generated art in this repository's README, examples and demo gallery: one hero illustration
 * and a set of icons, each with the prompt that made it. `scripts/readme-art.mjs` generates them
 * with the default image model (`IMAGE_GEN_DEFAULT_MODEL`); `tests/readme-art.test.mjs` holds the
 * files, the lock and the places that use them to this list.
 *
 * An icon is a prompt, not a drawing: change `glyph` (or `ICON_STYLE`) and the lock no longer
 * matches, so the test fails until the icon is generated again — the file on disk would otherwise
 * be a picture of a sentence nobody can read any more.
 */
import { createHash } from "node:crypto";

export const ICON_DIR = "docs/assets/icons";
export const HERO_FILE = "docs/assets/readme-hero.webp";
export const LOCK_FILE = "docs/assets/art.lock.json";

/** Rendered size of an icon file (webp with alpha, ~6KB). Shown at 20-32 CSS px, so 128 stays sharp at 4x. */
export const ICON_PX = 128;

/**
 * One style for every icon: a filled tile reads on GitHub's light and dark themes alike and holds
 * a glyph at 20px, which the first attempt — blue line art on transparent — did not (dark blue on
 * #0d1117 vanished, and the model added a glow that the reference then taught every other icon).
 */
export const ICON_STYLE =
  "App icon. A rounded square tile (corner radius about 22% of its width) filled with solid flat blue #2563eb, filling the canvas edge to edge with a few pixels of margin. On it, one bold, simple, white glyph, centered, thick uniform strokes, readable at 24 pixels. Flat vector, no gradient, no shadow, no glow, no text, no letters. Transparent background outside the tile.";

/** Generated first; every other icon gets it as a reference image, which is what keeps the set one set. */
export const ANCHOR_ICON = "page-check";

/**
 * `usedFor` says where the icon appears, so an unused one is visible here and in the test.
 * @type {readonly { id: string, glyph: string, usedFor: string }[]}
 */
export const ICONS = Object.freeze([
  { id: "page-check", glyph: "a web page outline with a magnifying glass over its lower right", usedFor: "demo group “Is the page broken?”; README: check the page you just wrote; examples/vlmkit-intro-page" },
  { id: "keyboard", glyph: "a single keyboard key with a return arrow on it", usedFor: "demo group “Can it be operated?”" },
  { id: "contrast", glyph: "an eye whose iris is a circle split into a white half and a blue half", usedFor: "demo group “Can everyone read it?”" },
  { id: "layout-grid", glyph: "a layout grid of three blocks with a ruler along its top edge", usedFor: "demo group “Does it look designed?”; README: audit design quality" },
  { id: "compare", glyph: "two overlapping pages, the front one showing a small highlighted rectangle", usedFor: "demo group “What changed?”; README: compare two versions" },
  { id: "zoom", glyph: "a magnifying glass with a plus sign inside it", usedFor: "demo group “Vision models and figures”" },
  { id: "responsive", glyph: "a phone standing in front of a desktop monitor", usedFor: "README: verify behavior, not pixels" },
  { id: "pointer", glyph: "a mouse pointer arrow clicking the centre of a crosshair", usedFor: "README: drive the page from a screenshot" },
  { id: "target", glyph: "a bullseye target with a check mark over it", usedFor: "README: match a target design; examples/markup-loop-project" },
  { id: "history", glyph: "a clock face with a circular arrow running around it", usedFor: "README: track changes over time" },
  { id: "image-check", glyph: "a picture frame showing a mountain, with a round check mark badge at its corner", usedFor: "README: vet an image asset" },
  { id: "wrench", glyph: "a wrench", usedFor: "README: repair" },
  { id: "stack", glyph: "a stack of three pages, slightly offset", usedFor: "README: run gates over a whole site; examples/sites" },
  { id: "bell-off", glyph: "a bell with a diagonal slash through it", usedFor: "README: audit what has been silenced" },
  { id: "plug", glyph: "an electric plug whose cable ends in a small square chip", usedFor: "README: wire into agents / pipelines" },
  { id: "puzzle", glyph: "a single jigsaw puzzle piece", usedFor: "examples/gate-plugin" },
  { id: "slides", glyph: "a presentation screen on a tripod stand, showing a small bar chart", usedFor: "examples/d2-slides" },
  { id: "gallery", glyph: "a grid of four square thumbnails, two by two", usedFor: "examples/demos" },
  { id: "clipboard", glyph: "a clipboard holding a list of three check marks", usedFor: "examples/markup-vrt-eval" },
  { id: "card", glyph: "a playing card showing a single spade", usedFor: "examples/solitaire" },
  { id: "component", glyph: "a small rounded card with a heading line and a pill-shaped button inside", usedFor: "examples/story-gallery" },
]);

/** The README's opening illustration. Pictured, not diagrammed: it names no command and no flow. */
export const HERO = Object.freeze({
  id: "readme-hero",
  aspectRatio: "21:9",
  width: 1600,
  prompt:
    "Wide flat vector illustration, white background, a limited palette of blue #2563eb, light blue #bfdbfe, slate grey and one red accent #ef4444. A web page is shown on three screens side by side — a phone, a tablet and a desktop monitor. A large magnifying glass hovers over the desktop screen and reveals a small overlapping-text defect marked with a thin red outline. Beside the screens, a small friendly robot and a person look at a checklist whose items carry blue check marks. Clean, calm, generous whitespace, no text, no letters, no logos.",
});

export const iconFile = (id) => `${ICON_DIR}/${id}.webp`;
export const iconPrompt = (icon) =>
  `${ICON_STYLE} Glyph: ${icon.glyph}.${icon.id === ANCHOR_ICON ? "" : " Match the reference icon's tile, colour, stroke weight and proportions exactly."}`;

/** What the lock records per entry: the prompt, the shape, and for icons the style anchor they were drawn against. */
export function artHash(entry) {
  const text = entry.id === HERO.id ? `${HERO.aspectRatio}\n${HERO.width}\n${HERO.prompt}` : `${ICON_PX}\n${iconPrompt(entry)}`;
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}
