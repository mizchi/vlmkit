Use case: ui-mockup
Asset type: blog design mock, visual target for HTML/CSS implementation
Primary request: Create a polished mobile blog homepage mock for the brief below.
Audience: technical readers who scan archives and read long posts.
Layout: actual usable blog homepage, not a marketing landing page.
Required sections: compact header, editorial intro, featured article, recent article list, topic filters, newsletter or RSS subscription.
Responsive target: mobile portrait.
Text: use short realistic English labels only; keep text readable; avoid tiny paragraphs.
Typography: use implementation-friendly web typography. Use Georgia/system serif
for editorial headings and system-ui/Inter-like sans for UI labels/body text.
Avoid custom display fonts, rasterized logo text, hand lettering, and font
weights that cannot be approximated in CSS. Keep mobile wrapping plausible for
real HTML text and avoid card heights that depend on generated glyph shapes.
Style: quiet editorial interface, strong typography, restrained palette, clear spacing, no decorative blobs, no fake browser chrome.
Implementation feasibility: every region should map to semantic HTML plus CSS
grid/flex with explicit min/max widths. Decorative art should be replaceable by
simple SVG or a media slot; do not rely on image-only text or complex texture.

Brief:
See ../brief.md
