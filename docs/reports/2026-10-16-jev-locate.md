# `inspect locate` and `click` with `describe`: finding a described element with no DOM (2026-10-16)

This builds item 2 of `2026-10-16-jev-box-bench.md`: finding an element by its description on a
screenshot, for UIs whose DOM is not what is drawn. Examples are a Flutter web canvas, an Android
frame and a macOS window capture.

```bash
vlmkit inspect locate shot.png 'the "Save" button' --mark marked.png      # TYPESAFEAI_API_KEY
vlmkit inspect locate shot@2x.png 'the "Star 42" button' --dpr 2 --json   # box in CSS px too
# in an inspect interact sequence:
{ "action": "click", "describe": "the \"Save draft\" button" }
```

The core is `locateByDescription` (`@mizchi/vlmkit-ai/locate.ts`). It makes two requests:

1. One request asks two typed questions about the whole screenshot: a `noul` ("the screenshot
   shows …") and a `box`. A screenshot over 1568px, such as a 2x capture, is shown shrunk to fit
   Jev's limits.
2. If presence is ≥ 0.5, a second `box` is asked on a crop of the **original** pixels. The crop
   is the first box padded by its own size and grown to 280px, then magnified up to 4x. Its
   answer is mapped back.

`inspect locate` prints the box and the point, and exits 0 when found and 1 when not, so a script
can branch on it. `--mark` writes the screenshot with the box outlined, for checking by eye.
`inspect interact` takes `describe` instead of `selector` on a `click` step. It screenshots the
viewport at CSS scale, locates the target and clicks its centre. The report lists every located
click with its point and presence. A target that is not found is a step failure that quotes
Jev's presence answer.

## Measured

`jev-box.ts --only locate` runs the shipped function as it is, end to end. The targets are the 85
named elements of the grounding bench: links, buttons, headings and fields with a unique label on
9 CSS-challenge fixtures at 1280x800. The decoys are 85 labels taken from other fixtures. Data:
`docs/reports/data/2026-10-16-jev-locate/` (`--rescore` reproduces it with no key).

| | result |
|---|---|
| targets found | **81/85** |
| found with the click point on the target | **80/81** |
| end to end (found and on target) | **94%** |
| decoys reported not found | **85/85** |
| median edge error / IoU of found targets | 4.1px / 0.75 |
| cost | 251 calls (presence-only on decoys), $0.034; median 287ms a call |

- **The 4 misses are the presence question, not the box.** Three are form fields described by
  their placeholder ("the text field whose placeholder reads 'you@example.com'"). The `noul`
  reads placeholder text as not shown (presence ≤ 0.01), as it did in the first bench, although
  `box` finds those fields. The fourth is a dropdown whose label runs over two lines. The usage
  text says to describe a field by its label, and `--no-presence` returns the box anyway.
- **The 1 off-target is a neighbour** ("Build a bundle", IoU 0.40). Every single-look miss in
  the first bench was the neighbouring item as well.
- **A 2x capture works through the shrink.** On `page.html` at 2560x1600, `'the "Star 42" button'
  --dpr 2` came back at CSS box 25.4,110.2 78.4x22.4 against the DOM's 24,110 79.7x22 (within
  1.5px). The second look crops the original 2x pixels, so the shrink costs the first look only.
- **`inspect interact` on a canvas app** (a page whose only element is a `<canvas>`, with four
  painted buttons). "Save draft" was clicked at (651, 521); the button is 580..730 x 500..548, and
  the app recorded `save`. "Dark mode" was clicked at (119, 140), and the page turned dark (94.9%
  of pixels changed). "Archive", which the page does not have, failed the step with presence 0.01,
  and nothing was clicked.

## Decisions

- **The presence question is on by default** because `box` always returns a box. Without the
  `noul`, a description of something absent clicks somewhere. The two questions share one request
  and one image, so presence costs about 20 tokens.
- **Interact's screenshot is CSS-scale** (`scale: "css"`), so the box is in the coordinates
  `page.mouse.click` takes at any device scale factor.
- **Refused before the browser starts:** a `describe` click with no key, and a click with both
  `selector` and `describe` or with neither. Each is a `UsageError` naming the step.
- **A failed `describe` click gets no selector suggestions.** The healer's "did you mean" is for
  selectors, and a description has none to heal.
- `locateByDescription` throws `LocateError` for an image no scale fits. That is an edge ratio
  over 5.6 (1568 / 280), for example a 3000x100 strip. Crop it to the part to search.

## Not measured

- No real Flutter, Android or macOS build. The interact round used a canvas page written for it,
  and the 85 targets are DOM pages photographed. `scan a11y --click` still finds Flutter targets
  through the accessibility DOM, which needs no model. `describe` is for when that DOM is absent
  or wrong.
- Repeated or ambiguous labels: the bench only asks about labels that appear once on the page.
  Two "Save" buttons need a description that tells them apart ("the Save button in the dialog").
- Icons without text, and any description wording other than `the "<label>" <role>`.
