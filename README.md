# Patralekhiser

A tool that takes any article and returns a version written in the Myridius house style. It runs entirely in the browser with deterministic rules. There is no LLM, no API call, and no network access in its operation. The same input always produces the same output.

## How to use it

Open `app/index.html` in any browser. Paste an article on the left (or press Upload to load a .docx, .pdf, .md or .txt file), then press Patralekhise. The Patralekhised version appears on the right, paragraph by paragraph. The two panes scroll in sync at paragraph level, in both directions, and hovering a paragraph highlights its pair. The Show original switch hides the left pane when you want only the result. Download the output as Word, PDF, Markdown or plain text, or Copy it to the clipboard. The Changes tab logs every automatic fix and the Needs a human tab lists spots that need a real rewrite, each with a reason and a suggestion.

Everything runs in your browser. The one exception is reading an uploaded PDF, which loads the standard pdf.js library from a CDN the first time you use it in a session; every other feature, including writing PDFs and Word files, works fully offline.

## What it fixes automatically

Complex words become plain ones (utilize becomes use, facilitate becomes help). Marketing hype and AI sounding words get safe swaps (seamless becomes smooth, empower becomes help). Wordy phrases shrink (in order to becomes to, due to the fact that becomes because). Stock openers get deleted (It is worth noting that, In today's fast-paced world). Em and en dashes become commas, number ranges become "X to Y". Emojis are removed. Contractions are expanded for formal writing. Protected terms like Myridius and BusinessBook Plus are never touched, and neither are URLs, emails or code.

## What it flags for a human

Rule based tools cannot rephrase safely, so anything that needs judgment is flagged instead of guessed: hype claims (game-changing, ultimate, world-class), long sentences, passive voice, semicolons, long paragraphs, repetitive sentence openings, and templated headings. Each flag says why it matters and what to do.

## Changing the style

Open the Configuration tab in the app. Every word list and behaviour toggle is editable there. Press Apply to use the new rules, and Export to save your configuration as a JSON file you can Import later or share with the team. The reference copy of the default rules lives in `config/default-config.json`.

## Project layout

```
app/index.html    The tool. This is the only file users need.
src/engine.js     Rule engine source (runs in Node and browser)
src/fileio.js     File import/export: docx, pdf, txt, md (no libraries)
src/template.html UI shell
src/build.js      Inlines engine and fileio into app/index.html
config/           Default style configuration (JSON)
design/           Design and UI source of truth. Read before any UI work.
docs/             The Myridius style profile in prose
samples/          Test article and its Patralekhised output
tests/test.js     Engine test suite
```

## Design source of truth

All design and UI decisions live in `design/`. Read them before writing or changing any interface code, styling, token, layout or interaction.

```
design/README.md        The design and behaviour specification
design/INTEGRATION.md   Exact diff against the original index.html
design/index.html       Working reference implementation, final arbiter
design/reference/       Visual reference only. Not shipped.
```

`design/index.html` is a built, self-contained artifact, not a mock. It is the original app with the resemblance-audit module patched in. Because it is built output, changes belong in `src/engine.js` and `src/template.html` and then get inlined by `node src/build.js`. Do not hand-edit `app/index.html`.

Nothing in the interface should introduce a colour, spacing value, radius or interaction pattern that is not already in `design/`. If something is missing there, ask rather than invent.

## Development

Edit `src/engine.js` or `src/template.html`, then:

```
node tests/test.js         # engine test suite
node tests/fileio.test.js  # file format test suite
node src/build.js          # rebuild app/index.html
```

## Known limits

This is a surface level transformer. It cannot restructure an argument, invent an analogy, or rewrite a clunky paragraph into fluent prose. That is by design: anything requiring judgment goes to the Needs a human tab rather than being guessed at.
