# About Kumo Studio: the sections below the header

`page.html` is a long "about" page. The header is there from the start. Every
section below it starts hidden and, as it scrolls into view, fades up into
place (from 16px lower, over 400ms, slowing at the end). Once a section has
come into view it stays fully visible.

A reviewer says: "I scrolled down and the 'Our studio' section never showed
up. There's just a big empty gap between 'What we do' and 'Team'."

Keep the effect: the sections further down must still be hidden until they
scroll into view, and must still fade up when they do. The viewport is
1280x800.
