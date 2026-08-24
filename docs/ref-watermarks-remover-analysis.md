# Reference: `watermarks-remover` codebase analysis

**Repo:** https://github.com/guillaumemeyer/watermarks-remover
**Author:** Guillaume Meyer · **License:** MIT · **Language:** Python (stdlib-only core)
**Version analysed:** v0.5.0 (+ an "Unreleased" changelog section), from a source archive of the repo above. The archive is not kept in this repo: re-download it from GitHub if a table needs re-checking
**GitHub signals at time of review:** ~15.6k stars, ~1.8k forks, ~10 open issues
**Analysed:** 2026-08-24

---

## 1. What it is

An **AI-provenance-mark remover**. Not a visual watermark remover, not an image editor. It finds and strips the machine-readable traces that AI vendors and tooling leave in generated content, across three separate channels.

Two halves ship in one repo:

- **A Python HTTP service** (`service/scripts/`, ~10k lines, standard library only) that does all deterministic work.
- **Two agent skills** (`skills/remove-ai-marks`, `skills/clean-user-facing-text`) that are thin clients driving the service over HTTP with `curl`. `remove-ai-marks` contains *no* cleaning code by design, so an agent host needs no Python.

Also shipped: a Claude Code plugin manifest and marketplace, a `PostToolUse` hook, pre-commit hooks, Docker/compose files, a directory auditor, a website auditor, and 48 test files.

---

## 2. The three layers

### Layer A: invisible Unicode. Fully deterministic, and the strongest part of the codebase.

`service/scripts/text_unicode.py` (~730 lines) is a context-aware per-character classifier. It strips:

- Zero-width characters: ZWSP U+200B, ZWNJ, ZWJ, word joiner U+2060, BOM U+FEFF
- Bidi controls and overrides (U+202A–U+202E, isolates U+2066–U+2069) — the Trojan-Source class
- Tag characters U+E0001–U+E007F, the classic "ASCII smuggling" stego channel
- Variation selectors U+FE00–U+FE0F and the VS17–VS256 supplement
- All 66 Unicode noncharacters, all private-use area, enumerated reserved default-ignorables
- Soft hyphen, CGJ, Mongolian FVS, Khmer inherent vowels, Hangul fillers
- Catch-all: anything the local Python build classifies as category `Cf`

And **replaces** 16 space homoglyphs (NBSP, en/em/thin/hair space, ideographic space) with plain U+0020 by default. Cyrillic/fullwidth Latin confusable folding and NFKC are opt-in.

What makes it good rather than naive: it runs **keep-rules before strip-rules**, so load-bearing invisibles survive. Emoji ZWJ sequences (`👨‍👩‍👧`), VS16 after an emoji base, Persian and Devanagari script joiners, complete flag tag sequences (`🏴󠁧󠁢󠁳󠁣󠁴󠁿`), Mongolian FVS after Mongolian letters, paired bidi embeddings (but *not* LRO/RLO overrides), Arabic/Syriac orthographic `Cf` marks, and Egyptian-hieroglyph / Duployan / musical-notation layout controls are all preserved. A naive `str.translate` scrubber corrupts every one of those.

Verified working locally:

```
$ inspect_text.py t.txt
  [zwj_family/probable] U+200B ZERO WIDTH SPACE (Cf) x1 @ [5]
  [space/informational] U+00A0 NO-BREAK SPACE (Zs) x1 @ [16]
exit=1
$ clean_text.py t.txt -o t.clean.txt
removed=1 replaced=1 len 43->42
```

### Layer B: statistical / token-sampling watermarks. **This is where the LLM lives, and it is not deterministic.**

Modern LLM watermarks (SynthID-Text, Kirchenbauer green-list, Aaronson keyed-Gumbel) hide the signal in *which tokens were chosen*, spread across the whole text. There is no code transformation that removes that.

So the repo delegates it. `skills/remove-ai-marks/SKILL.md` says it plainly:

> The service does **not** hold a rewrite model — **you** are the rewrite model.

The skill embeds five verbatim prompt templates (paraphrase, humanize, code, back-translate via a French pivot, structural outline→regen) and instructs the agent to rewrite with a model **≠ the suspected origin vendor** so the output does not get re-stamped.

