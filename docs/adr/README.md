# Architecture Decision Records

One file per decision. A record is never edited to hide a change of mind: a decision that
changes gets a new ADR that supersedes the old one, and the old one is marked
`Superseded`. That is the point of keeping them.

**Status values:** `Proposed`, `Accepted`, `Deferred`, `Deprecated`, `Superseded`.

| ADR | Title | Status | Summary |
|---|---|---|---|
| [0001](ADR-0001-retain-vanilla-single-file-stack.md) | Retain the vanilla single-file stack for v2 | **Accepted** | No framework, no bundler, no package manager. Extend `src/engine.js` and `src/fileio.js`, keep `src/build.js` as the only build step, keep the output one self-contained HTML file. The engine is treated as a portable module so the view can be replaced later if a real reason appears. |
| [0002](ADR-0002-packaging-and-distribution.md) | Packaging and distribution strategy | **Deferred** | PWA, Tauri, Electron and Capacitor all analysed; none chosen. The tool stays a single HTML file sent to testers. Four explicit triggers would reopen it. Mobile is recorded here as a redesign question rather than a packaging one. |
| [0003](ADR-0003-document-formatting-parser.md) | Document formatting, own parser versus vendored Markdown library | **Proposed** | Write an own block-and-inline parser over a documented subset rather than vendoring a Markdown library, because parser coverage is capped by what the docx and PDF writers can render. Keep the pipeline text-first so the audit module's offset architecture is untouched. |

## Reading order

0001 first, since it constrains the others. 0003 is the only one with live work attached.
0002 is kept for the analysis, not for a direction.

## Note on 0002 and 0003 being independent

The instinct that "full formatting" and "make it a real app" are one project is what 0002
and 0003 exist to separate. Formatting is a parsing and serialisation problem living
entirely inside `src/fileio.js`. Packaging is a distribution problem. Every packaging option
consumes the same HTML, so formatting work never waits on a packaging decision. That is why
0002 could be deferred without blocking anything.
