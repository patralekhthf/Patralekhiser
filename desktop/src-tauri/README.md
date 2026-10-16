# Why the macOS minimum is 13.3

Tauri uses the operating system's own webview rather than shipping a browser,
so the app inherits whatever WebKit the Mac already has. `src/fileio.js`
reads .docx by inflating the zip with `DecompressionStream`, which Safari did
not ship until 16.4, and 16.4 did not reach macOS before 13.3.

Tauri's own floor is macOS 10.15. Leaving it there would have produced an
installer that runs perfectly, opens, looks correct, and then fails to read a
Word file on any Mac between 10.15 and 13.2, with no visible reason. Zip
reading is load-bearing for this tool, so the floor is raised to match the
feature rather than the framework.

ADR-0002 flagged exactly this risk when it analysed Tauri, under Option C:
"src/fileio.js depends on DecompressionStream for docx reading, whose
availability in the macOS WebKit versions being targeted must be verified
before committing, since zip reading is load-bearing."

If the floor ever needs to come down, the fix is to vendor a pure-JS inflate
rather than to lower this number.
