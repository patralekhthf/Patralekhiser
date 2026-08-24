# Session Context: Patralekhiser (2026-08-24)

## Standing rule: where design comes from
All design and UI decisions for this project are read from the `design/` folder.
Before writing or reviewing any UI, styling, interaction, token, or layout code,
read in this order:
1. `design/README.md` : the design and behaviour specification (five dimensions,
   engine API, UI contract, tokens, state, known gaps).
2. `design/INTEGRATION.md` : the exact diff against the original `index.html`,
   for review or re-application onto a newer copy.
3. `design/index.html` : the working reference implementation. Source of truth
   for anything the two markdown files leave ambiguous.
4. `design/reference/AI Text Audit.dc.html` : visual reference only (warm/cream,
   display type, sticky rail prototype). Do NOT ship it, no engine behind it.
Never invent tokens, colours, spacing or interaction patterns. If it is not in
`design/`, ask before adding it.

## Context at save
Context window: 289,556 tokens = 145% of 200,000 (2026-08-24 save; the session
ran long on codebase analysis and requirement drafting, so start fresh with /RC).
Previous save: 62,109 tokens = 31%.

## Current stage & gate status
Patralekhiser v1.1 is live, committed and pushed
(github.com/patralekhthf/Patralekhiser, main, HEAD f66d55f).

The AI Text Audit module is NO LONGER just a spec. A working implementation
arrived in `design/index.html` (117 KB, 2,690 lines) as a patched superset of
`app/index.html` (81 KB, 1,921 lines). It is self-contained, runs in a browser,
and carries the full resemblance-audit feature.

Next stage, updated 2026-08-24: the requirement and handover documents for the
Unicode artifacts work now exist (`docs/req-unicode-artifacts.md`,
`docs/handoff-unicode-artifacts.md`) and that piece is ready to build independently
of the back-port. The `design/` back-port into `src/` is still open and is still the
larger job.

Confirmed 2026-08-24, and it is the trap that will confuse the next implementer:
`reviewParas`, `resemblance`, `protectedRanges` and `guardText` exist in
`design/index.html`, `dist/Patralekhiser-test-build.html` and
`publish/Patralekhiser-v1.2.0-preview.4.html`, and in NONE of `src/engine.js`,
`src/template.html` or `app/index.html`. `design/index.html` is a fork of the built
app that is ahead of `src/`. `node src/build.js` is therefore safe to run, because
`app/index.html` is already the pre-audit build and loses nothing, but any
requirement touching the resemblance UI cannot be built in `src/` until the
back-port lands.

## What exists and works
- Single-file app at `app/index.html`, no runtime dependencies, no LLM.
- Split-screen editor: original left, Patralekhised right, paragraph-level scroll
  sync both ways, hover pairing, Show original toggle, Edit button.
- Engine (`src/engine.js`): protected terms, simple-word swaps, hype/AI-word
  swaps, filler phrase cleanup, sentence-start and mid-sentence deletes, dash and
  emoji handling, contraction expansion, flags, Flesch stats.
  Exports: process, processDoc, transform, analyze.
- File IO (`src/fileio.js`): hand-rolled zip/unzip (DecompressionStream), docx
  read/write, PDF writer, txt export. PDF READING lazy-loads pdf.js from cdnjs
  (only network dependency, still present in `design/index.html` too).
- Config tab: editable rules, JSON export/import, no localStorage by design.
- Tests: `tests/test.js` (34 checks), `tests/fileio.test.js` (15 checks).
  Build: `node src/build.js` inlines engine+fileio into `app/index.html`.

## The audit module as designed (summary; full detail in design/README.md)
- Replaces the flat "Needs a human" list with a Resemblance audit: 0 to 20 score
  across five dimensions, inline highlights, per-flag accept/revert review loop.
