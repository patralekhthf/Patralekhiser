# AI Text Audit Module: Technical Specification

**Version** 1.0 · **Target** browser-side module in an existing HTML/JS application
· **Constraint** must run with zero network connectivity

---

## 0. How to read this document

This spec is written to be handed to an implementing agent (Claude Code) and worked
through in order. Requirements are numbered and each carries a **tier tag** telling you
what capability it depends on:

| Tag | Means | Ships when |
|-----|-------|-----------|
| `T0` | Pure deterministic code. Regex, arithmetic, string handling. No model of any kind. | Immediately |
| `T1` | Classical NLP. Tokenizers, POS tagging, named-entity recognition, stylometry. Small offline JS libraries. | Immediately (adds ~1 to 3 MB of bundle) |
| `T2` | A small local statistical language model used only to score token probability. Not a chat model. | When you accept a ~90 to 350 MB local model asset |
| `T3` | A reasoning LLM. Generates prose, judges meaning, proposes rewrites. | When you have a local LLM (Ollama, llama.cpp, WebLLM) or an approved API |

**Section 9 is the one you asked for**: every capability that cannot exist without a
language model, what the degraded version looks like until then, and the interface to
build now so the upgrade is a drop-in.

Build order is T0 then T1 then T3 then T2. T2 is listed third by tier but last by
priority, because it is the heaviest asset for the least incremental user value.

---

## 1. Purpose and scope

### 1.1 What the module does

Given a piece of prose, the module measures how closely the writing resembles the
default register and structure of large-language-model output, and presents the finding
as annotated evidence on the text itself plus a banded score.

### 1.2 Hard scope boundary

This module does **not** determine authorship and must never claim to. See section 2,
which states this as a testable requirement rather than a disclaimer, because it is the
single most likely way for this feature to cause real harm to a real person.

### 1.3 Users

Two roles, both offline, both on a MacBook:

- **Author**: runs it on their own draft before publishing. Wants edits.
- **Reviewer**: runs it on a document someone else produced. Wants evidence they could
  defend in a conversation.

The reviewer path is the one that needs guardrails.

### 1.4 Out of scope for v1

- Multi-document batch comparison
- Any telemetry, analytics, or crash reporting (see 3.1)
- Languages other than English (detect and refuse, see FR-1.7)
- Plagiarism detection against a source corpus
- Editing the document in place

---

## 2. The honesty requirements

These are functional requirements with acceptance criteria, not copy suggestions. Treat
a violation as a failing test.

**FR-0.1** `T0` The module must never output a percentage, probability, or any figure
formatted as a likelihood that text was AI-generated. The scoring scale is 0 to 20 and
is always rendered with the `/20` denominator visible.
*Acceptance: a grep of all user-facing strings and templates finds no `%` adjacent to a
score value; the score component refuses to render if handed a value outside 0 to 20.*

**FR-0.2** `T0` All verdict language is drawn from a locked vocabulary file
(`config/verdicts.json`). The permitted band labels are exactly: `Reads as
human-written`, `Mild resemblance`, `Substantial resemblance`, `Heavy resemblance`. No
code path may construct verdict prose by string concatenation outside this file.
*Acceptance: unit test asserts the rendered band string is one of the four constants.*

**FR-0.3** `T0` The limitation notice must be rendered above the fold in the UI and
embedded in every export format. It must not be dismissible, collapsible, or
suppressible by configuration.
*Acceptance: export snapshot tests assert the notice string is present in HTML, PDF and
JSON exports.*

**FR-0.4** `T3` Any generated prose must use resemblance framing ("this text carries
markers of", "this reads like") and never authorship framing ("this was written by",
"the author used AI"). The generation prompt carries this as a constraint and a
post-generation filter rejects output matching a banned-phrase list.
*Acceptance: filter test with a seeded violating string causes regeneration, then hard
failure with a visible error rather than silent passthrough.*

**FR-0.5** `T0` When any false-positive guard fires (section 7), the guard must appear
in the report body, not only in a tooltip or a log.

**FR-0.6** `T0` Confidence is always displayed adjacent to the score, never separated
from it. A score shown without confidence is a defect.

---

## 3. Constraints

### 3.1 Offline and privacy

**NFR-1** No runtime network request of any kind. Enforced, not just intended:

```
Content-Security-Policy: default-src 'self'; connect-src 'self';
  script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'
```

**NFR-2** All assets vendored locally. No CDN references, no Google Fonts, no remote
source maps. A build-time check must fail the bundle if any `http://` or `https://`
literal appears outside comments and documentation.

**NFR-3** Document content must never be written to any persistent store by default.
Analysis is in-memory. If a "recent documents" feature is added later it is opt-in,
stored in IndexedDB, and carries a visible clear-all control.

**NFR-4** The `connect-src 'self'` above blocks a local Ollama server on a different
port. When T3 lands with a local server backend, the policy is widened to exactly
`connect-src 'self' http://127.0.0.1:11434` and no further. Document this as a
deliberate, reviewed exception.

