# Feature demos

One page per vlmkit feature, published at <https://mizchi.github.io/vlmkit/demos/>: a page with a known
defect, the command that finds it, its whole output and screenshots from the same run.

```bash
pnpm build
node --experimental-strip-types examples/demos/capture.mjs          # all demos
node --experimental-strip-types examples/demos/capture.mjs integrity
node examples/demos/render.mjs                                      # after editing prose only
```

- `demos.mjs` — the manifest: page under test, command, prose, screenshots to take.
- `capture.mjs` — runs every command, keeps its output in `<id>/result.json`, takes the screenshots
  (WebP), writes the gallery and the README's demo table.
- `render.mjs` — the HTML, from the manifest and the captures only.
- `demos.test.mjs` — copies equal their fixtures, outlines mark only what the tool printed, committed
  pages and the README table equal a fresh render.

To add a demo: an entry in `demos.mjs`, then `capture.mjs <id>`, then read every image it wrote and check
every number in the prose against `<id>/result.json`.
