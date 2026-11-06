# An inbox avatar with a count

A user avatar, `div.avatar`, 64x64 with fully rounded corners (a circle), 100px from the left and
100px from the top, showing a photo-like gradient that is cut to the circle. A count badge,
`span.badge`, a red pill reading "3", 22px tall, sits over the avatar's top right: its centre is on
the avatar's top right corner (the corner of its square box), so most of the badge lies outside
the circle.

1000ms after the page opens, the badge pops in: it grows from 0 to 115% of its size and settles to
100%, about its own centre, over 400ms. While it pops, and after, the whole badge is seen: no part
of it is cut off by the circle.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
