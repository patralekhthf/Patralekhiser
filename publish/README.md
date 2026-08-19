# Patralekhiser

A tool that rewrites an article into plainer prose and then scores how much the result
still *reads like* generative-model output.

It runs entirely in your browser. No install, no account, no server, no AI. Nothing you
paste leaves your machine. Every rule is a lookup you can inspect and edit in the
Configuration tab, so the same input always produces the same output.

Built for articles and technical papers.

## Get it

Download the HTML file from the [latest release](../../releases/latest), then double-click
it. That is the whole setup. It works offline, with one exception noted below.

Do not use the "raw" link from the file listing. GitHub serves raw HTML as plain text, so
you would see source code instead of the app.

## What it does automatically

Complex words become plain ones (utilize becomes use). Marketing hype and model-sounding
words get safe swaps (seamless becomes smooth, empower becomes help). Wordy phrases shrink
(in order to becomes to). Stock openers are deleted (It is worth noting that). Em and en
dashes become commas, number ranges become "X to Y", emojis are removed, contractions are
expanded. URLs, emails, code and protected terms are never touched.

## What it refuses to do

Anything needing judgement is flagged rather than guessed. Long sentences, passive voice,
hype claims, unsourced statistics and vague attribution are pointed at with a reason and a
suggestion, and you rewrite them yourself. A rule engine that guessed here would quietly
change your meaning.

## The Resemblance score is not a detector

It measures resemblance to the default register of model prose. That is all. It cannot
establish who or what wrote anything, and it never claims to. Careful formal business
writing scores high with no model involved, and so does English written by a fluent
second-language writer. If you use the number to accuse someone of something, you are
using it wrong.

## Known limits

- **The thresholds are uncalibrated.** No reference corpus has been built yet, so every
  score band is provisional. Feedback that a number feels wrong is useful; expect it to be
  off.
- **Second-language English is likely scored unfairly high.** There is no guard for it yet.
  This is the failure mode most worth reporting.
- **Scores can look stuck.** Four of the five dimensions are density-scored, so on dense
  text clearing one flag may not move the bar. Not a bug.
- **The last dimension highlights nothing.** "No personal voice" is judged by absence, so
  it appears as a document-level card. Zero highlights is not a pass.
- **PDF export drops inline bold** and its line wrapping is approximate. Headings are fine.
  Word export is the accurate one.
- **Bullet lists are not formatted.** The `-` markers survive into Word and PDF as literal
  characters.
- **Reading an uploaded PDF needs internet** the first time, because it loads a PDF parsing
  library. Everything else, including writing PDFs and Word files, works fully offline.
- **Desktop only.** It is a two-pane tool and mobile was never adapted.
- **Nothing is saved.** Reloading loses your text and any configuration changes.

## Feedback

Open an issue. The most useful report is the input you used, what you expected, and what
you got, quoting the build number shown next to the title. Disagreement with a score is a
finding, not a complaint.
