# A menu that can change its mind

A toolbar with a `button.menu-button` labelled "Menu", 40px from the left and 40px from the top.
Clicking it opens `div.menu` (a white panel, 220px wide, with five items) just below the button,
its left edge on the button's left edge: the panel unfolds downwards from its top edge (it grows
from 0 to its full height over 250ms, with its top edge staying put) while it fades in, ease-out.
Clicking the button again closes it the same way in reverse.

The menu can be clicked again while it is still opening or closing. Then it turns round from
wherever it is at that moment and goes back smoothly: it never jumps, at no moment does it show
fully open or fully closed when it was not, and it never restarts from one end.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
