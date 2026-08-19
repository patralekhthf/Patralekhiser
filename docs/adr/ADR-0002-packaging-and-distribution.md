# ADR-0002: Packaging and distribution strategy

**Status:** Deferred
**Date:** 2026-08-19
**Deciders:** Satyam Patralekh
**Related:** [ADR-0001](ADR-0001-retain-vanilla-single-file-stack.md) (accepted),
[ADR-0003](ADR-0003-document-formatting-parser.md)

> **Deferred 2026-08-19, before any option was chosen.** Decision: none of the packaging
> options will be built now. The tool stays a single HTML file sent to testers, and the
> question gets revisited only if tester feedback over the coming days produces a concrete
> reason. The analysis below is kept deliberately so it does not have to be redone, not
> because a direction was picked.
>
> **What would reopen this,** stated now while the reasoning is fresh, so a vague future
> preference does not get mistaken for a requirement:
> 1. A tester asks to double-click a `.docx` and have it open here, which is file
>    association and only Option C or D provides it.
> 2. Saved configuration or style profiles become a real requirement. That argues for
>    Option C, which can use a real config file, rather than reversing the deliberate
>    no-`localStorage` decision.
> 3. The tool is to be shared beyond people known personally, at which point an unsigned
>    download or an emailed HTML file stops being socially acceptable.
> 4. Testers report that keeping track of which file version they have is a real nuisance,
>    which is the update-path problem arriving on its own.
>
> Nothing in ADR-0003 depends on this being settled. Formatting work can proceed in full,
> because every packaging option consumes the same HTML.

## Context

v1.1 is distributed by sending someone an HTML file. They double-click it and it runs from
`file://`. There is no install, no account, no server, and no network call except pdf.js
from cdnjs when reading an uploaded PDF.

That works, and `dist/Patralekhiser-test-build.html` is currently being shared with testers
exactly this way. The question is whether v2 should be an installable application with
platform installers.

Forces at play:

- **The privacy claim is a feature, not a footnote.** People paste unpublished writing into
  this. "Open this file, nothing leaves your browser, read the source yourself" is the
  strongest verifiable form of that promise, and it is strongest precisely because there is
  no host to trust.
- **Distribution by email does not scale past friends.** No update path, no discoverability,
  and every recipient is on whatever version they were sent.
- **Nothing currently persists.** No `localStorage`, by explicit design, so configuration
  changes die on reload. An installed application could reasonably hold a config file.
- **Signing is a real, recurring cost.** Notarised macOS builds need an Apple Developer
  account. Windows needs a certificate. Unsigned installers produce security warnings that
  will stop non-technical users cold.
- **One developer, intermittent time.** Anything with a release matrix competes directly
  with feature work.
- **The interaction model is desktop-shaped.** See the mobile section below.

## Decision

Adopt a staged approach and do not build installers yet.

1. **Now:** keep `file://` distribution of the single HTML file. Vendor pdf.js locally so
   the offline claim becomes unconditional.
2. **Next:** add a PWA layer, a web app manifest plus a service worker, and host the file
   on GitHub Pages. This gives installability on macOS, Windows, Linux, and as a home
   screen app on iOS and Android, from one codebase, with no signing and no toolchain.
   Continue to publish the plain HTML file alongside it for anyone who prefers it.
3. **Only on a concrete trigger:** wrap in Tauri for real desktop installers. The likeliest
   trigger is file association, wanting to double-click a `.docx` and have it open here.
   Choose Electron over Tauri only if the decision is made to replace the hand-rolled docx
   and PDF writers with Node libraries.

## Options Considered

### Option A: Stay on plain `file://` HTML

| Dimension | Assessment |
|---|---|
| Complexity | None. Already done |
| Cost | Zero |
| Reach | Any device with a browser, if the file gets there |
| Team familiarity | Complete |

**Pros:** strongest privacy story; zero maintenance; no signing; works offline once pdf.js
is vendored; source is readable by the recipient.
**Cons:** no update path; no icon or app identity; downloads folder clutter; awkward to
explain at any scale; no file associations; no persistence.

### Option B: PWA served over HTTPS

| Dimension | Assessment |
|---|---|
| Complexity | Low. Manifest, service worker, icon set |
| Cost | Free hosting on GitHub Pages |
| Reach | Desktop installs plus iOS and Android home screens |
| Team familiarity | New but small surface |

**Pros:** one codebase for every platform; genuine install and app icon; offline after
first load; updates propagate through the service worker; no signing, no notarisation, no
Rust or Node toolchain; keeps the single-file architecture from ADR-0001 essentially intact.
**Cons:** requires hosting, since a `file://` page cannot register a service worker, so the
privacy claim moves from "read the file" to "trust the host plus verify offline"; no file
associations; no native menus; iOS PWA support has historically lagged and should be tested
rather than assumed; service worker cache invalidation is a genuine source of "why am I on
the old version" confusion.

### Option C: Tauri desktop wrapper

| Dimension | Assessment |
|---|---|
| Complexity | Medium. Rust toolchain to build, per-platform config |
| Cost | Apple Developer account, Windows certificate, build matrix |
| Reach | macOS, Windows, Linux. No mobile |
| Team familiarity | None |

