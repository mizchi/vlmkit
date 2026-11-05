# Tabs with a sliding indicator

A settings screen. At the top left, 40px from the left and 40px from the top, a row of four tabs:
`nav.tabs` holding four `button.tab` elements, side by side with no space between them, labelled
"Overview", "Activity", "Settings" and "Billing and invoices" (16px text, 12px padding above and
below, 20px left and right, so the tabs have different widths). Below the tabs there is some page
content of your choosing.

Under the selected tab sits its indicator, `span.indicator`: a 3px tall bar, exactly as wide as the
selected tab and starting at its left edge, its bottom on the tabs' bottom edge. "Overview" is
selected when the page opens, and the selected tab has `aria-selected="true"` (the others
`"false"`).

Clicking a tab selects it, and the indicator slides to it over 300ms, starting slowly and slowing
again at the end (ease-in-out), changing its width to the new tab's width over the same 300ms. The
tabs themselves never move or change size. For people who ask for reduced motion, the indicator
goes to the new tab at once.

Write the whole page yourself as one file, `page.html` (CSS in a `<style>`; script only where this brief needs one). The viewport is 1280x800. Use the class names given here exactly: the page is checked through them. Animate with CSS transitions or animations (or the Web Animations API), never a `requestAnimationFrame` loop or a timer that moves things, and a delay is an animation or transition delay, not a timer.
