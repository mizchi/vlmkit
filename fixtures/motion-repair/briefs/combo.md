# Upload: the status toast

`page.html` shows a status toast in the bottom-right corner. When the page
loads, the toast rises 24px into its place while it fades in, over 400ms,
slowing as it arrives. Once it is in place it pulses gently, growing to 104%
and back every 1.6s, for as long as it is shown.

The pulse comes from the shared motion kit, which other components use.

A reviewer says: "The toast just fades in where it is. It never rises."

Fix it, keeping both the entrance and the pulse. The viewport is 1280x800.
