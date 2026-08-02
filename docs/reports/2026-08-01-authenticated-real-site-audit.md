# Authenticated real-site audit (`--storage-state`)

The auth support shipped earlier today was verified against a fixture I
wrote myself. This audit points the gates at a **real, session-protected
application** to find out what `--storage-state` does on markup nobody on
this project authored.

## Target and access

**Swag Labs** (`saucedemo.com`), Sauce Labs' public demo app, using the
credentials **published on its own login page** for automation practice.
No third-party account, no real user data, nothing that isn't offered for
exactly this purpose.

## Getting a real site in front of the gates

Chromium cannot egress in this environment — with or without
`HTTPS_PROXY`, navigation dies at `ERR_CONNECTION_RESET`, and the agent
proxy's `recentRelayFailures` stays empty, so its connections never even
arrive. Node's `fetch` does work.

So the audit puts a **local reverse proxy** in front of the real origin
(`scratchpad/authaudit/relay.mjs`): the gates navigate to
`http://127.0.0.1:8910`, the bytes come from `saucedemo.com` over node's
fetch, and `Set-Cookie` is rewritten (drop `Domain`, drop `Secure`) so a
real session works against the local origin. `redirect: "manual"` is
essential — otherwise the relay would swallow the login-wall redirect that
is half of what this audit tests.

This is a real-site audit, not a mirror: live HTML/CSS/JS and a real
session cookie. The one honest caveat is that **cross-origin subresources
still cannot load** (Google Fonts), which shows up as relay artifacts —
classified below.

## Result 1: the login-wall guard works on a real app

```
$ vlmkit check integrity http://127.0.0.1:8910/inventory.html   # no session
verdict: DEFECTS
  x [redirected] requested /inventory.html but measured http://127.0.0.1:8910/.
    The gate measured the destination, not the URL you passed.
  1280x800: 3 component(s), 6 text block(s)      <- the LOGIN page
```

With the session: `28 text block(s)`, 8 components — the real inventory
page. Before this session's work, the no-session run would have reported
the login page as a clean result for `/inventory.html`.

**One gap found in my own heuristic:** the message is the generic
"measured the destination" rather than the login-wall hint, because Swag
Labs redirects to `/` — the login page does not *look* like a login path.
Detection is unaffected (it still fails), only the hint is missed. Keying
the hint on path text is inherently partial; a content signal (a password
field on the destination) would be the better test.

## Result 2: a false positive I introduced, found on real markup

The authenticated page reported:

```
x [occluded-text] span.active_option "Name (A to Z)" is painted over by an
  opaque element select.product_sort_container — 100% of sampled glyph points
```

Measured ground truth:

| property | value |
|---|---|
| `select.product_sort_container` opacity | **0.001** |
| its `background-color` | `rgb(239, 239, 239)` — alpha **1** |
| span text / select's selected option text | both `"Name (A to Z)"` |

This is the **styled-select pattern**: a native `<select>` is layered over
a styled span at opacity ~0 so the control keeps native keyboard and
assistive-tech behaviour while the span carries the visual design. The
overlay paints nothing. `paintsOpaquely()` tested `background-color` alpha
and ignored element `opacity`, so a deliberately invisible overlay counted
as an opaque occluder.

**Attribution, honestly:** an A/B against the pre-session revision says
`before=0, after=1` — this session surfaced it. Not, however, via the
`pointer-events` override as I first assumed: both arms hit the same
`SELECT` at the sampled point. It was the **`document.fonts.ready` wait**.
The gate now measures a more completely rendered page and therefore
*reaches* a latent false positive that was always in the probe's logic.
Making a gate see more of the page exposes bugs that were previously out
of reach — which is an argument for the settle fix, not against it.

**Fix:** effective opacity — CSS `opacity` multiplied down the ancestor
chain, plus `visibility: hidden` / `display: none` short-circuits — must
be ≥ 0.5 before an element can be an occluder at all. Regression test
M14b2 encodes the styled-select pattern.