### 3.2 Platform

**NFR-5** Target Safari 17+ and Chrome 120+ on macOS (Apple Silicon and Intel).
Firefox best-effort.

**NFR-6** No build-step requirement for the analysis engine itself: it must be
importable as an ES module. The host app's existing bundler wraps it.

**NFR-7** Heavy work runs in a Web Worker. The main thread must never block for more
than 50 ms during analysis.

### 3.3 Performance budgets

Measured on a 5,000-word document, M-series MacBook:

| Tier | Budget | Notes |
|------|--------|-------|
| T0 | < 300 ms | Full metric pass |
| T1 | < 2 s | Including NER over the whole document |
| T2 | < 45 s CPU/WASM, < 10 s WebGPU | Show a progress bar and allow cancel |
| T3 | Streamed, first token < 5 s | Report renders at T0/T1 first, commentary fills in |

**NFR-8** The report must be usable before T2 and T3 finish. Render progressively; never
gate the whole view on the slowest tier.

---

## 4. Architecture

### 4.1 Module layout

```
ai-text-audit/
├── index.js                     # public API, the only import surface
├── engine/
│   ├── ingest/
│   │   ├── plaintext.js         # T0
│   │   ├── docx.js              # T0  (JSZip + DOMParser on word/document.xml)
│   │   ├── pdf.js               # T0  (pdf.js, vendored)
│   │   └── normalize.js         # T0  segmentation, cleanup, offset map
│   ├── metrics/
│   │   ├── structural.js        # T0  M-01..M-09
│   │   ├── lexical.js           # T0  M-10..M-14, M-20..M-29
│   │   ├── density.js           # T0  M-17..M-19
│   │   ├── linguistic.js        # T1  NER, POS, passive, L2 heuristics
│   │   ├── stylometry.js        # T1  Burrows's Delta vs author baseline
│   │   └── surprisal.js         # T2  local LM token ranks and perplexity
│   ├── detect/
│   │   ├── spans.js             # T0/T1 span detection, produces Finding[]
│   │   └── patterns/            # T0  compiled pattern packs
│   ├── score/
│   │   ├── dimensions.js        # T0  metric -> 0..4 per dimension
│   │   ├── bands.js             # T0  weighting, banding
│   │   ├── guards.js            # T0/T1 false-positive guards
│   │   └── confidence.js        # T0
│   ├── narrate/
│   │   ├── templates.js         # T0  canned commentary fallback
│   │   ├── llm.js               # T3  reasoning-LLM commentary and rewrites
│   │   └── provider.js          # T3  pluggable backend interface
│   └── report/
│       ├── html.js              # T0  annotated document view
│       ├── markdown.js          # T0
│       └── json.js              # T0  full machine-readable result
├── config/
│   ├── lexicons/
│   │   ├── stock-phrases.json   # versioned, dated, editable without a rebuild
│   │   ├── hedges.json
│   │   ├── transitions.json
│   │   └── authority-claims.json
│   ├── weights.json             # dimension weights and band thresholds
│   ├── verdicts.json            # locked verdict vocabulary (FR-0.2)
│   └── genres.json              # genre profiles and per-genre score adjustments
├── ui/                          # host-app-facing components
└── test/
    ├── corpus/                  # golden documents, see section 11
    └── ...
```

### 4.2 Layer rule

`engine/` must have no DOM dependency and no knowledge of the host application. It takes
a string and returns a plain object. `ui/` and `report/` may touch the DOM. This is what
makes the engine testable in Node and reusable if the app later grows a backend.

### 4.3 Public API

```js
import { analyze, extract, renderHTML, renderMarkdown } from 'ai-text-audit';

const { text, meta } = await extract(fileOrString);   // ingestion
const result = await analyze(text, {
  tiers: ['T0', 'T1'],            // which tiers to run
  genre: 'auto',                  // or an explicit genre id
  authorBaseline: null,           // optional AuthorBaseline for stylometry
  llm: null,                      // optional LLMProvider for T3
  signal: abortController.signal,
  onProgress: (p) => {},          // { stage, pct }
});
const html = renderHTML(result, { includeExplainer: true });
```

`analyze` must be pure with respect to the module: same input plus same config gives the
same output at T0 and T1. T2 must be deterministic given a fixed model and seed. Only T3
is allowed to vary between runs, and that variance must be disclosed in the UI.

---

## 5. Functional requirements: ingestion

**FR-1.1** `T0` Accept pasted text via a textarea, minimum 1 word, no maximum below
200,000 characters. Above that, warn and offer to analyze the first 200,000.

**FR-1.2** `T0` Accept `.txt`, `.md`, `.docx`, `.pdf`, `.rtf` by file picker and by
drag-and-drop onto the analysis pane.

**FR-1.3** `T0` DOCX extraction runs entirely in-browser: unzip with a vendored JSZip,
parse `word/document.xml` with `DOMParser`, walk `w:p` elements, concatenate `w:t` runs,
emit one paragraph per `w:p`. Preserve heading levels from `w:pStyle`. Ignore
`w:instrText`, comments, headers, footers, and footnotes for the main text but capture
them separately in `meta.auxiliary`.

