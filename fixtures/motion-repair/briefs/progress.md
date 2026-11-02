# Upload: the progress bar

`page.html` shows an upload at 70%. Shortly after the page opens (the script
marks it loaded at 100ms), the blue bar should fill from empty up to 70% of
the track, smoothly over 600ms, slowing as it reaches 70%. Then it stays at
70%.

A reviewer says: "The bar just appears at 70%. There's no filling at all."

Fix it without changing how the page looks once the bar has filled. The
viewport is 1280x800.
