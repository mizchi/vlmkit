# A speed gauge

An inline SVG gauge, `svg.gauge`, 320x200, 80px from the left and 80px from the top. It draws a
half-circle dial whose centre is at (160, 170) in the SVG's own coordinates (the SVG's viewBox is
"0 0 320 200"), and a needle, `.needle` (a line, path or thin shape), 120 units long, from that
centre point outwards.

The needle starts pointing straight left (along the dial's flat edge). When the page opens it
sweeps clockwise to 120 degrees from there over 1200ms, slowing as it arrives (ease-out), and stays.
Throughout, its base stays on the dial's centre: it turns about that point and nowhere else.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