**FR-1.4** `T0` DOCX provenance metadata: read `docProps/app.xml` and `docProps/core.xml`
and surface `TotalTime` (editing minutes), `Words`, `Application`, `Company`, `creator`,
`lastModifiedBy`, `created`, `modified`, and revision count.
Present these in a **separate "Document provenance" panel**, visually distinct from the
stylistic score, with an explicit note that provenance describes how the file was
assembled and is not part of the resemblance score. A 4,000-word document with a
`TotalTime` of 3 minutes was pasted in rather than typed, which is informative and is
also completely legitimate in many workflows.
*This must not feed the score. Keeping it separate is what stops the report becoming an
accusation engine.*

**FR-1.5** `T0` PDF extraction uses a vendored pdf.js. Extract per-page text items with
their transform matrices, reconstruct reading order by y then x, and reassemble
paragraphs by detecting line-gap thresholds. Strip repeated running heads and footers by
finding lines that recur on more than 60% of pages at the same y position. Strip
standalone page-number lines.

**FR-1.6** `T0` If a PDF yields fewer than 30 characters per page on average, classify it
as scanned and return a clear error: OCR is out of scope and there is no offline OCR
dependency in this build.

**FR-1.7** `T1` Language detection on the extracted text. If the dominant language is not
English, refuse analysis with an explanation. The entire lexicon and every threshold in
this spec is English-specific and applying it to other languages produces noise. Use a
small n-gram language identifier bundled locally, not a heuristic on stopwords alone.

**FR-1.8** `T0` Normalization produces a canonical text plus an **offset map** back to
the original character positions, so every later finding can be anchored to the exact
source range. Normalization: collapse runs of whitespace, normalize Unicode to NFC,
convert smart quotes to straight quotes for matching only (never for display), preserve
paragraph breaks. Highlights must land on the original text, so the offset map is
load-bearing and needs its own tests.

**FR-1.9** `T0` Sentence segmentation must handle abbreviations (Dr., Inc., e.g., i.e.,
U.S.), decimals, ellipses, and quoted sentences. A naive split on `[.!?]` will corrupt
the sentence-length statistics, which are the module's strongest signal. Use a rule-based
segmenter with an abbreviation list, and cover it with the segmentation test set in 11.2.

---

## 6. Functional requirements: metrics

All metrics are computed on the normalized text and returned in the result object under
`metrics`, each with a raw value and, where applicable, a length-normalized rate.

### 6.1 Structural metrics `T0`

| ID | Metric | Definition |
|----|--------|-----------|
| M-01 | `words` | Token count, `[A-Za-z][A-Za-z'-]*` |
| M-02 | `sentences`, `paragraphs` | Counts after FR-1.9 segmentation |
| M-03 | `sentLenMean` | Mean words per sentence |
| M-04 | `sentLenStdev` | Population standard deviation |
| M-05 | `sentLenCV` | Stdev / mean. Length-independent, preferred for thresholds |
| M-06 | `sentLenMin`, `sentLenMax` | With the sentences themselves, for quoting |
| M-07 | `shortSentRate` | Share of sentences under 8 words |
| M-08 | `burstiness` | Mean absolute difference between consecutive sentence lengths, divided by `sentLenMean`. Captures oscillation, which spread alone misses: a text alternating 10,30,10,30 and one running 10,10,30,30 have equal stdev but very different rhythm |
| M-09 | `paraLenStdev` | Standard deviation of sentences per paragraph |
| M-26 | `sectionLenCV` | Coefficient of variation of words per section, where sections are delimited by headings. Mechanically equal sections are a template signal |

### 6.2 Lexical metrics `T0`

| ID | Metric | Definition |
|----|--------|-----------|
| M-10 | `stockHits` | Array of `{phrase, count, offsets[]}` from `stock-phrases.json` |
| M-11 | `stockDensity` | Stock phrase hits per 1,000 words |
| M-12 | `transitionOpenRate` | Share of paragraphs opening with a token from `transitions.json` |
| M-13 | `tricolonDensity` | Matches of `X, Y,? and Z` coordinate structures per 1,000 words |
| M-14 | `emDashRate`, `pairedEmDashRate` | Per 1,000 words. Report both: paired appositive dashes are the mechanical pattern, single dashes are ordinary good writing |
| M-15 | `hedgeDensity` | Hedge tokens per 100 words, from `hedges.json` |
| M-16 | `firstPersonRate`, `secondPersonRate` | Pronoun density per 1,000 words |
| M-20 | `mattr` | Moving-average type-token ratio, window 100. Length-normalized lexical diversity; plain TTR is length-biased and must not be used |
| M-21 | `authorityClaims` | Matches from `authority-claims.json` ("studies show", "experts agree", "research suggests", "it is widely accepted") where no citation marker, proper noun, or year appears within the following 15 tokens |
| M-22 | `notJustCount` | Instances of `not (just|only|merely) X, (but|it's) Y` |
| M-23 | `balancedClauseRate` | Share of sentences opening with `While|Although|Though|Not only|Whereas` or containing `, yet ,` style balance |
| M-24 | `closingRestatement` | Boolean plus offsets: final paragraph opens with a summary connective and shares more than 60% of its content lemmas with earlier paragraphs |
| M-25 | `boldLeadBulletRate` | Share of list items opening with a bolded phrase then a colon (markdown and DOCX runs with `w:b`) |
| M-27 | `fleschKincaid` | Reported as context only, never scored. Readability is not an AI signal |
| M-28 | `openerRepetitionRate` | Share of sentences whose first three tokens match the shape of another sentence's first three, by POS at T1 and by literal token at T0 |
| M-29 | `contractionRate` | Contractions per 1,000 words. Low contraction rate in an informal genre is a weak marker; ignore in formal genres |
| M-30 | `irregularities` | Count of spelling irregularities against a bundled dictionary, inconsistent hyphenation of the same compound, and inconsistent serial-comma usage. **These are anti-markers**: they lower the score |

