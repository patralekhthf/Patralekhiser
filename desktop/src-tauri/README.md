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

# Why there is no Content-Security-Policy

There was one. It broke every button in the app, and it took a bug report to
find out, so the reasoning is recorded here rather than left as a blank field
somebody helpfully fills in again.

Tauri injects a nonce into the CSP it serves: the binary carries
`__TAURI_SCRIPT_NONCE__` and substitutes a fresh value per load. The CSP
specification says that when a nonce source is present in `script-src`, the
`'unsafe-inline'` keyword is **ignored**. This application's interface is
built from inline `onclick` attributes, which are inline script. So setting
any `csp` value at all silently disabled the entire user interface while the
window still opened, rendered correctly, and looked completely normal.

The same policy also blocked `https://cdnjs.cloudflare.com`, which is where
`fileio.js` lazy-loads pdf.js from when somebody opens a PDF, so PDF import
was broken by the same line.

Two ways to get a CSP back, in order of preference:

1. Vendor pdf.js locally and replace every inline handler with
   `addEventListener`. Then a strict CSP costs nothing and the offline
   promise becomes unconditional. Vendoring pdf.js is already a tracked
   next action for its own reasons.
2. Keep inline handlers and set `dangerousDisableAssetCspModification` so
   Tauri does not add the nonce. This works and is worse: the name is
   accurate, and it leaves a policy that looks stricter than it is.

Until one of those happens, no CSP is the honest setting. The application
loads no remote content, makes no network request except the optional
pdf.js fetch, has no Tauri commands exposed, and is a single HTML file
anybody can read.

# Why productName is "Swara" and not "Swara - myVoice"

The product is called Swara - myVoice. The bundle is called Swara, and the
difference is forced rather than chosen.

Tauri passes productName into its bundle_dmg.sh unquoted. With the full name
the command it builds reads:

    bundle_dmg.sh --volname Swara - myVoice --icon Swara - myVoice.app ...

so the shell splits on the spaces and "- myVoice" is read as a flag. The dmg
step fails, and it would fail the same way on every CI runner, not just here.

So the single word is used everywhere a shell or a filename is involved:
the .app bundle, the dmg, the volume name, the binary, the crate, the npm
package, and the bundle identifier com.patralekh.swara. The full name is
used everywhere a person actually reads it: the window title, and the app's
own interface.

If the full name is ever wanted on the bundle too, the fix is upstream in
Tauri's bundler, not a local workaround. Do not put a dash surrounded by
spaces back into productName.
