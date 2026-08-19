#!/usr/bin/env python3
"""Builds the tester distributable from design/index.html.

Adds a version marker and a caveat banner. Both are DISTRIBUTION-ONLY and must
never be back-ported into src/ or design/. Run from the project root:

    python3 publish/build-dist.py v1.2.0-preview.3
"""
import sys, os

VER = sys.argv[1] if len(sys.argv) > 1 else "v0.0.0-dev"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("DESIGN_SRC", os.path.join(ROOT, "design", "index.html"))
OUT = os.environ.get("DIST_OUT", os.path.join(ROOT, "publish", f"Patralekhiser-{VER}.html"))

CSS = """
  /* ---- tester banner: DISTRIBUTION-ONLY addition, not in design/index.html ---- */
  .ver { font-size: 11.5px; font-weight: 600; color: var(--ink-soft);
         border: 1px solid var(--line); border-radius: 10px; padding: 1px 7px;
         margin-left: 9px; vertical-align: middle; white-space: nowrap; }
  .tb-note { margin: 0 18px 10px; padding: 10px 13px; background: var(--warn-bg);
             border: 1px solid #e8d9b5; border-left: 3px solid var(--warn);
             border-radius: 8px; font-size: 13px; line-height: 1.55; color: var(--ink); }
  .tb-note h2 { margin: 0 0 6px; font-size: 13.5px; font-weight: 700; color: var(--warn); }
  .tb-note p { margin: 0 0 7px; }
  .tb-note p:last-child { margin-bottom: 0; }
  .tb-note details { margin-top: 8px; }
  .tb-note summary { cursor: pointer; font-weight: 600; color: var(--accent);
                     font-size: 12.5px; outline: none; }
  .tb-note summary:hover { text-decoration: underline; }
  .tb-note ol, .tb-note ul { margin: 8px 0 0; padding-left: 20px; }
  .tb-note li { margin-bottom: 5px; }
  .tb-note code { background: rgba(0,0,0,.05); padding: 1px 4px; border-radius: 3px;
                  font-size: 12px; }
  .tb-note .tb-strong { font-weight: 700; }
  .tb-close { float: right; background: none; border: 0; cursor: pointer;
              color: var(--ink-soft); font-size: 16px; line-height: 1; padding: 0 2px; }
  .tb-close:hover { color: var(--ink); }
"""