### 6.3 Specificity metrics

| ID | Metric | Tier | Definition |
|----|--------|------|-----------|
| M-17 | `numeralDensity` | `T0` | Numerals per 1,000 words, split into round numbers (multiples of 5 or 10) and precise ones. Precise figures are strong anti-markers |
| M-18 | `dateDensity` | `T0` | Date-like expressions per 1,000 words |
| M-19a | `capitalizedTokenDensity` | `T0` | Non-sentence-initial capitalized tokens per 1,000 words. Crude proxy for named entities |
| M-19b | `entityDensity` | `T1` | Real NER: PERSON, ORG, GPE, PRODUCT, MONEY, DATE counts per 1,000 words, replacing M-19a when available |
| M-31 | `uniqueEntityRatio` | `T1` | Distinct entities divided by total entity mentions. Repeating one company name 40 times is not specificity |

### 6.4 Linguistic metrics `T1`

| ID | Metric | Definition |
|----|--------|-----------|
| M-32 | `passiveRate` | Share of clauses in passive voice |
| M-33 | `modalDensity` | POS-verified modal verbs, more accurate than the M-15 string match |
| M-34 | `posOpenerDiversity` | Entropy of the POS tag of the first token across sentences. Low entropy means every sentence starts the same way |
| M-35 | `l2Indicators` | Count of article omission or misuse, non-idiomatic preposition choices, and tense inconsistency. **Feeds guard G-1 only, never the score.** These indicate a human writing in a second language |

Implement T1 with a browser-capable NLP library (wink-nlp with its English model, or
compromise). spaCy is not available in the browser and a Python sidecar contradicts the
offline browser-only constraint.

### 6.5 Stylometric metrics `T1`

| ID | Metric | Definition |
|----|--------|-----------|
| M-36 | `burrowsDelta` | Burrows's Delta between this document and an author baseline corpus, over the 150 most frequent function words, z-scored |

**FR-6.1** `T1` The module accepts an optional `AuthorBaseline`: two or more samples of
the same author's earlier writing, ideally predating widespread LLM use. When present,
compute Burrows's Delta and report it prominently.

This is the most evidentially valuable thing in the whole module and it needs no language
model at all. A document that scores 14/20 but sits at a normal Delta distance from the
author's own prior corpus is most likely just how that person writes. A document at an
anomalous Delta distance from the same author's baseline is a far stronger finding than
any stock-phrase count. Build the baseline management UI (add samples, name the author,
store in IndexedDB with explicit consent) as part of T1.

### 6.6 Surprisal metrics `T2`

| ID | Metric | Definition |
|----|--------|-----------|
| M-37 | `meanLogLikelihood` | Mean token log-probability under the local model |
| M-38 | `perplexity` | Exponentiated negative mean log-likelihood |
| M-39 | `surprisalVariance` | Variance of per-token surprisal. The statistical analogue of burstiness |
| M-40 | `rankHistogram` | GLTR-style buckets: share of tokens whose true token fell in the model's top 10, top 100, top 1000, or beyond. Human text has a fatter tail |
| M-41 | `perSentenceSurprisal` | Per-sentence mean, enabling a surprisal heat map over the document |

Implementation: transformers.js with an int8-quantized ONNX `distilgpt2` (~90 MB) or
`gpt2` (~160 MB), executed via WASM with WebGPU when available. Model files are vendored
under `assets/models/` and loaded with `env.allowRemoteModels = false` and
`env.localModelPath` set. Verify with a network-blocked test that no fetch to
huggingface.co is attempted.

**Read this before building T2.** These metrics look scientific and are the weakest link
in the chain. Perplexity-based detection is exactly what produced the wave of false
accusations against non-native English speakers, and it is trivially defeated by light
paraphrasing. A small model's perplexity also says as much about how predictable the
*topic* is as about how the text was produced. Treat M-37 to M-41 as supporting context
displayed alongside the rubric, cap their total contribution to the score at 2 of 20
points, and never let them alone move a document up a band. Budget the 90 MB only if
users specifically ask for it.

