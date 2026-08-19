# Session Context — Patralekhiser — 2026-08-19

## Context at save
Context window: 253,437 tokens = 127% of 200,000 (compaction had occurred)

## Current stage & gate status
Tool is live at v1.1, committed locally and pushed to GitHub (github.com/patralekhthf/Patralekhiser, branch main, HEAD f66d55f).
Next stage agreed but NOT started: AI Text Audit module per docs/ai-text-audit-spec.md.

## What exists and works
- Single-file app at app/index.html (79 KB, no runtime dependencies, no LLM).
- Split-screen editor: original left, Patralekhised right, paragraph-level scroll
  sync both ways, hover pairing, Show original toggle, Edit button.
- Engine (src/engine.js): protected terms, simple-word swaps, hype/AI-word swaps,
  filler phrase cleanup, sentence-start and mid-sentence deletes, dash and emoji
  handling, contraction expansion, flags (long sentence, passive, semicolon,
  repetitive rhythm/headings, connective stacking), Flesch stats.
  Exports: process, processDoc (1:1 paragraph mapping), transform, analyze.
- File IO (src/fileio.js): hand-rolled zip/unzip (DecompressionStream),
  docx read/write (real Heading styles, validated with python-docx), PDF writer
  (validated with qpdf/pdftotext), txt export. PDF READING lazy-loads pdf.js
  from cdnjs (only network dependency).
- Config tab: editable rules, JSON export/import (no localStorage by design).
- Tests: tests/test.js (engine, 34 checks) and tests/fileio.test.js (15 checks).
  Build: node src/build.js inlines engine+fileio into app/index.html.

## Decisions made this session
- Zero-LLM constraint for the humanizer: deterministic rules only; flags what it
  cannot safely fix ("Needs a human" tab).
- Renamed from Myridiusizer to Patralekhiser (folder, repo, UI, filenames).
  "Myridius" kept where it means the company/style, incl. code identifiers
  MyridiusEngine/MyridiusFileIO.
- Style profile captured in docs/style-profile.md (source of truth for rules).
- GitHub: cloud sandbox git proxy blocks unauthorized repos even with a user PAT;
  push was done by the user from their own Mac Terminal. Future pushes: user runs
  git push locally. Token used was exposed in chat; user told to revoke.
- Device mount cannot delete files: git leaves stale .git/*.lock after every op.
  Workaround: mv locks into _to_delete/ before each git command.

## Audit module review verdict (delivered to user this session)
- Phase 1 (T0 deterministic core): fully buildable here.
- Phase 2 (T1, wink-nlp/compromise + n-gram lang id, Burrows's Delta): buildable;
  app grows to ~3-5 MB; vendor pdf.js at the same time to satisfy zero-network CSP.
- Phase 3 (T3 Ollama provider): code buildable, live-model verification must
  happen on the user's Mac. Tension flagged: original zero-LLM constraint vs T3.
- Phase 4 (T2 ~90 MB model): recommend skip; bridge caps files at 20 MB anyway.
- Hard user dependency: calibration corpus (FR-11.5) — human classes, especially
  the 20 second-language English docs (G-1 gate). AI classes can be generated.

## Open threads / blockers
- User has NOT yet answered: audit module as a third tab in app/index.html or a
  separate HTML file sharing the engine? (asked at end of session)
- Calibration corpus not sourced. All future thresholds provisional until then.
- Team style calibration: user promised sample Myridius articles; never arrived.
- User may still need to revoke the exposed GitHub token.

## Next actions
1. Get the tab-vs-separate-file decision, then start Audit Phase 1 (T0):
   ingest/normalize with offset map, segmenter, M-01..M-30, dimensions/bands/
   confidence, guards G-3/G-5/G-6, findings, report UI, exports, lexicon packs.
2. Vendor pdf.js locally (removes last CDN dependency).
3. Ask again for sample Myridius articles to calibrate humanizer word lists.
4. After any code change: node tests/*.js, node src/build.js, commit via device
   (clear stale locks first), remind user to git push from Terminal.
