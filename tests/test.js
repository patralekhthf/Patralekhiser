/* Engine test harness. Run: node tests/test.js */
var fs = require("fs");
var path = require("path");
var engine = require("../src/engine.js");

var input = fs.readFileSync(path.join(__dirname, "..", "samples", "sample-article.md"), "utf8");
var result = engine.process(input, engine.defaultConfig);

var failures = [];
function check(name, cond) {
  if (!cond) failures.push(name);
  console.log((cond ? "PASS" : "FAIL") + "  " + name);
}

var out = result.output;
/* Frozen so FR-U49 can prove the pass is inert when switched off. */
var baselineOutput = result.output;

/* Auto fix assertions */
check("em dash removed", out.indexOf("—") === -1);
check("en dash removed outside numbers", !/[a-z]\s*–\s*[a-z]/i.test(out));
check("number range becomes 'to'", out.indexOf("10,000 to 50,000") !== -1);
check("emoji removed", !/[\u{1F680}\u{1F389}]/u.test(out));
check("'leverage' swapped", !/\bleverage\b/i.test(out));
check("'in order to' swapped", !/\bin order to\b/i.test(out));
check("'utilizing' swapped", !/\butilizing\b/i.test(out));
check("'seamless' swapped", !/\bseamless\b/i.test(out));
check("'empowers' swapped", !/\bempowers\b/i.test(out));
check("'facilitates' swapped", !/\bfacilitates\b/i.test(out));
check("'moreover' swapped", !/\bmoreover\b/i.test(out));
check("'furthermore' swapped", !/\bfurthermore\b/i.test(out));
check("'each and every' swapped", !/\beach and every\b/i.test(out));
check("'due to the fact that' swapped", !/due to the fact that/i.test(out));
check("'whether or not' swapped", !/whether or not/i.test(out));
check("'It is worth noting that' deleted", !/It is worth noting that/i.test(out));
check("'Needless to say' deleted", !/Needless to say/i.test(out));
check("'At the end of the day' deleted", !/at the end of the day/i.test(out));
check("contraction don't expanded", !/\bdon['’]t\b/.test(out));
check("contraction it's expanded", !/\bit['’]s\b/i.test(out));
check("stock opener deleted and recapitalized", /^Organizations must use modern solutions to stay ahead/m.test(out));

/* Protected terms untouched */
check("BusinessBook Plus intact", out.indexOf("BusinessBook Plus") !== -1);
check("Myridius intact (in URL and email)", out.indexOf("myridius.com") !== -1);
check("URL intact", out.indexOf("https://www.myridius.com") !== -1);
check("email intact", out.indexOf("hello@myridius.com") !== -1);

/* Flags */
function hasFlag(type, needle) {
  return result.flags.some(function (f) {
    return f.type === type && (!needle || (f.found + " " + f.excerpt).toLowerCase().indexOf(needle.toLowerCase()) !== -1);
  });
}
check("flags long sentence", hasFlag("Long sentence"));
check("flags passive voice", hasFlag("Passive voice"));
check("flags semicolon", hasFlag("Semicolon"));
check("flags hype word 'game-changing'", hasFlag("Word choice", "game-changing"));
check("flags 'ultimate'", hasFlag("Word choice", "ultimate"));
check("flags repetitive headings (Delving)", hasFlag("Repetitive headings"));
check("flags repetitive rhythm (The platform...)", hasFlag("Repetitive rhythm"));

/* Stats sanity */
check("readability improved or equal", result.stats.after.score >= result.stats.before.score);
check("changes recorded", result.changes.length > 30);

/* ---------------------------------------------------------------- *
 * verbOnly guard: ambiguous verb/noun swaps                         *
 * A rule engine cannot parse, so an ambiguous word is only swapped  *
 * where the surrounding function words make the verb sense certain. *
 * Biased to refuse: a missed swap costs nothing, a wrong one ships. *
 * ---------------------------------------------------------------- */

function swapCheck(name, input, shouldSwap) {
  var out = engine.process(input, engine.defaultConfig).output;
  var kept = /\b(harness|leverage)\b/i.test(out);
  check(name, shouldSwap ? !kept : kept);
}

/* noun uses: must be left alone */
swapCheck("keeps noun 'eval harness'",       "The eval harness regression-tests every change.", false);
swapCheck("keeps noun 'test harness'",       "A test harness runs the suite nightly.", false);
swapCheck("keeps noun 'no leverage'",        "We had no leverage in that negotiation.", false);
swapCheck("keeps noun 'financial leverage'", "Financial leverage increased the risk.", false);
swapCheck("keeps noun after possessive",     "Our robust harness handles retries.", false);
swapCheck("keeps sentence-initial noun",     "Leverage increased the risk last year.", false);

/* verb uses: must still be swapped */
swapCheck("swaps verb after modal",          "The team will leverage the new API.", true);
swapCheck("swaps verb after 'should'",       "You should harness the wind for power.", true);
swapCheck("swaps imperative with object",    "Harness the wind for power.", true);
swapCheck("swaps verb after plural subject", "Companies leverage data to make decisions.", true);
swapCheck("swaps verb after 'must'",         "Organizations must leverage modern solutions.", true);

/* the guard must not leak to unguarded rules */
swapCheck("unguarded rule still fires on a noun",
          "Server utilization hit ninety percent.", true);
check("'utilization' still swapped",
      engine.process("Server utilization hit ninety percent.", engine.defaultConfig)
            .output.indexOf("use") !== -1);

console.log("\n--- Stats ---");
console.log("Words: " + result.stats.before.words + " -> " + result.stats.after.words);
console.log("Flesch: " + result.stats.before.score + " -> " + result.stats.after.score);
console.log("Grade: " + result.stats.before.grade + " -> " + result.stats.after.grade);
console.log("Avg sentence: " + result.stats.before.avgSentence + " -> " + result.stats.after.avgSentence);
console.log("Changes: " + result.stats.changeCount + "  Flags: " + result.stats.flagCount);

/* ==================================================================== */
/* Invisible Unicode artifacts (docs/req-unicode-artifacts.md)           */
/* ==================================================================== */

/* Every codepoint below is an escape sequence and never a literal
   character. Not a style preference: a test file containing literal
   carriers cannot be reviewed, and a diff containing them cannot be read. */

var C = {
  ZWSP: "\u200b",
  ZWNJ: "\u200c",
  ZWJ: "\u200d",
  WJ: "\u2060",
  BOM: "\ufeff",
  VS1: "\ufe00",
  VS16: "\ufe0f",
  LRE: "\u202a",
  RLE: "\u202b",
  POPDF: "\u202c",
  LRO: "\u202d",
  RLO: "\u202e",
  RLM: "\u200f",
  NBSP: "\u00a0",
  NNBSP: "\u202f",
  IDSP: "\u3000",
  SHY: "\u00ad",
  CGJ: "\u034f",
  NUL: "\u0000",
  SOH: "\u0001",
  VT: "\u000b",
  NONCHAR: "\ufdd0",
  RESERVED: "\u2065",
  PUA: "\ue123",
  PUA_ASTRAL: "\u{f0001}",
  TAG_A: "\u{e0041}",
  TAG_B: "\u{e0042}",
  MUS_BEAM: "\u{1d173}",
  FVS1: "\u180b",
  KHMER_AQ: "\u17b4",
  HANGUL_CHOSEONG_FILLER: "\u115f",
  ARABIC_NUMBER_SIGN: "\u0600",
  CYR_A: "\u0430"
};

/* FR-U20: the required keep fixtures. */
var FIX = {
  /* man, woman, girl joined by ZWJ */
  familyEmoji: "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}",
  /* red heart with emoji presentation */
  heartVS16: "\u2764\ufe0f",
  /* waving flag plus a complete tag sequence */
  scotlandFlag: "\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}",
  /* mi-rawam: the ZWNJ is orthographic */
  persian: "\u0645\u06cc\u200c\u0631\u0648\u0645",
  /* the D3 cluster: ka, virama, ZWJ, ssa */
  devanagari: "\u0915\u094d\u200d\u0937",
  /* normal Arabic orthography */
  arabicNumberSign: "\u0600\u0661\u0662",
  /* CJK ideograph with a variation selector */
  cjkVariation: "\u8fbb\ufe00",
  /* Mongolian letter with a free variation selector */
  mongolian: "\u1820\u180b",
  /* Khmer letter with an inherent vowel */
  khmer: "\u1780\u17b4",
  /* conjoining jamo with a choseong filler */
  hangul: "\u1100\u115f",
  /* a musical beam between musical symbols */
  musicalBeam: "\u{1d15f}\u{1d173}\u{1d165}"
};

/* Escape a string for readable failure output. */
function escCp(s) {
  var o = "";
  for (var ch of s) {
    var cp = ch.codePointAt(0);
    o += (cp < 0x20 || cp === 0x7f || cp > 0x7e)
      ? (cp > 0xffff ? "\\u{" + cp.toString(16) + "}" : "\\u" + cp.toString(16).padStart(4, "0"))
      : ch;
  }
  return o;
}

/* ---- FR-U20 / FR-U44: load-bearing invisibles round-trip untouched --- */
[
  ["family emoji ZWJ chain", FIX.familyEmoji, "emoji-glue"],
  ["red heart with VS16", FIX.heartVS16, "emoji-glue"],
  ["Scotland flag tag sequence", FIX.scotlandFlag, "flag-sequence"],
  ["Persian ZWNJ", FIX.persian, "script-joiner"],
  ["Devanagari ka-virama-ZWJ-ssa", FIX.devanagari, "script-joiner"],
  ["Arabic number sign", FIX.arabicNumberSign, "orthographic"],
  ["CJK ideograph + variation selector", FIX.cjkVariation, "same-script-base"],
  ["Mongolian letter + FVS1", FIX.mongolian, "same-script-base"],
  ["Khmer letter + inherent vowel", FIX.khmer, "same-script-base"],
  ["Hangul jamo + choseong filler", FIX.hangul, "same-script-base"],
  ["musical beam between musical symbols", FIX.musicalBeam, "layout-control"]
].forEach(function (f) {
  var r = engine.cleanArtifacts(f[1]);
  check("keep: " + f[0] + " is byte-identical", r.text === f[1]);
  check("keep: " + f[0] + " removes and replaces nothing", r.removed === 0 && r.replaced === 0);
  var kept = r.artifacts.filter(function (a) { return a.action === "keep"; });
  check("keep: " + f[0] + " reported as " + f[2],
    kept.length > 0 && kept.every(function (a) { return a.keptBecause === f[2]; }));
  check("keep: " + f[0] + " keeps are informational",
    kept.every(function (a) { return a.confidence === "informational"; }));
});

/* ---- FR-U12 / 2.1: one fixture per kind, with action and confidence --- */
[
  ["zwj_family",         "util" + C.ZWSP + "ize",               "strip",   "confirmed"],
  ["bidi",               "a " + C.RLO + "100" + C.POPDF + " b", "strip",   "confirmed"],
  ["tag_chars",          "USD" + C.TAG_A + C.TAG_B,             "strip",   "confirmed"],
  ["variation_selector", "x" + C.VS1 + "y",                     "strip",   "informational"],
  ["noncharacter",       "a" + C.NONCHAR + "b",                 "strip",   "confirmed"],
  ["reserved_ignorable", "a" + C.RESERVED + "b",                "strip",   "confirmed"],
  ["private_use",        "a" + C.PUA + "b",                     "strip",   "confirmed"],
  ["format",             "soft" + C.SHY + "hyphen",             "strip",   "confirmed"],
  ["space",              "10" + C.NBSP + "km",                  "replace", "informational"],
  ["control",            "a" + C.NUL + "b",                     "strip",   "confirmed"]
].forEach(function (k) {
  var r = engine.cleanArtifacts(k[1]);
  var a = r.artifacts.filter(function (x) { return x.kind === k[0]; });
  check("kind " + k[0] + " classified", a.length > 0);
  check("kind " + k[0] + " action is " + k[2], a.length > 0 && a[0].action === k[2]);
  check("kind " + k[0] + " confidence is " + k[3], a.length > 0 && a[0].confidence === k[3]);
  check("kind " + k[0] + " has a label", a.length > 0 && typeof a[0].label === "string" && a[0].label.length > 0);
});

/* A run of tag characters stays one artifact per codepoint (FR-U10/FR-U33). */
var tagRun = "x";
for (var tg = 0; tg < 40; tg++) tagRun += C.TAG_A;
check("40 tag characters are 40 artifacts, all removed",
  engine.inspectArtifacts(tagRun).length === 40 && engine.cleanArtifacts(tagRun).text === "x");

/* ---- keep rules refuse the ambiguous cases -------------------------- */
check("lone tag character is never kept", engine.cleanArtifacts("a" + C.TAG_A + "b").text === "ab");
check("unpaired RLE is stripped and confirmed", (function () {
  var r = engine.cleanArtifacts("a" + C.RLE + "b");
  return r.text === "ab" && r.artifacts[0].confidence === "confirmed";
})());
check("balanced RLE..PDF is kept as paired-bidi", (function () {
  var t = "a" + C.RLE + "shalom" + C.POPDF + "b";
  var r = engine.cleanArtifacts(t);
  return r.text === t && r.artifacts.length === 2 &&
    r.artifacts.every(function (a) { return a.keptBecause === "paired-bidi"; });
})());
check("LRO is stripped even when balanced",
  engine.cleanArtifacts("a" + C.LRO + "b" + C.POPDF + "c").text === "abc");
check("RLM is kept by default", engine.cleanArtifacts("a" + C.RLM + "b").text === "a" + C.RLM + "b");
check("RLM is stripped when artifactStripBidiMarks is on",
  engine.cleanArtifacts("a" + C.RLM + "b", { artifactStripBidiMarks: true }).text === "ab");
check("a musical beam floating free of its script is stripped",
  engine.cleanArtifacts("ab" + C.MUS_BEAM + "cd").text === "abcd");

/* ---- FR-U21 / FR-U22: code spans are reported, never modified ------- */
var codeSpan = "Text `util" + C.ZWSP + "ize` here.";
var codeRes = engine.cleanArtifacts(codeSpan);
check("carrier inside inline code is kept", codeRes.text === codeSpan);
check("carrier inside inline code says in-code",
  codeRes.artifacts.length === 1 && codeRes.artifacts[0].keptBecause === "in-code");
var fenced = "```\nutil" + C.ZWSP + "ize\n```";
check("carrier inside a fenced block is kept", engine.cleanArtifacts(fenced).text === fenced);
check("artifactScanCode overrides the code-span keep",
  engine.cleanArtifacts(codeSpan, { artifactScanCode: true }).text === "Text `utilize` here.");
check("a control is stripped even inside code",
  engine.cleanArtifacts("`a" + C.NUL + "b`").text === "`ab`");

/* ---- FR-U14 / FR-U15: the two settings that change visible text ----- */
check("non-breaking space becomes an ordinary space by default",
  engine.cleanArtifacts("10" + C.NBSP + "km").text === "10 km");
check("non-breaking space survives with artifactNormalizeSpaces off", (function () {
  var t = "10" + C.NBSP + "km";
  var r = engine.cleanArtifacts(t, { artifactNormalizeSpaces: false });
  return r.text === t && r.artifacts.length === 1 && r.artifacts[0].action === "keep";
})());
check("Cyrillic is untouched and unreported by default", (function () {
  var t = "A" + C.CYR_A + "B";
  var r = engine.cleanArtifacts(t);
  return r.text === t && r.artifacts.length === 0;
})());
check("Cyrillic folds only when artifactFoldConfusables is on",
  engine.cleanArtifacts("A" + C.CYR_A + "B", { artifactFoldConfusables: true }).text === "AaB");

/* ---- invariants: FR-U5, FR-U6/47, FR-U9/45, FR-U46, FR-U7/52 -------- */
var artCorpus = [
  "plain ASCII with nothing interesting in it",
  "util" + C.ZWSP + "ize and facil" + C.ZWSP + "itate",
  "Total: " + C.RLO + "100" + C.POPDF + " dollars.",
  "Cost is 10 USD" + C.TAG_A + C.TAG_B + ".",
  FIX.devanagari + " " + FIX.persian + " " + FIX.familyEmoji,
  FIX.scotlandFlag + C.ZWSP + FIX.heartVS16,
  "a" + C.PUA_ASTRAL + "b" + C.NONCHAR + "c" + C.RESERVED + "d",
  "10" + C.NBSP + "km and 10" + C.NNBSP + "%",
  "soft" + C.SHY + "hyphen, " + C.CGJ + "cgj, " + C.WJ + "wj",
  "`code " + C.ZWSP + "span` and text " + C.ZWSP + "outside",
  "```\nfenced " + C.ZWSP + " block\n```",
  C.NUL + C.SOH + C.VT + "controls",
  FIX.mongolian + FIX.khmer + FIX.hangul + FIX.musicalBeam,
  "a" + C.LRE + "b" + C.POPDF + "c" + C.RLE + "unclosed",
  "mixed " + C.BOM + " bom and " + C.IDSP + " ideographic space"
];
var artSettings = [
  ["defaults", undefined],
  ["normalizeSpaces off", { artifactNormalizeSpaces: false }],
  ["stripBidiMarks on", { artifactStripBidiMarks: true }],
  ["foldConfusables on", { artifactFoldConfusables: true }],
  ["scanCode on", { artifactScanCode: true }]
];

check("inspectArtifacts never modifies its input (FR-U5)", (function () {
  var t = artCorpus[1], copy = String(t);
  engine.inspectArtifacts(t);
  return t === copy;
})());

check("inspect and clean agree on every decision (FR-U6, FR-U47)", (function () {
  var bad = 0;
  artSettings.forEach(function (ss) {
    artCorpus.forEach(function (t) {
      var ins = engine.inspectArtifacts(t, ss[1]);
      var cln = engine.cleanArtifacts(t, ss[1]);
      if (JSON.stringify(ins) !== JSON.stringify(cln.artifacts)) { bad++; return; }
      ins.forEach(function (a) {
        var ch = String.fromCodePoint(a.cp);
        var alsoKept = ins.some(function (b) { return b.cp === a.cp && b.action !== "strip"; });
        if (a.action === "strip" && !alsoKept && cln.text.indexOf(ch) !== -1) bad++;
        if (a.action === "keep" && cln.text.indexOf(ch) === -1) bad++;
      });
    });
  });
  return bad === 0;
})());

check("cleanArtifacts is idempotent (FR-U9, FR-U45)", (function () {
  var bad = 0;
  artSettings.forEach(function (ss) {
    artCorpus.forEach(function (t) {
      var once = engine.cleanArtifacts(t, ss[1]);
      var twice = engine.cleanArtifacts(once.text, ss[1]);
      if (twice.text !== once.text || twice.removed !== 0 || twice.replaced !== 0) bad++;
    });
  });
  return bad === 0;
})());

check("every offset slices back to its own codepoint, ascending (FR-U46, FR-U10)", (function () {
  var bad = 0;
  artSettings.forEach(function (ss) {
    artCorpus.forEach(function (t) {
      var prev = -1;
      engine.inspectArtifacts(t, ss[1]).forEach(function (a) {
        if (t.slice(a.start, a.end).codePointAt(0) !== a.cp) bad++;
        if (a.end - a.start !== (a.cp > 0xffff ? 2 : 1)) bad++;
        if (a.start < prev) bad++;
        prev = a.start;
      });
    });
  });
  return bad === 0;
})());

check("astral emoji next to a carrier keeps both offsets right (FR-U7, FR-U52)", (function () {
  var t = "\u{1f600}" + C.ZWSP + "\u{1f601}" + C.PUA_ASTRAL + "\u{1f602}";
  var a = engine.inspectArtifacts(t);
  return a.length === 2 &&
    a[0].cp === 0x200b && a[0].start === 2 && a[0].end === 3 &&
    a[1].cp === 0xf0001 && a[1].start === 5 && a[1].end === 7 &&
    engine.cleanArtifacts(t).text === "\u{1f600}\u{1f601}\u{1f602}";
})());

check("no cleaned output contains a lone surrogate", (function () {
  var bad = 0;
  artCorpus.forEach(function (t) {
    var out = engine.cleanArtifacts(t).text;
    for (var i = 0; i < out.length; i++) {
      var u = out.charCodeAt(i);
      if (u >= 0xd800 && u <= 0xdbff) {
        var lo = out.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) i++; else bad++;
      } else if (u >= 0xdc00 && u <= 0xdfff) bad++;
    }
  });
  return bad === 0;
})());

check("output length is input minus strips plus replacements (FR-U11)", (function () {
  var bad = 0;
  artCorpus.forEach(function (t) {
    var r = engine.cleanArtifacts(t);
    var expected = t.length;
    r.artifacts.forEach(function (a) {
      if (a.action === "keep") return;
      expected -= (a.end - a.start);
      if (a.action === "replace") expected += a.replacement.length;
    });
    if (r.text.length !== expected) bad++;
  });
  return bad === 0;
})());

check("artifactClean false stops removal but not reporting (FR-U27)", (function () {
  var t = artCorpus[1];
  var r = engine.cleanArtifacts(t, { artifactClean: false });
  return r.text === t && r.removed === 0 && r.replaced === 0 && r.artifacts.length === 2;
})());

check("missing settings fall back to defaults, never undefined (FR-U28)", (function () {
  var d = engine.defaultArtifactSettings;
  return d.artifactClean === true && d.artifactNormalizeSpaces === true &&
    d.artifactStripBidiMarks === false && d.artifactFoldConfusables === false &&
    d.artifactScanCode === false &&
    engine.cleanArtifacts("a" + C.ZWSP + "b", {}).text === "ab" &&
    engine.cleanArtifacts("a" + C.ZWSP + "b", { settings: {} }).text === "ab";
})());

check("the artifact tables carry a dated Unicode version (FR-U13)",
  /^unicode-\d+\.\d+\/\d{4}-\d{2}-\d{2}$/.test(engine.artifactTableVersion));

/* ---- FR-U41 to FR-U43: the three defect regressions ----------------- */

/* D1: one zero-width space defeated every swap and flag rule, because they
   are all word-boundary regexes over the raw string. */
var d1 = engine.process("We util" + C.ZWSP + "ize the platform to facil" + C.ZWSP + "itate growth.");
check("D1: a carrier no longer blocks the swaps (FR-U41)",
  d1.output === "We use the platform to help growth.");
check("D1: the swaps are logged as Simpler word",
  d1.changes.filter(function (c) { return c.category === "Simpler word"; }).length === 2);
check("D1: the carriers are reported as artifacts",
  d1.artifactSummary.total === 2 && d1.artifactSummary.removed === 2);

/* D2: bidi overrides and tag characters reached every export unflagged. */
var d2 = engine.process("Total: " + C.RLO + "100" + C.POPDF + " dollars. Cost is 10 USD" + C.TAG_A + C.TAG_B + ".");
check("D2: no bidi or tag character survives into the output (FR-U42)",
  d2.output.indexOf(C.RLO) === -1 && d2.output.indexOf(C.POPDF) === -1 &&
  d2.output.indexOf(C.TAG_A) === -1 && d2.output.indexOf(C.TAG_B) === -1);
check("D2: each is reported as a confirmed artifact",
  d2.artifacts.length === 4 &&
  d2.artifacts.every(function (a) { return a.confidence === "confirmed" && a.action === "strip"; }));

/* D3: removeEmojis deleted the orthographic joiner in Devanagari clusters
   and logged it as "Emoji removal". */
var d3in = "The form " + FIX.devanagari + " appears.";
var d3 = engine.process(d3in);
check("D3: the Devanagari cluster is byte-identical (FR-U43)", d3.output === d3in);
check("D3: nothing is logged as Emoji removal",
  d3.changes.every(function (c) { return c.category !== "Emoji removal"; }));
check("D3: Persian ZWNJ also survives", (function () {
  var t = "Word " + FIX.persian + " here.";
  return engine.process(t).output === t;
})());

/* ---- FR-U24 / FR-U24a: emoji sequences, and disjoint ownership ------ */
check("whole emoji sequences are removed, not codepoints", (function () {
  var t = "Ship " + FIX.familyEmoji + " it \u{1f680} now";
  var r = engine.transform(t);
  return r.output === "Ship it now" &&
    r.output.indexOf(C.ZWJ) === -1 && r.output.indexOf("\u{1f468}") === -1;
})());
check("a keycap is removed as one unit",
  engine.transform("Press 5" + C.VS16 + "⃣ now").output === "Press now");
check("removeEmojis never deletes a lone invisible character (FR-U24a)", (function () {
  /* Every codepoint the artifact pass treats as a carrier must survive
     removeEmojis when it stands alone, or the two functions are contending
     for the same character, which is how D3 happened. */
  var probes = [C.ZWSP, C.ZWNJ, C.ZWJ, C.WJ, C.BOM, C.VS1, C.VS16, C.SHY, C.CGJ,
                C.LRM, C.RLM, C.LRE, C.RLE, C.POPDF, C.LRO, C.RLO,
                C.NBSP, C.NNBSP, C.IDSP, C.TAG_A, C.NONCHAR, C.RESERVED, C.PUA];
  var bad = 0;
  probes.forEach(function (ch) {
    var log = [];
    /* call the emoji pass alone by disabling every other transform rule */
    var cfg = JSON.parse(JSON.stringify(engine.defaultConfig));
    cfg.simpleSwaps = []; cfg.hypeSwaps = []; cfg.fillerPhrases = [];
    cfg.contractions = []; cfg.sentenceStartDeletes = []; cfg.midSentenceDeletes = [];
    cfg.flagWords = [];
    cfg.settings.fixDashes = false;
    cfg.settings.artifactClean = false;   /* artifact pass off: emoji pass only */
    var out = engine.transform("a" + ch + "b", cfg).output;
    if (out.indexOf(ch) === -1) bad++;
  });
  return bad === 0;
})());

/* ---- FR-U49: disabled is inert -------------------------------------- */
check("artifactClean false leaves the sample article byte-identical (FR-U49)", (function () {
  var cfg = JSON.parse(JSON.stringify(engine.defaultConfig));
  cfg.settings.artifactClean = false;
  var off = engine.process(input, cfg);
  return off.output === baselineOutput &&
    off.changes.every(function (c) { return c.category !== "Invisible character"; });
})());
check("the sample article carries no carriers either way",
  result.artifactSummary.total === 0 && result.output === baselineOutput);

/* ---- FR-U50: the sentinel hazard is closed --------------------------- */
check("a literal control cannot corrupt the protect vault (FR-U50)", (function () {
  var t = "Myridius" + C.NUL + " builds BusinessBook Plus" + C.SOH + " for clients.";
  var r = engine.process(t);
  return r.output.indexOf("Myridius") !== -1 &&
    r.output.indexOf("BusinessBook Plus") !== -1 &&
    r.output.indexOf(C.NUL) === -1 && r.output.indexOf(C.SOH) === -1;
})());
check("a control between vault sentinels does not mis-substitute", (function () {
  var t = "Use Myridius" + C.NUL + "0" + C.NUL + " and BusinessBook.";
  var r = engine.process(t);
  return r.output === "Use Myridius0 and BusinessBook.";
})());

/* ---- FR-U48: score invariance, DEFERRED ------------------------------ */
/* reviewParas and the resemblance object live in design/index.html and have
   not been back-ported into src/engine.js yet, so the assertion FR-U1 needs
   cannot run here. The test is written rather than omitted, because a
   skipped test with a reason survives a back-port and a missing one does
   not. The back-port must unskip this. */
if (typeof engine.reviewParas === "function") {
  check("FR-U48: artifacts do not move the resemblance score", (function () {
    var plain = "We utilize the platform. It is a robust solution that empowers teams.";
    var laced = "We utilize the plat" + C.ZWSP + "form. It is a robust solution that empowers teams.";
    var a = engine.reviewParas([{ original: plain, output: plain }], engine.defaultConfig);
    var b = engine.reviewParas([{ original: laced, output: laced }], engine.defaultConfig);
    return JSON.stringify(a.resemblance) === JSON.stringify(b.resemblance);
  })());
} else {
  console.log("SKIP  FR-U48: score invariance needs reviewParas, which is still only in " +
              "design/index.html. Unskip with the design back-port.");
}

/* ---- FR-U38: the indirect effect, recorded rather than hidden -------- */
check("fixing D1 makes swaps fire that previously did not", (function () {
  /* The same document scored differently before this landed, because the
     swaps silently failed to match. The old number was wrong, not the new
     one. This asserts the direction so the change cannot regress quietly. */
  var laced = "We util" + C.ZWSP + "ize it. We leverage it. We facil" + C.ZWSP + "itate it.";
  var cfgOff = JSON.parse(JSON.stringify(engine.defaultConfig));
  cfgOff.settings.artifactClean = false;
  var on = engine.process(laced);
  var off = engine.process(laced, cfgOff);
  return on.stats.changeCount > off.stats.changeCount;
})());

/* ---- FR-U27 / FR-U28: config round trip and backwards compatibility -- */
var fileCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "default-config.json"), "utf8"));
check("config/default-config.json carries all five artifact keys (FR-U27)",
  fileCfg.settings.artifactClean === true &&
  fileCfg.settings.artifactNormalizeSpaces === true &&
  fileCfg.settings.artifactStripBidiMarks === false &&
  fileCfg.settings.artifactFoldConfusables === false &&
  fileCfg.settings.artifactScanCode === false);
