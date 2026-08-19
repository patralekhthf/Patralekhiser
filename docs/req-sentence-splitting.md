# Requirement: Deterministic Sentence Splitting

**Status:** ready to implement. Not started.
**Owner of the work:** Claude Code.
**Target files:** `src/engine.js`, `src/template.html`, `config/default-config.json`,
`tests/test.js`. Never `app/index.html` directly, it is build output.
**Read first:** `design/README.md`, `design/INTEGRATION.md`, `design/index.html`
(final arbiter on anything UI). Design tokens, drawer behaviour and the accept/revert
loop are all specified there and must not be reinvented.

---

## 0. The claim this document makes

`docs/ai-text-audit-spec.md` section 9.2 has a row reading:

> **Rewrite suggestions** | Needs `T3` | Ships at T0/T1: Nothing. `rewrite` stays `null`
> and the UI omits the block | This is the single biggest loss.

This requirement narrows that row rather than overturning it. Rewriting prose still
needs a language model. But **sentence splitting is the one rewrite class where a
restricted syntactic subset can be done deterministically**, because the split point
is marked by punctuation and a function word, not by meaning. You do not need to know
what a clause is about to know it is independent.

So: implement splitting for that subset, refuse the rest, and be explicit in the UI
about which is which. Do not let this become a general rewriter.

Amend section 9.2 when this lands: change the row to "Rewrite suggestions (general)"
and add a row "Sentence splitting (bounded subset) | Nothing | Ships at T0 | Covers
compound sentences only; complex and complex-compound sentences stay advice-only".

---

## 1. Scope

### 1.1 In scope

Three split rules, in descending confidence.

**SPLIT-A, semicolon compound.** `A; B` where both sides are independent clauses.
Highest confidence. A semicolon between independent clauses is, by definition of the
punctuation mark, a sentence boundary the author chose not to use.

```
before: The engine applies swaps first; the audit runs afterwards.
after:  The engine applies swaps first. The audit runs afterwards.
```

**SPLIT-B, comma plus coordinating conjunction.** `A, and B` / `, but ` / `, so ` /
`, yet ` / `, or ` / `, nor ` where B passes the independent-clause test in section 3.

```
before: The score dropped to eleven, but the long sentences were still flagged.
after:  The score dropped to eleven. But the long sentences were still flagged.

before: We shipped the module, and the tests passed on the first run.
after:  We shipped the module. The tests passed on the first run.
```

Note the asymmetry, it is deliberate. `but`, `so`, `yet` survive the split as sentence
openers and read as natural English. `and`, `or`, `nor` do not, so they are dropped and
the second clause is capitalised in place. Dropping `and` loses an additive signal that
is almost always redundant. Dropping `but` would lose a contrast and change the meaning,
which is why it is kept.

**SPLIT-C, imperative second clause.** `A, and B` where B begins with a base-form verb
and has no subject. Lowest confidence, tier 3, off by default.

```
before: Open the configuration tab, and press Apply to use the new rules.
after:  Open the configuration tab. Press Apply to use the new rules.
```

### 1.2 Out of scope, permanently

These stay `kind: "advice"` and must never be auto-split. Each one requires either
knowing the meaning or inventing a subject, and a rule engine that guesses here will
produce fragments and quiet meaning changes, which is worse than a long sentence.

| Pattern | Example | Why refused |
|---|---|---|
| Subordinate clause | `Because the corpus is missing, thresholds are provisional.` | Splitting requires re-expressing the causal link, so a connective has to be chosen |
| Participial tail | `We shipped it, resulting in a faster review loop.` | The second half has no subject. One would have to be invented |
| Relative clause | `The engine, which runs in Node and the browser, is portable.` | Non-restrictive clauses are not independent, and restrictive ones cannot be separated at all |
| Appositive | `Patralekhiser, a deterministic rewriter, has no dependencies.` | Same |
| Colon list | `It does three things: a, b and c.` | Restructures the document, not the sentence. Separate feature if wanted |
| Comma splice | `The tests pass, the build is clean.` | Already an error. Fixing it silently hides the author's mistake |
| Long sentence with no boundary | A 45-word sentence with one clause | Nothing to split on. Must stay advice, with the reason saying so |

