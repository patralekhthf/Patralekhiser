# Patralekhiser

**[Open it now, nothing to install](https://patralekhthf.github.io/Patralekhiser-Public/)**

It rewrites an article into plainer, less corporate English, and then tells you how much the
result still sounds like it was written by an AI.

Nothing you paste leaves your computer. There is no sign-up, no account, and no AI inside it.
It is one web page that does all its work in your browser.

## Two ways to use it

**Just open it.** Click the link above. It works straight away.

**Or keep your own copy.** Go to [releases](../../releases), open the one at the top, and download the
`.html` file at the bottom of that page. Save it anywhere, double-click it, and it opens in your
browser like any other page. It keeps working with no internet connection, so a copy on your
desktop is a copy you own.

*A note if you are browsing this project's files: do not click the `index.html` file in the list
above and expect the app. GitHub shows you the code behind a web page rather than the page
itself. Use the link at the top instead.*

## What it does

Paste your article on the left, or press **Upload** to open a Word, PDF, Markdown or text file.
Press **Patralekhise**. Your rewritten article appears on the right.

Words the tool changed are shaded green. Hover over one to see what it used to say. A small
orange line shows where something was deleted, and hovering it tells you what was removed.

Click any paragraph on the right to fix it yourself. Whatever you write is what comes out when
you press **Download**, which gives you Word, PDF, Markdown or plain text.

## What it changes on its own

Long words become short ones: *utilize* becomes *use*. Marketing language gets toned down:
*seamless* becomes *smooth*, *empower* becomes *help*. Padding disappears: *in order to* becomes
*to*. Stock openings like *It is worth noting that* are cut. Em dashes become commas, emojis are
removed. Your company and product names are never touched, and neither are links, email
addresses or code.

## What it deliberately will not do

It will not reword a sentence for you. Long sentences, passive voice, vague claims and unsourced
statistics get pointed out with a reason and a suggestion, and you decide what to write instead.
A tool that guessed at these would quietly change your meaning, so it does not guess.

## About that score

The score tells you how much your text resembles the way AI models tend to write. **It is not an
AI detector and it cannot tell you who wrote something.** Careful, formal business writing scores
high with no AI involved at all, and so does English written well by someone whose first language
is not English. Please do not use the number to accuse anyone of anything.

## Things that are not finished yet

This is an early version, so it is worth knowing what is rough:

- **The score has not been calibrated.** The bands were set by judgement, not by measurement. If
  a number feels wrong to you, that is useful to hear, but expect it to be off.
- **It is probably unfair to writing by non-native English speakers,** scoring it higher than it
  deserves. This is the problem most worth telling me about.
- **The score sometimes will not budge** after you fix something. It measures how often problems
  appear rather than counting them, so one fix in a dense paragraph may not move the bar.
- **PDF files come out plainer than Word files.** Bold text inside a paragraph is lost and the
  line breaks are approximate. Use Word if the formatting matters.
- **Bulleted lists are not formatted.** The dashes come through as plain dashes.
- **Opening a PDF needs internet** the first time. Everything else works offline.
- **It needs a laptop or desktop.** The two-column layout does not work on a phone.
- **Nothing is saved.** If you reload the page, your text is gone.
- Pressing **Patralekhise** a second time throws away edits you made by hand, because it starts
  again from your original.

## Telling me it went wrong

Open an [issue](../../issues). The most useful thing you can send is what you pasted in, what you
expected, and what you actually got. Mention the version number shown next to the title. If you
think the tool made a sentence worse, that is the single most valuable thing you can report.