check("the reference config agrees with the engine defaults", (function () {
  var d = engine.defaultArtifactSettings;
  for (var k in d) if (fileCfg.settings[k] !== d[k]) return false;
  return true;
})());
check("config export then re-import preserves all five settings", (function () {
  var cfg = JSON.parse(JSON.stringify(fileCfg));
  cfg.settings.artifactNormalizeSpaces = false;
  cfg.settings.artifactFoldConfusables = true;
  var round = JSON.parse(JSON.stringify(cfg));
  return round.settings.artifactNormalizeSpaces === false &&
    round.settings.artifactFoldConfusables === true &&
    engine.cleanArtifacts("10" + C.NBSP + "km", round).text === "10" + C.NBSP + "km" &&
    engine.cleanArtifacts("A" + C.CYR_A + "B", round).text === "AaB";
})());
check("a config exported before this feature still loads (FR-U28)", (function () {
  /* strip the five keys, as an older export would not have them */
  var old = JSON.parse(JSON.stringify(fileCfg));
  ["artifactClean", "artifactNormalizeSpaces", "artifactStripBidiMarks",
   "artifactFoldConfusables", "artifactScanCode"].forEach(function (k) { delete old.settings[k]; });
  var r = engine.process("We util" + C.ZWSP + "ize it.", old);
  return r.output === "We use it." && r.artifactSummary.total === 1;
})());

if (process.argv.indexOf("--show") !== -1) {
  console.log("\n--- OUTPUT ---\n" + out);
  console.log("\n--- FLAGS ---");
  result.flags.forEach(function (f) {
    console.log("[" + f.type + "] " + f.found + " :: " + f.reason);
  });
}

if (failures.length) {
  console.log("\n" + failures.length + " FAILURE(S)");
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