### 1.3 Non-goals

No sentence *merging*. No reordering. No changing which words are used, that is what the
existing swap dictionaries are for. This feature only inserts a full stop, adjusts case,
and removes at most one conjunction and one comma.

---

## 2. New engine surface

Add to `src/engine.js`, before the "Main entry point" comment, alongside the audit
functions described in `design/README.md`. Plain ES5, no dependencies, `module.exports`
guard unchanged.

```js
MyridiusEngine.splitCandidates(text, config)
// text: one paragraph's text, unmodified
// -> [ Candidate ]

MyridiusEngine.applySplits(text, candidates)
// -> { text, applied }   applied = count of splits performed

MyridiusEngine.defaultSplitSettings
// -> { splitMaxTier, minClauseWords }   no auto-apply flag, see FR-S13a
```

### 2.1 Candidate object

```js
{
  kind: "SPLIT-A" | "SPLIT-B" | "SPLIT-C",
  tier: 1 | 2 | 3,             // confidence, see section 4
  start: 41,                   // offset into `text` of the region replaced
  end: 47,                     // exclusive
  from: ", and ",              // exact original substring [start, end)
  to: ". ",                    // replacement
  capitalizeAt: 47,            // offset in `text` of the char to upper-case, or null
  left: "the engine applies swaps first",   // clause text, for tests and debug
  right: "the audit runs afterwards",
  reason: "Compound sentence joined by a semicolon",
  preview: "..."               // the whole sentence as it would read after the split
}
```

`preview` is required. The UI shows it before the human accepts, and a preview the human
can read is the only honest way to offer a mechanical rewrite.

### 2.2 Contract rules

- **FR-S1.** `splitCandidates` must not modify `text`. It returns offsets only.
- **FR-S2.** Candidates are returned in ascending `start` order, non-overlapping. If two
  rules match the same region, the lower tier number wins; on a tie, the earlier start.
- **FR-S3.** `applySplits` applies candidates right to left so earlier offsets stay valid.
- **FR-S4.** `applySplits(text, splitCandidates(text, cfg))` must be idempotent: running
  it twice on its own output produces zero new candidates.
- **FR-S5.** A candidate must never be produced whose `start` or `end` falls inside a
  protected range (section 5).
- **FR-S6.** Both `left` and `right`, after trimming, must contain at least
  `minClauseWords` words (default 4). Otherwise no candidate. This kills
  `Open it. And go.` and similar stubs.

---

## 3. The independent-clause test

This is the load-bearing heuristic. Get it wrong and the feature emits fragments.

`isIndependentClause(clause)` returns true when the clause has **its own subject** and
**a finite verb after that subject**. Implement as a positive test, not an absence test.

### 3.1 Subject detection

The clause, after trimming, must begin with one of:

1. A subject pronoun: `I, we, you, he, she, it, they, this, that, these, those, there,
   who, one, someone, everyone, nobody, nothing`.
2. A determiner or possessive followed by a word: `the, a, an, its, our, their, his,
   her, my, your, this, that, these, those, each, every, both, all, most, some, any,
   no, another, either, neither`.
3. A capitalised word that is not a sentence-initial artifact, treated as a proper noun.
4. A gerund followed within three words by a finite verb (`Running the tests is slow`).

### 3.2 Finite verb detection

Within the next eight words after the subject there must be a match for a finite-verb
pattern. Use a closed list plus morphology, in this order:

- copula and auxiliaries: `is, are, was, were, be, been, being, am, has, have, had,
  do, does, did, can, could, will, would, shall, should, may, might, must`
- contracted forms: `'s, 're, 've, 'll, 'd, n't`
- a word ending in `s`, `ed`, or `ing` that is not in a stop list of common nouns
  ending the same way (`this, business, process, analysis, address, needs, means,
  series, species, news, thanks`)

If no finite verb is found, the clause is not independent. Return false. Do not fall
back to accepting it.

### 3.3 Explicit rejections

Return false immediately if the clause, after trimming, begins with:

- a subordinating conjunction: `because, since, although, though, while, whereas,
  unless, until, after, before, if, when, whenever, wherever, as, whether`
