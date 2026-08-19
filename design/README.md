# Patralekhiser — Resemblance audit module

Handoff for Claude Code. Everything needed to implement, review or re-implement the
resemblance-audit feature that was added to Patralekhiser.

## What this is

Patralekhiser is a deterministic (no LLM) text rewriter. It already had two output
buckets: **changes** (auto-applied dictionary swaps) and **flags** (things a rule engine
must not rewrite on its own). This module replaces the flat "Needs a human" list with a
**Resemblance audit**: a 0-20 score across five dimensions, inline highlights in the
rewritten text, and a per-flag review loop where a human accepts or reverts a rewrite.

## Status of the files in this folder

`index.html` is **not a mock**. It is the real, working application — the user's original
`index.html` with the module patched in, self-contained, no build step, no dependencies,
no network calls. Open it in a browser and it runs.

Treat it as **both** the implementation and the specification:

- If the target is this same single-file app, ship it as-is.
- If the target is a real codebase (React/Vue/etc.), `MyridiusEngine` is portable as-is
  (plain ES5, `module.exports` guarded) — lift it into a module and rebuild only the view
  layer. The engine is the valuable half; the DOM code is replaceable.

`reference/AI Text Audit.dc.html` is a **design reference only** — the original standalone
prototype of the panel in a different visual language (warm/cream, display type). It shows
the interaction model at full width with a sticky rail. Do not ship it; it duplicates the
demo text and has no engine behind it.

Fidelity: **high**. Colors, type and spacing are final and match the host app's existing
tokens.

## The five dimensions

| Key | Name | Formal name | What triggers it |
| --- | --- | --- | --- |
| d1 | Stock wording | lexical fingerprint | `flagWords` entries whose reason is hype / jargon / AI-sounding |
| d2 | Sentence rhythm | syntactic rhythm | long sentences, semicolons, repeated sentence openers, long paragraphs, repeated heading openers, stacked connectives |
| d3 | Fence-sitting | rhetorical posture | passive voice, vague connectives, legalese, abstractions |
| d4 | Missing specifics | informational density | six new patterns: unsourced research claims, unnamed authorities, `up to N%`, unquantified populations, vague attribution, sourceless percentages |
| d5 | No personal voice | authorial presence | **absence** of first person, dates, concrete figures, and opinion or named people |

d1-d4 are scored by **density**: flags per 1000 words, mapped `per1000 / 9 * 4`, clamped to
4, rounded to the nearest 0.5. d5 is scored by counting four presence signals and
subtracting from 4. Total = `20 * sum(weight * score) / (4 * sum(weight))`, rounded to one
decimal. Verdict bands: >=15 heavy, >=10 moderate, >=6 light, >0 low, 0 none.

Two consequences to keep, because they are honest:

1. **Density bands saturate.** On dense text, clearing one of four stock-wording flags will
   not move that bar until the rate drops under about nine per thousand words.
2. **d5 highlights nothing.** It is judged by absence, so it renders as a document-level
   card, never as an inline mark. A count of zero marks is not a pass.

The module also never claims authorship. The panel carries that caveat in copy, plus a
short-text guard under 400 words (sentence-length statistics are unreliable there).

## Engine API (script block 1, `MyridiusEngine`)

Existing exports are unchanged. New:

```js
MyridiusEngine.reviewParas(pairs, config)
// pairs: [{ original, output }] — the paragraph list from processDoc
// -> { flags, output, after, resemblance }

MyridiusEngine.authorialPresence(text)
// -> { score, signals, missing, words }

MyridiusEngine.defaultDimensions // [{ key, name, note, color, weight }]
```

`processDoc` now returns an extra `resemblance` key and derives `flags` from
`reviewParas`, so existing callers keep working.

### Flag object

```js
{
  paragraph: 0,          // index into pairs, or null for document-level
  start: 37, end: 46,    // offsets INTO THAT PARAGRAPH'S output text
  type: "Word choice",
  dim: "d1",
  found: "landscape",
  reason: "...",
  suggestion: "...",
  kind: "swap" | "advice" | "advice-span" | "document",
  replace: "" | null,    // present only on kind "swap"
  excerpt: "...",
  dimScore: 2            // d5 only: overrides the density band
}
```

`kind` drives the UI: `swap` prefills a replacement, `advice` asks the human to write one,
`advice-span` covers a whole sentence or paragraph (rendered as a chip under the paragraph,
not as an inline mark, so it cannot swallow narrower marks), `document` has no span.

### How offsets are made safe

- `protectedRanges(text, terms)` returns spans no rule may touch (code fences, inline code,
  URLs, emails, protected terms). The original `protect()` swapped these for placeholders,
  which shifted every offset; ranges leave the text intact.
- `guardText` applies the same abbreviation guard as `splitSentences` but is
  **length-preserving** (`e.g.` -> `e.g\u0001`), so indices in the guarded string are valid
  in the original. `sentenceSpans` returns `{start, end, text}` on that basis.
