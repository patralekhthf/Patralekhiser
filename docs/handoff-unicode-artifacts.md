# Handoff: Invisible Unicode Artifacts

**To:** Claude Code
**From:** Cowork session, 2026-08-24
**Requirement:** `docs/req-unicode-artifacts.md` (57 numbered requirements, FR-U1 to FR-U54)
**Status:** nothing built. No code written. This is a clean start.

Read this document first, then the requirement. This one tells you the order, the gates and
the traps. The requirement tells you what to build. Where they disagree, the requirement
wins on *what* and this document wins on *when*.

---

## 1. What you are building, in one paragraph

A deterministic pass that classifies every codepoint in the input as strip, replace or keep,
runs at the very front of `transform` in `src/engine.js`, and reports what it found as a
separate evidence class that never touches the resemblance score. It fixes three verified
defects in the shipped engine: a single zero-width space currently defeats every swap and
flag rule, bidi overrides and tag characters currently pass through into every export
unflagged, and `removeEmojis` currently deletes the orthographic joiner in Devanagari
clusters and logs it as "Emoji removal". The value of the port is the keep rules, not the
strip tables. Anyone can list zero-width characters. Not breaking emoji sequences, Persian
and Devanagari joiners, flag sequences and CJK variation selectors while removing carriers
is the actual work.

---

## 2. The repo state you are walking into. Read this before you touch anything.

**The audit module is not in `src/`.** This is the single most important fact in this
handoff and it will confuse you within ten minutes if you do not know it up front.

| File | Has the resemblance audit module? |
|---|---|
| `src/engine.js`, `src/template.html` | **No** |
| `app/index.html` (built from `src/`) | **No** |
| `design/index.html` | **Yes** (`reviewParas`, `resemblance`, `protectedRanges`, `guardText`) |
| `dist/Patralekhiser-test-build.html` | **Yes** |
| `publish/Patralekhiser-v1.2.0-preview.4.html` | **Yes** |

So `design/index.html` is not a mock and not merely a spec: it is a **fork of the built app
that is ahead of `src/`**, and the back-port into `src/engine.js` and `src/template.html`
has not happened. It is SESSION.md next action 2 and it is not your job in this handoff.

Three consequences, all of which shape the plan in section 6:

1. **`node src/build.js` is safe to run.** `app/index.html` is already the pre-audit build,
   so building from `src/` does not regress anything that is currently in `app/`.
2. **Anything in the requirement that touches `reviewParas`, `resemblance`, the panel or the
   dimension chips cannot be built yet**, because none of it exists in `src/`. That is
   FR-U30 to FR-U36 and FR-U48. They are deferred. See section 7.
3. **The tester build will still have all three defects after you finish.** Testers are
   running `dist/Patralekhiser-test-build.html` right now (SESSION.md next action 0), and it
   is built from `design/index.html`, not from `src/`. Do **not** hand-edit
   `design/index.html` to fix that. Two divergent implementations of this classifier is a
   far worse outcome than a lagging tester build. Record the lag in SESSION.md instead, so
   that tester feedback mentioning stray characters is recognised as known rather than filed
   as new.

Other state worth knowing:

- Branch `main`, clean apart from the three files this session added and a modified
  `SESSION.md`. Latest commit `651efab`.
- `config/default-config.json` is a reference copy and is **missing three sets of keys**:
  the audit module's `dimensions`, the splitting keys from `req-sentence-splitting.md`, and
  now the artifact keys from FR-U27. FR-U28a says do them in one pass. You are only adding
  the artifact keys; do not invent the other two.
- `node v22.23.2` and `git 2.34.1` are available on the device.
- Push is blocked from the device environment (SESSION.md has a section on this). Commit
  locally, then tell the user to `git push` from Terminal.
- `SESSION.md` and `README.md` are published on a public repo. Nothing operational or
  sensitive goes in either. `NOTES.local.md` is the gitignored place for that.

---

## 3. Read order

Do not skip and do not skim. Each one is here for a specific reason.

1. `docs/req-unicode-artifacts.md` — the requirement. All of it.
2. `src/engine.js` lines 283 to 300 (`settings`), 370 to 400 (`protect` / `restore`),
   530 to 550 (`removeEmojis`), 688 to 720 (`transform`). This is the code you are changing.
3. `README.md` sections "What it fixes automatically" and "Design source of truth".
4. `SESSION.md`, the section "Unicode artifacts requirement (new, 2026-08-24)" and the
   standing rule at the top.
5. `docs/req-sentence-splitting.md` sections 2, 5 and 6.3 — not because you are building it,
   but because FR-U23a depends on understanding why splitting runs *late* and this runs
   *early*, and because its FR-S18 sets the config-compatibility precedent you must follow.
6. `design/README.md` — read it, but only so you can see what you are deferring. Do not
   implement from it in this pass.
7. `docs/ref-watermarks-remover-analysis.md` sections 2 and 5, for the source project's
   design and its two known bugs, so you do not port them.

