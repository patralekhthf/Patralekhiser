# Requirement: Invisible Unicode Artifacts

**Status:** IMPLEMENTED 2026-08-24. Engine, configuration, tests and the artifacts panel
are all built and in `src/`. The one requirement still open is FR-U40, which depends on
FR-1.7 language detection and therefore has nothing to hook into yet. See SESSION.md for
the six places this document turned out different once built.
**Owner of the work:** Claude Code.
**Target files:** `src/engine.js`, `src/template.html`, `config/default-config.json`,
`tests/test.js`. Never `app/index.html` directly, it is build output.
**Read first:** `design/README.md`, `design/INTEGRATION.md`, `design/index.html`
(final arbiter on anything UI). Panel layout, chips, drawer behaviour and the design
tokens are specified there and must not be reinvented.
**Ported from:** `guillaumemeyer/watermarks-remover`, MIT licence, file
`service/scripts/text_unicode.py` at v0.5.0. Analysis in
`docs/ref-watermarks-remover-analysis.md`. This is a port from Python to JS, not a
dependency. Attribution belongs in a header comment on the new engine block.

**Notation.** Invisible codepoints are written in escaped form throughout this document
(`U+200B`, or `\u200b` inside code) and never as literal characters. A spec about
invisible characters cannot contain any, or it becomes unreviewable and unsafe to copy.

---

## 0. The claim this document makes

`docs/ai-text-audit-spec.md` FR-1.8 reads:

> Normalization: collapse runs of whitespace, normalize Unicode to NFC, convert smart
> quotes to straight quotes for matching only (never for display), preserve paragraph
> breaks.

That line is the defect this document fixes. NFC normalization does nothing to any
zero-width character, any bidi control, any tag character, any noncharacter, or any
private-use codepoint. Every one of them survives NFC untouched, by design: normalization
is required to preserve them. So the spec currently believes the text is canonical when
it is not.

This is not a new detection dimension and must not become one. It is two things:

1. **A normalization defect.** Invisible characters defeat every string-matching rule in
   the engine. Fixing that is maintenance on the existing product, not a new feature.
2. **A separate evidence class.** Everything else the audit module reports is inference
   about tendency. An invisible carrier is an artifact, verifiable by offset and
   codepoint. It is the only thing in the module that can be stated as fact rather than
   scored, and it must be presented that way and kept out of the score.

### 0.1 The three defects, verified by running `src/engine.js`

Not hypothetical. These were reproduced against the current engine with
`config.defaultConfig`.

**D1. One zero-width space defeats the entire rule engine.**

```
in  "We utilize the platform to facilitate growth."
out "We use the platform to help growth."         changes: Simpler word x2

in  "We util\u200bize the platform to facil\u200bitate growth."
out "We util\u200bize the platform to facil\u200bitate growth."
                                                  changes: (none)   flags: 0
```

Every `simpleSwaps`, `hypeSwaps`, `fillerPhrases`, `flagWords`, `contractions` and
`protectedTerms` entry has this hole, because all of them are `\b`-anchored regex matches
on the raw string. The document looks processed and is not. Nothing tells the reviewer a
rule was skipped, which is worse than the miss itself.

**D2. Carriers pass through into every export.**

```
in  "Total: \u202e100\u202c dollars."
out "Total: \u202e100\u202c dollars."             changes: (none)   flags: 0

in  "Cost is 10 USD\u{e0041}\u{e0042}."
out "Cost is 10 USD\u{e0041}\u{e0042}."           changes: (none)   flags: 0
```

U+202E is a right-to-left override, the Trojan-Source class: it reorders the rendering of
everything after it. U+E0041 and U+E0042 are tag characters, the standard ASCII-smuggling
channel. Both reach `fileio.js` and are written into the Word, PDF, Markdown and plain
text output. The tool currently launders a payload and stamps it house-style.

**D3. `removeEmojis` corrupts Devanagari and reports it as a clean change.**

```
in  "The form <ka+virama><ZWJ><ssa> appears."     (Devanagari, U+0915 U+094D U+200D U+0937)
out "The form <ka+virama><ssa> appears."          changes: Emoji removal
```

`removeEmojis` (`src/engine.js:536`) matches `\u{200D}` and `\u{FE0F}` as bare codepoints:

```js
var re = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{2764}]/gu;
```

The ZWJ in that cluster is an orthographic joiner, not a carrier. It is deleted, the
Changes tab labels it "Emoji removal", and the reviewer has no way to see that the word
was altered. Persian ZWNJ survives only because U+200C happens not to be in that
character class. Myridius writes for readers in India: this is not a hypothetical locale.

