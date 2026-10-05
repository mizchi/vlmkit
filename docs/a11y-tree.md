# Accessibility from a platform tree (`vlmkit-a11y/1`)

`vlmkit check a11y touch|contrast|focus` read a browser's DOM. A Flutter app, an Android or iOS
app, a macOS or Windows desktop app has no DOM worth reading. Flutter web does have a DOM, but
it paints nothing into it. What each of these platforms *does* have is an accessibility tree
and a screen. `vlmkit-a11y/1` is that pair as a file. Two gates work with it:

- `vlmkit scan a11y` writes one from a Flutter web page, an Android `uiautomator dump`, or a running
  macOS app's window (`--app`).
- `vlmkit check a11y tree` judges it, from any platform, with no browser.

```mermaid
flowchart LR
  subgraph collectors["collectors — one per platform, outside the judges"]
    fw["Flutter web<br/>vlmkit scan a11y &lt;url&gt;"]
    an["Android<br/>vlmkit scan a11y ui.xml --density N"]
    mac["macOS AX<br/>vlmkit scan a11y --app TextEdit"]
    other["Windows UIA · iOS ·<br/>Flutter desktop — your own script"]
  end
  collectors --> tree["a11y.json (vlmkit-a11y/1)<br/>+ frame.png"]
  tree --> check["vlmkit check a11y tree"]
  check --> r1["unlabelled-control"]
  check --> r2["unreachable-content"]
  check --> r3["contrast-below-aa<br/>(frame pixels)"]
  check --> r4["target-undersized<br/>(check a11y touch's policy)"]
```

```bash
# Flutter web: the semantics tree is switched on before the app starts, no served-copy injection
vlmkit scan a11y https://example.com/app/ --out a11y.json
vlmkit scan a11y https://example.com/app/ --click Practice --click Start --out game.json
vlmkit check a11y tree a11y.json

# Android
adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml
adb exec-out screencap -p > frame.png
vlmkit scan a11y ui.xml --density "$(adb shell wm density | grep -o '[0-9]*$')" --frame frame.png --out a11y.json
vlmkit check a11y tree a11y.json

# macOS: a running app's window, by name, bundle id or pid
vlmkit scan a11y --app TextEdit --out a11y.json                 # also writes a11y.png and a11y.ax.json
vlmkit scan a11y --app com.apple.Notes --window Notes --click "New Note" --out notes.json
vlmkit check a11y tree a11y.json
vlmkit scan a11y a11y.ax.json --out again.json                  # re-import the raw dump, on any OS
```

## The file

```json
{
  "format": "vlmkit-a11y/1",
  "platform": "flutter-web",
  "viewport": { "width": 375, "height": 812 },
  "scale": 2,
  "frame": "a11y.png",
  "nodes": [
    { "path": "n0", "role": "group", "rect": { "left": 0, "top": 0, "width": 375, "height": 812 } },
    { "path": "n0>n6", "role": "button", "name": "Standard",
      "rect": { "left": 16, "top": 438, "width": 114, "height": 32 },
      "states": { "selected": true }, "actions": ["tap"] },
    { "path": "n0>n28>textarea[0]", "role": "textfield",
      "rect": { "left": 8, "top": 100, "width": 130, "height": 26 }, "states": { "disabled": true } }
  ]
}
```

| field | meaning |
|---|---|
| `viewport` | The visible area in **viewport units**: CSS px on the web, dp on Android, pt on Apple platforms. WCAG's target floors are written in these units. |
| `scale` | Frame pixels per viewport unit. The default is frame width / viewport width. |
| `frame` | The screenshot taken with the tree, relative to the tree file. `--image` overrides it. |
| `path` | Unique. Ancestry comes from its prefixes (`a>b` is inside `a`), as in the scene contract. |
| `role` | One of `button link textfield checkbox radio switch slider tab menuitem combobox heading text image group list listitem dialog scrollview window`, or the platform's own role when there is no mapping. |
| `name` | What a screen reader announces. A text field's content is `value`, never `name`. |
| `states` | `disabled focused checked selected expanded hidden`. |
| `actions` | `tap longPress scroll focus setText`, or anything else the platform reports. `scroll` on a node, or `role: scrollview`, makes everything inside it reachable. |
| `textSize`, `fontWeight` | Optional. When absent, contrast measures the text height from the frame. |
| `nameDrawn` | Optional. `false` when the name is announced but not painted in the rect: an icon button's accessibility label, a separate label view's text, a role description. Contrast then skips the node (`label-only`), since there is no text there to measure. |