---

## 7. Functional requirements: scoring

### 7.1 Dimensions

Five dimensions, each scored 0 to 4, each with a plain name used in all user-facing
output and a formal name used internally.

| # | Formal name | Plain name | Primary inputs |
|---|-------------|-----------|----------------|
| D1 | Lexical fingerprint | **Stock wording** | M-10, M-11, M-14, M-22, M-29 |
| D2 | Syntactic rhythm | **Sentence rhythm** | M-04, M-05, M-08, M-09, M-12, M-13, M-23, M-24, M-26, M-28, M-34 |
| D3 | Rhetorical posture | **Fence-sitting** | M-15, M-21, M-23, M-33 |
| D4 | Informational density | **Missing specifics** | M-17, M-18, M-19, M-31 |
| D5 | Authorial presence | **No personal voice** | M-16, M-29, M-30, and T3 judgment |

**FR-7.1** `T0` Each dimension maps its inputs to 0 to 4 through an explicit, inspectable
rule set in `config/weights.json`. No opaque formula. A worked example for D2:

```
D2 base = 0
  +1 if sentLenCV < 0.45            // low variation
  +1 if burstiness < 0.35           // low oscillation
  +1 if transitionOpenRate > 0.35
  +1 if tricolonDensity > 4.0 per 1k
  +1 if closingRestatement is true
  +1 if sectionLenCV < 0.25 and sections >= 3
  cap at 4
```

Every threshold in this file must be traceable to the calibration corpus in 11.3 and
carry a comment recording the corpus statistic that justified it. Thresholds invented
without corpus support are the main way this module goes quietly wrong.

**FR-7.2** `T0` Weighted total = sum of `dimension x weight`, max 20:

| Dimension | Weight | Why |
|-----------|--------|-----|
| D1 Stock wording | 0.75 | Real but coincidental, and dates fastest |
| D2 Sentence rhythm | 1.25 | Structural, measurable, survives editing |
| D3 Fence-sitting | 1.00 | Strong, some genre overlap |
| D4 Missing specifics | 1.25 | Clearest evidence of writing without knowledge |
| D5 No personal voice | 0.75 | Powerful when absent, heavily genre-dependent |

**FR-7.3** `T0` Bands: 0 to 4.0 human-written · 4.1 to 8.5 mild · 8.6 to 13.5 substantial
· 13.6 to 20 heavy.

**FR-7.4** `T0` Section-level scoring for documents over 1,200 words. Sections are
delimited by headings, or by 400-word windows if the document has none. Report a per
section table and flag any section deviating more than 4 points from the document mean.
Mixed authorship is the common real-world case and the variance between sections is often
the most useful output the module produces.

### 7.2 Confidence

**FR-7.5** `T0` Start at `moderate`. Down one level for each: fewer than 400 words; any
guard fired; the document is form-driven or templated; evidence concentrated in a single
dimension. Up one level for: over 1,500 words with consistent markers; four or five
dimensions at 3 or above. Floor `low` for anything under 150 words. Ceiling `high`.

**FR-7.6** `T0` Under 150 words, return a `insufficient_text` result that renders the
metrics but refuses to render a band at all. Short text is where false positives cluster
and a band on 80 words is worse than no output.

### 7.3 False-positive guards

**FR-7.7** Each guard, when it fires, appends a structured entry to `result.guards` with
an id, a plain-language explanation, and its effect on confidence.

| ID | Guard | Tier | Trigger | Effect |
|----|-------|------|---------|--------|
| G-1 | Second-language English | `T1` | M-35 above threshold | Discount D1 and D2 by 1 each, force confidence down, display prominently |
| G-2 | Genre convention | `T1`/`T3` | Genre classified as legal, academic, medical, regulatory, or compliance | Apply per-genre baseline offsets from `genres.json` to D3 and D5 |
| G-3 | Template or house style | `T0` | `sectionLenCV` very low **and** heading text matches a known template pattern, or the same structure repeats across sections | Discount D2 |
| G-4 | Translated text | `T1` | Low idiom density with high formal-register density and low contraction rate | Reduce confidence |
| G-5 | Short text | `T0` | Under 400 words | Reduce confidence; under 150 see FR-7.6 |
| G-6 | Marketing or SEO register | `T0` | High stock density concentrated in marketing-specific lexicon subset | Discount D1 |
| G-7 | Author baseline consistent | `T1` | Burrows's Delta within normal range for this author | Reduce the reported band by one level and say why |

**FR-7.8** `T0` G-1 is the most important requirement in this section. English written by
a second-language speaker produces low lexical diversity, formal vocabulary, careful
hedging, and even sentence lengths. That is the same profile as LLM output on four of
five dimensions. Every published detector that skipped this guard generated real,
documented harm to real students and employees. Implement it before shipping the reviewer
workflow, and when it fires, say so in the largest text in the report.

