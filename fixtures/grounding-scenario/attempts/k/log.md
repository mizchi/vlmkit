# Attempt k — triage-control log

| # | action | what I expected | what the next screenshot showed | how I knew |
|---|---|---|---|---|
| 1 | `wheel 85,120 200` | reveal tickets below the visible top 5 (list says 14 open, only 5 shown) | list scrolled; a second row titled "Checkout webhook retries exhaust..." appeared further down | the truncated title text in the list, same wording as the row I'd already seen at the top |
| 2 | `wheel 85,120 200` | reveal further tickets | screenshot identical to the previous one | pixel-for-pixel same rows/text — list had hit its bottom |
| 3 | `wheel 85,120 200` | confirm bottom-of-list (sanity check) | identical again | same as above, confirms it wasn't a one-off render glitch |
| 4 | `click 85,92` (the "Checkout webhook..." row visible at the bottom scroll position) | open that ticket's detail | detail pane: **"Checkout webhook retries exhausted for region eu-central-1"**, body: "Duplicate of an earlier report; keep it open until that one closes." | the region name and the explicit "keep it open" instruction, both printed in the detail pane |
| 5 | `wheel 85,120 -400` | scroll back to the top of the list | the original 5 tickets (Invoice PDF / SSO / Checkout webhook / Seat count / Cannot remove teammate) reappeared | matched the very first screenshot exactly |
| 6 | `click 85,68` (meant to hit the "Checkout webhook..." row, 3rd from top) | open the checkout-webhook ticket | opened **"Invoice PDF is blank for multi-currency accounts"** instead — misjudged the row boundary | detail pane title didn't match what I clicked for |
| 7 | `click 85,110` (same row, lower y) | open the checkout-webhook ticket | detail pane: **"Checkout webhook retries exhausted for region us-east-1"**, body: "Low volume there; the customer asked us to watch it rather than fix it today." | region name + explicit "don't fix, just watch" instruction in the body |
| 8 | `wheel 85,120 150` | check the middle of the list for any checkout-webhook ticket not yet seen | revealed "API key rotation docs are outdated" and another "Checkout webhook retries exhaust..." row (marked "12h") not matching either ticket already opened | new title strings/timestamp not seen in steps 4 or 7 |
| 9 | `click 85,90` (meant to hit the new "Checkout webhook..." row) | open that ticket | opened **"API key rotation docs are outdated"** instead — again misjudged the row boundary | detail pane title mismatch |
| 10 | `click 85,105` (same row, lower y) | open the checkout-webhook ticket | detail pane: **"Checkout webhook retries exhausted for region eu-west-1"**, body: "Retries stop after the third attempt even though the endpoint returns 500. eu-west-1 carries most of their checkout volume." | region name matched the brief exactly, and nothing in the body says to keep it open |
| 11 | `click 560,51` (leftmost of 4 header icons on the open eu-west-1 ticket) | archive the ticket | a tooltip reading **"Archive"** appeared over the icon, the pane grew an **"Archived."** line under the Reply button, and the ticket's row in the left list turned grey/struck-through | the tooltip text, the "Archived." label, and the visibly de-emphasized list row all agree |

Total harness actions used: 11 (budget 12). No delete/spam/snooze/wrong-archive action was taken.