**The collector resolves, the judge decides.** A collector maps its platform's roles and units
onto these fields and reports facts. It never reports a verdict, such as a contrast ratio. A
collector for another platform is a script that walks that platform's accessibility API and
writes this JSON:

- **Windows:** UI Automation, via `ControlType`, `Name`, `BoundingRectangle` and `IsEnabled`.
- **iOS:** the XCUITest hierarchy.
- **Flutter on any platform:** a `SemanticsNode` dump.

Nothing in `check a11y tree` knows which platform wrote the file.

## macOS (`scan a11y --app`)

`--app` reads one window of a running app through the Accessibility API: the focused window, or
the one whose title contains `--window`. `--click <name>` presses a control by its exact title or
description first (`AXPress`), once per flag, in order.

What it needs on the Mac:

- **The Xcode Command Line Tools** (`xcode-select --install`). The collector is a small Swift
  program, compiled once with `swiftc` and cached in `~/Library/Caches/vlmkit/` by the hash of its
  source (`VLMKIT_CACHE_DIR` moves it).
- **Accessibility permission for the terminal** (System Settings → Privacy & Security →
  Accessibility). Without it every attribute read fails, so the collector stops and says so;
  `--prompt` asks macOS to show the request.
- **Screen Recording permission for the frame.** Without it a window capture holds the desktop
  behind the window, which would make contrast measure the wallpaper. So the collector does not
  capture: the tree has no frame, the report says why, and every rule except contrast still runs.

How the AX facts map onto the contract (`packages/vlmkit-markup/src/a11y-tree/macos-ax.ts`):

| contract | from |
|---|---|
| `viewport` | the window's `AXSize`, in **points** — the unit WCAG's floors mean on macOS |
| `rect` | `AXPosition` + `AXSize`, made relative to the window's top-left corner |
| `scale` | not set: the judge takes frame width / window width, so a Retina capture is 2 |
| `role` | `AXSubrole` first (`AXSwitch` → switch, `AXTabButton` → tab, `AXSearchField` / `AXSecureTextField` → textfield, `AXDialog` → dialog), then `AXRole`. An unmapped role keeps its own name (`AXScrollBar` → `scrollbar`) and is judged by its actions |
| `name` | `AXTitle`, then `AXDescription`, then the text of `AXTitleUIElement` (a separate label view). Static text and headings are named by `AXValue`; a text field falls back to `AXPlaceholderValue` |
| `value` | a text field's `AXValue`, never a secure field's |
| `states` | `AXEnabled` false → disabled; `AXFocused`; `AXValue` 0/1 of a check box, radio, switch or tab → checked; `AXSelected`; `AXExpanded`; `AXHidden` |
| `actions` | `AXPress` → tap, `AXShowMenu` → showMenu, `AXIncrement` / `AXDecrement`; a settable `AXFocused` → focus; an enabled text field → setText |

An element with no position, or with a zero width or height, is left out, and its children are
kept under its path. So are the parts of a scroll bar (`AXIncrementArrow` / `AXDecrementArrow` /
`AXIncrementPage` / `AXDecrementPage`), which belong to the scroll bar rather than standing as
controls of their own. Paths read like the Android ones: `window[0]>group[1]>button[2]`, indexed
per role among siblings.

A title, a static text's value and a field's placeholder are drawn inside the element. A
description, a linked label's text and a role description are not, so they set
`nameDrawn: false`. The window's own close, minimize and zoom buttons carry no title or
description, so they are named by their role description ("close button"), which is what
VoiceOver reads.

The raw dump (`vlmkit-ax-dump/1`) is written beside the tree as `<out>.ax.json`. It holds the
attributes as AX returned them. That way a mapping can be questioned, or a tree re-imported, on a
machine with no Mac.

### Measured on macOS 15

`.github/workflows/macos-ax.yml` runs the collector on GitHub's hosted `macos-15` runner
(macOS 15.7, Swift 6.1). The runner grants both permissions. The target is an AppKit window
(`fixtures/a11y-tree/macos/fixture-app.swift`) with one planted defect per rule and an intact
neighbour for each. `assert.mjs` requires every planted defect to be reported and every intact
neighbour to stay silent; then the saved dump is re-imported and must produce the identical tree.
The first runs are why the mapping looks the way it does:

- **An AX frame is the control's bezel, not its view.** A 40x32 rounded `NSButton` reports
  28x22, and a 14x14 borderless one reports 16x16. Target size is judged on what the user sees,
  so this is the right input. It does mean a planted "too close" defect has to be placed by its
  AX frame: placed by its view frame, "Info" sat 7pt clear of its neighbour and correctly passed
  2.5.8's spacing exception.