D3 is the argument for porting a classifier rather than writing a strip table. A naive
table makes D3 systematic instead of accidental.

### 0.2 Sections of `ai-text-audit-spec.md` this amends

Listed here so the amendment is a checklist, not a memory. Section 12 repeats it as a
working list.

| Spec section | Change |
|---|---|
| FR-1.8 | Add artifact classification to normalization, ahead of NFC. State that NFC does not remove invisible carriers |
| Section 6, new 6.7 | Add metric group M-42 to M-45, marked never scored, following the M-27 precedent |
| FR-1.7 | The artifact pass runs even when language detection refuses analysis. A carrier is a carrier in any language |
| Section 8.1 | Add the `Artifact` object alongside `Finding`. Artifacts are not Findings and do not obey FR-8.2 or FR-8.3 |
| FR-8.5 | Add the artifacts panel to the ordered report list, adjacent to the provenance panel |
| Section 10 | Add `artifacts` and `artifactSummary` to `AnalysisResult` |
| Section 11 | Add the fixture requirements from section 9 of this document |
| Section 12 | Phase 1 gains the artifact pass. Note that its exit criterion moves, see FR-U39 |

---

## 1. Why this stays out of the score

Stated first because every other decision follows from it.

**FR-U1.** An artifact must never change `score.weighted`, any `dimensions[].raw`, the
band, or the confidence level. Not by a point, not by a fraction.
*Acceptance: a unit test asserts that `reviewParas` output on a document is
score-identical with and without artifacts inserted into it, for every kind in the
taxonomy.*

Three reasons, in order of importance.

**It would make one pasted character move a verdict.** The score is banded and
density-driven. A rubric that responds to a single codepoint is not measuring register, it
is measuring whether the author's clipboard was clean. That is a false positive in both
directions: a careless copy from a web page reads as heavy resemblance, and a carefully
cleaned piece of pure model output reads as human.

**It is a category error.** Sections 6 and 7 measure how closely prose resembles the
default register of model output. An invisible character is not register. It says
something about the file's history, which is exactly what FR-1.4 already carves out into
a separate provenance panel with the note *"This must not feed the score. Keeping it
separate is what stops the report becoming an accusation engine."* The same sentence
applies here without modification.

**Section 1.2 is a hard boundary and this is the likeliest place to breach it.** Artifacts
are the most concrete-looking evidence the module will ever hold. Concrete evidence inside
a scored rubric is what turns a resemblance report into an accusation. Keep them adjacent
and unweighted, and the report can say *here is one thing we can prove, and separately,
here is an estimate.* Merge them and the product has quietly become a detector.

**FR-U2.** The artifacts panel carries a fixed caveat, drawn from the locked vocabulary
per FR-0.2, stating that finding no artifacts is not evidence of human authorship, and
that finding artifacts is not evidence of authorship either. Carriers arrive from web
pages, PDFs, CMS exports and ordinary copy-paste far more often than from anything
deliberate.
*Acceptance: the string is present in the HTML, Markdown and JSON exports.*

---

## 2. Scope

### 2.1 In scope

A single deterministic pass over text that classifies every codepoint into `strip`,
`replace` or `keep`, applies the first two, and reports all three.

Eleven kinds, matching the source implementation's taxonomy so the port stays checkable
against it:

| Kind | Examples | Default action |
|---|---|---|
| `zwj_family` | U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 word joiner, U+FEFF BOM, U+180E | strip unless a keep rule fires |
| `bidi` | U+202A to U+202E, U+2066 to U+2069, U+200E, U+200F, U+061C | strip overrides and unpaired embeddings; keep marks and isolates |
| `tag_chars` | U+E0001, U+E0020 to U+E007F | strip unless part of a complete flag sequence |
| `variation_selector` | U+FE00 to U+FE0F, U+E0100 to U+E01EF, Mongolian FVS | strip unless after a valid base |
| `noncharacter` | U+FDD0 to U+FDEF, U+nFFFE, U+nFFFF | strip, always |
| `reserved_ignorable` | U+2065, U+FFF0 to U+FFF8, U+E0000, U+E0080 to U+E00FF, U+E01F0 to U+E0FFF | strip, always |
| `private_use` | U+E000 to U+F8FF, U+F0000 to U+FFFFD, U+100000 to U+10FFFD | strip, always |
| `format` | U+00AD soft hyphen, U+034F CGJ, U+206A to U+206F, U+FFF9 to U+FFFB, Khmer inherent vowels, Hangul fillers | strip unless a keep rule fires |
| `space` | U+00A0, U+1680, U+2000 to U+200A, U+202F, U+205F, U+3000 | replace with U+0020 |
| `confusable` | Cyrillic and fullwidth Latin lookalikes | keep unless `artifactFoldConfusables` is on |
| `control` | U+0000 to U+0008, U+000B, U+000E to U+001F, U+007F | strip, always. See FR-U16 |