---

## 8. Functional requirements: findings and reporting

### 8.1 Findings

**FR-8.1** `T0` Every flagged passage produces a `Finding`:

```ts
interface Finding {
  id: string;
  dimension: 1|2|3|4|5;
  start: number;            // offset into the ORIGINAL text
  end: number;
  matchedText: string;
  patternId: string;        // e.g. "stock.in-todays-landscape"
  severity: 1|2|3;
  note: {
    pattern: string;        // what it is, plain words        [T0 template]
    cost: string;           // what it costs the reader        [T0 template]
    rewrite: string | null; // concrete replacement            [T3 only]
    source: 'template' | 'llm';
  };
}
```

**FR-8.2** `T0` Findings must not overlap. Where two patterns match overlapping ranges,
keep the higher severity, then the longer span.

**FR-8.3** `T0` Cap highlighted text at 20% of total characters. Above that the page stops
being readable and stops being persuasive. Keep the highest-severity findings, move the
remainder to an appendix list in the report.

**FR-8.4** `T0` D5 (No personal voice) is evidenced by absence and will normally produce
zero findings while still scoring high. The UI must explain this wherever a zero count is
shown, or a zero reads as a pass.

### 8.2 Report UI

**FR-8.5** `T0` The analysis view contains, in order: score and band with confidence
adjacent; the non-dismissible limitation notice; a colour legend using **plain** dimension
names with per-dimension finding counts; a collapsed explainer panel; the highlighting
toggle; the annotated document; the provenance panel; the metrics table; the guards
section; the section-variation table.

**FR-8.6** `T0` The explainer panel is collapsed by default, opens on click, and defines
each of the five dimensions in one or two plain sentences with a contrasting pair of
examples: the AI-flavoured version and how a person would write the same thing. It closes
with the caveat that formal business, legal, and academic registers score high by
convention and that second-language writers score high on D1 and D2 through no fault of
their own.

**FR-8.7** `T0` Highlights reveal their note on hover and on click, so the report works on
a trackpad and on a touchscreen. Notes render with line breaks preserved.

**FR-8.8** `T0` A toggle hides all highlighting so the text can be read clean.

**FR-8.9** `T0` Keyboard accessible throughout: findings reachable by Tab, notes shown on
focus as well as hover, WCAG 2.1 AA contrast for every highlight colour in both light and
dark mode. Highlight colour must not be the only channel carrying meaning: pair each
colour with a small dimension marker for colour-blind users.

**FR-8.10** `T0` Exports: self-contained HTML (single file, inlined CSS and JS, data-URI
assets), Markdown, and JSON. PDF export via the browser print path with a print
stylesheet. Every export embeds the limitation notice and the fired guards.

**FR-8.11** `T0` Every result carries a provenance header: module version, lexicon pack
version and date, weights version, which tiers ran, and the model identifier if T2 or T3
were used. Two reports produced by different lexicon versions are not comparable and the
report must make that checkable.

### 8.3 Configuration

**FR-8.12** `T0` Lexicon packs are JSON, versioned, dated, and loadable at runtime without
a rebuild. Model vocabulary shifts every few months and a hard-coded phrase list is
obsolete within a year. Include a simple UI for viewing the active pack and its date, and
warn when the pack is more than 12 months old.

---

## 9. What is not doable without a language model

This is the section to consult when planning the LLM work. Everything below is either
impossible or badly degraded at T0/T1. For each item: what it needs, what ships instead
in the meantime, and the interface to build now.

### 9.1 The interface to build now

Define this at T0 and implement the template fallback behind it. When an LLM arrives, it
is a single new implementation of the same interface with no changes elsewhere.

```ts
interface NarrationProvider {
  readonly id: string;
  readonly available: boolean;
  explainFinding(f: Finding, ctx: DocumentContext): Promise<FindingNote>;
  suggestRewrite(f: Finding, ctx: DocumentContext): Promise<string | null>;
  classifyGenre(text: string): Promise<GenreVerdict>;
  findAntiMarkers(text: string): Promise<Finding[]>;
  assessVoice(text: string): Promise<{ score: 0|1|2|3|4; evidence: string[] }>;
  writeSummary(result: AnalysisResult): Promise<string>;
}

// T0 implementation: TemplateNarrationProvider  (available: true, rewrites: null)
// T3 implementation: LocalLLMNarrationProvider  (Ollama / llama.cpp / WebLLM)
```

### 9.2 Capability gate table

