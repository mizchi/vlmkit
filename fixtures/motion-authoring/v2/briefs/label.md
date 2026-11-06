# An "Add to cart" button that confirms

A product card with `button.add`, 40px from the left and 40px from the top: a round 44x44 button
showing only a "+" icon. Clicking it confirms: over 300ms (ease-out) the button widens to the right
into a pill showing the icon and the label "Added to cart" on one line beside it, its height staying
44px and its left edge staying put. The label fades in as the button widens.

The label is on one line at every moment of the widening: it never wraps onto a second line, and
the button never gets taller, even for a moment. Nothing else on the card moves.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