### 2.2 Out of scope, permanently

| Excluded | Why |
|---|---|
| Statistical or token-sampling watermarks | Requires a language model and a heavy rewrite. `README.md` line 3 and spec section 1.2 both forbid it, and the source project's own README argues against the feature |
| Any file metadata: C2PA, EXIF, XMP, docProps | A separate concern. DOCX provenance is already specified as FR-1.4 and should be built on its own terms |
| Image, audio or video channels | Patralekhiser is a text tool |
| Vendor attribution | No carrier identifies its producer. Never label an artifact with a vendor name, not even as a guess |
| Unicode category lookup as a fallback rule | See FR-U26. JS has no `unicodedata`, and a category rule would be build-dependent anyway |
| NFKC folding | Lossy and irreversible: ligatures collapse, circled digits become digits, `kg` symbols become letters. Not a carrier problem |

### 2.3 Non-goals

No detection of *why* a carrier is present. No reversal, no decoding, no attempt to read a
payload out of a tag-character run. The pass removes and reports. If someone later wants
to decode a smuggled string, that is a different tool with different ethics.

---

## 3. New engine surface

Add to `src/engine.js` before the "Main entry point" comment, alongside the audit
functions in `design/README.md`. Plain ES5 plus the `u` regex flag already used by
`removeEmojis`, no dependencies, `module.exports` guard unchanged.

```js
MyridiusEngine.inspectArtifacts(text, settings)
// -> [ Artifact ]           never modifies text

MyridiusEngine.cleanArtifacts(text, settings)
// -> { text, artifacts, removed, replaced }

MyridiusEngine.defaultArtifactSettings
// -> { artifactClean, artifactNormalizeSpaces, artifactStripBidiMarks,
//      artifactFoldConfusables, artifactScanCode }
```

### 3.1 The Artifact object

Deliberately shaped like the flag object in `design/README.md` so the UI can reuse the
mark and chip machinery, but it is a distinct type and must not be pushed into `flags`.

```js
{
  paragraph: 0,           // index into pairs, or null for document level
  start: 12, end: 13,     // UTF-16 offsets into that paragraph's ORIGINAL text
  cp: 0x200B,             // code point, not code unit
  label: "ZERO WIDTH SPACE",
  kind: "zwj_family",     // one of the eleven in 2.1
  action: "strip",        // "strip" | "replace" | "keep"
  replacement: "",        // "" for strip, " " for space, the fold target for confusable
  keptBecause: null,      // null, or "emoji-glue" | "script-joiner" | "flag-sequence" |
                          // "same-script-base" | "paired-bidi" | "orthographic" |
                          // "layout-control" | "in-code"
  confidence: "confirmed",// "confirmed" | "informational"
  context: "util|ize"     // short excerpt with the position marked, for the panel
}
```

**FR-U3.** `confidence` is `confirmed` only for kinds with no legitimate use in running
prose: `tag_chars`, `noncharacter`, `reserved_ignorable`, `private_use`, `control`, and a
`bidi` override or unpaired embedding. Everything else is `informational`, including every
`space`, every `confusable`, and every `keep`.

This is the one idea worth taking from the source project's `classify_finding_confidence`.
Take the taxonomy, not its implementation: theirs is substring matching over message
strings, which is a hack. Classify from the kind and the keep rule, both of which are
already known at decision time.

**FR-U4.** A `zwj_family` or `format` artifact is `confirmed` when it sits between two
word characters of the same script and no keep rule fired, and `informational` otherwise.
A ZWSP at a word boundary is usually a broken paste. A ZWSP inside `utilize` is not.

### 3.2 Contract rules

- **FR-U5.** `inspectArtifacts` must not modify `text`. It returns offsets only.
- **FR-U6.** `cleanArtifacts` and `inspectArtifacts` share one classifier and one settings
  object. There must be exactly one function that decides, called by both.
  *Rationale: the source project has `inspect_text` running with `strip_bidi=True` while
  `clean_text` defaults to `False`, so its inspect step reports findings its default clean
  will not remove. Do not inherit that. A panel and a Changes tab that disagree is a bug
  report waiting to happen.*
  *Acceptance: a test asserts that for every artifact with `action: "strip"` returned by
  `inspectArtifacts`, the codepoint is absent from `cleanArtifacts(text).text`, and for
  every `action: "keep"`, it is present.*
