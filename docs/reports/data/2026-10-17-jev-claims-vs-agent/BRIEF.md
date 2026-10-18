# Task

`images/` holds 27 screenshots of web pages (1280x800 PNG). For each image, judge each of
these five statements by looking at the image, and give the probability (0 to 1, two decimals)
that the statement is true of what the screenshot visibly shows:

- c0: the screenshot shows an error message or error banner
- c1: the screenshot shows a modal dialog open over the page
- c2: the screenshot shows a broken or missing image
- c3: the screenshot shows text overlapping other text so that it is hard to read
- c4: the screenshot shows a loading spinner or loading indicator covering the page

Rules: look at every image with your own vision (the Read tool on each PNG). Do not run code on the
pixels, do not look anywhere outside this directory, and judge each image on its own.

Write `answers.json` in this directory:
`{"<image id>": {"c0": 0.05, "c1": 0.9, "c2": 0.1, "c3": 0.02, "c4": 0.0}, ...}`
with one entry for each of: 09e452, 120869, 23741a, 289374, 2c7da9, 49e4c5, 4b4dd2, 4e02aa, 4e8bca, 5a35f0, 5db0a0, 60ab93, 6aa87b, 6d5275, 9165b0, 927cd8, a05904, b8a6d4, c410b3, c64495, ca8963, d759f8, e7f867, ee719b, ee9ca8, f8551a, fc423e.