- a relative pronoun: `which, whom, whose`
- a preposition followed by a noun phrase with no later finite verb
- a participle: a word ending in `ing` or `ed` with no subject before it
  (this is the participial-tail rejection from 1.2)

### 3.4 Honesty note for the implementer

This test will be wrong sometimes. It is a heuristic over function words, not a parser.
That is acceptable **only because nothing is ever applied without a human accepting a
preview** (section 6, FR-S12). Bias every ambiguous case toward returning false anyway. A
missed split costs nothing, since the sentence simply stays flagged as advice. A bad
suggestion costs the reviewer trust in every other suggestion, which is the expensive
failure here.

---

## 4. Confidence tiers

| Tier | Rules | Condition | Default |
|---|---|---|---|
| 1 | SPLIT-A | Semicolon, both sides independent, no colon earlier in the sentence, exactly one semicolon in the sentence | offered |
| 2 | SPLIT-B | Comma plus coordinator, right side independent by section 3, left side independent | offered |
| 3 | SPLIT-C | Comma plus coordinator, right side imperative (base-form verb, no subject) | not offered |

**FR-S7.** `config.settings.splitMaxTier` (default `2`) caps which tiers produce
candidates. Setting it to `0` disables the feature entirely.

**FR-S8.** Tier must be carried on the candidate and surfaced in the UI. A tier 3
suggestion must be visually distinguishable from a tier 1 one, and its `reason` must say
it is a lower-confidence suggestion.

---

## 5. Protection and guards

### 5.1 Reuse what exists

`protectedRanges(text, terms)` in `design/index.html` already covers fenced code, inline
code, URLs, emails and protected terms. Reuse it.

### 5.2 It is not enough. Extend it.

`protectedRanges` does **not** cover quotes or parentheses. Splitting inside either is
wrong: you would be editing someone's quoted words, or breaking a parenthetical in half.

**FR-S9.** Add `splitProtectedRanges(text, terms)` that returns `protectedRanges` output
plus:

- double-quoted spans, including curly quotes: `"..."` and `“...”`
- single-quoted spans where the opening quote follows whitespace or a start of line
  (so apostrophes in `don't` are not mistaken for quote openers)
- parenthesised spans `(...)`, square `[...]` and brace `{...}` spans
- HTML entities `&[a-z]+;` and `&#\d+;`, because these contain a semicolon and SPLIT-A
  would otherwise fire inside them
- Markdown link targets `](...)`

Nested and unbalanced cases: on an unbalanced opener, protect from the opener to the end
of the paragraph. Over-protecting loses a split. Under-protecting corrupts text.

### 5.3 Sentence-level skips

**FR-S10.** Produce no candidates for a sentence that:

- is a Markdown heading (`/^\s*#{1,6}\s/`)
- is a list item (`/^\s*([-*+]|\d+[.)])\s/`). Splitting inside a bullet is usually fine
  in prose terms but changes the list's shape, so defer it to a later decision
- is a table row (contains two or more unescaped pipes)
- is inside a blockquote (`/^\s*>/`)
- contains two or more semicolons **and** a colon before the first one. That is a list
  written with semicolon separators, not a compound sentence
- is under `minClauseWords * 2` words total

### 5.4 Abbreviation safety

**FR-S11.** Use `guardText` and `sentenceSpans` from `design/index.html` for sentence
boundaries, never `splitSentences`. `guardText` is length-preserving, so offsets in the
guarded string are valid in the original. `splitSentences` trims and therefore destroys
offsets. This distinction is already documented in `design/README.md` and it applies here
for the same reason.

---

## 6. Pipeline placement and the human-approval rule

### 6.1 Settled decision: every split requires human approval

**Decided by the user, 2026-08-19. This is a constraint, not a default.** No code path
may apply a sentence split to the output without a human having accepted it in the
drawer. There is no automatic mode, no configuration flag that enables one, and no
"tier 1 is safe enough" exception for semicolons.

The reasoning is worth keeping so nobody relaxes it later. A split is a structural edit,
and the independent-clause test in section 3 is a heuristic over function words rather
than a parser. Under human approval that heuristic is a suggestion engine, and its worst
failure costs the reviewer two seconds. Under automatic application it becomes the only
thing standing between a bad parse and published prose, and its worst failure is a
sentence fragment under the author's name. The asymmetry is the whole argument.