- **FR-U7.** Iterate by code point, not code unit. `for (var ch of text)` or
  `Array.from(text)`, never `charAt` or a bare index loop. Every carrier above U+FFFF is a
  surrogate pair in a JS string, and a code-unit loop will split it.
- **FR-U8.** Offsets are UTF-16 indices into the original string, so they stay compatible
  with `sentenceSpans`, `protectedRanges`, `replaceNth` and the existing mark rendering.
  Track the UTF-16 position alongside the code-point iteration.
- **FR-U9.** Idempotent. `cleanArtifacts` on its own output returns zero `strip` and zero
  `replace` artifacts.
- **FR-U10.** Artifacts are returned in ascending `start` order. Unlike Findings they may
  be adjacent, and FR-8.2 non-overlap and FR-8.3 the 20 percent highlight cap do not
  apply. A run of forty tag characters is forty artifacts, and the panel must survive it by
  collapsing the run for display, not by discarding evidence.
- **FR-U11.** No output beyond stripping and replacing. The pass never inserts, never
  reorders, never re-cases, and never collapses whitespace. Whitespace tidy already happens
  later in `transform`.

---

## 4. Classification tables

The strip tables are trivial and anyone could write them. The keep rules are the reason
this is a port and not a regex, so they get the detail.

### 4.1 Strip, unconditionally

**FR-U12.** No context test, no keep rule, no setting disables these.

- All 66 noncharacters: `cp >= 0xFDD0 && cp <= 0xFDEF`, or `(cp & 0xFFFE) === 0xFFFE`.
  Permanently prohibited in interchange text and permanently unassignable, so stripping
  them carries no future-Unicode risk.
- Reserved default-ignorables, as **explicit ranges**: U+2065, U+E0000, U+FFF0 to U+FFF8,
  U+E0080 to U+E00FF, U+E01F0 to U+E0FFF.
- Private use: U+E000 to U+F8FF, U+F0000 to U+FFFFD, U+100000 to U+10FFFD.
- C0 and C1 controls except tab, newline and carriage return. See FR-U16.

**FR-U13.** Reserved default-ignorables are enumerated as ranges and never derived from a
category test. When Unicode assigns a real character inside one of these ranges, a
category rule silently deletes it. This has happened: U+180F was unassigned until Unicode
14 made it Mongolian free variation selector 4. Add a dated comment on the table naming
the Unicode version it was checked against, and re-check on version bumps.

### 4.2 Replace

**FR-U14.** Space homoglyphs map to U+0020, on by default, controlled by
`artifactNormalizeSpaces`: U+00A0, U+1680, U+2000 to U+200A, U+202F, U+205F, U+3000.
Logged as a Change, confidence `informational`.

**FR-U15.** Latin confusables are **off** by default, controlled by
`artifactFoldConfusables`: 19 Cyrillic lookalikes and the 52 fullwidth Latin letters. When
on, genuine Russian text containing the Cyrillic a, e, o, p, c or x becomes Latin
mojibake, so the Configuration help text must say exactly that.

**FR-U16.** U+0000 and U+0001 are stripped as `control` before anything else runs, and
this closes an existing hazard rather than creating one. `protect()` stashes protected
spans as `NUL + index + NUL` and restores with a `NUL(\d+)NUL` pattern; `guardText` marks
abbreviations with U+0001. A literal U+0000 in the input can therefore corrupt the vault
restore and mis-substitute a protected term. Removing controls in front of `protect()`
makes that unreachable.

**FR-U17.** The classifier must never see or touch a sentinel. Because of FR-U23 it runs
strictly before `protect()` and before `guardText`, so U+0000 and U+0001 in the string at
that point are input, not sentinels. Assert the ordering in a test rather than trusting
it: FR-U50.

### 4.3 Keep rules, the load-bearing part

**FR-U18.** Keep rules are evaluated **before** the strip test, per codepoint. A codepoint
in a strip class survives when it is load-bearing. Implement as a positive test for
legitimacy, and when a keep rule and a strip class disagree, the keep rule wins.