Optional but useful: the Python original is `service/scripts/text_unicode.py` in
`github.com/guillaumemeyer/watermarks-remover` at v0.5.0. Read the real tables from there
rather than trusting a transcription. It is MIT licensed. The source archive is deliberately
**not** kept in this repo, which is public, so fetch it yourself if you want it and keep it
outside the working tree. The attribution header required by acceptance item 12 goes on your
new engine block.

---

## 4. Ground rules

These are not negotiable and each has cost someone time before.

- **Never edit `app/index.html` directly.** It is build output. Changes go in
  `src/engine.js` or `src/template.html`, then `node src/build.js`.
- **Never hand-edit `design/index.html`.** See section 2, consequence 3.
- **No new dependency, no network call, no `localStorage`.** The product's first promise in
  `README.md` is that it runs entirely in the browser with no LLM, no API call and no
  network. This feature is pure table lookup and must not be the thing that breaks that.
- **ES5 plus the `u` regex flag.** `removeEmojis` already uses `u`, so it is established.
  `module.exports` guard at the bottom of `engine.js` stays as it is.
- **Bias every ambiguous case toward keep.** FR-U18 and section 4.5 of the requirement.
  A missed strip is a line in a panel that a human reads. A wrong strip is a changed word
  nobody noticed. These failures are not symmetric and the second one is the worst thing
  this product can do.
- **Write invisible characters as escape sequences in source and tests, never as literal
  characters.** The requirement's preamble sets this rule. It is not stylistic: a test file
  containing literal carriers cannot be reviewed, and a diff containing them cannot be read.
  The requirement document itself failed this on first draft and had to be fixed, which is
  why FR-U21 exists.

---

## 5. Scope fence

Do not build these, even if they seem adjacent and cheap. Each was considered and excluded
in the brainstorm that produced the requirement.

| Not in scope | Why |
|---|---|
| The `design/` back-port | Separate work, SESSION.md next action 2. This handoff is engine-only |
| The artifacts UI panel | Depends on the back-port. FR-U30 to FR-U36, deferred, see section 7 |
| Statistical or token-sampling watermark removal | Needs a language model. `README.md` line 3 and spec section 1.2 both forbid it |
| DOCX provenance reading (spec FR-1.4) | Worth doing and cheap, but it is its own requirement. Do not fold it in |
| Sentence splitting | `docs/req-sentence-splitting.md`, separate |
| Vendoring pdf.js | SESSION.md next action 4, unrelated |
| Any change to the scoring rubric, dimensions or bands | FR-U1 is that artifacts never touch the score. Touching the score to accommodate them inverts the entire point |
| Decoding a carrier payload | Requirement section 2.3. Different tool, different ethics |

---

## 6. Work sequence

Six stages. Each has a gate. Do not start a stage until the previous gate passes, and do not
batch the gates to the end.

### Stage 0. Reproduce the three defects

Before writing any implementation, write a throwaway script that reproduces D1, D2 and D3
against the current `src/engine.js` exactly as section 0.1 of the requirement shows them.

**Gate:** you have seen all three fail with your own eyes. If any one of them does not
reproduce, stop and report it. The requirement was written from observed behaviour, but the
observation was made from this session and you should not trust it blind.

### Stage 1. The classifier, with no wiring

Build `inspectArtifacts`, the shared decision function, and the tables. Nothing calls it yet.
Nothing in `transform` changes. FR-U5 to FR-U13, FR-U18 to FR-U22.

Write the keep rules **first**, before the strip tables. If you build strip first you will be
tempted to ship it, and strip without keep is the D3 bug generalised.

**Gate:** every fixture in FR-U20 classifies as keep with the right `keptBecause`, and every
kind in requirement section 2.1 classifies as expected. Tests only, no integration.

### Stage 2. `cleanArtifacts` and the inspect/clean agreement invariant

Add `cleanArtifacts` on top of the same decision function. FR-U6 is the requirement that
matters here and it is the one the source project got wrong: its inspect step reports
findings its default clean will not remove. One classifier, called by both.

**Gate:** FR-U47 passes. FR-U9 idempotence passes. FR-U46 offset validity passes over every
fixture. FR-U7 and FR-U52 prove no surrogate pair is split.

### Stage 3. Wire into `transform`, and rewrite `removeEmojis` in the same commit

FR-U23 places the pass first, ahead of `protect()`. FR-U24 rewrites `removeEmojis` to match
whole emoji sequences instead of bare codepoints.

These two go together in one commit and cannot be split. Once the classifier preserves emoji
glue, a `removeEmojis` that still deletes U+200D individually will either leave orphaned
joiners behind or keep destroying Devanagari. Landing one without the other produces a state
that is worse than today.

**Gate:** the three defect regressions FR-U41, FR-U42 and FR-U43 pass. FR-U51 proves the two
functions own disjoint codepoints. FR-U49 proves that with `artifactClean: false` the output
is byte-identical to the current engine on the existing sample article. FR-U50 proves the
sentinel hazard is closed.

