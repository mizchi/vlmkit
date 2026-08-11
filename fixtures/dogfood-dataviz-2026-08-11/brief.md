# Ops dashboard — reported problems

This is the internal ops dashboard. It is served by a dev server, reads two
endpoints, and embeds a charting library that renders its own zoom controls into
the page. Start it with:

```
node fixtures/dogfood-dataviz-2026-08-11/attempts/<your-dir>/serve.mjs <port>
```

It prints the URL it bound. **The dashboard has to be checked as it is served** —
we tried keeping a saved copy of the HTML and it drifted from the real page
within a week, so a saved copy is not an acceptable answer.

Five things came in this week.

1. **"I cannot get any of this into CI."** Every check we point at the running
   dashboard dies after about half a minute without reporting anything at all.
   The page itself loads fine — it is on screen in well under a second.

2. **"The grey text under each number is unreadable."** Two people on the
   platform team said this independently; one of them has low vision.

3. **"Tablet width has a horizontal scrollbar."** Only at tablet width. It looks
   fine on a phone and fine on a laptop.

4. **"There is a note to ourselves shipped in the UI."** Somebody spotted
   unfinished text on the error-rate panel. For what it is worth, the platform
   team has since confirmed the denominator: it is successful requests, not total
   requests.

5. **"The design-consistency number never moves."** It has reported the same
   verdict since the charting library was added, so we cannot tell whether our
   own components are converging. We restyled what we could reach on the
   library's controls and it made no difference. We are not going to fork the
   library, and we are not going to hand-tune its internals.

Fix what is ours to fix. The charting library's own markup is not ours — treat it
the way you would any vendor DOM.