| Rule | Keeps | Condition | `keptBecause` |
|---|---|---|---|
| Emoji glue | U+200D, U+FE0E, U+FE0F | ZWJ only when **both** neighbours are emoji bases. VS15 and VS16 when the previous character is an emoji base | `emoji-glue` |
| Script joiner | U+200C, U+200D | Characters on both sides map to the same broad script group: Arabic U+0600 to U+08FF, Indic U+0900 to U+0DFF, South Asian U+0F00 to U+109F, Khmer, Mongolian | `script-joiner` |
| Flag sequence | U+E0020 to U+E007F | Part of a complete sequence: U+1F3F4, then a run of tag characters, terminated by U+E007F. A lone tag character is never kept | `flag-sequence` |
| Same-script base | Mongolian FVS, Khmer inherent vowels, Hangul fillers, CJK variation selectors | Directly after a base character from the matching script. Hangul checks conjoining, compatibility and halfwidth jamo separately | `same-script-base` |
| Paired bidi | U+202A LRE, U+202B RLE, U+202C PDF | Only as a balanced pair, found by a stack walk. U+202D LRO and U+202E RLO are **excluded and always stripped**, and so is any unpaired embedding | `paired-bidi` |
| Bidi marks and isolates | U+061C, U+200E, U+200F, U+2066 to U+2069 | Kept unless `artifactStripBidiMarks` is on. Legitimate in mixed-direction prose | `paired-bidi` |
| Orthographic Cf | U+0600 to U+0605, U+06DD, U+070F, U+08E2, U+110BD, U+110CD | Always. Normal Arabic and Syriac orthography | `orthographic` |
| Layout controls | U+13430 to U+1343F, U+1BCA0 to U+1BCA3, U+1D173 to U+1D17A | Next to their own script: Egyptian hieroglyphs, Duployan shorthand, musical beams and ties | `layout-control` |
| Inside code | any | Inside a fenced or inline code span. See FR-U21 | `in-code` |

**FR-U19.** Glue does not advance the "previous base" pointer. When a kept glue character
is emitted, the previous-base reference stays on the last non-glue character, so ZWJ chains
and tag runs stay anchored. Without this, a three-person family emoji fails on its second
joiner.

**FR-U20.** These are the required keep fixtures and they are not optional: the
man-woman-girl family emoji (U+1F468 ZWJ U+1F469 ZWJ U+1F467), a red heart with VS16
(U+2764 U+FE0F), the Scotland flag tag sequence (U+1F3F4 plus five tag characters plus
U+E007F), Persian with a ZWNJ (U+0645 U+06CC U+200C U+0631 U+0648 U+0645), the Devanagari
cluster from D3 (U+0915 U+094D U+200D U+0937), an Arabic number sign (U+0600), and a CJK
ideograph followed by a variation selector. Each must round-trip byte-identical through
`cleanArtifacts`.

### 4.4 Code spans are reported, never modified

**FR-U21.** A carrier inside a fenced or inline code span is reported with
`action: "keep"` and `keptBecause: "in-code"`, and is not removed, unless
`artifactScanCode` is on.

The scenario is concrete and will happen to this project: an article *about* invisible
characters, containing example carriers in code samples. Silently cleaning them destroys
the article's subject matter. This document is itself the reason FR-U21 exists, since its
notation rule in the preamble was written to avoid exactly that problem. It is also the
general rule the engine already follows, since `protect()` exists for this purpose.

**FR-U22.** Code span ranges are computed before the classifier runs, using only the fence
and backtick delimiters. Those are ASCII and cannot themselves be defeated by a zero-width
character, so this ordering is safe. Do not use full `protectedRanges` here: protected
terms, URLs and emails are matched **after** the pass, so that they benefit from clean
text. Splitting the two phases is deliberate.

### 4.5 Honesty note for the implementer

This classifier will be wrong sometimes, and the failure is asymmetric. Over-stripping
corrupts a reader's text invisibly, which is the worst outcome this project can produce.
Under-stripping leaves a carrier that the panel still reports, so the human sees it and
decides. Bias every ambiguous case toward `keep` with a reported artifact.

Specifically: when a keep rule is uncertain, keep. When a codepoint is not in a table,
keep. When the script group of a neighbour cannot be determined, keep. A missed strip is a
line in a panel. A wrong strip is a changed word nobody noticed.

---

## 5. Pipeline placement

### 5.1 It runs first

**FR-U23.** The pass runs at the very front of `transform`, before `protect()`, before
`removeEmojis`, before every swap and delete list. This is the fix for D1, and placement is
the whole fix: the swap dictionaries are `\b`-anchored regexes over the raw string, and
they cannot match across a codepoint they do not know about.

