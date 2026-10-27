# Field Notes: the cookie message

`page.html` is an article with a dark cookie message fixed at the bottom of
the window. Clicking Dismiss makes the message fade out while it sinks 16px
(250ms, speeding up as it goes); then it is gone for good and nothing on the
page can be clicked through it.

A reviewer says: "Dismiss works, but the message just vanishes. The fade
never plays."

Fix it without changing how the article or the message look before Dismiss
is clicked. The viewport is 1280x800.
