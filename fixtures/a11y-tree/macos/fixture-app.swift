// An AppKit window with one planted defect per `check a11y tree` rule, and an intact
// neighbour for each, for the macOS collector's CI run (.github/workflows/macos-ax.yml).
//
//   xcrun swiftc -O fixture-app.swift -o vlmkit-ax-fixture && ./vlmkit-ax-fixture &
//   vlmkit scan a11y --app vlmkit-ax-fixture --out a11y.json && vlmkit check a11y tree a11y.json
//
// Planted (expected.json lists them):
//   unlabelled-control   an image-only button with no title or description; a plain text field
//   target-undersized    "Info", 14x14pt next to another button
//   contrast-below-aa    "Seed hint", #cccccc on white
//   unreachable-content  "Hidden log", laid out below the window with nothing to scroll it into view
// Intact neighbours: "Start", a labelled image button ("Settings gear"), "Help" (small but alone),
// "Remember me", a field named by its placeholder, a scroll view whose rows are past its edge,
// and the window's own title-bar buttons and scroll bar, which must not read as unlabelled.
// Not planted, and reported: the "Search" placeholder, AppKit's default placeholder colour
// (1.83:1 on macOS 15), fails 1.4.3.
import AppKit

final class Flipped: NSView {
  override var isFlipped: Bool { true }
}

/// A gear-ish glyph drawn by hand: an NSImage with no accessibility description of its own.
func glyph() -> NSImage {
  NSImage(size: NSSize(width: 16, height: 16), flipped: false) { rect in
    NSColor.black.setStroke()
    let path = NSBezierPath(ovalIn: rect.insetBy(dx: 3, dy: 3))
    path.lineWidth = 2
    path.stroke()
    return true
  }
}

func label(_ text: String, _ frame: NSRect, color: NSColor = .black, size: CGFloat = 13) -> NSTextField {
  let l = NSTextField(labelWithString: text)
  l.frame = frame
  l.textColor = color
  l.font = .systemFont(ofSize: size)
  return l
}

func button(_ title: String, _ frame: NSRect) -> NSButton {
  let b = NSButton(title: title, target: nil, action: nil)
  b.bezelStyle = .rounded
  b.frame = frame
  return b
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
app.appearance = NSAppearance(named: .aqua)

let window = NSWindow(
  contentRect: NSRect(x: 200, y: 200, width: 480, height: 360),
  styleMask: [.titled, .closable], backing: .buffered, defer: false)
window.title = "vlmkit AX fixture"
window.backgroundColor = .white
let root = Flipped(frame: NSRect(x: 0, y: 0, width: 480, height: 360))
root.wantsLayer = true
root.layer?.backgroundColor = NSColor.white.cgColor
window.contentView = root

root.addSubview(label("Settings", NSRect(x: 20, y: 16, width: 200, height: 26), size: 20))
root.addSubview(button("Start", NSRect(x: 20, y: 56, width: 100, height: 32)))

let unlabelled = NSButton(image: glyph(), target: nil, action: nil)
unlabelled.bezelStyle = .rounded
unlabelled.frame = NSRect(x: 130, y: 56, width: 40, height: 32)
root.addSubview(unlabelled)

let labelledGear = NSButton(image: glyph(), target: nil, action: nil)
labelledGear.bezelStyle = .rounded
labelledGear.frame = NSRect(x: 260, y: 56, width: 40, height: 32)
labelledGear.setAccessibilityLabel("Settings gear")
root.addSubview(labelledGear)

let info = NSButton(title: "", target: nil, action: nil)
info.isBordered = false
info.image = glyph()
info.imageScaling = .scaleProportionallyDown
// Right against the unlabelled button. Measured on macOS 15: a rounded NSButton's AX frame is
// its bezel (28x22 for a 40x32 view), so at x 172 "Info" sat 7pt clear and passed 2.5.8's
// spacing exception.
info.frame = NSRect(x: 164, y: 65, width: 14, height: 14)
info.setAccessibilityLabel("Info")
root.addSubview(info)

let help = NSButton(title: "", target: nil, action: nil)
help.isBordered = false
help.image = glyph()
help.imageScaling = .scaleProportionallyDown
help.frame = NSRect(x: 440, y: 20, width: 14, height: 14)
help.setAccessibilityLabel("Help")
root.addSubview(help)

let next = button("Next", NSRect(x: 20, y: 96, width: 100, height: 32))
next.isEnabled = false
root.addSubview(next)

let remember = NSButton(checkboxWithTitle: "Remember me", target: nil, action: nil)
remember.frame = NSRect(x: 20, y: 140, width: 160, height: 24)
root.addSubview(remember)

root.addSubview(label("Seed hint", NSRect(x: 200, y: 140, width: 160, height: 20), color: NSColor(white: 0.8, alpha: 1)))

let plain = NSTextField(frame: NSRect(x: 20, y: 176, width: 200, height: 24))
root.addSubview(plain)
let search = NSTextField(frame: NSRect(x: 240, y: 176, width: 200, height: 24))
search.placeholderString = "Search"
root.addSubview(search)

let scroll = NSScrollView(frame: NSRect(x: 20, y: 214, width: 440, height: 90))
scroll.hasVerticalScroller = true
scroll.borderType = .bezelBorder
let doc = Flipped(frame: NSRect(x: 0, y: 0, width: 420, height: 30 * 24))
for i in 0..<30 { doc.addSubview(label("Row \(i + 1)", NSRect(x: 8, y: CGFloat(i) * 24 + 2, width: 200, height: 20))) }
scroll.documentView = doc
root.addSubview(scroll)

// Past the bottom edge: the window does not grow and nothing scrolls it into view.
root.addSubview(label("Hidden log", NSRect(x: 20, y: 400, width: 200, height: 20)))

window.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)
app.run()