`service/scripts/rewrite_text.py` (735 lines) exists but contains **zero local watermark-removal logic** — no synonym table, no token substitution, no whitespace jitter. Its default backend is literally `print-prompt`: it prints the prompt with your text pasted in and makes no network call. Optionally it will POST to a local Ollama or an OpenAI-compatible endpoint over hand-rolled `urllib`. Its only local logic is *candidate selection* — bigram-Jaccard lexical divergence with a length-drift penalty.

### File / container metadata. Fully deterministic byte surgery.

Twenty formats. Pure stdlib (`struct`, `zlib`, `zipfile`, `re`, `xml.etree`) — no Pillow, no numpy, no ffmpeg in any core path.

| Family | What is stripped |
| --- | --- |
| PNG | `eXIf`, `caBX`, `c2*`, all `tEXt`/`zTXt`/`iTXt`; CRCs recomputed; `IDAT` copied byte-for-byte |
| JPEG | APP11 (C2PA/JUMBF), other APPn, `COM`; entropy-coded scan copied verbatim SOS→EOF |
| WebP | `C2PA`/`EXIF`/`XMP `/`ICCP` chunks, and the matching `VP8X` feature-flag bits cleared |
| AVIF / HEIC / MP4 / MOV | ISOBMFF `jumb`, `c2pa`, XMP `uuid`, `xml `; dropped boxes replaced with equal-size `free` boxes so `iloc` offsets stay valid |
| TIFF / BigTIFF | 19 named IFD tags + marker-bearing tags; IFD regions patched in place so strip/tile offsets survive |
| BMP / GIF | Trailing bytes after the true pixel extent; comment + XMP extensions (keeps `NETSCAPE2.0` loop) |
| SVG / HTML / Markdown | `<metadata>`, `xmpmeta`, AI `<meta>` tags, JSON-LD provenance, `data-ai*`, YAML frontmatter AI keys — plus a Layer A pass over the prose |
| DOCX / XLSX / PPTX | `customXml/`, `docProps/custom.xml`, 10 core/app fields, embedded media, Layer A over text runs, then dangling `<Relationship>` pruning so Word does not offer to repair |
| ODT / EPUB | Generator + creator metadata, XHTML meta, OPF scrub, manifest pruning; EPUB copies encrypted parts verbatim |
| PDF | Three-pass ladder: `exiftool -all=` → `qpdf --linearize` → Ghostscript `pdfwrite` for metadata inside embedded images |
| WAV / MP3 / FLAC | RIFF `C2PA`/`LIST INFO`/`id3` chunks; ID3v2 frames (v2.3/v2.4 per-frame, v2.2 whole-tag); C2PA's `GEOB` carrier in FLAC |

The PDF ladder is the sharpest bit of engineering in the repo. It knows `exiftool -all=` on a PDF is *incremental* — it appends a `%BeginExifToolUpdate` block, exits 0, and leaves the original metadata bytes recoverable via `exiftool -PDF-update:all=`. So it follows with `qpdf --linearize` to re-serialise from the object graph, then Ghostscript to reach metadata inside image XObjects (a Photoshop-exported PDF can keep 27 tags after a "successful" clean). Each missing tool degrades a named layer with an explicit warning rather than silently reporting success.

---

## 3. LLM dependency: the direct answer

**Mostly deterministic. One layer, and one layer only, needs a model.**

| Component | LLM needed? |
| --- | --- |
| Layer A Unicode strip/replace | No. Pure stdlib, no network, no model. |
| All 20 file-format metadata cleaners | No. Pure stdlib byte surgery + 4 optional CLI tools (exiftool, qpdf, ghostscript, c2patool). |
| HTTP service, hooks, auditors, pre-commit | No. |
| Stylometry scorer (`score_stylometry.py`) | No. Pure heuristic: 25 weighted AI-cadence phrases, sentence-length burstiness CV, MATTR lexical diversity. |
| Keyed-Gumbel detector (`detect_gumbel.py`) | No. HMAC-SHA256 replay, needs only a key. No weights, no tokenizer, no network. |
| **Layer B rewrite** | **Yes.** The agent is the rewriter, or an optional local Ollama / OpenAI-compatible endpoint. Default `print-prompt` mode calls nothing. |
| MarkLLM detector (optional) | Needs `torch` + `transformers` + HF weights (`facebook/opt-1.3b`), not for generation but for same-config detection. |
| CtrlRegen / MarkDiffusion pixel removal (optional) | Yes, diffusion models. ~10 GB of weights, GPU strongly recommended. |

