# Checkout: the "Shipping details" section

`page.html` is a checkout page. The "Shipping details" section starts closed.
Clicking its heading opens it: the panel grows open smoothly over 250ms,
slowing at the end, and the "Order total" box below slides down with it.
Clicking again closes it the same way.

A reviewer says: "It snaps open instantly. There's no animation, the content
just pops in and the total jumps down."

Fix it without changing how the section looks when fully open or fully
closed. The viewport is 1280x800.
