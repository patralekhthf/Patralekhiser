# ADR-0001: Retain the vanilla single-file stack for v2

**Status:** Accepted
**Date:** 2026-08-19
**Deciders:** Satyam Patralekh
**Related:** [ADR-0002](ADR-0002-packaging-and-distribution.md) (deferred),
[ADR-0003](ADR-0003-document-formatting-parser.md)

> **Accepted 2026-08-19.** Confirmed directly: "we will live with the current
> architecture". The tool continues to be distributed and used as a single HTML file.

## Context

Patralekhiser v1.1 ships as a single self-contained HTML file. Plain JavaScript written
ES5-style, no framework, no `package.json`, no bundler, no transpiler. `src/build.js`
inlines `src/engine.js` and `src/fileio.js` into `src/template.html` to produce
`app/index.html`. Node is used only to run the build and the tests, never at runtime.

v2 wants full document formatting and better exports (see ADR-0003), and installable
distribution (see ADR-0002). The question raised: does that warrant rebuilding on a
modern application stack, or does the current stack carry v2?

Forces at play:

- **Determinism is the product claim.** The tool exists because it is not an LLM: the
  same input always produces the same output, and every rule is inspectable in
  `config/default-config.json`. Anything that obscures the rule path weakens the claim.
- **The engine is the valuable half.** `design/README.md` states this explicitly, and the
  numbers support it: `src/engine.js` is 31 KB of transformation and detection logic with
  49 tests behind it (34 engine checks, 15 file IO checks). The DOM code is replaceable.
- **The audit module raised the cost of a view rewrite.** `design/index.html` defines 112
  functions against `app/index.html`'s 75, and its review loop depends on precise
  character offsets, a rebuild-from-baseline edit model, and a `syncFrom` that measures
  paragraph positions inside scroll containers. That behaviour is specified in prose in
  `design/README.md`, not encoded in types or tests. Reimplementing it is where the risk
  concentrates.
- **Zero maintenance overhead today.** No dependency updates, no security advisories, no
  build breakage, no lockfile. The tool will still run in five years.
- **One developer, intermittent time.** Whatever is chosen must be resumable after weeks
  away, which is also why `SESSION.md` exists.

## Decision

Retain the current stack for v2. Do not introduce a framework, a bundler, or a package
manager. Extend `src/engine.js` and `src/fileio.js`, keep `src/build.js` as the only build
step, and keep the output a single self-contained HTML file.

Treat the engine as a portable module with a stable public API. It already guards
`module.exports`, so it runs unchanged in Node and the browser. Any future view rewrite
must be able to consume it untouched.

## Options Considered

### Option A: Retain vanilla single-file stack

| Dimension | Assessment |
|---|---|
| Complexity | Low. One build script, no toolchain |
| Cost | Zero. No dependencies, no CI, no updates |
| Scalability | Adequate. The constraint is file size, not architecture |
| Team familiarity | Highest. It is the existing code |

**Pros:**
- Zero migration risk to the offset-sensitive audit logic.
- The 49 existing tests keep their meaning.
- Preserves the strongest form of the privacy claim: a file you can read and run offline.
- No dependency supply chain, which matters for a tool people paste unpublished writing into.
- Survives long gaps between working sessions.

**Cons:**
- No type checking. The flag and candidate contracts are enforced by tests and prose only.
- No component model, so the view code grows as procedural DOM manipulation. At 2,690
  lines it is already past comfortable.
- Hand-rolled docx and PDF writers must be extended by hand (ADR-0003).
- Manual DOM updates in the review loop are a plausible source of future bugs, mitigated
  today by the rebuild-from-baseline design.

### Option B: Rebuild the view in a framework (React, Vue, Svelte)

| Dimension | Assessment |
|---|---|
| Complexity | Medium to high. Adds bundler, dependencies, build pipeline |
| Cost | Weeks of migration producing no user-visible feature |
| Scalability | Better for view growth, irrelevant for engine growth |
| Team familiarity | Unknown, and not the bottleneck |

**Pros:**
- Component boundaries would make the panel, drawer and config view independently testable.
- Declarative rendering removes a class of manual DOM bugs.
- Easier to bring in a contributor familiar with modern tooling.

**Cons:**
- The migration rewrites exactly the code that is hardest to get right, the offset and
  scroll-sync behaviour, for no functional gain.
- Introduces a dependency tree and a build that can break while untouched.
- Single-file distribution requires a bundler configured to inline everything, which is
  achievable but is new machinery replacing a 30-line script that already works.
- Does nothing for formatting or exports, which is the actual v2 requirement.

### Option C: Keep the engine, rewrite only the view, framework optional

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Weeks, still no user-visible feature |
| Scalability | Good |
| Team familiarity | Mixed |

**Pros:**
- Recognises the correct seam. `design/README.md` already identifies it: lift the engine,
  rebuild the view layer.
- Could be done later without invalidating v2 work.

**Cons:**
- Same core objection as Option B: the view is not what is blocking v2.
- Better as a response to a real pain signal than as a scheduled project.

## Trade-off Analysis

The decisive question is what v2 actually needs. "Full formatting and downloads" is a
parsing and serialisation problem, solved entirely inside `src/fileio.js`. Not one line of
it is made easier by a component framework. A rewrite would therefore spend its entire
budget on the view layer while the requirement sits in the IO layer.

Against that, the honest cost of staying: no types on the flag and candidate contracts,
and a view file that is already long. Both are real, and neither is currently causing
defects. The rebuild-from-baseline model in the review loop was chosen precisely so that
manual DOM edits cannot desynchronise state from text, which removes the most likely class
of bug a framework would have prevented.

Option C is the right shape for a future rewrite and the wrong thing to do now. Recording
it here means the seam stays deliberate: as long as the engine's public API is respected,
the view can be replaced whenever a real reason appears.

## Consequences

**Easier:**
- v2 work goes straight into the layer that needs it.
- Distribution stays trivial: one file, works from `file://`, no server required.
- The privacy story stays maximally simple and verifiable.

**Harder:**
- The view file keeps growing. Splitting `src/template.html` into several inlined script
  partials is the pressure valve if it becomes unreadable.
- Contracts stay documented rather than enforced. Mitigation: extend the test suite
  whenever a new contract is added, as `docs/req-sentence-splitting.md` already requires.
- Hand-rolled writers must absorb the full formatting work (ADR-0003).

**To revisit:**
- If the single file exceeds roughly 500 KB, or if the view code causes two or more
  offset or rendering bugs that a component model would have prevented, reopen Option C.
- If a second developer joins, the absence of types and a component model becomes a real
  onboarding cost rather than a theoretical one.

## Action Items

1. [ ] Back-port `design/index.html` into `src/engine.js` and `src/template.html`, then
       rebuild with `node src/build.js`. This is a prerequisite for all v2 work, since
       `src/` is currently behind the design build.
2. [ ] Document the engine's public API in `docs/` as a stable contract:
       `process`, `processDoc`, `transform`, `analyze`, `reviewParas`,
       `authorialPresence`, `defaultDimensions`, plus the splitting API from
       `docs/req-sentence-splitting.md`.
3. [ ] Extend the test suite to cover the audit surface, which is currently untested.
4. [ ] If `src/template.html` passes roughly 1,500 lines, split it into inlined partials
       and teach `src/build.js` to assemble them.