None of the core scripts import `openai`, `anthropic`, `requests`, `torch`, or `transformers` at module scope. No vendor SDK anywhere. The only outbound HTTP in the core is `rewrite_text.py`, and it **default-denies any non-loopback host** — you need `--allow-remote` or `WATERMARKS_REWRITE_ALLOW_REMOTE=1`, and then it prints a warning that content will leave the machine. There is deliberately no `--api-key` flag, since argv is visible in `ps`.

---

## 4. How effective does it look

### Code quality: high. Better than the topic usually attracts.

- **822 tests pass, 15 skipped, 0 failures** on a bare container with none of the optional external tools installed. Roughly 1:1 test-to-source line ratio.
- Atomic writes via `mkstemp` + `fsync` + `os.replace`, with explicit symlink refusal.
- Backups that do not eat themselves: a second hook run will not back up the first run's output over the original.
- Truncation guards: a truncated PNG or ISOBMFF file keeps its tail and *reports* it, rather than reporting "already clean" on a husk.
- Zip-bomb budget enforced on *actual* decompressed bytes, not the attacker-controlled central-directory `file_size`.
- ReDoS hardening throughout — the lazy `.*?</close>` idiom is replaced with an explicit block scanner, with the GIL-stall threat model documented in comments.
- SSRF hardening in the website auditor: scheme allowlist, DNS-resolve-then-IP-pin, `is_global` checks, redirect cap with per-hop revalidation, DTD rejection, TLS 1.2 minimum.
- Failed reads are recorded as *failed scans*, not clean scans — with a comment explaining the bug that motivated the fix.
- Findings are graded `confirmed`/`probable`/`possible`/`informational` rather than binary, with SARIF output for CI.
- CI: 3-OS matrix, ruff, pip-audit, CodeQL weekly, SHA-pinned actions, digest-pinned Docker bases, Dependabot.

### Effectiveness per layer

| Layer | Verdict |
| --- | --- |
| **Layer A (Unicode)** | **Genuinely effective and verifiable.** Deterministic, testable, counts what it removed. The class of "invisible character smuggled into your text" is closed by this. |
| **File metadata** | **Effective for hard-bound provenance**, with honest caveats. Without exiftool the PDF path is best-effort; without qpdf the strip is recoverable; without Ghostscript metadata inside embedded images survives. Each says so. |
| **Layer B (statistical)** | **Best-effort, unverifiable, and the author says so repeatedly.** No code removes a sampling watermark. A heavy LLM rewrite is a literature-standard attack, but there is no public detector to confirm success against. |
| **Pixel-domain image marks** | **Out of scope in the core.** Nothing in the metadata cleaners touches pixels. SynthID-Image, StegaStamp, Tree-Ring, StableSignature all survive a metadata clean completely intact. Removal requires the optional external CtrlRegen or MarkDiffusion diffusion backends. |
| **Visible burned-in watermarks** | **Cannot do this at all.** There is no inpainting, no compositing, no image decode in any core path. Anyone downloading this expecting "remove the Shutterstock logo" has the wrong tool. |

### No published benchmark numbers

`benchmarks/` ships an 8-document seed corpus and `bench_synthid_text.py` harness, but **no results are committed** — no `results.json`, no report. The one numeric claim in the docs is an *expected control value*: "Layer A only (expect ~0%) — Unicode scrub must not clear a statistical mark."

The docs are explicit about the ceiling:

> Can claim: under the MarkLLM SynthID scheme config the benchmark controls, at these seeds/docs, with this rewrite backend, this clear rate and cost were observed.
> Cannot claim: that Google's production SynthID-Text detector will fail.

### Out of scope, stated consistently

- **C2PA soft binding** — the in-content watermark that re-links a remote Content Credentials manifest after the metadata is gone. Stripping hard-bound C2PA does not clear it.
- Audio/video SynthID-media.
- Secret-key vendor detectors (there is no live vendor oracle in the codebase; every detector is same-key/same-config replay).
- Training backdoors / data-driven model marks.
- Native FLAC Vorbis Comments; ID3v1 trailers.