- **An overlay scroll bar exposes its parts as buttons.** Two of them are 0x0, plus a 15x2 and a
  15x66 page region. Before they were dropped, they produced 4 unlabelled and 3 undersized false
  findings.
- **The title-bar buttons have only a role description.** Read as names, they fixed 3 unlabelled
  findings. Then contrast read the close button's red disc, `rgb(224, 61, 53)` on white, as text at
  4.29:1. That is why the contrast check skips names that are not drawn (`nameDrawn`).
- **AppKit's default placeholder colour fails 1.4.3.** "Search" measures `rgb(191, 191, 191)` on
  white, 1.83:1. It was not planted, and it is reported: placeholder text is text.
- The planted 1.6:1 label (`#cccccc`) fails, and black body text passes. Contrast is measured on
  the Retina capture with the tree in points (`scale` 2 from the frame's width).

## The rules

| rule | fires on | WCAG |
|---|---|---|
| `unlabelled-control` | An operable node (an interactive role, or a `tap`/`setText`/`longPress` action) with no name, and no named descendant to take one from. Disabled controls are judged too: 4.1.2 has no inactive exemption. | 4.1.2 |
| `unreachable-content` | Named or operable nodes outside the viewport with no scrolling ancestor. One finding per container, with the count, because 35 log lines past the fold are one defect. | — |
| `contrast-below-aa` | Text under 4.5:1, or under 3:1 for text of 24 units (18.66 bold). The background is the rect's most common colour. The ink is the most contrasting glyph colour, after outlines, rules and underlines are dropped. Disabled nodes are listed as exempt. Needs a frame. | 1.4.3 |
| `target-undersized` | `check a11y touch`'s own policy, including its spacing exception, applied to the tree's operable nodes. A small control inside an operable ancestor that meets the floor is judged as that ancestor and listed as `enclosed`. | 2.5.8 / 2.5.5 |

`--allow '<path-or-"name">;<reason>'` exempts one node from every rule. It matches the node's
path or its quoted name. A rule that matches nothing is reported.

## Why contrast is measured in pixels

Flutter web's accessibility DOM is transparent by construction (`filter: opacity(0%)`), so
every computed colour is `rgba(0,0,0,0)`. On ofc-app this made `check integrity`'s contrast
rules report every label at 1.00:1, all eight of them false positives. The project turned the
rules off and wrote its own pixel audit. Paint here comes only from the frame.

Measuring pixels raised two problems. Both were found on ofc-app, and both are handled:

- **A chip's outline is not its text.** When the outline counted as ink, the three mode chips
  measured as 35.6-unit text, which is large text with the lenient 3:1 floor. The outline could
  also stand in for the label's colour. Ink is therefore split into connected components, and a
  component that spans the rect is dropped when it is thin (a rule or an underline) or spans the
  height too (an outline).
- **A tight text rect is its text.** Width alone is not a line. A `"7♥"` card label fills its
  own rect, and dropping every width-spanning component made it read as blank.

Text size comes from the tallest run of inked rows, divided by 0.9. An estimate that errs low
applies the stricter 4.5:1 floor.

## Measured on a real app

Measured on ofc-app ([whywaita/ofc-app#36](https://github.com/whywaita/ofc-app/pull/36)), the
Flutter web project whose hand-written workarounds this replaces:

- **Pre-fix build** (`6aaf448`, built with Flutter 3.47.5, captured at 375x812 and 375x568):
  - `Game Mode` at 4.38:1 (their audit reported 4.39:1).
  - The seed line's unlabelled, disabled `<textarea>`.
  - Every red card label at 3.68:1: `#F44336` on white, 14px text. This finding is new. The
    project's own audit could not see it, because it took the text size from the rect's height,
    so a 40x30 card counted as large text with a 3:1 floor.
- **Deployed fix:**
  - `Game Mode` at 5.89:1.
  - The red cards still at 3.68:1.
  - The 17px "Place in …" buttons are listed as enclosed by their 35px tappable rows, not as
    failures.

The fourth pre-fix defect, the unreachable Action Log, is on the result screen. The pre-fix
build could reach that screen only by dragging, and `--click` cannot drag. The fixture
(`fixtures/a11y-tree/flutter-like.html`) and the Android test cover the rule instead. Details
are in `docs/reports/2026-09-25-a11y-tree-v1.md`.
