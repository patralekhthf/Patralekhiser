# ADR-0003: Document formatting, own parser versus vendored Markdown library

**Status:** Proposed
**Date:** 2026-08-19
**Deciders:** Satyam Patralekh
**Related:** [ADR-0001](ADR-0001-retain-vanilla-single-file-stack.md) (accepted),
[ADR-0002](ADR-0002-packaging-and-distribution.md) (deferred)

> Unblocked by ADR-0002 being deferred. Formatting is a parser and serialisation problem
> inside `src/fileio.js`, so none of it waits on a packaging decision.

## Context

v2 wants full formatting and better downloads. The formatter today is `parseDoc` in
`src/fileio.js`, twenty lines that split paragraphs on blank lines, recognise ATX headings
clamped to three levels, and split `**bold**` into runs. It returns
`[{ level, runs: [{ text, bold }] }]`.

Everything else is passed through as literal text: no italic, no lists, no links, no
tables, no blockquotes, no fenced code, no images, no nested emphasis.

The current state of the writers, verified against the source:

- **`toDocx`** honours per-run bold and real `Heading1` to `Heading3` styles. It writes
  five parts: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`,
  `word/_rels/document.xml.rels`, `word/styles.xml`. There is no `numbering.xml`, so lists
  are not representable at all without adding a new part, a content type and a relationship.
- **`toPdf`** already embeds both Helvetica as `/F1` and Helvetica-Bold as `/F2`. Inline
  bold is lost not for want of a font but because each paragraph is flattened with
  `p.runs.map(r => r.text).join("")` and then given a single `bold` value derived from
  `p.level > 0`. Line wrapping estimates width as `chars * size * 0.5`, a fixed-width
  calculation applied to a proportional font, so wrapping is approximate in both directions.
- **`fromDocx`** collects `<w:t>` text and reads `<w:pStyle>` for headings but never looks
  for `<w:b/>`, so bold survives export and is silently lost on import. The docx round trip
  is lossy in one direction.

One architectural constraint dominates this decision. The engine and the audit module are
**text-first**. Flag offsets are character indices into a paragraph's output string;
`protectedRanges`, `guardText` and `sentenceSpans` all operate on plain text and are
carefully length-preserving; the review loop rebuilds paragraphs from a baseline string and
re-applies edits by nth occurrence. Introducing a rich document model as the engine's
internal representation would invalidate all of that.

## Decision

Write an own block-and-inline parser covering a documented subset. Do not vendor a Markdown
library.

Keep the pipeline text-first. The parser stays a **boundary concern**: Markdown-ish text
remains the single source of truth that the engine transforms and the audit scores, and
parsing to a document tree happens only at the IO boundary, on export and on import. The
engine's view of a document does not change.

Define the supported subset explicitly, and make it exactly what the writers can render.

## Options Considered

### Option A: Own parser, documented subset

| Dimension | Assessment |
|---|---|
| Complexity | Medium. Roughly 250 to 400 lines for parser plus writer extensions |
| Cost | Development time only |
| Correctness | Good within the subset, undefined outside it |
| Team familiarity | High. Same style as the rest of the codebase |

**Pros:**
- Preserves the zero-dependency claim in `README.md` and ADR-0001.
- Coverage is bounded by what the writers support anyway, so no wasted parsing.
- Deterministic and inspectable, consistent with the product claim.
- No license notice, no supply chain, no bundle size jump.
- The subset can be stated in the UI, so users know what will survive an export.

**Cons:**
- Hand-rolled parsers get emphasis edge cases wrong. `*a**b*`, intraword underscores and
  nested emphasis are the classic traps.
- Nested lists and lazy continuation lines are genuinely fiddly.
- Any construct outside the subset silently passes through as literal characters, which
  looks like a bug to a user even when documented.

### Option B: Vendor a Markdown library (markdown-it, marked, remark)

| Dimension | Assessment |
|---|---|
| Complexity | Low for parsing, unchanged for writing |
| Cost | Roughly 100 KB minified inlined into the single file |
| Correctness | High. CommonMark compliant, well tested |
| Team familiarity | Low but the API is small |

**Pros:**
- Correct emphasis, nesting and list handling for free, including the cases a hand-rolled
  parser gets wrong.
- Well-tested against the CommonMark suite.
- Faster to reach broad Markdown coverage.

**Cons:**
- **Buys coverage that cannot be used.** The parser's useful range is capped by the docx and
  PDF writers, and extending those is the bulk of the work either way. A CommonMark-complete
  AST containing images, reference links, HTML blocks and deeply nested structures still
  needs a renderer written for each, or those constructs get dropped anyway.
- Breaks the "no dependencies" statement in `README.md` and requires a license notice inside
  the distributed file.
- Roughly doubles the single-file size, from 117 KB to around 220 KB. Tolerable, not free.
- Still solves none of the export problem, which is where the actual difficulty is.
- Adds a dependency to a tool whose selling point is that it has none.

### Option C: Replace the writers with libraries (docx, pdf-lib) as well

| Dimension | Assessment |
|---|---|
| Complexity | Low to write, high to package |
| Cost | Several hundred KB, or a move to Electron |
| Correctness | High |
| Team familiarity | Low |

**Pros:** correct docx numbering and styles without learning OOXML; real PDF text metrics,
which fixes wrapping properly; genuine font embedding.
**Cons:** the hand-rolled writers are validated working code, tested against python-docx,
qpdf and pdftotext, and represent the largest sunk investment in `src/fileio.js`; bundle
size becomes hard to justify for a single-file tool; the browser-friendly options are not
uniformly small; realistically pushes toward Electron, which reverses ADR-0002's reasoning.
Records a genuine alternative if PDF fidelity ever becomes the dominant complaint.

## Trade-off Analysis

The intuition favouring Option B is that Markdown parsing is a solved problem and rewriting
it is hubris. That is true in general and misleading here, because parsing is not the
bottleneck. The bottleneck is rendering to Word and PDF, and every construct parsed must be
rendered by hand regardless. Vendoring a CommonMark parser produces an AST richer than the
writers can consume, and the surplus either gets dropped, which is what happens today, or
gets written by hand, which is Option A's work anyway.

So the correct sequencing is inverted from the instinct: **decide what the writers will
support, then write exactly enough parser to feed them.** That framing makes Option A a
bounded task rather than an open-ended reimplementation of CommonMark.

The strongest argument for Option B remains emphasis correctness, which hand-rolled parsers
reliably get wrong. Mitigation is to restrict the subset so the hard cases do not arise:
support `**bold**` and `_italic_` with no nesting and no intraword matching, and document
that. A restriction that is stated is a feature; one that is discovered is a bug.

Option C is a real answer to a different question. If PDF fidelity becomes the dominant
complaint, it should be reopened, and it would probably carry Electron with it.

## Proposed subset

Support exactly this, and say so in the Configuration view:

**Block:** paragraphs, ATX headings 1 to 3, unordered lists, ordered lists, one level of
nesting, blockquotes, fenced code blocks, thematic breaks.
**Inline:** bold, italic, inline code, links.
**Explicitly not supported:** images, tables, nested emphasis, reference links, raw HTML,
footnotes, definition lists, heading levels 4 to 6, which continue to clamp to 3.

Tables are the most likely first request. They are deliberately out because they need a
`<w:tbl>` implementation in docx and a column layout engine in PDF, which together are
comparable in size to everything else in this ADR.

## Consequences

**Easier:**
- The engine, the audit offsets and the review loop are untouched, since text stays the
  source of truth.
- The subset is a testable contract, one round-trip test per construct.
- A user can be told exactly what survives an export.

**Harder:**
- `toDocx` must gain `numbering.xml`, a content type and a relationship for real Word lists.
  This is the single largest piece of work in v2's export story.
- `toPdf` must render runs rather than flattened paragraph strings, and must adopt a real
  Helvetica advance-width table to fix wrapping. The bold font resource already exists.
- `fromDocx` must detect `<w:b/>`, `<w:i/>` and list numbering to stop the round trip being
  lossy. Import fidelity is now a first-class requirement, not an afterthought.
- Anything outside the subset still passes through literally, so the UI must say what the
  subset is.

**To revisit:**
- If tables are requested twice, reopen and cost them separately.
- If emphasis bugs are reported despite the restricted subset, that is the signal to
  reconsider Option B for the inline layer only, keeping the own block parser.
- If PDF fidelity becomes the dominant complaint, reopen Option C, which would also
  reopen ADR-0002 since it points toward Electron.

## Action Items

1. [ ] Write the subset into `docs/` as a formatting contract before writing code.
2. [ ] Replace `parseDoc` with a block-and-inline parser producing a small explicit AST.
       Keep the existing `{ level, runs }` shape as a compatibility view if that reduces
       churn in the writers.
3. [ ] Extend `toDocx`: `numbering.xml` plus content type plus relationship for lists,
       italic runs, inline code as a character style, hyperlink relationships, blockquote
       indentation.
4. [ ] Fix `toPdf`: render per-run bold and italic instead of flattening, add a Helvetica
       advance-width table for correct wrapping, add italic and bold-italic font resources,
       render list markers and code blocks.
5. [ ] Fix `fromDocx`: detect `<w:b/>` and `<w:i/>`, and map list numbering back to Markdown
       markers, so a docx round trip is lossless within the subset.
6. [ ] Add round-trip tests: one per supported construct, asserting
       text to docx to text and text to PDF text extraction.
7. [ ] Add list support to the parser before, or at the same time as, the audit module's
       "pull key items into a short list" suggestion reaches users. The tool currently
       recommends a construct its own formatter cannot render, and
       `docs/req-sentence-splitting.md` FR-S10 skips list items for a related reason.
8. [ ] State the supported subset in the Configuration view.