```
transform(input, config)
  1. cleanArtifacts            <- new, this document
  2. protect()
  3. removeEmojis              <- rewritten, FR-U24
  4. fixDashes
  5. sentenceStartDeletes, midSentenceDeletes
  6. fillerPhrases, hypeSwaps, simpleSwaps, contractions
  7. whitespace tidy
  8. restore()
```

**FR-U23a.** This is the inverse of FR-S14 in `docs/req-sentence-splitting.md`, and the two
do not conflict. Splitting runs late because it must see transformed text. The artifact
pass runs early because everything downstream must see clean text. Both are ordering
constraints in service of the same rule: each stage gets text the previous stage has
already made matchable.

### 5.2 `removeEmojis` must be rewritten in the same change

**FR-U24.** `removeEmojis` must stop matching U+200D and U+FE0F as bare codepoints and must
instead match whole emoji sequences: base, plus any glue, plus any tag run, plus any
trailing variation selector, removed as one unit.

This is not optional cleanup, it is a correctness dependency. Once the artifact pass
preserves emoji glue per FR-U18, a `removeEmojis` that deletes individual codepoints will
either leave orphaned joiners behind or keep deleting Devanagari. Both functions have to
change together or D3 is not fixed.

**FR-U24a.** After the rewrite, `removeEmojis` owns visible emoji and the artifact pass
owns invisible carriers, with no overlapping codepoints between them. Assert the disjoint
property in a test, because the two functions drifting apart is how D3 happened.

### 5.3 Offsets and the audit module

**FR-U25.** Because the pass runs inside `transform`, the audit module's flags are computed
on cleaned text and their offsets are already consistent. But artifacts are reported
against the **original** text, since the point of an artifact is where it was before
removal. `cleanArtifacts` therefore returns original-text offsets, and the panel anchors to
the left-hand pane, not the right.

**FR-U26.** No Unicode category fallback. The source implementation has a last-resort rule
stripping anything its Python build calls category `Cf`. JS has no equivalent without
shipping a table, and the rule is build-dependent even in Python. The port is table-driven
only. Document the consequence honestly: a format character assigned after the tables were
written will not be caught. That is the correct trade for not deleting characters we cannot
name.

---

## 6. Configuration

**FR-U27.** Add to `config/default-config.json` under `settings`, alongside the seven keys
already there:

```json
"artifactClean": true,
"artifactNormalizeSpaces": true,
"artifactStripBidiMarks": false,
"artifactFoldConfusables": false,
"artifactScanCode": false
```

`artifactClean: false` disables removal but **not** reporting: `inspectArtifacts` still
runs and the panel still shows what is there. Disabling the report entirely is not a
setting, because a silent carrier is the failure mode this whole document exists to fix.

**FR-U28.** Backwards compatibility. A config JSON exported before this feature has none of
these keys, and missing keys fall back to the defaults above, never to `undefined`. Same
precedent as FR-S18 and `dimensions`.

**FR-U28a.** `config/default-config.json` still does not carry the audit module's
`dimensions` key, nor the splitting keys from `req-sentence-splitting.md`, because the
back-port from `design/` has not happened. All three additions land in the same file. Do
them in one pass and say so in the commit.

**FR-U29.** The Configuration help text states, in plain words: what is removed, that space
normalization changes non-breaking spaces to ordinary ones, that confusable folding will
damage genuine Cyrillic, and that code spans are reported but left alone. A toggle whose
blast radius the user cannot predict is a bad toggle.

---

## 7. UI requirements

All of this fits into `design/README.md`. The work is to fit, not to design.

**FR-U30.** A new **Artifacts** panel, placed adjacent to where the provenance panel will
go per FR-8.5, and visually separated from the resemblance panel by the same treatment that
separates provenance. It is not a sixth dimension, it gets no bar, and it must not appear
in the dimension legend or the chip filter row.

**FR-U31.** Add no new design token. Artifacts use `--warn #9a5b00` on `--warn-bg #fdf4e3`,
which already exists and already means "look at this, it is not a score". Confirmed
artifacts render at full weight, informational ones at the same 50 percent opacity the
design uses for reviewed spans.

**FR-U32.** Marks in the left pane only. A zero-width character has zero width, so render a
2px caret at the offset rather than an underline, using the existing inset box-shadow
technique so it cannot collide with `.para.hl`.

**FR-U33.** Runs collapse. Forty consecutive tag characters render as one mark and one
panel row reading "40 tag characters", expandable to the full offset list. FR-U10 keeps all
forty in the data.