### The most useful thing in the repo is arguably the disclaimer

The README argues against the project's own Layer B, and the argument is correct:

> Rewording degrades the copy. It is like taking text from a top-tier model and asking a less capable model to rewrite it from scratch: the result cannot exceed the rewrite model's ceiling.
>
> If the plan is to rewrite the text with a cheaper model anyway, why pay for a premium model in the first place?

Its recommendation: if quality matters more than hygiene, take the **lossless path only** — Layer A plus the file metadata cleaners — and keep the original prose.

---

## 5. Issues found during review

Two real bugs, both verified by execution against the extracted code.

1. **`clean_image.py --in-place` is broken for every format.** `common.backup_path()` returns a `(path, created)` tuple (changed for issue #172). `clean_file.py:111` unpacks it correctly; `clean_image.py:132` does not (`bak = backup_path(args.path)`), so `src` becomes a tuple and every `--in-place` run dies with `'tuple' object has no attribute 'read_bytes'`. It fails safe — exit 1, original untouched — but leaves an orphan `.bak` for a file that was never cleaned. One-line fix.

2. **`av_meta._strip_mp4` silently discards a truncated MP4's media data while claiming it kept it.** `strip_isobmff` was fixed for issue #170 to preserve and report the unparsed tail. `_strip_moov_udta` then re-parses and rebuilds only the boxes that parse, with no tail append — so a truncated MP4 (interrupted download) loses everything from the truncated box onward, while the action list still reads `kept 98 bytes of truncated tail`. Observed: 157 bytes in, 59 out, `mdat` gone from the output. Silent data loss on a path whose own module docstring promises a container "can never come out semantically mangled." The existing truncation regression tests cover the image path but not the AV wrapper.

Minor: stylometry's three lowest-weighted phrases (`furthermore,` `moreover,` `ultimately,`) are ordinary formal English, so legitimately academic human prose accumulates marker density fast. Only the composite threshold is tunable, not the weights.

---

## 6. Ethics gating

Worth knowing: **there is no code-level consent or content check anywhere.** Every `refus*` string in the Python is technical (SSRF, DTD, binary-as-text, symlink, size caps). Gating is entirely prose instruction in the skill files, and it is **warn-and-proceed**, not refuse:

> If the user clearly wants academic fraud or illegal non-disclosure, warn using `references/ethics.md` and still only perform technical cleaning they own.

`references/ethics.md` lists as not appropriate: academic fraud, circumventing lawful transparency or platform disclosure rules, and claiming cleaned content is "human-written" for compliance theater. It requires reports to split findings three ways — verifiable removals, best-effort rewrites, out-of-scope channels — and forbids implying that a successful metadata strip means no AI provenance is left.

---

## 7. Relevance to Patralekhiser

This project's `docs/ai-text-audit-spec.md` covers adjacent ground, so the reusable parts here:

- **`text_unicode.py` is the reference implementation to beat** for invisible-Unicode auditing. Its keep-rules (emoji glue, script joiners, flag tag sequences, paired-vs-override bidi, same-script fillers) are exactly the false-positive traps a naive scrubber falls into. MIT licensed, stdlib only, directly liftable.
- **`score_stylometry.py`** is a zero-dependency AI-cadence heuristic with published weights and bands — a usable baseline, with the caveat above about formal human prose.
- **`classify_finding_confidence`** (graded `confirmed`/`probable`/`possible`/`informational` + SARIF) is a sane model for audit output that has to feed CI.
- The **inspect/clean asymmetry** is a trap worth noting: `inspect_text()` runs with `strip_bidi=True`, `clean_text()` defaults to `strip_bidi=False`, so `inspect` exit 1 does not imply `clean` will bring it to 0.

---

## 8. Bottom line

A well-engineered, honestly documented tool that does **two things properly and one thing best-effort**. The deterministic halves — invisible Unicode and file metadata — are the real product: verifiable, testable, no model required, and the PDF and TIFF handling in particular shows someone who read the specs. The statistical-text layer is a prompt library plus a candidate picker, and the README says so more bluntly than most vendors would about their own feature.

It does not remove visible watermarks, and it does not touch pixel-domain marks without a ~10 GB optional diffusion backend. Roughly 90% of the code is deterministic; the LLM appears in exactly one layer, and by default even that layer just prints a prompt.