- Within a paragraph, an earlier flag claims its range; later overlapping matches are
  skipped, except `advice-span` flags which never claim.

### Passive voice

The original condition was `pm && !whitelist.test(pm[0]) || (pm && pm[3])`, which reads as a
precedence bug. It is now one regex plus an explicit benign-verb whitelist
(`is based`, `are required`, `is logged`, ...), with an `... by` override. This matters
beyond tidiness: flag noise inflates the d3 score directly.

## UI contract (script block 3)

- The **Resemblance** tab replaces "Needs a human" (internal tab key is still `"flags"`;
  element ids `tabFlags` / `flagCount` are unchanged). Its badge shows the score, not a count.
- `renderResemblance(pane)` draws: score card (total, verdict, five weighted bars), the
  caveat + short-text guard, dimension filter chips, the list of applied rewrites with
  Revert, document-level cards, then the rewritten text with inline `<mark class="rz">`.
- Clicking a mark, a paragraph chip or a document card opens the **drawer** docked at the
  bottom of the right pane: dimension, reason, suggestion, a **Rewrite the phrase /
  Rewrite the whole sentence** scope switch, an editable field, then
  *Accept changes* / *Mark reviewed* / Previous / Next with an "n of m" position.
- Scope matters: many `flagWords` entries are single words (`landscape`), too narrow to
  swap grammatically. `sentenceRange()` widens the edit to the containing sentence.
- **Accept** pushes `{paragraph, from, to, nth}` onto `review.edits`, then `rebuild()`
  restores every paragraph from `review.base`, re-applies the remaining edits in order by
  nth-occurrence, and re-runs `reviewParas`. Nothing is patched in place, so offsets, word
  count, Flesch ease, the score and the flag list can never drift from the text.
  **Revert** removes one edit and rebuilds. Accepted rewrites land in
  `lastResult.paragraphs[i].output`, so Download and Copy export what the human approved.
- `revealSelection()` scrolls `#rightBody` so the selected mark sits centred in the band
  above the drawer, clamped to the scroll range. It deliberately avoids `scrollIntoView`
  (which would move the whole page).
- `syncFrom()` was rewritten to measure each paragraph's true offset inside its own scroll
  container. The old version subtracted the first paragraph's `offsetTop`, which assumed
  both panes start with a paragraph — false once the panel has a score card above its text.
  **If you add chrome above any pane's paragraphs, this is the function that breaks.**

## Result pane: change highlighting and inline editing

Added after the audit module. Both live in script 3 only; the engine is untouched.

### Change highlighting

`annotateChanges(original, output)` returns `{ html, count }`. Highlights are derived by
**diffing each paragraph's original against its output**, not from the change log. The log
records what each rule did but not where, and the rules run in sequence, so any position
captured during a pass is stale by the end of it. Diffing the finished text is independent of
the pipeline and it also catches deletions, dash fixes and emoji removal, which have no
`after` string to search for.

- `diffTokenize` splits on `/\s+|[^\s]+/` so whitespace is preserved as tokens.
- `diffOps(a, b)` is a plain LCS returning `{op: "keep"|"add"|"del", text}` in output order.
  `DIFF_CAP` is 800 tokens per paragraph; above that the diff is skipped and the paragraph
  renders plain, because the LCS table is O(n*m).
- Adjacent add/del runs are grouped so one swap reads as one highlight rather than one per
  token. Whitespace-only groups are folded into the surrounding text.
- An add group renders `<mark class="chg" title="was: ...">`. A del-only group renders
  `<span class="del" title="removed: ...">`, a zero-width 2px bar, because a deletion has no
  text to shade.
- The `Highlight changes` switch (`#showHighlights`, `toggleHighlights()`) turns shading off.
  Count appears in `#outputMeta`.
- Colors reuse existing tokens: `--fix-bg` for marks, `--warn` for the deletion bar. `mark.chg`
  uses a background plus an inset underline, chosen not to collide with `.para.hl` pairing or
  with `mark.rz` in the audit tab, which the two tabs never show together anyway.

### Inline paragraph editing

Click any `.para.r.editable` in the Result tab to replace it with a `<textarea id="paraEdit">`.
Blur or Cmd/Ctrl+Enter commits; Escape discards. There is no contenteditable anywhere: the
paragraph is the unit of editing, so text extraction stays exact and no browser-inserted markup
has to be parsed back out.

`commitParaEdit` is where the invariants live:

- Writes `lastResult.paragraphs[i].output`, which is what Download and Copy read, so the export
  always matches the pane.
- **Collapses blank lines inside the edit** (`/\n[ \t]*\n+/g` to `\n`). Paragraph parity
  between the panes is load-bearing: scroll pairing, flag offsets and `review.base` are all
  indexed by paragraph, so one block in must not become two blocks out.
- Refuses to empty a paragraph.
- **A manual edit supersedes the review history for that paragraph.** `review.base[i]` becomes
  the new text, `review.edits` entries for that paragraph are dropped, and `review.reviewed`
  keys prefixed `i|` are deleted. Those edits are recorded as from/to strings that may no longer
  exist in the text, so keeping them would let Revert corrupt the paragraph.
