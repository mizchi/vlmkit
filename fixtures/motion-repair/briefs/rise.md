# Plans: the pricing cards

`page.html` is a pricing page with three plan cards. When the page loads the
cards rise into place one after another, left to right, each 100ms after the
one before it, each fading in as it rises 16px over 400ms. After that, when
the pointer is over a card, the card lifts 4px and its shadow deepens, over
150ms; when the pointer moves off, it settles back the same way.

A reviewer says: "The cards come in nicely, but hovering does nothing. The
shadow changes and the card doesn't move at all."

Fix it without changing the entrance, or how a card looks at rest. The
viewport is 1280x800.