BANNER = """
<div class="tb-note" id="testerNote">
  <button class="tb-close" onclick="document.getElementById('testerNote').remove()" title="Hide this note">&times;</button>
  <h2>Test build {ver}. Please read this first.</h2>
  <p>This is an unreleased build of a tool that rewrites an article into a plainer house style
  and then scores how much the result still <em>reads like</em> generative-model output. It runs
  entirely in this page. There is no AI in it, no account, no server, and nothing you paste
  leaves your browser. Everything is deterministic: the same input always gives the same output.</p>

  <p><span class="tb-strong">The score is not a detector.</span> It measures resemblance to the
  default register of model prose, and nothing more. It cannot establish who or what wrote
  anything. Careful formal business writing scores high with no model involved, and so does
  English written by a fluent second-language writer. If you use this number to accuse someone
  of anything, you are using it wrong.</p>

  <p><span class="tb-strong">New in {ver}:</span> every word the rules changed is shaded green in
  the right pane, and hovering one tells you what it was before. A thin orange bar marks where
  something was deleted. Click any paragraph on the right to edit it by hand, in the Result tab or
  the Resemblance tab; your text is what Download and Copy produce. Where the rules can work out
  a safe rewrite they now offer it as a button you can tap, and where they cannot they say so
  instead of leaving you an empty box.</p>

  <details>
    <summary>What would be most useful to test</summary>
    <ol>
      <li>Paste something you wrote yourself, then something you know was model-generated.
      Does the gap between the two scores match your intuition?</li>
      <li>Look at the green highlights. Any swap that made the sentence worse is the most
      valuable thing you can report.</li>
      <li>Click a paragraph, rewrite it, then download as Word. Did your version come out?</li>
      <li>In <span class="tb-strong">Resemblance</span>, click a highlight. Is the reason
      convincing? Is the suggestion actionable, or does it just restate the problem?</li>
      <li>Accept a few rewrites, then Revert them. Does the text come back exactly as it was?</li>
      <li>Try a heading-heavy document, a very short one, and one with a code block or a URL.</li>
    </ol>
    <p style="margin-top:8px;">Send feedback as prose, not a form. The most useful report is
    <span class="tb-strong">the input you used, what you expected, and what you got.</span>
    Quote the build number ({ver}) shown next to the title.</p>
  </details>

  <details>
    <summary>Known limits, so you do not waste time reporting them</summary>
    <ul>
      <li><span class="tb-strong">The thresholds are guesses.</span> No calibration set has been
      built yet, so every score band is provisional. Tell me if a number feels wrong, that is
      exactly the feedback needed, but know that it is expected to be off.</li>
      <li><span class="tb-strong">Second-language English is likely scored unfairly high.</span>
      There is no guard for it yet. This is the failure mode I care most about hearing about.</li>
      <li><span class="tb-strong">Scores can look stuck.</span> Four of the five dimensions are
      scored by density, so on dense text clearing one flag may not move the bar until the rate
      drops. Not a bug.</li>
      <li><span class="tb-strong">Nothing is rephrased for you</span> beyond dictionary swaps.
      Long sentences, passive voice and vague claims are flagged for you to fix by hand, on
      purpose. A rule engine that guessed here would quietly change your meaning.</li>
      <li><span class="tb-strong">Editing a paragraph clears its highlights</span> and discards
      any accept or revert history for that paragraph. Your text becomes the new baseline.</li>
      <li><span class="tb-strong">In the Resemblance tab, click the plain text to edit</span> and
      click a highlight to review it. Clicking a highlight never opens the editor.</li>
      <li><span class="tb-strong">Blank lines inside a paragraph are collapsed</span> when you
      edit. The two panes stay paired paragraph for paragraph, so one block in cannot become two
      blocks out.</li>
      <li><span class="tb-strong">Pressing Patralekhise again discards your manual edits</span>,
      because it re-runs from the original text.</li>
      <li><span class="tb-strong">The last dimension highlights nothing.</span> "No personal
      voice" is judged by absence, so it shows as a document-level card. Zero highlights is not
      a pass.</li>
      <li><span class="tb-strong">PDF export drops inline bold</span> and its line wrapping is
      approximate. Headings are fine. Word export is the accurate one.</li>
      <li><span class="tb-strong">Reading an uploaded PDF needs internet</span> the first time,
      because it loads a PDF parsing library. Every other feature works fully offline.</li>
      <li><span class="tb-strong">Bullet lists are not formatted.</span> The <code>-</code>
      markers survive into Word and PDF as literal characters.</li>
      <li><span class="tb-strong">Desktop only.</span> It is a two-pane tool and mobile was
      never touched.</li>
      <li>Nothing is saved. Reloading the page loses your text and any configuration changes.</li>
    </ul>
  </details>
</div>
"""

s = open(SRC, encoding="utf-8").read()

if "testerNote" in s:
    sys.exit("refusing to build: source already contains the banner, so it is not a clean design build")

close = s.index("}", s.index("--fix-bg")) + 1
s = s[:close] + "\n" + CSS + s[close:]

anchor = "<!-- ================= EDITOR VIEW ================= -->"
if anchor not in s:
    sys.exit("editor view anchor missing")
s = s.replace(anchor, BANNER.format(ver=VER).strip() + "\n\n" + anchor, 1)

s = s.replace("<title>Patralekhiser</title>", f"<title>Patralekhiser {VER}</title>", 1)
s = s.replace("<h1>Patralekhiser</h1>", f'<h1>Patralekhiser<span class="ver">{VER}</span></h1>', 1)
s = s.replace("<body>",
              "<body>\n<!-- TEST BUILD: built by publish/build-dist.py from design/index.html.\n"
              "     The version marker and caveat banner (.ver, .tb-note, #testerNote) are a\n"
              "     distribution-only addition and must not be back-ported into src/ or design/. -->",
              1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(s)
print("built", OUT, f"({len(s)} bytes) from", SRC)