- Dimensions: d1 stock wording (amber #b45309), d2 sentence rhythm (teal #1f7a8c),
  d3 fence-sitting (slate #64748b), d4 missing specifics (violet #6d4aa7),
  d5 no personal voice (green #2f7a52).
- d1 to d4 scored by density (flags per 1000 words, `per1000/9*4`, clamped to 4,
  rounded to nearest 0.5). d5 scored by counting four presence signals and
  subtracting from 4. Total = `20*sum(w*score)/(4*sum(w))`, one decimal.
  Bands: >=15 heavy, >=10 moderate, >=6 light, >0 low, 0 none.
- New engine exports: `reviewParas(pairs, config)`, `authorialPresence(text)`,
  `defaultDimensions`. `processDoc` returns an extra `resemblance` key and derives
  `flags` from `reviewParas`, so existing callers keep working.
- Offset safety: `protectedRanges` (ranges, not placeholder swaps), length
  -preserving `guardText`, `sentenceSpans`. Earlier flags claim ranges; later
  overlaps are skipped; `advice-span` never claims.
- Accept pushes `{paragraph, from, to, nth}` onto `review.edits`, then `rebuild()`
  restores from `review.base` and re-applies edits, so score, word count, Flesch
  and flags can never drift from the text.
- Tab key stays `"flags"`; ids `tabFlags` / `flagCount` unchanged; badge shows the
  score, not a count.
- `flagWords` line format extended to
  `word | reason | suggestion | dimension | replacement`, backwards compatible.
- Fragile point called out in the design docs: `syncFrom` measures each paragraph's
  true offset inside its scroll container. Adding chrome above any pane's
  paragraphs breaks it.

## Decisions made
- Zero-LLM constraint for the humanizer: deterministic rules only; flags what it
  cannot safely fix.
- Renamed from Myridiusizer to Patralekhiser. "Myridius" kept where it means the
  company or style, incl. identifiers MyridiusEngine/MyridiusFileIO.
- Style profile in `docs/style-profile.md` is the source of truth for rules;
  `design/` is the source of truth for UI and audit behaviour.
- Audit module ships as a THIRD TAB inside the single-file app, not a separate
  HTML file. Settled by the design implementation.
- Sentence splitting is suggestion-only, always human approved. The automatic path
  was specified and then deliberately removed rather than shipped dormant, on the
  grounds that a switch nobody should flip is a liability, not an option. Adding
  it later is purely additive against `docs/req-sentence-splitting.md`.
- GitHub: cloud sandbox git proxy blocks unauthorized repos even with a user PAT.
  Pushes are done by the user from their own Mac Terminal.
- Device mount cannot delete files: git leaves stale `.git/*.lock` after every op.
  Workaround: `mv` locks into `_to_delete/` before each git command.

## Tester distribution (2026-08-19)
`dist/Patralekhiser-test-build.html` built for sharing with friends for feedback.
- Source: `design/index.html` verbatim, plus a dismissible tester banner
  (`.tb-note` CSS + `#testerNote` markup) and a changed `<title>`.
- The banner is DISTRIBUTION-ONLY. Do not back-port it into `src/` or `design/`.
  An HTML comment at the top of the file says so.
- Chose `design/index.html` over `app/index.html` after verifying it is a strict
  superset: 112 functions vs 75, the only absent name is `renderFlags` which was
  deliberately replaced by `renderResemblance`; all 42 element ids present; all
  config keys present plus `dimensions`.
- Verified headless in Chromium: 61 changes and resemblance 15.5/20 heavy on the
  sample article, 5 dimension rows, 22 inline marks, drawer opens, docx/pdf/txt
  writers all produce output, scroll sync unaffected by the banner, zero console
  errors.
- Banner is honest by design: says the score is not a detector, that thresholds
  are uncalibrated, that second-language English is likely scored unfairly, and
  lists the known limits including the PDF inline-bold loss.

## Architecture decisions (docs/adr/, 2026-08-19)
- ADR-0001 ACCEPTED: retain the vanilla single-file stack. No framework, no bundler,
  no package manager. User confirmed: "we will live with the current architecture".
  Engine treated as a portable module so the view could be replaced later.
- ADR-0002 DEFERRED: packaging and distribution. PWA / Tauri / Electron / Capacitor
  all analysed, none chosen. Stays a single HTML file. Four named reopening triggers:
  file association request, a real need for saved config, sharing beyond people known
  personally, or testers struggling to tell which build they have. Mobile folded in
  here as a UX redesign question, not a packaging one, so no separate ADR.
- ADR-0003 PROPOSED: own block-and-inline parser over a documented subset rather than
  vendoring a Markdown library, because parser coverage is capped by what the docx and
  PDF writers can render. Pipeline stays text-first so audit offsets are untouched.
  Subset: paragraphs, H1-H3, ordered/unordered lists with one nesting level,
  blockquotes, fenced code, thematic breaks, bold, italic, inline code, links.
  Tables explicitly out.
- Formatting and packaging are independent axes. This is why ADR-0002 could be
  deferred without blocking ADR-0003.

## Verified facts about the writers (corrects an earlier claim)
- `toPdf` ALREADY embeds Helvetica `/F1` and Helvetica-Bold `/F2`. Inline bold is lost
  to run-flattening (`p.runs.map(r=>r.text).join("")` then `bold = p.level > 0`), not
  to a missing font. Smaller fix than first assumed.
- `toPdf` wrapping uses `chars * size * 0.5`, a fixed-width estimate on a proportional
  font. Needs a real Helvetica advance-width table.
- `toDocx` writes 5 parts and has NO `numbering.xml`, so real Word lists need a new
  part plus a content type plus a relationship. Largest piece of v2 export work.
- `fromDocx` never reads `<w:b/>`, so bold survives export and dies on import. The
  docx round trip is lossy in one direction.
- `parseDoc` has no list handling, yet the audit's Long paragraph flag suggests
  "pull key items into a short list". The tool recommends a construct its own
  formatter cannot render.

## DEFECT found 2026-08-19 by running the tool on real text
Noun/verb confusion in single-word swaps. `hypeSwaps` has `harness -> use` and
`simpleSwaps` has `leverage -> use`, both intended for the verb sense, applied
unconditionally. Reproduced:
- "an eval harness that regression-tests..." -> "an eval use that..."   BROKEN
- "a test harness runs the suite"            -> "a test use runs..."     BROKEN
- "we had no leverage in that negotiation"   -> "no use in that..."      BROKEN
- "financial leverage increased the risk"    -> "financial use..."       BROKEN
- "the team will leverage the new API"        -> "will use the new API"   correct
- "you should harness the wind"              -> "should use the wind"    correct
14 of 109 single-word swaps replace with a bare verb, but only `harness` and
`leverage` are genuinely ambiguous. `utilization`, `assistance`, `modification`
are nouns swapped for noun senses and are safe.

Proposed fix, consistent with the project's refuse-when-unsure posture: add a
`verbOnly` guard to swap rules, extending the pipe-delimited config format the
same way `docs/req-sentence-splitting.md` extends `flagWords`. Apply the swap
only when preceded by a modal, auxiliary, infinitive `to`, or a pronoun subject.
When preceded by a determiner or adjective, skip the swap and raise a flag.

Also worth recording as a positive signal: on the user's own 1434-word article the
tool made 5 fixes and scored 8.5/20 light, against 61 fixes and 15.5/20 heavy on
the marketing sample. The gap between the two is the best calibration evidence so
far, and it arrived before any corpus was built.

## Shipped 2026-08-19: change highlighting + inline editing (v1.2.0-preview.3)
View-layer only, `design/index.html` script 3. Engine untouched. Documented in
`design/README.md` under "Result pane: change highlighting and inline editing".
- `annotateChanges(original, output)` diffs each paragraph's original against its
  output rather than reading the change log. The log has no offsets and rules run
  in sequence, so recorded positions go stale; a diff of the finished text is
  pipeline-independent and also catches deletions, dash fixes and emoji removal.
- `diffTokenize` + `diffOps` (LCS), `DIFF_CAP` 800 tokens per paragraph.
  Adjacent add/del runs grouped so one swap is one highlight.
- `mark.chg` uses `--fix-bg` with a `was: ...` tooltip. Deletions render as a
  zero-width 2px `--warn` bar with a `removed: ...` tooltip. No new tokens.
- `#showHighlights` toggle, count shown in `#outputMeta`.
- Click any Result-tab paragraph to edit. Textarea, not contenteditable, so text
  extraction stays exact. Blur or Cmd+Enter commits, Esc discards.
- `commitParaEdit` invariants: writes `paragraphs[i].output` so exports match the
  pane; collapses internal blank lines to keep paragraph parity (scroll pairing,
  flag offsets and `review.base` are all indexed by paragraph); refuses to empty
  a paragraph; a manual edit supersedes that paragraph's review history because
  `review.edits` are from/to strings that may no longer exist.
- `recompute()` extracted; `rebuild()` now delegates to it so the review loop and
  manual editing cannot disagree about derived state.
- Also fixed: `showTab` now hides the drawer when leaving the audit tab. It is
  docked inside the right pane and was covering the editable paragraphs.
- `publish/build-dist.py` added so the distributable build is reproducible. It
  refuses to run if its input already contains the banner.
- src/template.html deliberately does NOT have these UI features, only the
  verbOnly config plumbing. Adding the toggle without its handler would have
  shipped a dead control. They arrive in src/ with the back-port.
- Verified headless: 65 change marks + 7 deletion bars on the sample, tooltips
  correct, toggle works, edit reaches md/txt/docx/pdf exports, score recomputes
  (15.5 heavy to 13.5 moderate after a manual paragraph gained a date and a
  figure, which is the d5 presence signal working), Esc discards, resemblance
  tab and scroll sync unaffected, zero console errors.

## Public distribution shape, settled 2026-08-19
Both repos public. `Patralekhiser` keeps everything; `Patralekhiser-Public` is built
for a non-technical person who just wants to use the tool.
- `Patralekhiser` is ALREADY public. Verified by an anonymous clone from the cloud
  sandbox with the proxy explicitly declining to supply a credential. So SESSION.md,
  the ADRs, both specs, `design/` and `dist/` have been world-readable since 74c3b03.
  User's decision: leave it public.
- `Patralekhiser-Public` holds exactly three files, two of them visible:
  `index.html` (the app, so GitHub Pages serves it at a clean URL), `README.md`,
  and `.nojekyll`. Nothing in the listing looks like source code.
- Two access paths: https://patralekhthf.github.io/Patralekhiser-Public/ opens and
  runs with no download, and the release asset
  `Patralekhiser-v1.2.0-preview.3.html` downloads a keepable offline copy. A raw
  link is NOT used: GitHub serves raw HTML as text/plain, so it shows source.
- Pages here is static file serving, not the PWA decision ADR-0002 deferred. No
  manifest, no service worker. Consistent with that ADR.
- Public README rewritten for a non-technical reader: plain language, the one-click
  link first, and an explicit warning not to click `index.html` in the file list
  because GitHub shows code rather than the page. Honesty preserved: the score is
  not a detector, bands are uncalibrated, second-language English likely scored
  unfairly.
- `publish/publish.sh` now creates the repo, pushes, enables Pages via
  `gh api -X POST repos/:owner/:repo/pages`, tags, and publishes the release with
  the versioned asset. Idempotent. Full browser-only fallback in its comments.
- Added an inline `data:image/svg+xml` favicon to `design/index.html`. A browser
  requests `/favicon.ico` unprompted when the page is served over http, which
  logged a 404 and left the tab iconless. Serving the built page over http now
  makes exactly one request, the page itself, with zero console errors and no
  off-origin traffic.

## PUSH IS BLOCKED FROM THE SANDBOX AND THE BRIDGE VM (verified, not assumed)

NOTE 2026-08-24: this section is about the cloud sandbox and the bridge VM. Pushing from
the user's own Mac works: credential.helper is osxkeychain and gh is authenticated there.
- Cloud sandbox: can READ github (anonymous clone works) but the git proxy refuses
  writes: "not in this session's authorized repository set, so the proxy will not
  inject a credential". Dry-run pushes to `main` and to a throwaway ref both 403.
  The `add_repo` tool the proxy suggests is not exposed in this session.
- Bridge VM on the Mac: no network at all (403 from its proxy), no stored
  credentials, no SSH keys, no `gh`.
- So every push must be run by the user from their own Mac Terminal. Commits are
  prepared locally and left ready.
- Unpushed as of this note: the five invisible-Unicode commits plus everything
  earlier that has not been pushed. Run `git log origin/main..main` to see the exact
  list rather than trusting a number recorded here.

## Shipped 2026-08-19: mechanical rewrite options (v1.2.0-preview.4)
User asked whether the tool can offer selectable rewrite options. Answer: yes for a
bounded set, no in general, same reasoning as the sentence-splitting spec.
- `suggestOptions(flag, paraText)` -> `[{label, text, scope}]`. Drawer renders chips;
  clicking loads into the editable box; Accept unchanged, so human approval holds.
- Sources: word alternatives from config (30 of 31 entries now populated), semicolon
  splits, long-sentence splits at an author-written joint.
- flagWords field 5 now takes several values separated by `;`. Single value behaves
  as before, so old config loads.
- Guards added after the first cut split a LIST into two fragments: verb search stops
  at the first subordinator/relative; any comma before the joint means list, refuse;
  colon before the first semicolon means list, refuse; both halves >= 4 words.
  9/9 split regression cases pass.
- No options for passive voice (agentless passives have no agent in the text) or long
  paragraphs (splitting one breaks paragraph parity, which scroll pairing, flag offsets
  and review.base all depend on). Drawer says so instead of showing an empty box.
- Honest coverage on the credit union article: 1 of 6 semicolons, 0 of 7 long sentences,
  1 of 1 word choice. Every refusal checked and correct.

## Editing extended to the Resemblance tab (2026-08-19)
- `beginParaEdit` now accepts `activeTab === "flags"` as well as `"result"`, and on the
  audit tab clears `review.sel`/`review.opt` and hides the drawer first, since the drawer
  is docked over the bottom of that pane.
- Click disambiguation needs no mode switch: marks, paragraph chips and Revert already
  call `stopPropagation`, so any click reaching the `.para` handler is plain text.
  Verified both ways: highlight click opens the drawer and no editor; plain-text click
  opens the editor and closes the drawer.
- Changes tab stays non-editable. It renders `.item` cards, a log of engine actions, not
  document text.
- Verified: edit in the audit tab propagates to `lastResult.output` and the exports, marks
  are re-derived (22 -> 18), the "edited by you" count appears in both panes' meta, and the
  Result tab shows the same text. Zero console errors.
- Note: the score did not move (9.0 -> 9.0) on that edit. Expected, and it is the density
  saturation `design/README.md` documents as honest rather than a bug.

## Open bug: passive-voice detector over-fires
Found while analysing a real article. `are open` ("my messages are open"), `was down`
("search access was down") and `is unmanaged` are adjectival complements after a copula,
not passives. 3 of 11 passive flags on that document were false, inflating d3 by roughly
a band. Needs an adjectival-complement guard, same shape as the verbOnly fix.

## Shipped 2026-08-24: invisible Unicode artifacts (engine only)

`docs/req-unicode-artifacts.md` implemented in `src/engine.js`, `src/template.html`,
`config/default-config.json` and `tests/test.js`, following the six stages and gates in
`docs/handoff-unicode-artifacts.md`. Five commits: classifier, defect fix, config, build,
documents. 178 engine checks and 15 file-IO checks pass; the original 34 engine checks are
unchanged.

- Stage 0 first: all three defects reproduced against the shipped engine before any code
  was written. They then stopped reproducing, which is the regression evidence.
- New engine surface: `inspectArtifacts`, `cleanArtifacts`, `defaultArtifactSettings`,
  `artifactTableVersion`. Both entry points come out of ONE decision function, so a panel
  and a Changes tab can never disagree. The source project gets this wrong: its inspect
  step runs with `strip_bidi` on while its clean step defaults it off.
- `transform` now returns `artifacts`; `process` and `processDoc` also return
  `artifactSummary`. `processDoc` stamps the paragraph index. Offsets are UTF-16 indices
  into the ORIGINAL paragraph text, so the panel anchors to the left pane.
- `removeEmojis` rewritten to match whole emoji sequences. Landed in the same commit as
  the pipeline placement, because splitting them produces a state worse than today.
- Tables pinned to Unicode 15.1 with a dated comment. Re-check on version bumps.

### What turned out different from the requirement, worth knowing before the back-port

1. **Two keep rules were dead code as specified.** FR-U26 forbids a Unicode category
   fallback, and without one the orthographic Arabic and Syriac marks (U+0600 to U+0605,
   U+06DD, U+070F, U+08E2, U+110BD, U+110CD) and the visible-layout controls (Egyptian
   hieroglyph quadrat, Duployan, musical beaming) never enter a strip class at all, so
   their keep rules could never fire. They are now part of the `format` kind, which makes
   both rules reachable and testable and lets the layout controls be stripped when they
   float free of their own script, which is the case the source project calls contraband.
2. **FR-U12 and the 2.1 table disagree about controls.** The table lists U+0000 to U+0008,
   U+000B, U+000E to U+001F, U+007F, which leaves out form feed and the C1 range. FR-U12
   says "C0 and C1 controls except tab, newline and carriage return". FR-U12 was
   implemented as the normative text, so U+000C and U+0080 to U+009F are also stripped.
3. **Confusables are only a carrier class when `artifactFoldConfusables` is on.** Reporting
   every Cyrillic letter in a Russian document would bury the panel in thousands of rows
   that say nothing. This follows the source project's behaviour.
4. **FR-U16 beats FR-U21 for controls.** A carrier inside a code span is kept, but a
   control is stripped even there, because FR-U16 says controls go before anything else and
   a literal U+0000 inside a code span would reach `protect()` and could corrupt a vault
   restore. Every other kind is kept inside code as specified.
5. **FR-U6's invariant holds when `artifactClean` is true.** With it false the report
   describes what would be removed rather than what was, which is the documented point of
   the setting.
6. **The README's "Needs a human" reference is NOT stale for `src/`.** The tab in
   `src/template.html` is still called "Needs a human", so the note in
   `req-sentence-splitting.md` acceptance item 9 only becomes true after the back-port. It
   was left correct rather than corrected into being wrong. Rename it with the back-port.

### FR-U38, recorded rather than hidden

Fixing D1 means swap rules now fire on text where they silently did not. Because auto-swaps
run before flagging (known gap 1), a document that was bypassing its swaps will produce
fewer flags after this and therefore a **lower** resemblance score. The old number was
wrong, not the new one. Any calibration figure recorded before this landed is **not
comparable** to a figure recorded after, and `artifactSummary.tableVersion` is carried so
two reports can be checked for comparability. Note this against the corpus rather than
silently re-baselining.

The existing sample article is unaffected: it carries no invisible characters, so old and
new engines produce byte-identical output for it and
`samples/sample-article-patralekhised.md` was NOT regenerated, per FR-U54.

### Verification actually performed

- Browser, from the built `app/index.html`, no server and no network: zero console errors,
  zero network requests, the five toggles round-tripping through `renderConfig`,
  `applyConfig` and `resetConfig`, and the Changes tab showing the new entries.
- All four exports byte-scanned, not eyeballed: no stripped codepoint appears in the
  markdown, the plain text, the docx container, the inflated `word/document.xml`, or the
  pdf. Codepoints kept elsewhere in the document are excluded from that scan, because the
  same U+200B is stripped inside a word and kept inside a code span.
- `toPdf` is single-byte WinAnsi and turns anything above U+00FF into "?", so only
  codepoints that fit in one byte could ever have appeared there as themselves. That is a
  pre-existing export limitation, not something this change introduced.
- Boundary proved by grep, per acceptance item 9: no artifact reaches `flags`, and the
  only mention of the score in the artifact code is a comment explaining why it must not.

### Deferred at first, all but one now closed by the back-port below

- FR-U30 to FR-U36, the artifacts panel. BUILT. See the back-port section.
- FR-U48, score invariance. BUILT and passing end to end.
- FR-U40, the artifact pass running when language detection refuses. Still open, and
  correctly so: FR-1.7 language detection does not exist yet, so there is nothing to
  refuse. Recorded in the spec amendment only.

## Shipped 2026-08-24: the design back-port, and the artifacts panel

`design/index.html` was a fork of the built app running ahead of `src/`, so the audit
module existed only in a build artifact. It is now split back into source, which closes
SESSION.md next action 2 and unblocks everything that depended on it.

- Engine: the audit block lands verbatim before the main entry point. `DEFAULT_CONFIG`
  gains `dimensions`, `flagWords` moves to the five-field format, exports gain
  `reviewParas`, `suggestOptions`, `authorialPresence`, `defaultDimensions`.
- Template: the resemblance CSS layer, change-highlighting and inline-editing CSS, the
  docked drawer, the dimension weights card, the highlight-changes switch, the inline
  favicon, and the tab renamed to "Resemblance". Script 3 taken from `design/` wholesale,
  because `renderFlags` was replaced there rather than edited.
- Two real merges, where the audit work and the Unicode work had both changed the same
  code: `processDoc` (now calls `reviewParas`, keeps per-paragraph artifact collection)
  and the exports.
- `src/fileio.js` needed nothing. The diff against `design/` is empty, as INTEGRATION.md
  said it would be.

**FR-U48 unskipped itself and failed, and the test was wrong, not the code.** It fed
`reviewParas` raw laced text directly, which constructs a state the pipeline cannot
produce, so it failed for the D1 reason. `reviewParas` scores `pairs[].output`, which
`transform` has already cleaned. It now runs end to end through `processDoc` with one of
every artifact kind inserted at word boundaries, which is what FR-U48 actually specifies,
plus a second case for a KEPT artifact, which does survive into the scored text. Both pass.

**The artifacts panel is built**, FR-U30 to FR-U36: below the annotated document where
FR-8.5 puts it, no bar and no chip and no dimension, `--warn` on `--warn-bg` with no new
token, informational rows at 50% opacity, 2px carets in the LEFT pane only, runs collapsed
to one row and one caret with the offsets expandable, a "Kept, and why" subsection in plain
words, and an explicit empty state carrying the caveat. Scroll pairing was checked at four
positions in both tabs and pairs exactly, which is the FR-U36 hazard.

Note for whoever tests the UI next: `requestAnimationFrame` does not fire while the
browser pane is hidden, and `syncFrom` clears its `syncing` guard inside a rAF. A scroll
-sync test in a hidden pane will look broken when it is not. Clear the guard by hand or
foreground the pane.

Not covered by tests: the panel is view code in `src/template.html` and the project has no
DOM test harness. It was verified in a browser instead, which is the same standard the rest
of the view layer is held to.

### Tester build lag, now closable

`dist/Patralekhiser-test-build.html` and `publish/Patralekhiser-v1.2.0-preview.4.html` are
both built from `design/index.html` and therefore still carry all three defects. Verified,
not assumed: the published asset was loaded in a browser and D1, D2 and D3 all reproduce in
it. Tester reports of stray or missing characters from the round that used those builds are
KNOWN and are not new bugs.

Now that the back-port has landed, `src/` is ahead of `design/` and the distributables
should be rebuilt from `src/` rather than from `design/`. `publish/build-dist.py` reads
`DESIGN_SRC` from the environment and defaults to `design/index.html`, so it can be pointed
at `app/index.html` without editing it. `design/index.html` stays as the design reference
and must still never be hand-edited.

## Published 2026-08-24: v1.2.0-preview.5

Live at https://patralekhthf.github.io/Patralekhiser-Public/ and released as a prerelease
with the downloadable asset attached. Verified against the LIVE URL, not just the local
file: version marker correct, all three defects fixed, the code-span carrier kept, five
artifact rows in the panel and five carets in the left pane.

This is the first public build that contains the audit module from `src/` rather than from
`design/`, and the first that contains the invisible-character work at all.

`publish/build-dist.py` now defaults to `app/index.html` instead of `design/index.html`.
That default was correct only while `design/` ran ahead of `src/`; after the back-port it
would have shipped a stale app. `DESIGN_SRC` still overrides it.

Push works from this Mac: `credential.helper osxkeychain` is set and `gh` is authenticated.
The older note in this file saying push is blocked from both environments described the
cloud sandbox and the bridge VM, not this machine.

## Open threads / blockers
- Back-port gap: `design/index.html` is a BUILT artifact. The additions must be
  split back into `src/engine.js` (engine functions, DEFAULT_CONFIG.dimensions)
  and `src/template.html` (CSS layer, markup, script 3 UI), then rebuilt with
  `node src/build.js`. Editing `app/index.html` directly would be overwritten by
  the next build.
- Tests do not cover the new engine surface. `reviewParas`, `authorialPresence`,
  `scoreResemblance`, `protectedRanges`, `guardText`, `sentenceSpans` need cases.
- Calibration corpus not sourced (FR-11.5). All thresholds, including the `/9*4`
  density divisor and the verdict bands, remain provisional. The 20 second
  -language English docs are the G-1 gate.
- Team style calibration: sample Myridius articles promised, never arrived.
- pdf.js still loads from cdnjs. Vendoring it locally is still open.
- THIS FILE IS PUBLISHED. The repo is public, so SESSION.md is a public web page.
  Never record credentials, credential states, incident details, customer names, or
  anything that would be awkward to publish. Operational reminders of that kind go in
  `NOTES.local.md`, which is gitignored.
- Known gaps carried from the design docs: auto-swaps run before flagging so the
  score describes post-rewrite text; density bands saturate above roughly nine
  flags per thousand words; `replaceNth` can in principle target the wrong
  occurrence after a revert; no keyboard shortcuts in the review loop; mobile
  untouched.

## Sentence splitting requirement (new, 2026-08-19)
`docs/req-sentence-splitting.md` written and ready for Claude Code. Deterministic
sentence splitting for a bounded syntactic subset, no LLM.
- Covers SPLIT-A semicolon compounds (tier 1), SPLIT-B comma plus coordinating
  conjunction with an independent second clause (tier 2), SPLIT-C imperative
  second clause (tier 3, off by default).
- Permanently refuses: subordinate clauses, participial tails, relative clauses,
  appositives, colon lists, comma splices, single-clause long sentences.
- New engine surface: `splitCandidates(text, config)`, `applySplits(text, cands)`,
  `defaultSplitSettings`, `isIndependentClause(clause)`,
  `splitProtectedRanges(text, terms)`.
- `protectedRanges` does NOT cover quotes, parentheses or HTML entities.
  `splitProtectedRanges` must add them or SPLIT-A fires inside `&amp;`.
- Default posture is suggest, not apply: a candidate promotes an existing
  `Long sentence` or `Semicolon` flag from `kind: "advice"` to `kind: "swap"`,
  so the existing accept/revert loop handles it with no architecture change.
- Amends `docs/ai-text-audit-spec.md` section 9.2, which currently claims rewrite
  suggestions need T3. Splitting is the one rewrite class that does not.
- SETTLED 2026-08-19: every split requires human approval. No automatic mode, no
  `autoSplitSentences` flag, no tier 1 exception for semicolons. Enforced by
  FR-S13 (`applySplits` unreachable from `transform`/`process`/`processDoc`) and
  by FR-S34a, a byte-identical test against `splitMaxTier: 0`. Config carries
  only `splitMaxTier` (2) and `minClauseWords` (4).

## Unicode artifacts requirement (new, 2026-08-24)
`docs/req-unicode-artifacts.md` written and ready for Claude Code. A deterministic
invisible-Unicode pass, ported from `guillaumemeyer/watermarks-remover` (MIT,
`service/scripts/text_unicode.py` v0.5.0). Repo analysis in
`docs/ref-watermarks-remover-analysis.md`.

Three defects were found by running the current `src/engine.js`, not inferred:
- **D1** A single U+200B inside a word defeats every swap and flag rule, because they are
  all `\b`-anchored regexes on the raw string. `util<ZWSP>ize` is neither fixed nor
  flagged, so the document looks processed and is not.
- **D2** Bidi overrides (U+202E, the Trojan-Source class) and tag characters
  (U+E0001 to U+E007F) pass straight through into the Word, PDF, Markdown and text
  exports. Nothing flags them.
- **D3** `removeEmojis` matches U+200D and U+FE0F as bare codepoints, so it deletes the
  orthographic ZWJ in Devanagari clusters and logs it as "Emoji removal". Myridius writes
  for readers in India, so this is a live locale, not a hypothetical.

Design decisions settled in the requirement:
- The pass runs **first** in `transform`, before `protect()`. Placement is the fix for D1.
  This is the inverse of FR-S14 for splitting and the two do not conflict.
- Artifacts are a **separate evidence class, never scored**. FR-U1 forbids any effect on
  the band, the dimensions or the confidence. Same reasoning as FR-1.4's provenance panel:
  a rubric that responds to one pasted codepoint is measuring clipboards, not register.
- The value of the port is the **keep rules**, not the strip tables: emoji ZWJ chains,
  script joiners, complete flag tag sequences, paired bidi versus overrides, same-script
  fillers. A naive strip table would make D3 systematic instead of accidental.
- `removeEmojis` must be rewritten in the same change to match whole emoji sequences
  (FR-U24), or fixing D3 leaves orphaned joiners behind.
- Carriers inside fenced or inline code are reported and **not** removed (FR-U21), so an
  article about invisible characters survives its own subject matter.
- U+0000 and U+0001 are stripped as controls before `protect()` runs, which closes an
  existing vault-restore hazard rather than creating one (FR-U16).
- No Unicode category fallback (FR-U26). JS has no `unicodedata`, so the port is
  table-driven only and will miss newly assigned format characters. Tables carry a dated
  Unicode-version comment (FR-U13), because U+180F became Mongolian FVS4 in Unicode 14.

Known consequence to record rather than hide: fixing D1 means swaps now fire where they
previously did not, so resemblance scores will **drop** on carrier-laden documents (known
gap 1: swaps run before flagging). The old number was wrong, not the new one. Calibration
figures recorded before this lands are not comparable to figures after (FR-U39).

Amends `docs/ai-text-audit-spec.md` in eight places, listed as a checklist in section 0.2
and repeated in section 12 of the requirement. FR-1.8 is the headline: "normalize Unicode
to NFC" is the defect, because NFC is required to preserve every one of these codepoints.

SHIPPED 2026-08-24. See the section below.

## Decisions made 2026-08-24
- Analysed `guillaumemeyer/watermarks-remover` (MIT, v0.5.0, 15.6k stars) as prior
  art. 822 tests pass on a bare container. Roughly 90% deterministic; the only
  LLM-dependent layer is the statistical rewrite, whose default backend just prints a
  prompt. Written up in `docs/ref-watermarks-remover-analysis.md`, with two bugs found
  in it (`clean_image.py --in-place` tuple unpack; `av_meta._strip_mp4` truncated-tail
  data loss).
- ADOPT the invisible-Unicode classifier (their Layer A), ported Python to JS.
  Requirement in `docs/req-unicode-artifacts.md`, 57 numbered FR-U requirements.
- REJECT from the same project: the statistical rewrite layer (needs an LLM, breaks
  the no-network promise), all image/audio/PDF metadata surgery (this is a text tool),
  pixel-domain and torch backends, the HTTP service, hooks and SARIF (ADR-0002 settled
  on a single-file browser app).
- SETTLED: artifacts never touch the score, the band or the confidence (FR-U1). Same
  reasoning as spec FR-1.4's provenance panel. This is the boundary that stops the
  module drifting into being an AI detector, per spec section 1.2. Do not relitigate.
- SETTLED: the pass runs FIRST in `transform`, before `protect()`. Placement is the
  fix, not an optimisation. This is the inverse of FR-S14 for splitting and the two do
  not conflict.
- SETTLED: `removeEmojis` must be rewritten to match whole emoji sequences in the same
  commit (FR-U24), or fixing the Devanagari defect leaves orphaned joiners behind.
- SETTLED: carriers inside fenced or inline code are reported, never removed (FR-U21),
  so an article about invisible characters survives its own subject matter.
- SETTLED: no Unicode category fallback (FR-U26). JS has no `unicodedata`, so the port
  is table-driven only, with a dated Unicode-version comment (FR-U13). U+180F became
  Mongolian FVS4 in Unicode 14 and a category rule would have deleted it.
- Still open and cheap, not folded in: DOCX provenance reading (spec FR-1.4;
  `fileio.js` already has a working `unzip()` that discards `docProps/`), and a
  fail-loud ingestion contract so a partial read never reports as a clean read.

## Deferred until the design back-port
- FR-U30 to FR-U36, the artifacts panel. No resemblance UI exists in `src/`.
- FR-U48, score invariance. `reviewParas` does not exist in `src/`. The handoff says
  write the test now and skip it with a printed reason naming FR-U48.
- FR-U40, artifact pass running when language detection refuses. FR-1.7 is unbuilt.
The back-port must pick these up and unskip FR-U48.

## Open question for the user
FR-U14 defaults `artifactNormalizeSpaces` to true, which turns non-breaking spaces
into ordinary ones and changes line-breaking on `10 km`, `10 %`, `Fig. 3` and French
guillemet spacing. Defensible for business prose, wrong for typeset work. Unanswered
at save. Ships as true unless the user says otherwise.

## Next actions
0. WAITING: user is running a tester round over the next several days with
   `dist/Patralekhiser-test-build.html`. Packaging revisited only if feedback gives a
   concrete reason (see ADR-0002 triggers).
1. Write the complete requirement and handover document for Claude Code covering
   the audit module back-port. The splitting requirement and the Unicode artifacts
   requirement are standalone pieces of it and should be referenced, not rewritten.
1a. DONE 2026-08-24. `docs/req-unicode-artifacts.md` implemented, engine only. See
   "Shipped 2026-08-24: invisible Unicode artifacts" above for what changed, what turned
   out different from the requirement, and what was deferred.
1b. KNOWN LAG: the tester build `dist/Patralekhiser-test-build.html` is built from
   `design/index.html`, not from `src/`, so it will still carry all three Unicode
   defects after 1a lands. Tester reports of stray or missing characters are expected,
   not new bugs. Do NOT hand-edit `design/index.html` to patch it; two divergent
   implementations of the classifier is the worse outcome.
2. DONE 2026-08-24. `design/index.html` back-ported into `src/engine.js` and
   `src/template.html`, FR-U30 to FR-U36 built, FR-U48 unskipped and passing. The tab is
   now called "Resemblance" in `src/`, so `README.md` was corrected to match.
3. Add tests for the new engine surface, then run `node tests/*.js`.
4. Vendor pdf.js locally (removes the last CDN dependency).
5. Ask again for sample Myridius articles to calibrate the humanizer word lists.
6. After any code change: tests, build, commit via device (clear stale locks
   first), remind the user to `git push` from Terminal.
