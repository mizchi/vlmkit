# Flash cards: turning a card over

`page.html` is a flash-card page. The card shows its question side. Clicking
"Show answer" turns the card over around its vertical axis, over 500ms,
easing in and out, to show the answer side (dark blue). Clicking again turns
it back. At no point does the question side show through backwards: once the
card has turned past edge-on, only the answer side is seen.

A reviewer says: "After it turns over I still see the question, just
mirrored. The answer never appears."

Fix it without changing how either side looks when it faces you. The viewport
is 1280x800.
