# Brief — release-notes page

`page/index.html` plus `page/theme.css` render a small "Release notes" screen: a
toolbar with three buttons, three release cards (one of them featured), and a
loading spinner.

The page was reviewed and **several problems were reported by users**, but the
report was lost. What is known:

- Someone using a screen reader and keyboard said the toolbar "jumps around" when
  they tab through it.
- Someone who turns motion off in their OS settings said the page "still moves".
- A designer said one of the three cards "doesn't match the others" in a way they
  could not put into words.
- The page is also meant to be usable as a visual-regression baseline, and someone
  said it "never holds still long enough to screenshot".

Your job is to find each problem and fix it, in the markup or the stylesheet.

## Constraints

The page must keep, after your changes:

- three `<button>` elements in `.toolbar`, with the same labels
- three `.card` articles, one of which is `.card--featured` and stays visually
  distinguishable from the other two
- the `.spinner` element
- an entrance animation on the cards for users who have **not** asked for reduced
  motion (removing motion for everyone is not the fix)

Do not change the DOM order of the three buttons.
