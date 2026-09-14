# log — checkout-calls.d2 (attempt c)

Checks run each round, in the skill's order ("The loop", SKILL.md lines 119-126):
`d2 fmt` → `d2 validate` → `d2 --layout=tala … .txt` + `wc -L` → `.png` read by eye.
Width column is `wc -L` on the extended render / on the `--ascii-mode standard`
render — they disagree by 5 on the same layout (see round 1).

| # | What I changed | What told me to | wc -L (ext / std) |
|---|---|---|---|
| 1 | First write: `shape: sequence_diagram`, five actors declared in order, seven messages; returns marked `{style.stroke-dash: 3}`, the broker event `{target-arrowhead.shape: arrow}` | The skill's route table: "Draw the request / call flow between components → `shape: sequence_diagram` at the root; actors in first-use order; one message per line with its label". fmt/validate/render all exit 0 first try | 69 / 74 |
| 2 | Moved the semantics out of the styles and into the label text: `<<` prefix for the three returns, `async` word on the broker event | `diff` of my render against a style-free copy of the same file: **IDENTICAL** — `style.stroke-dash` and `target-arrowhead` are byte-for-byte invisible in the `.txt` render, so rounds 1's returns were unmarked in the deliverable. Also round 1 rendered `201 Created` as `201─Created` (the skill warned: "their spaces become line characters") | 70 / 75 |
| 3 | Replaced `<<` with a `ret` prefix and made the event `order.placed async` | The round-2 render **silently ate the `<<`**: `inventory -> orders: "<<reserved"` came out `│◀───reserved───│`, and `"<<201-Created"` came out `201─Created` — the marker is dropped on a right-to-left arrow (it survives on a left-to-right one). Same render also showed `async order.placed` → `async order─placed`, i.e. the renderer overwrote the `.` **inside the event name** with a line glyph. Probed six spellings before picking this one; two of them (`reserved (ret)`, `201 Created (ret)`) rendered with **no arrowhead at all** — `│reserved (ret)│` — which is the brief's "arrow whose ends you cannot tell apart" | 70 / 75 |
| 4 | Broker event back to a solid line with an open arrowhead; only the three returns keep `stroke-dash: 3` | The **PNG**, not the text render: with `stroke-dash: 5` on the event, the event and the three returns were all dashed, so the SVG said "the broker message is a return". Nothing in the `.txt` render could have told me this — the text render drops all four styles equally | 70 / 75 |

Stopped at round 4. Re-rendering the same file twice gave a byte-identical
`.txt` (checked), so the layout is reproducible as the skill claims.

## Done condition

1. `d2 validate` exit 0; `d2 fmt` left the file unchanged (`diff` empty). ✓
2. `d2 --layout=tala` exit 0 (`d2 layout` lists `tala (bundled)`, so no silent
   fallback). `wc -L checkout-calls.txt` = **70**, `wc -L checkout-calls.ascii.txt`
   = **75**. Both ≤ 80. ✓
3. Every message is on its own row; no label wraps; every arrow has a visible
   `<` or `>` end. ✓

## What I could NOT verify from the render

- **Nothing in the terminal render distinguishes a return from a call except
  the arrow's direction and my own `ret` prefix.** The prefix is a convention I
  invented; a reader who does not read the legend line sees seven identical
  solid arrows. I cannot tell from the render that the reviewer will read
  `ret-reserved` as "returns reserved" rather than as a method called `ret`.
- **Nothing in the terminal render distinguishes the async message.** Same
  problem: the word `async` in the label is the whole signal. The text render
  gave `order.placed-async`, so it reads as one hyphenated token.
- The space → `─` substitution is not something I can predict; it changed
  between rounds as the layout reflowed (`201 Created` was mangled in round 1
  and intact in round 4 with a longer label). I re-read every label in the
  render each round rather than trusting the `.d2`.
- In the round-4 PNG the open arrowhead (`target-arrowhead.shape: arrow`) still
  drew as a filled triangle, so in the **SVG** the async event is now
  indistinguishable from a call. I chose that over it being indistinguishable
  from a return, which is the worse error for this brief.