### Stage 4. Configuration

FR-U27 adds five keys. FR-U28 makes missing keys fall back to defaults, never `undefined`.
FR-U29 writes the help text.

**Gate:** config export then re-import round-trips all five. A config JSON exported before
this change still loads. Acceptance item 8.

### Stage 5. Build, verify the exports, regenerate the sample

`node tests/test.js`, `node tests/fileio.test.js`, `node src/build.js`.

Then acceptance item 5, and do it properly: download the same document as .docx, .pdf, .md
and .txt and **byte-scan** each one for every stripped codepoint. Do not eyeball it. These
characters are invisible by definition and a visual check proves nothing.

Then FR-U54: regenerate `samples/sample-article-patralekhised.md` only if it actually
changed, and if it did, read the diff character by character before committing it. A silent
change to the golden sample is precisely the failure mode this whole feature exists to
prevent.

**Gate:** the existing 34 engine checks and 15 file-IO checks pass unchanged. If a swap test
broke, you violated the FR-U23 ordering. If the sample changed with `artifactClean: false`,
you violated FR-U49.

### Stage 6. Documents

- Amend `docs/ai-text-audit-spec.md` in all eight places. The checklist is in section 0.2 of
  the requirement and repeated as section 12. FR-1.8 is the headline: "normalize Unicode to
  NFC" is the defect, because NFC is *required* to preserve every one of these codepoints.
- `README.md`: add invisible characters to "What it fixes automatically". While you are in
  there, correct the stale "Needs a human" tab reference, which
  `req-sentence-splitting.md` acceptance item 9 already flagged.
- `SESSION.md`: record what shipped, and record FR-U38 honestly. Fixing D1 means swaps now
  fire where they previously did not, so resemblance scores will **drop** on carrier-laden
  documents, because auto-swaps run before flagging. The old number was wrong, not the new
  one. Also record the tester-build lag from section 2, consequence 3.

**Gate:** acceptance items 1 to 12 in the requirement all satisfied, and item 9 verified by
actual grep, not by assertion.

---

## 7. Deferred, and what to do about it

These requirements are real but unbuildable until the `design/` back-port lands. Do not skip
them silently.

| Deferred | Reason | What to do now |
|---|---|---|
| FR-U30 to FR-U36, the artifacts panel | No `resemblance` UI exists in `src/template.html` | Nothing. They are listed in the requirement and will be picked up with the back-port |
| FR-U48, score invariance | `reviewParas` does not exist in `src/engine.js` | Write the test now, guarded so it skips with an explicit printed reason naming FR-U48 and the back-port. A skipped test with a reason survives. A missing test does not |
| FR-U40, artifact pass runs when language detection refuses | FR-1.7 language detection is `T1` and unbuilt | Note it in the spec amendment only |

When you finish, add one line to SESSION.md next actions: the back-port must pick up FR-U30
to FR-U36 and unskip FR-U48. Otherwise this feature ships with no UI and nobody remembers
why.

---

## 8. Definition of done

1. All six gates in section 6 passed, in order.
2. `node tests/test.js` and `node tests/fileio.test.js` green, including the existing suites
   unchanged.
3. `node src/build.js` run, and the feature verified working in the browser from
   `app/index.html`, offline, with the network disabled.
4. Acceptance items 1 to 12 of the requirement satisfied.
5. Committed locally in coherent commits: Stage 1 and 2 together, Stage 3 alone and clearly
   messaged as the defect fix, Stage 4, Stage 5, Stage 6.
6. The user told to `git push` from Terminal.
7. A short report back covering: which gate caught what, anything in the requirement that
   turned out wrong when built, and every deferred item with its reason.

---

## 9. One decision to confirm before Stage 4

FR-U14 sets `artifactNormalizeSpaces` to **true** by default, which turns non-breaking
spaces into ordinary spaces. That changes line-breaking behaviour on things like `10 km`,
`10 %` and `Fig. 3`, and on French spacing around guillemets. It is defensible for business
prose and wrong for anything typeset.

Ask the user to confirm the default before you wire it. If there is no answer, ship it as
`true` per the requirement and say clearly in your report that the question went unanswered.

---

## 10. If you get stuck

- **A keep rule and a strip table disagree and you cannot tell which is right:** keep, and
  report the case. Section 4.5.
- **A test in the existing suite breaks:** it is almost certainly the FR-U23 ordering. The
  swap dictionaries match multi-word phrases, and anything that changes the string before
  they run can break a match. Do not "fix" the test.
- **The classifier needs a Unicode property JS does not expose:** stop. FR-U26 forbids a
  category fallback. Enumerate the range explicitly with a dated comment, or leave the
  codepoint alone.
- **The requirement asks for something that cannot be built without the back-port:** defer
  it per section 7 and say so. Do not partially back-port `design/index.html` to unblock
  yourself. That is how two divergent implementations get created.