Verified after the fix:

- the authenticated page is **CLEAN** (0 fail),
- CSS Zen Garden still reports its **3** real occlusions (the
  decorative-overlay page that guards this probe),
- all five M14 occlusion tests pass, 487/487 markup tests pass.

## Result 3: env-var auth works across gates

`VLMKIT_STORAGE_STATE` alone — no per-command flag — authenticated
`check copy` against the real app: `status: ok, manifest: 4 line(s),
missing 0`, matching `Products`, `Name (A to Z)`, `Sauce Labs Backpack`,
`Add to cart`. That is the ergonomic claim from the auth commit ("applies
to every gate at once") confirmed on a real session.

Note `Name (A to Z)` matching is itself meaningful: it lives in the span
under the invisible select, and the copy gate's geometric visibility model
correctly counts it as visible.

## Result 4: the rest of the gates on the authenticated app

With `VLMKIT_STORAGE_STATE` set, run against the real inventory page:

| Gate | Result |
|---|---|
| `check interactions` | `status: ok`, **23 interactive elements** discovered |
| `scan handlers` | `status: ok` |
| `check breakpoints --sweep` | `status: ok`, clean across 320-1280px, and it discovered the app's **five real breakpoints** (480, 640, 900, 960, 1060px) from its own CSS |
| `scan scroll` | `status: ok` |

**What I could not measure, and am not claiming.** The obvious follow-up
was a before/after A/B on those 23 controls, to size the `settleAfterLoad`
fix on a real SPA (it was 0 → 3 on my own fixture). Two attempts were
confounded and neither is usable: the first ran after the demo session had
expired, so both arms measured the *login* page (2 vs 3 controls); the
second hit the 500s timeout, because `check interactions` reloads the page
once per control probe and every load crosses the relay. So: 23 controls on
the authenticated page is verified, the *delta* attributable to the settle
fix on a real SPA is **not**.

### Unplanned validation: an expired session fails loudly

The confounded run turned into evidence for a claim the auth commit made
but had not tested. When the Swag Labs session expired, the gate did not
quietly measure the login page — it reported

```
verdict: DEFECTS
  x [redirected] requested /inventory.html but measured http://127.0.0.1:8910/
  1280x800: 6 text block(s)      <- login page, not the 31 of the authed page
```

An expired `--storage-state` is therefore a loud failure, not a silent
wrong answer. That is the property that makes replaying a session safe to
recommend at all.

## Findings classified

| Finding | Class |
|---|---|
| `occluded-text` on `span.active_option` | **false positive — fixed** (effective opacity) |
| `js-error` ×2 (`404`, `ERR_CONNECTION_RESET`) | relay artifact — cross-origin subresources cannot load through the local relay |
| `failed-stylesheet` (Google Fonts `css2?family=DM+Mono…`) | relay artifact, same cause; correctly reported as a **third-party** warn rather than a fail |
| `low-contrast-text` 3 blocks skipped (exempted) | correct — composite background, reported as skipped rather than guessed |

Every non-artifact finding on the real authenticated page was a false
positive in the tool, and it is now fixed. Zero real defects were found in
Swag Labs' markup, which is the expected outcome for a maintained demo app
and the right baseline for an FP audit.

## Method notes

- **A fixture I wrote could not have found this.** The styled-select
  pattern is a real-world idiom I would not have thought to write, and it
  defeated a probe that passes a 5-test synthetic battery.
- **Chromium egress was the binding constraint, not auth.** The relay is
  the reusable part: any gate can now be pointed at a real site through
  `RELAY_TARGET`, which also makes the FP-audit corpus refreshable without
  hand-mirroring.
- **`redirect: "manual"` in the relay is load-bearing.** With automatic
  redirect following, the relay would have hidden the login wall and this
  audit would have silently measured the authenticated page in both arms —
  the same class of vacuous-A/B mistake as the `node_modules` leak in the
  FP re-audit.