**Pros:** real installers with an app identity; small binaries, single-digit MB, versus
Electron; file associations; native save dialogs so exports land where the user chose; a
real config file, which would let the no-persistence limitation be lifted deliberately
rather than by adopting `localStorage`.
**Cons:** signing and notarisation become an ongoing obligation; uses the OS webview, so
platform engine differences apply, and `src/fileio.js` depends on `DecompressionStream` for
docx reading, whose availability in the macOS WebKit versions being targeted must be
verified before committing, since zip reading is load-bearing; adds a release process where
none exists; no mobile.

### Option D: Electron desktop wrapper

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Same signing burden, plus roughly 100 MB per install |
| Reach | Desktop only |
| Team familiarity | None |

**Pros:** everything Tauri offers, plus a known Chromium engine on every platform, which
removes the `DecompressionStream` uncertainty entirely; Node available, so `toDocx` and
`toPdf` could be replaced by mature libraries instead of extended by hand.
**Cons:** installer size is hard to defend for a text tool; same signing obligation; the
Node option quietly contradicts the zero-dependency stance in ADR-0001 and should be its
own decision if wanted.

### Option E: Capacitor mobile wrapper

| Dimension | Assessment |
|---|---|
| Complexity | Medium, plus app store review |
| Cost | Two store accounts, review cycles |
| Reach | iOS and Android |
| Team familiarity | None |

**Pros:** genuine mobile app presence.
**Cons:** wraps a two-pane desktop interface that does not work at phone width, so it would
ship something that installs and cannot be used. This is a UX problem, not a packaging one.
See the mobile section below.

## Mobile, recorded here rather than as its own ADR

Mobile was going to be a separate ADR. It does not need one, because it is not a packaging
question. Capacitor would wrap the existing HTML without difficulty, and the result would
install and be unusable.

The interaction model is the obstacle. The product is a side-by-side reviewer: original
left, rewritten right, paragraph-level scroll sync in both directions, hover pairing, inline
highlights, and a drawer docked to the bottom of the right pane capped at 48 percent of its
height. At phone width there is no second pane to sync to, and a drawer taking half the
viewport leaves almost nothing of the text under review visible. `design/README.md` states
plainly that mobile was never touched.

So mobile is a redesign, not a build target. It would need a single-pane model with a
different way to move between the original and the rewrite, and a review surface that is
not a bottom drawer. That is a product decision with its own scope, and it should be made
because someone actually wants to review prose on a phone, which no one has yet said.

The PWA path in Option B does incidentally put an icon on a phone home screen. If that is
ever tested, expect it to confirm the above rather than contradict it.

## Trade-off Analysis

The instinct that an installer makes the tool more legitimate is worth examining, because
here it partly inverts. The product's distinguishing property is that nothing leaves the
machine, and a local HTML file is the most auditable expression of that. Every packaging
step adds a party to trust: a host for the PWA, a signing identity and an update channel
for an installer. The PWA is a reasonable trade because the service worker means it
demonstrably runs offline once installed, so the claim remains testable. It is still a
step away from "read the source yourself".

The second consideration is that installers create an obligation that does not currently
exist. Today, sending a file means everyone is current. With installers, either auto-update
infrastructure is built or a population is stranded on old versions, and either way signing
must be renewed. For a single developer working intermittently, that is a standing tax on
a benefit that no user has yet asked for.

Tauri over Electron on size, unless the writers are being replaced by Node libraries, in
which case Electron's Node access is the whole point and its size is the price. That choice
should not be smuggled in through packaging; it belongs in ADR-0003.

## Consequences

**Easier:**
- v2 formatting work proceeds without waiting on a packaging decision, since every option
  consumes the same HTML.
- The PWA step is small and reversible.
- Vendoring pdf.js makes "works fully offline" true without qualification, which benefits
  every option.

**Harder:**
- Hosting for the PWA means a public URL, and therefore a decision about whether the tool
  is public. That is a product decision this ADR does not make.
- Service worker caching will produce stale-version reports. Plan a visible version string
  in the UI before shipping the PWA.
- Persistence stays unsolved in options A and B. If saved configuration becomes a real
  requirement, that argues for Option C sooner, since it can use a real file rather than
  reversing the deliberate no-`localStorage` decision.

**To revisit:**
- If a tester asks for file associations, or for exports to land somewhere specific without
  a picker, reopen Option C.
- If iOS PWA testing shows the install path is unreliable, the mobile question collapses
  into the redesign question anyway.
- If the tool is ever shared beyond people known personally, revisit whether an unsigned
  download is acceptable.

## Action Items

Only the first is live. The rest are parked with this ADR and should not be started unless
one of the reopening triggers above fires.

1. [ ] **Live.** Vendor pdf.js locally, removing the last network dependency. Worth doing
       on its own merits: it makes "works fully offline" unconditional for the single HTML
       file being tested right now, and it is independent of every packaging option.
2. [ ] **Live, small.** Add a visible version string to the UI. Useful immediately: testers
       over the next several days will otherwise have no way to tell you which build they
       are reporting on.
3. [ ] Parked. Write the PWA layer: `manifest.webmanifest`, a service worker with an explicit cache
       version, and an icon set. Keep the plain HTML file published alongside.
4. [ ] Parked. Decide whether the hosted URL is public or unlisted before publishing.
5. [ ] Parked. Test the iOS and Android home screen install path on real devices,
       expecting the interaction problems recorded above.
6. [ ] Parked. Before any Tauri work, verify `DecompressionStream` support in the macOS WebKit
       versions targeted, since docx reading depends on it.
