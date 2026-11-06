# A notification bell

An app header with a notification button at the top right: `button.bell`, 48x48, its right edge
32px from the right of the viewport and its top 24px from the top. Inside it is the bell drawing,
`.bell-icon` (an inline SVG, or any element you like), 28x28 and centred in the button.

800ms after the page opens, the bell rings once: the icon swings about the point at its top centre,
where a real bell hangs. It swings first to the right (clockwise) to 14 degrees, then to the left
to 12 degrees, then right to 8 degrees, then left to 4 degrees, and comes to rest upright: 700ms
from the start of the first swing to rest. It rings only that once. The button itself never moves.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