This also matches the project's existing posture: the engine applies dictionary swaps,
which are lookups with a bounded blast radius, and refuses everything requiring judgment.
Splitting requires judgment. It gets the refusal, softened only by offering a preview.

**FR-S12.** `collectParaFlags` attaches the best candidate for a sentence to that
sentence's existing `Long sentence` or `Semicolon` flag, promoting it from
`kind: "advice"` to `kind: "swap"` with:

```js
replace: <the split sentence>   // full sentence, not just the joint
start:   <sentence start>
end:     <sentence end>
```

The existing accept/revert machinery then handles it with **no architectural change**.
An accepted split is an ordinary `{paragraph, from, to, nth}` edit on `review.edits`,
`rebuild()` restores from `review.base` and re-applies it, and the score, word count and
Flesch reading recompute from the rebuilt text. This is exactly what that design was for.

**FR-S13.** `applySplits` must **not** be called from `transform`, from `process`, from
`processDoc`, or from any code reachable without a user gesture. It exists as a public
export for two reasons only: the test suite calls it directly, and the UI calls it on a
single sentence to build the `replace` string and the candidate's `preview`. Anything
else is a bug.

**FR-S13a.** Do not add an `autoSplitSentences` setting, and do not add a
`"Sentence split"` category to the Changes tab. The Changes tab logs what the engine did
on its own. A split is something the human did, so it belongs in the panel's list of
applied rewrites with a Revert control, which `design/README.md` already specifies. Two
places recording the same edit under different authorship would be worse than either
alone.

### 6.2 Why this simplifies the build

Dropping the automatic path removes real complexity, which is the practical case for the
decision on top of the safety one:

- No insertion point inside `transform`, so the pass order stays untouched.
- No interaction with `protect()` and its placeholder offsets.
- No before-and-after score problem: the score is always computed on text the human
  either wrote or approved.
- No config key, so no migration concern for previously exported config JSON.

If tier 1 automatic splitting is ever wanted, it is a purely additive change against this
spec. Nothing here forecloses it. It just is not being built now, and the toggle is not
being shipped dormant, because a switch that should never be flipped is a liability
rather than an option.

### 6.3 Ordering constraint

**FR-S14.** Candidates must be computed on already-transformed text, never on raw input.
The swap dictionaries match multi-word phrases, and inserting a full stop first could
break a phrase across the boundary and stop it matching. This is satisfied for free by
the current architecture: `collectParaFlags` runs on `transform` output. Do not move it
earlier.

**FR-S14a.** The whitespace tidy inside `transform` collapses runs of two or more spaces
and strips spaces before newlines, but a split happens after all of that, on accepted
text. So FR-S15's cleanup gets no help from it and must handle its own double spaces and
its own space-before-full-stop case.

---

## 7. Exact string mechanics

Ambiguity here produces double spaces and lower-case sentence openers, so the steps are
prescribed.

For SPLIT-A, `A; B`:

1. Replace the matched region `/;\s+/` with `". "`.
2. Upper-case the first letter of `B`.
3. If `A` already ends with `.`, `!` or `?` before the semicolon, which is malformed
   input, produce no candidate.

For SPLIT-B with `but`, `so`, `yet`:

1. Replace `/,\s+(but|so|yet)\s+/` with `". "` plus the capitalised conjunction plus `" "`.
2. Upper-case nothing else. The clause after the conjunction stays lower case.

For SPLIT-B with `and`, `or`, `nor`, and for SPLIT-C:

1. Replace `/,\s+(and|or|nor)\s+/` with `". "`.
2. Upper-case the first letter of the following word.

In all cases:

**FR-S15.** Collapse any resulting double space. Remove any space that ends up before a
full stop. Preserve the original trailing whitespace of the sentence exactly, including
newlines, since paragraph joining depends on it.

**FR-S16.** Never upper-case a word that is already fully upper case (an acronym), and
never lower-case anything.

**FR-S17.** If the character to capitalise is not `[a-z]`, for example a digit or an
opening quote, produce no candidate. Trying to capitalise `"3 of the tests failed"`
yields nothing, and a sentence starting with a numeral after a split is usually a sign
the clause was not independent anyway.

---

## 8. Configuration

