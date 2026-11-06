# Plan cards that lift

A pricing section: three plan cards, `div.plan`, each 300x380, in a row 8px apart, the row's top
left corner 80px from the left and 120px from the top. Each card is white with a rounded border and
holds a plan name, a price, a short list and a button, and has a small coloured tag ("Starter",
"Team", "Scale") pinned to its top right corner, sticking out 8px above the card. Cards sit flat
until the pointer rests on one.

While the pointer is over a card, the card lifts toward you over 200ms, slowing as it ends
(ease-out): it grows to 108% of its size about its own centre and casts a soft shadow. A lifted
card is on top of everything around it: no part of it, its edges included, is covered by the card
beside it. When the pointer leaves, it settles back over the same 200ms. The cards beside a lifted
card do not move.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
