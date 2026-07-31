# Creative brief — "Fieldnote" note-taking app landing page

There is NO reference design. You are free to choose layout, palette,
and typography — but the page must satisfy every requirement below and
pass the deterministic gates. All copy is quoted verbatim in this brief;
`copy-manifest.txt` carries the same lines for `check copy --manifest`.

## Page structure (top to bottom)

1. **Header bar**: product name "Fieldnote" left, nav links right:
   "Features", "Pricing", "FAQ". The bar stays usable at 375px width.
2. **Hero**: a full-width visual band (CSS-only: gradient or solid —
   no external images). The hero headline is layered ON TOP of the
   band (positioned overlay, not plain flow):
   - Headline: "Notes that survive the field."
   - Subline: "Offline-first. Plain text. Yours forever."
   - A call-to-action button: "Start writing free"
3. **Features**: three cards side by side on desktop, stacked at 375px.
   - Card 1 title "Works offline", body "Every note lives on your
     device first and syncs when you are."
   - Card 2 title "Plain-text core", body "Markdown files you can grep,
     back up, and keep for decades."
   - Card 3 title "Instant search", body "Find any note in under 50
     milliseconds, even with 10,000 of them."
4. **Pricing**: two plans in a row on desktop, stacked at 375px.
   - Plan "Solo" price "$0" with line "All features. One device."
   - Plan "Everywhere" price "$4/mo" with line "Unlimited devices.
     End-to-end encrypted sync."
   - The "Everywhere" plan carries a small corner badge "Popular"
     overlapping the card edge (intentional overlay).
5. **FAQ**: two disclosure items (native `<details>` or a button that
   toggles — if you use JS, it must run without errors).
   - Q1 "Can I export my notes?" → A1 "Yes. Your notes are already
     plain Markdown files on disk — there is nothing to export."
   - Q2 "What happens if I stop paying?" → A2 "Sync stops. Every note
     stays on every device, fully readable and editable."
6. **Footer**: "© 2026 Fieldnote Labs · Privacy · Terms" in one line
   (the `·` separators matter).

## Hard requirements

- Self-contained single HTML file (inline CSS/JS, no external requests).
- No horizontal scrolling at 1280, 768, or 375px width.
- No text may collide with or be cut off by other elements at any of
  the three widths.
- Use every copy line above EXACTLY as written (spelling, casing,
  `·`, "$4/mo").

## Done condition (deterministic)

- `check integrity attempt.html` → verdict CLEAN (default 3 viewports).
- `check copy attempt.html --manifest copy-manifest.txt` → 0 missing,
  0 placeholders.