Add to `config/default-config.json` under `settings`, alongside the seven keys already
there (`expandContractions`, `removeEmojis`, `fixDashes`, `maxSentenceWords`,
`maxParagraphSentences`, `flagPassiveVoice`, `flagSemicolons`), and expose in the
Configuration view per the pattern `design/README.md` describes for "Resemblance
scoring":

```json
"splitMaxTier": 2,
"minClauseWords": 4
```

There is deliberately no `autoSplitSentences` key. See FR-S13a.

**FR-S18a.** Note that `config/default-config.json` is the reference copy and does not
yet carry the audit module's `dimensions` key either, because the back-port from
`design/` has not happened. Both additions land in the same file, so do them in one pass.

**FR-S18.** Backwards compatibility. A config JSON exported before this feature has
neither of these keys. Missing keys must fall back to the defaults above, not to
`undefined`. The audit module already set this precedent with `dimensions`.

**FR-S19.** The Configuration view's help text must state plainly what the feature will
and will not split, in one or two sentences, drawn from section 1. A toggle whose blast
radius the user cannot predict is a bad toggle.

---

## 9. UI requirements

All of this is already specified in `design/README.md`, so the work is to fit into it,
not to design anything.

**FR-S20.** A split suggestion appears in the drawer as any `kind: "swap"` flag does,
with the editable field prefilled with the split sentence. The human can edit it before
accepting. The prefill is a starting point, never a final answer.

**FR-S21.** The drawer's existing **Rewrite the phrase / Rewrite the whole sentence**
scope switch must default to **sentence** for a split candidate, because a split by
definition spans the whole sentence. `sentenceRange()` already computes the range.

**FR-S22.** Show the tier. Tier 1 reads as a confident suggestion. Tier 2 says the split
was inferred from sentence structure. Tier 3, if enabled, says clearly that it is a guess
worth checking.

**FR-S23.** Where a `Long sentence` flag has **no** candidate, the flag stays
`kind: "advice"` and its `reason` must say why, for example "no safe split point: this is
one clause". Silence here reads as a broken feature. An explicit refusal reads as a tool
that knows its limits, which is the whole posture of this project.

**FR-S24.** Do not add chrome above the paragraphs in either pane. `syncFrom` measures
paragraph offsets inside the scroll container and `design/README.md` names it as the
function that breaks. Split UI belongs in the drawer and in inline marks only.

**FR-S25.** Colour. A split suggestion is a d2 finding, so it uses the existing d2 teal
`#1f7a8c`. Add no new token.

---

## 10. Effect on the resemblance score

`design/README.md` lists as known gap 1 that auto-swaps run before flagging, so the score
describes post-rewrite text. Splitting makes this sharper and it must be handled honestly.

**FR-S26.** An accepted split genuinely reduces d2, because the long-sentence and
semicolon flags it resolves disappear on `rebuild()`. That is correct and should happen.

**FR-S27.** But d2 is density-banded, so clearing one flag of several may not move the
bar. `design/README.md` already requires this be treated as honest rather than fixed. Do
not add a special case that makes splits feel more rewarding than they are.

**FR-S28.** Because of FR-S12, the score is never computed on text the human did not
approve, so this feature does not deepen `design/README.md`'s known gap 1. The reported
number always describes the current state of the right-hand pane. Keep it that way: do
not compute or display a hypothetical post-split score for splits the human has not
accepted, since a score that moves before the text does would be a lie about the
document.

---

## 11. Tests

Add to `tests/test.js`. Same hand-rolled assertion style, no framework, run with
`node tests/test.js`.

### 11.1 Must split

| Input | Expected |
|---|---|
| `The engine applies swaps first; the audit runs afterwards.` | `... first. The audit ...` |
| `The score dropped to eleven, but the long sentences were still flagged.` | `... eleven. But the long ...` |
| `We shipped the module, and the tests passed on the first run.` | `... module. The tests ...` |
| `The corpus is missing, so every threshold stays provisional here.` | `... missing. So every ...` |

### 11.2 Must not split

