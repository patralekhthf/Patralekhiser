# Session Context: Patralekhiser (2026-08-19)

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
Context window: 62,109 tokens = 31% of 200,000 at resume; see below for the
current figure when this file is next saved.

## Current stage & gate status
Patralekhiser v1.1 is live, committed and pushed
(github.com/patralekhthf/Patralekhiser, main, HEAD f66d55f).

The AI Text Audit module is NO LONGER just a spec. A working implementation
arrived in `design/index.html` (117 KB, 2,690 lines) as a patched superset of
`app/index.html` (81 KB, 1,921 lines). It is self-contained, runs in a browser,
and carries the full resemblance-audit feature.

Next stage: write the requirement and handover document for Claude Code, then
back-port the design implementation into the `src/` build pipeline.

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

## PUSH IS BLOCKED FROM BOTH ENVIRONMENTS (verified, not assumed)
- Cloud sandbox: can READ github (anonymous clone works) but the git proxy refuses
  writes: "not in this session's authorized repository set, so the proxy will not
  inject a credential". Dry-run pushes to `main` and to a throwaway ref both 403.
  The `add_repo` tool the proxy suggests is not exposed in this session.
- Bridge VM on the Mac: no network at all (403 from its proxy), no stored
  credentials, no SSH keys, no `gh`.
- So every push must be run by the user from their own Mac Terminal. Commits are
  prepared locally and left ready.
- Unpushed as of this note: 8884909, 42332b3, 38e99a4 plus the current commit.
  Remote HEAD is 74c3b03.

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

## Next actions
0. WAITING: user is running a tester round over the next several days with
   `dist/Patralekhiser-test-build.html`. Packaging revisited only if feedback gives a
   concrete reason (see ADR-0002 triggers).
1. Write the complete requirement and handover document for Claude Code covering
   the audit module back-port. The splitting requirement is a standalone piece of
   it and should be folded in or referenced, not rewritten.
2. Back-port `design/index.html` into `src/engine.js` and `src/template.html`,
   then `node src/build.js`.
3. Add tests for the new engine surface, then run `node tests/*.js`.
4. Vendor pdf.js locally (removes the last CDN dependency).
5. Ask again for sample Myridius articles to calibrate the humanizer word lists.
6. After any code change: tests, build, commit via device (clear stale locks
   first), remind the user to `git push` from Terminal.
