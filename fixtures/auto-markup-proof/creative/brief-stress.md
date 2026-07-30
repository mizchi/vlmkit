# Creative brief (stress) — "Fieldnote Sync" technical spec page

NO reference design. Layout, palette, and typography are yours — but
every requirement below is mandatory and the page must pass the gates
at 1280, 768, AND 375px. This page is deliberately dense: long
unbreakable strings, a fixed sidebar, and a packed stats strip. Copy
must be used EXACTLY as quoted; `copy-manifest-stress.txt` carries the
same lines.

## Layout skeleton

- **Desktop (≥1024px)**: a 260px fixed-width sidebar on the left, main
  column on the right.
- **768px**: sidebar collapses above the main column (full width).
- **375px**: single column, nothing may stick out or collide.

## Sidebar (in order)

1. Product mark "Fieldnote Sync"
2. Version chip "v2.11.0-rc.3+build.20260730"
3. Nav list: "Overview", "Endpoints", "Conflict model", "Limits",
   "Changelog"

## Main column (in order)

1. **Title block**
   - H1: "Replication protocol specification"
   - Lead: "How ten thousand devices stay in agreement without a
     central clock."
2. **Stats strip**: four cells in one row at 1280, 2x2 at 768, stacked
   at 375. Each cell is a big value over a small label:
   - "12 ms" / "median sync latency"
   - "99.999%" / "delivery guarantee"
   - "4,096" / "max concurrent replicas"
   - "0" / "bytes readable by our servers"
3. **Endpoint card**: a card titled "Replication endpoint" containing
   the full connection string on one logical line (it may wrap, but
   must never overflow the card or the viewport):
   - "sync://replication.fieldnote.example/v2/streams/primary?compression=zstd&frame=64KiB"
   - Below it a note: "The endpoint identifier is immutable; treat it
     as an opaque capability URL."
4. **Conflict model section**: H2 "Conflict model" and two paragraphs:
   - "Every edit is a signed operation in a per-note log. Concurrent
     edits merge deterministically; the merge function is commutative,
     associative, and idempotent."
   - "The pathological case — simultaneous renames of the same note on
     offline devices — resolves by lexicographic device fingerprint,
     documented as Entscheidungsverfahrensdokumentation in the German
     compliance annex."
5. **Limits table**: a two-column definition list or table titled
   "Hard limits" with four rows (term → value):
   - "Maximum note size" → "1 MiB"
   - "Maximum attachment size" → "25 MiB"
   - "Log retention on free plan" → "90 days"
   - "Device fingerprint length" → "128 hexadecimal characters"
6. **Changelog strip**: one line, small text:
   - "2026-07-30 · rc.3 · frame negotiation hardened · zstd window capped"
7. **Footer**: "© 2026 Fieldnote Labs · Status · Security disclosures"

## Hard requirements

- Self-contained single HTML file. No external requests, no JS needed
  (pure static is fine).
- The connection string and the version chip are UNBREAKABLE-looking
  tokens: you must make them wrap or shrink safely rather than let
  them overflow (overflow-wrap / word-break are your tools).
- No horizontal page scroll at any of the three widths.
- No text collision, no cut-off text, at any of the three widths.
- All copy EXACT (casing, `·`, "99.999%", the German compound word).

## Done condition (deterministic)

- `check integrity attempt-stress.html` → verdict CLEAN.
- `check copy attempt-stress.html --manifest copy-manifest-stress.txt`
  → 0 missing, 0 placeholders.
