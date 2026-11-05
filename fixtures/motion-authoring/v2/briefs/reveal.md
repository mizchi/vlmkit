# Features that slide in

A features section: six feature boxes, `div.feature`, each 360x160, in a grid of three columns
and two rows with 24px between them, the grid's top left corner 40px from the left and 120px from
the top, each with a heading and a sentence.

When the page opens, the boxes slide up 32px into place while they fade in, 500ms each, ease-out,
one after another in reading order, 100ms apart (the first starts at once).

For people who ask for reduced motion, nothing moves or fades: all six boxes are in place and fully
shown from the moment the page opens.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
