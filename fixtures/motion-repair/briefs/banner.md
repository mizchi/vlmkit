# Inbox: the "You're back online" banner

`page.html` is an inbox. A blue banner across the top says "You're back online".
It is there from the moment the page loads. Two seconds later it slips up off
the top of the screen over 300ms, picking up speed as it goes, and after that
nobody should see it again.

A reviewer says: "The banner leaves, and then it's suddenly back. It never
actually goes away."

Fix it without changing anything else on the page. The viewport is 1280x800.