| Capability | Needs | Ships at T0/T1 instead | Gap |
|---|---|---|---|
| **Per-finding commentary** | `T3` | A canned note per `patternId`, written once by hand. Every instance of "in today's landscape" gets the same paragraph | Generic. Cannot reference this document's subject, audience, or argument |
| **Rewrite suggestions** | `T3` | Nothing. `rewrite` stays `null` and the UI omits the block | This is the single biggest loss. Without it the report tells the author what is wrong and not what to do |
| **Genre classification** | `T3` for accuracy | Keyword-profile classifier over `genres.json`. Works on obvious cases (a contract, a paper with a Methods section), fails on hybrids | Guard G-2 misfires on mixed-genre documents |
| **D5 voice assessment** | `T3` | Proxy only: first-person density, contraction rate, irregularity count | Cannot tell an opinion from a statement, or detect an anecdote, a joke, or a personal stake. The dimension is roughly half-blind |
| **D4 "claims without mechanism"** | `T3` | Counting only: numerals, dates, entities | Counts do not distinguish a load-bearing figure from decoration. A text can be dense with numbers and still explain nothing |
| **Anti-marker detection** | `T3` | Only mechanical ones: typos, inconsistent hyphenation, precise numerals | Cannot detect an anecdote, a joke, a tangent, a strong opinion, or an acknowledged specific uncertainty. So the score cannot be pulled down by the evidence that most deserves to pull it down |
| **Detecting a specific unattributed claim** | `T3` | Regex for "studies show" plus absence of a nearby citation | Misses paraphrased authority appeals with no trigger phrase |
| **Narrative summary** | `T3` | Assembled from templates: band sentence, top three dimensions, guards | Reads mechanically. Cannot connect findings into an argument |
| **Section interpretation** | `T3` | Numbers only: this section scores 15, that one scores 3 | Cannot say what is different about them, which is the useful part |
| **Detecting AI-drafted-then-edited text** | Nothing available | Not detectable | No tier fixes this. State it as a permanent limitation, not a roadmap item |
| **L2 detection for guard G-1** | `T3` for reliability | Heuristics for article and preposition errors | Noisy in both directions. Since G-1 is the harm-prevention guard, prefer over-firing: a false guard costs a little confidence, a missed guard costs someone their reputation |
| **Semantic redundancy in the closing paragraph** | `T3` | Lemma-overlap ratio | Catches literal restatement, misses restatement in different words |
| **Register consistency across sections** | `T3` | Per-section metric deltas | Numbers flag the discontinuity, prose is needed to characterize it |

### 9.3 What a language model does *not* fix

Worth stating in the spec so nobody plans around it later:

- **Authorship remains undeterminable.** An LLM makes the commentary better. It does not
  convert resemblance into proof, and a fluent, confident LLM-written explanation is
  actively more dangerous than a terse template because it reads as authoritative.
- **The false-positive problem gets worse, not better,** if T3 output is allowed to
  overrule the guards. Guards are computed before narration and narration must be
  constrained by them, never the reverse.
- **T2 perplexity is not a shortcut.** See the warning at the end of 6.6.

### 9.4 T3 integration requirements, for when you get there

**FR-9.1** `T3` The provider is pluggable. First implementation targets a local Ollama
server on `127.0.0.1:11434` with a model in the 7B to 14B class. WebLLM in-browser is the
zero-install alternative at a 2 to 4 GB asset cost.

**FR-9.2** `T3` The LLM receives the findings, the metrics, and the guards as structured
input, and is asked to explain and rewrite. **It never re-scores.** Scoring stays
deterministic so results stay reproducible and defensible.

**FR-9.3** `T3` Every LLM-authored string is labelled as generated in the UI and carries
`source: 'llm'` in the JSON, so a reader can tell measurement from commentary.

**FR-9.4** `T3` Output passes the FR-0.4 banned-phrase filter before display. Two
regeneration attempts, then fall back to the template note and show a quiet notice.

**FR-9.5** `T3` The document is sent only to the local provider. Any future remote
provider requires an explicit per-session opt-in with a clear warning that the document
leaves the machine, and must be off by default.

**FR-9.6** `T3` Full functionality without the LLM is a permanent requirement, not a
transitional state. If the model is missing or the server is down, the module degrades to
templates silently and stays useful.

---

## 10. Data contract

```ts
interface AnalysisResult {
  version: { module: string; lexicons: string; weights: string };
  tiersRun: ('T0'|'T1'|'T2'|'T3')[];
  input: { words: number; chars: number; source: 'paste'|'docx'|'pdf'|'txt'|'md'|'rtf';
           language: string; truncated: boolean };
  metrics: Record<string, number | object>;
  dimensions: Array<{
    id: 1|2|3|4|5; formalName: string; plainName: string;
    raw: 0|1|2|3|4; weight: number; weighted: number;
    contributingMetrics: string[];      // traceability: which metrics drove this
    rulesFired: string[];               // which threshold rules fired
  }>;
  score: { weighted: number; max: 20; band: BandId; bandLabel: string };
  confidence: 'low'|'moderate'|'high';
  insufficientText: boolean;
  guards: Array<{ id: string; label: string; explanation: string;
                  effect: string; firedBecause: string }>;
  findings: Finding[];
  sections?: Array<{ title: string; start: number; end: number;
                     weighted: number; deviation: number }>;
  provenance?: { totalTimeMinutes?: number; application?: string;
                 creator?: string; created?: string; modified?: string;
                 revisions?: number; note: string };
  stylometry?: { burrowsDelta: number; baselineId: string;
                 baselineSamples: number; interpretation: string };
  narrative?: { summary: string; source: 'template'|'llm'; modelId?: string };
}
```

