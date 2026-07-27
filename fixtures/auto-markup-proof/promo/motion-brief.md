# Motion brief — Pulse promo page

Static layout, copy, and colors are defined by the target screenshots.
This brief specifies the motion, which screenshots cannot convey.

1. **Hero entrance**: the hero content block (badge + heading + subtitle +
   CTA together) fades in while rising a small distance (~14px) over
   **600ms, ease-out, once**, when the page loads. It must end exactly at
   the layout shown in the screenshots.
2. **LIVE badge pulse**: the green LIVE badge pulses by fading between
   full opacity and ~55% opacity, **1.2s per leg, alternating, forever**.
3. **Reduced motion**: when the user prefers reduced motion
   (`prefers-reduced-motion: reduce`), both animations must be disabled;
   the page shows its final resting layout immediately.

No other element animates. Scrolling the changelog panel is native
scrolling, not scripted animation.