**FR-U34.** Kept artifacts are shown, in their own subsection, with the keep reason in plain
words. "Zero-width joiner kept: part of an emoji sequence." This is the panel's most useful
content for building trust, because it demonstrates the tool knows the difference. A panel
that only shows removals looks like a tool that removes everything.

**FR-U35.** Zero artifacts renders as an explicit empty state carrying the FR-U2 caveat,
never as an absent panel. Absence of the panel reads as absence of the check.

**FR-U36.** Add no chrome above the paragraphs in either pane. `syncFrom` measures paragraph
offsets inside the scroll container and `design/README.md` names it as the function that
breaks. Same constraint as FR-S24.

---

## 8. Effect on the resemblance score

**FR-U37.** Zero direct effect, per FR-U1.

**FR-U38.** But there is an indirect effect and it must be recorded, not hidden. Fixing D1
means swap rules now fire on text where they previously did not. Because
`design/README.md` known gap 1 has auto-swaps running before flagging, a document that was
silently bypassing its swaps will produce **fewer** flags after this lands, and therefore a
**lower** resemblance score. The number was wrong before, not after. Say so in
`SESSION.md`.

**FR-U39.** Consequence for spec section 12: the Phase 1 exit criterion is corpus-based,
and any corpus document containing carriers will score differently after this change. Any
calibration numbers recorded before this lands are not comparable to numbers after. Note it
against the corpus rather than silently re-baselining, and let FR-8.11's provenance header
carry the artifact-table version so two reports can be checked for comparability.

**FR-U40.** The artifact pass is language-agnostic, unlike every other part of the module.
FR-1.7 refuses analysis on non-English text because the lexicons and thresholds are
English-specific. That reasoning does not apply to a codepoint table. So when FR-1.7
refuses, `inspectArtifacts` still runs and the artifacts panel still renders, with the
resemblance panel absent. This is a small feature that falls out of the design for free and
is worth having.

---

## 9. Tests

Add to `tests/test.js`. Same hand-rolled assertion style, no framework,
`node tests/test.js`. Every fixture is built from escape sequences in the test source, per
the preamble notation rule, so the test file stays reviewable.

### 9.1 The three defect regressions, write these first

**FR-U41.** D1: `"We util\u200bize the platform"` through `process` yields
`"We use the platform"` with a `Simpler word` change. This is the test that proves the
feature works at all.
**FR-U42.** D2: U+202E, U+202C, U+E0041 and U+E0042 are absent from `process` output, and
each appears as a `confirmed` artifact.
**FR-U43.** D3: the Devanagari cluster `"क्\u200dष"` through `process` is
byte-identical to its input, and produces no `Emoji removal` change.

### 9.2 Must strip

Each of the eleven kinds, at least one fixture per kind, asserting removal, kind and
`confidence`. Include the tag-character run for FR-U33, a noncharacter, a private-use
codepoint above U+FFFF to exercise FR-U7, and an unpaired U+202A.

### 9.3 Must keep

**FR-U44.** Every fixture in FR-U20 round-trips byte-identical. Plus: a carrier inside a
fenced code block, a carrier inside inline backticks, a U+00A0 with
`artifactNormalizeSpaces: false`, and Cyrillic text with `artifactFoldConfusables: false`.

### 9.4 Invariants

**FR-U45.** Idempotence, per FR-U9.
**FR-U46.** Offset validity: for every artifact, the original text sliced by `[start, end)`
is the artifact's codepoint. This is the FR-11.2 round-trip applied to artifacts, and it is
what stops marks drifting.
**FR-U47.** Inspect and clean agree, per FR-U6.
**FR-U48.** Score invariance, per FR-U1: for a document, and for the same document with one
of each artifact kind inserted at word boundaries, `reviewParas` returns an identical
`resemblance` object.
**FR-U49.** Disabled is inert: `process` output with `artifactClean: false` is
byte-identical to the current engine's output on the same input, for the existing sample
article. This is the test that proves the feature cannot regress anything when off.
**FR-U50.** Sentinel safety, per FR-U16 and FR-U17: input containing a literal U+0000 and a
protected term restores that term correctly through `protect` and `restore`.
**FR-U51.** Emoji ownership is disjoint, per FR-U24a: no codepoint is matched by both the
`removeEmojis` sequence pattern and an artifact strip class.
**FR-U52.** Code-point iteration: a fixture containing an astral-plane emoji adjacent to a
carrier produces correct offsets for both, proving no surrogate was split.

### 9.5 Regression