| Input | Why |
|---|---|
| `He ran the suite, and passed every check.` | Compound predicate, no subject after `and` |
| `Because the corpus is missing, thresholds are provisional.` | Subordinate clause |
| `We shipped it, resulting in a faster review loop.` | Participial tail |
| `The engine, which runs in Node, is portable.` | Relative clause |
| `for (i = 0; i < n; i++)` inside backticks | Protected inline code |
| `He said "the build is clean; the tests pass" in standup.` | Inside a quote |
| `It does three things: parse the input; score it; report.` | Semicolon list after a colon |
| `Use &amp; for an ampersand, and it renders fine.` | Entity semicolon must not fire SPLIT-A |
| `Open it, and go.` | Clause under `minClauseWords` |
| `The result was clear, and 3 of the tests failed.` | Cannot capitalise a digit, FR-S17 |
| `## Setup, and configuration; a guide` | Heading |

### 11.3 Invariants

**FR-S29.** Idempotence: `applySplits` on its own output yields zero candidates.
**FR-S30.** Offset validity: for every candidate, `text.slice(start, end) === from`.
**FR-S31.** Non-overlap: no two returned candidates share a character.
**FR-S32.** Word conservation: after a split, the word count changes by exactly the
number of dropped conjunctions, which is zero for `but`, `so`, `yet` and one per split
for `and`, `or`, `nor`. Assert this, it catches whole classes of string-mangling bugs.
**FR-S33.** Protection: for every candidate, `[start, end)` intersects no range from
`splitProtectedRanges`.
**FR-S34a.** Human-approval invariant: assert that `process` and `processDoc` output on
a paragraph containing a splittable semicolon sentence is **byte-identical** to the same
run with `splitMaxTier: 0`. The engine must never split on its own. This is the test that
protects FR-S12, so write it first.

**FR-S34.** Round trip through the review loop: accept a split, assert the paragraph
text, revert it, assert the text is byte-identical to `review.base`.

### 11.4 Regression

**FR-S35.** The existing 34 engine checks and 15 file-IO checks must still pass
unchanged. If a dictionary swap test breaks, FR-S14 ordering was violated.

---

## 12. Acceptance criteria

1. All of section 11 passes, plus the existing suites, via `node tests/test.js` and
   `node tests/fileio.test.js`.
2. `node src/build.js` rebuilds `app/index.html` and the feature works in the browser
   from the built file, offline.
3. No new dependency, no network call, no `localStorage`.
4. A long sentence with a semicolon shows a prefilled split in the drawer, accepting it
   changes the pane text, the score recomputes, and Revert restores the original exactly.
5. A long single-clause sentence shows an advice flag that says no safe split exists.
6. Config export then re-import preserves both new settings (`splitMaxTier`,
   `minClauseWords`), and a config file exported before this change still loads.
7. Grep proves it: no call to `applySplits` exists inside `transform`, `process` or
   `processDoc`, and no `autoSplitSentences` key exists anywhere in the tree.
8. `docs/ai-text-audit-spec.md` section 9.2 is amended per section 0.
9. `README.md` and `SESSION.md` updated. Note that `README.md` still describes a "Needs a
   human" tab, which is already stale against `design/`, and should be corrected in the
   same pass.

---

## 13. Known limits to document, not fix

State these in the code comments and the Configuration help text. They are consequences
of the approach, not defects, and pretending otherwise invites someone to "fix" them
badly later.

1. **Coverage is low by design.** Most long AI-sounding sentences are complex, not
   compound. This feature will resolve a minority of `Long sentence` flags. That is the
   honest outcome of refusing to guess.
2. **The independent-clause test is a function-word heuristic**, not a parser. It will
   miss valid splits, especially with unusual subjects, and could in principle accept an
   invalid one. Mandatory human approval (FR-S12) is what makes that survivable, and it
   is the reason the heuristic is allowed to be this simple.
3. **Splitting can flatten intended rhythm.** A deliberate long compound sentence
   sometimes exists for effect. The tool cannot tell craft from carelessness, which is
   the same reason the audit module refuses to claim authorship.
4. **English only.** Every word list here is English. There is no language detection in
   front of it, and `docs/ai-text-audit-spec.md` guard G-1 exists precisely because
   second-language English is the population most at risk of being wrongly corrected.
5. **List items are skipped** rather than handled, per FR-S10. Splitting inside bullets
   is a separate decision about document shape.