**FR-10.1** `T0` `contributingMetrics` and `rulesFired` are mandatory. Any score a user
challenges must be traceable to the exact numbers and rules that produced it. A score
that cannot be explained is a score that cannot be defended.

---

## 11. Testing requirements

### 11.1 Unit

**FR-11.1** Every metric has tests with hand-computed expected values on short fixtures.
**FR-11.2** Offset-map round-trip: for every finding on every corpus document, the
original text sliced by `[start, end)` equals `matchedText`. This is the test that stops
highlights drifting.
**FR-11.3** Every scoring rule tested at its threshold boundary and one unit either side.

### 11.2 Segmentation

**FR-11.4** A fixture set of at least 200 sentences covering abbreviations, decimals,
ellipses, quotations, headings, lists, and citations, with expected boundaries. Sentence
statistics are the module's strongest signal and a segmentation bug corrupts them
invisibly.

### 11.3 Calibration corpus

**FR-11.5** Assemble and commit a labelled corpus. Minimum viable:

| Class | Count | Purpose |
|-------|-------|---------|
| Known human, pre-2022, business and technical | 30 | False-positive baseline |
| Known human, second-language English | 20 | **G-1 validation. Non-negotiable** |
| Known human, legal, academic, regulatory | 20 | G-2 validation |
| Known AI, unedited, several models | 30 | True-positive baseline |
| Known AI, lightly human-edited | 20 | Sensitivity curve |
| Known AI, heavily human-edited | 15 | Expected to score low; documents the limit |
| Human draft polished by AI | 15 | The reverse case |

**FR-11.6** Report on every build: false-positive rate on the human classes, separation
between the human and unedited-AI distributions, and **the false-positive rate on the
second-language class reported separately and tracked as a release-blocking metric**. If
the L2 false-positive rate is materially higher than the native-speaker rate, the module
is not ready to ship to reviewers regardless of how good its overall numbers look.

**FR-11.7** Every threshold in `weights.json` carries a comment naming the corpus
percentile that justified it.

### 11.4 Other

**FR-11.8** Network isolation test: run the full suite with fetch, XHR, and WebSocket
stubbed to throw. Any attempted call fails the build.
**FR-11.9** Performance test asserting the section 3.3 budgets.
**FR-11.10** Export snapshot tests asserting the limitation notice and guards are present
in every format.
**FR-11.11** Accessibility test: axe-core clean, contrast verified for all ten highlight
colours across light and dark.

---

## 12. Delivery phases

**Phase 1: deterministic core** `T0`
Ingestion for all formats, normalization and offset map, metrics M-01 to M-30, dimension
scoring, bands, confidence, guards G-3 G-5 G-6, findings with template notes, the full
report UI including the explainer, all three exports, lexicon pack loading.
*Exit criterion: separates the human and unedited-AI corpus classes with no overlap in
band, and produces zero false positives above "mild" on the pre-2022 human class.*

**Phase 2: classical NLP** `T1`
NER, POS metrics, language detection, L2 heuristics, guards G-1 G-2 G-4, Burrows's Delta
and the author-baseline manager, genre profiles.
*Exit criterion: G-1 fires on at least 80% of the second-language corpus, and the L2
false-positive rate is within 5 points of the native-speaker rate.*

**Phase 3: reasoning LLM** `T3`
`NarrationProvider` LLM implementation, generated commentary, rewrites, voice assessment,
anti-marker detection, narrative summary, section interpretation, the FR-0.4 filter.
*Exit criterion: every feature degrades cleanly to Phase 1 behaviour with the provider
disabled, verified by running the whole suite with `llm: null`.*

**Phase 4: surprisal, optional** `T2`
Local model, M-37 to M-41, surprisal heat map, contribution capped at 2 points.
*Only build this if users ask for it. Weakest evidence, largest asset, highest risk of
being misread as authoritative.*

---

## 13. Risks

| Risk | Mitigation |
|------|-----------|
| Someone is accused on the strength of a score | FR-0.1 to FR-0.6, G-1, mandatory guard display, `rulesFired` traceability, band vocabulary lock |
| Lexicon goes stale and the module quietly stops working | Versioned dated packs, staleness warning at 12 months, corpus re-run each release |
| Thresholds tuned by intuition rather than data | FR-11.7 traceability, calibration corpus as a build gate |
| T2 numbers get treated as authoritative | Score contribution capped at 2, presented as context, warning text in the UI |
| LLM commentary sounds authoritative and overstates | FR-9.2 no re-scoring, FR-9.3 source labels, FR-9.4 filter |
| Offset drift corrupts highlights silently | FR-11.2 round-trip test over the entire corpus |
| Feature scope creeps toward a "detector" product | Section 1.2 boundary, restated in the module README |