**FR-U53.** The existing 34 engine checks and 15 file-IO checks pass unchanged. If a swap
test breaks, FR-U23 ordering was violated. If the sample article output changes at all with
`artifactClean: false`, FR-U49 was violated.
**FR-U54.** `samples/sample-article-patralekhised.md` is regenerated and committed only if
it actually changes, and if it does, the diff is inspected character by character before
commit. A silent change to the golden sample is exactly the failure mode this feature is
meant to prevent.

---

## 10. Acceptance criteria

1. Section 9 passes, plus the existing suites, via `node tests/test.js` and
   `node tests/fileio.test.js`.
2. `node src/build.js` rebuilds `app/index.html` and the feature works in the browser from
   the built file, offline.
3. No new dependency, no network call, no `localStorage`.
4. Pasting text with a zero-width space inside `utilize` produces `use` in the right pane, a
   `Simpler word` entry in Changes, and a `confirmed` row in the Artifacts panel.
5. Downloading that document as .docx, .pdf, .md and .txt yields four files containing no
   stripped codepoint. Verify by byte scan, not by eye, because these characters are
   invisible by definition.
6. An article containing a carrier inside a fenced code block keeps it, and the panel says
   why.
7. Every fixture in FR-U20 renders unchanged in the right pane.
8. Config export then re-import preserves all five new settings, and a config file exported
   before this change still loads.
9. Grep proves the boundary: no artifact kind appears in any `dimensions` array, and no
   artifact count reaches `resemblance`.
10. `docs/ai-text-audit-spec.md` amended per section 0.2, all eight rows.
11. `README.md` and `SESSION.md` updated. `README.md`'s "What it fixes automatically"
    paragraph gains invisible characters, and its stale "Needs a human" tab reference should
    be corrected in the same pass, as `req-sentence-splitting.md` acceptance item 9 already
    notes.
12. The new engine block carries the MIT attribution header from the preamble of this
    document, and a dated comment naming the Unicode version the tables were checked
    against, per FR-U13.

---

## 11. Known limits to document, not fix

State these in the code comments and the Configuration help text. They are consequences of
the approach, and pretending otherwise invites someone to "fix" them badly later.

1. **Private-use stripping is broad and silent.** U+E000 to U+F8FF removal deletes Nerd
   Font and Powerline glyphs, the Apple logo at U+F8FF, and MUFI medievalist encodings.
   These are legitimate in some documents. They are not legitimate in a Myridius article,
   which is why the default stands.
2. **Space normalization changes typography, not just bytes.** A non-breaking space becoming
   an ordinary space changes line-breaking behaviour: `10 km`, `10 %`, `Fig. 3`, and French
   spacing around guillemets. On by default because business prose rarely depends on it, and
   reversible by a setting.
3. **Soft hyphen is stripped unconditionally.** Correct for a carrier, destructive for
   deliberate hyphenation hints in typeset copy. Patralekhiser's output is not typeset, so
   this is the right default here and would not be in a print workflow.
4. **No category fallback, per FR-U26.** Newly assigned format characters will be missed
   until the tables are updated. The alternative was deleting characters we cannot name.
5. **The tables need a maintainer.** They are dated and pinned to a Unicode version, and
   FR-U13 exists because the source project learned this the hard way with U+180F. This is a
   small recurring maintenance cost, not a one-time build.
6. **Reporting an artifact says nothing about authorship, and finding none says less.**
   FR-U2 puts this in the UI. It belongs here too, because the pressure to read the panel as
   a verdict will come from users, not from the code.
7. **This closes one channel of several.** Statistical token-sampling marks are untouched
   and out of scope per 2.2, and the source project is candid that no tool can certify their
   removal. A clean artifact panel means the text carries no invisible characters. It does
   not mean the text carries no marks.

---

## 12. Amendment checklist for `ai-text-audit-spec.md`

Repeat of 0.2 as a working list. All eight are acceptance item 10.

- [x] FR-1.8: artifact classification precedes NFC; note that NFC preserves carriers
- [x] FR-1.7: artifact pass runs even when analysis is refused for language
- [x] New section 6.7: M-42 `artifactCount`, M-43 `artifactConfirmedCount`,
      M-44 `artifactKeptCount`, M-45 `artifactKinds`, all marked never scored, citing the
      M-27 precedent
- [x] Section 8.1: add the `Artifact` object; state that FR-8.2 and FR-8.3 do not apply
- [x] FR-8.5: artifacts panel added to the ordered report list
- [x] Section 10: `artifacts: Artifact[]` and `artifactSummary` added to `AnalysisResult`
- [x] Section 11: fixture requirements from section 9 above
- [x] Section 12: Phase 1 gains the artifact pass; record the FR-U39 calibration note
