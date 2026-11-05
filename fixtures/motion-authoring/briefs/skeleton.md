# A loading card

A dashboard card, `div.card`, 360px wide, 40px from the left and 40px from the top of the page,
white on a light grey page. While its data loads it shows `div.skeleton`: three rounded grey bars
of different lengths standing in for text. Across the bars, a lighter highlight sweeps from left to
right: `span.shimmer`, an 80px wide band that starts wholly to the left of the bars, ends wholly to
the right of them, and takes 1200ms to cross, at a constant speed, again and again. The highlight
is never seen outside the skeleton.

The data arrives 1500ms after the page opens. Then the real content, `div.content` (a heading and
two lines of text, in the same place as the skeleton), fades in over 300ms while the skeleton
fades out over the same 300ms. From then on only the content is seen. For people who ask for
reduced motion, the highlight stays still; the content still arrives at 1500ms.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
