# Myridiusizer

A tool that takes any article and returns a version written in the Myridius house style. It runs entirely in the browser with deterministic rules. There is no LLM, no API call, and no network access in its operation. The same input always produces the same output.

## How to use it

Open `app/index.html` in any browser. Paste an article, press Myridiusize. You get three things: the cleaned article, a log of every change made, and a list of spots that need a human rewrite with a reason and a suggestion for each.

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
src/template.html UI shell
src/build.js      Inlines the engine into app/index.html
config/           Default style configuration (JSON)
docs/             The Myridius style profile in prose
samples/          Test article and its Myridiusized output
tests/test.js     Engine test suite
```

## Development

Edit `src/engine.js` or `src/template.html`, then:

```
node tests/test.js     # run the test suite
node src/build.js      # rebuild app/index.html
```

## Known limits

This is a surface level transformer. It cannot restructure an argument, invent an analogy, or rewrite a clunky paragraph into fluent prose. That is by design: anything requiring judgment goes to the Needs a human tab rather than being guessed at.
