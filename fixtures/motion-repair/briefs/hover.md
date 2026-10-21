# Lamps: the product cards

`page.html` is a product grid. When the pointer is over a card, the card lifts
4px and its shadow deepens, over 150ms, slowing at the end. When the pointer
moves off, the card settles back down the same way, over the same 150ms.

A reviewer says: "Lifting is nice and smooth, but when I move away the card
just drops back instantly."

Fix it without changing how a card looks at rest or while the pointer is over
it. The viewport is 1280x800.
