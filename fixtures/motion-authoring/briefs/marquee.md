# A logo strip

A strip of partner logos, `div.strip`, 1200x80, 40px from the left and 40px from the top. Inside it,
`div.track` holds the logos: eight `span.logo` boxes, each 140x60 with a name in it and 20px
between them (so one set of eight is 1280px from one logo's left edge to the same logo's next
appearance), and the same eight again after them, so the strip never runs out.

The track moves to the left at a steady 80px per second, forever, and the loop is seamless: when it
starts over, nothing jumps. The strip shows only what is inside it: no logo is ever seen outside
the strip. While the pointer is over the strip, the logos stop where they are, and they carry on
from there when the pointer leaves. For people who ask for reduced motion, the logos do not move.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
