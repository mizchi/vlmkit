# Billing: the help bubble

`page.html` is a billing form. Next to "VAT number" there is a small "?"
icon. When the pointer is over it, a dark help bubble fades in above it over
200ms. When the pointer moves off, the bubble fades out the same way, over the
same 200ms, and is then gone.

A reviewer says: "It fades in nicely, but the moment I move away it just
vanishes. There's no fade out."

Fix it without changing how the bubble looks or where it sits. The viewport is
1280x800.