- Sets `manualEdited[i]`, which suppresses highlighting for that paragraph (there is no longer a
  meaningful engine-vs-output diff) and marks it with a left accent bar.
- Calls `recompute()`.

`recompute()` re-runs `reviewParas` and refreshes flags, output, resemblance, stats and the
badge. `rebuild()` now delegates to it, so the review loop and manual editing cannot disagree
about derived state. `resetReview()` clears `manualEdited`. `run()` reports how many manual
edits it discarded.

`showTab` now calls `hideDrawer()` when leaving the audit tab. The drawer is docked inside the
right pane, so leaving it open over the Result tab blocked the paragraphs underneath from being
clicked.

## Configuration

New `config.dimensions`: `[{ key, name, note, color, weight }]`, editable in the
Configuration view under "Resemblance scoring". Applying re-scores immediately.

`flagWords` line format is extended, backwards compatible with three-field lines and with
previously exported config JSON:

```
word | reason | suggestion | dimension | replacement
```

A `replacement` (even an empty one, meaning delete) makes the flag one-click acceptable.
Deletions tidy double spaces, space-before-punctuation, and re-capitalise the sentence.

## Design tokens

All from the host app's existing `:root`; nothing new was invented.

`--ink #1a2433` · `--ink-soft #4a5568` · `--line #dde3ea` · `--bg #f5f7fa` ·
`--card #ffffff` · `--accent #1f4e79` · `--accent-soft #e8f0f8` · `--warn #9a5b00` ·
`--warn-bg #fdf4e3` · `--fix-bg #e9f6ee`

Dimension colors (the only added values, chosen to stay distinguishable on white and
against the navy chrome):

`d1 #b45309` amber · `d2 #1f7a8c` teal · `d3 #64748b` slate · `d4 #6d4aa7` violet ·
`d5 #2f7a52` green

Type: the app's system stack, 15px/1.55 body. Panel sizes: score 26px/700, verdict 14px/600,
dimension rows 12px, notes 12-12.5px. Radii 6-10px, chips 14px. Bars 6px tall, 4px radius.
Marks are underlines (`box-shadow: inset 0 -0.3em 0 var(--rz)`) rather than fills, so they
never collide with the existing `.para.hl` paragraph-pairing highlight. Accepted spans read
green, reviewed spans grey at 50% opacity. Drawer is capped at `max-height: 48%` with its own
scroll so the text under review stays visible.

Interaction states: chips off = `--ink-soft` on white with a hairline border and a 30%-opacity
dot; on = `--accent` text on `--accent-soft` with an accent border, weight 600, full dot.

## State

```js
review = {
  base: [],        // engine output per paragraph — the revert baseline
  edits: [],       // accepted rewrites, applied in order on top of base
  reviewed: {},    // flagKey -> true, dismissed without a rewrite
  sel: null,       // selected flagKey
  filter: {},      // dimension key -> hidden
  scope: "phrase"  // or "sentence"
}
```

`flagKey(f) = paragraph|type|found|start`. Nothing persists across a reload, matching the
rest of the app (the Configuration view says as much).

## No assets

No images, fonts or network requests. Everything is CSS and markup.

One exception, added later: a favicon, inlined as a `data:image/svg+xml,` URI in the `<head>`
(navy rounded square, white `P`, using `--accent` #1f4e79). It is not a separate file and fetches
nothing. It exists because a browser requests `/favicon.ico` on its own whenever the page is
served over http rather than opened from disk, which logged a 404 and left the tab iconless on
GitHub Pages. Verified: serving the built page over http now produces exactly one request, the
page itself, and zero console errors.

## Files

- `index.html` — the working application, module included. This is the source of truth.
- `reference/AI Text Audit.dc.html` — earlier standalone prototype of the panel, design
  reference only.
- `INTEGRATION.md` — exact list of what was added or changed against the original file,
  for review or for re-applying onto a newer copy.
- `../publish/build-dist.py` — builds the tester distributable from this folder's
  `index.html` by adding a version marker and a caveat banner. Those two additions are
  distribution-only and must never be back-ported here or into `src/`. The script refuses
  to run if its input already contains the banner.

## Known gaps

1. Auto-swaps run **before** flagging, so phrases the engine already fixes
   (`furthermore`, `seamless`) never reach the score. The number describes what is left
   after the rewrite, not the raw input. If a "before" score is wanted, run
   `reviewParas` on the original paragraphs too.
2. Density bands saturate on dense text (see above).
3. `replaceNth` matches by nth occurrence of the exact string. If two accepted edits have
   the same `from` text in one paragraph and one is reverted, the other could in principle
   target the wrong occurrence. Rare, and always visible in the pane.
4. No keyboard shortcuts in the review loop; j/k or arrow stepping would be a natural add.
5. Mobile is untouched — the app is a two-pane desktop tool.
