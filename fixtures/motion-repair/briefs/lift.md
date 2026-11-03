# Pricing: the plan cards

`page.html` is a pricing page with three plan cards side by side. When the
pointer rests on a card, the card lifts toward you over 200ms, slowing at the
end: it grows to 110% of its size and casts a soft shadow. A lifted card is on
top: it rises above the cards beside it, its shadow falls over them, and no
part of it is covered by anything. When the pointer leaves, it settles back.

A reviewer says: "Hovering the middle card looks off. Its right edge seems to
slip behind the Business card."

Fix it without changing how the cards look or how far and how fast they lift.
The viewport is 1280x800.
