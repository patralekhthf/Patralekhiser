/*
 * Patralekhiser rule engine
 * Deterministic, dictionary and pattern based text transformation.
 * No LLM, no network calls, no external dependencies.
 * Runs in the browser and in Node (module.exports guarded at the bottom).
 */

var MyridiusEngine = (function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Default configuration: the Myridius style profile encoded as rules  */
  /* ------------------------------------------------------------------ */

  var DEFAULT_CONFIG = {
    meta: {
      name: "Myridius house style",
      version: "1.0",
      description: "Direct, structured, practical, outcome oriented. Simple language for readers in India, USA and the Philippines. No corporate hype, no AI sounding copy."
    },

    /* Never touched by any rule. Brand names, product names, defined terms. */
    protectedTerms: [
      "Myridius",
      "BusinessBook Plus",
      "BusinessBook"
    ],

    /* Complex or formal words swapped for plain ones. find => replace.  */
    simpleSwaps: [
      { find: "utilize", replace: "use" },
      { find: "utilizes", replace: "uses" },
      { find: "utilized", replace: "used" },
      { find: "utilizing", replace: "using" },
      { find: "utilise", replace: "use" },
      { find: "utilising", replace: "using" },
      { find: "utilization", replace: "use" },
      { find: "leverage", replace: "use", verbOnly: true },
      { find: "leverages", replace: "uses" },
      { find: "leveraged", replace: "used" },
      { find: "leveraging", replace: "using" },
      { find: "commence", replace: "start" },
      { find: "commences", replace: "starts" },
      { find: "commenced", replace: "started" },
      { find: "commencing", replace: "starting" },
      { find: "initiate", replace: "start" },
      { find: "initiates", replace: "starts" },
      { find: "initiated", replace: "started" },
      { find: "endeavor", replace: "try" },
      { find: "endeavour", replace: "try" },
      { find: "ascertain", replace: "find out" },
      { find: "expedite", replace: "speed up" },
      { find: "expedites", replace: "speeds up" },
      { find: "subsequently", replace: "later" },
      { find: "consequently", replace: "so" },
      { find: "approximately", replace: "about" },
      { find: "sufficient", replace: "enough" },
      { find: "insufficient", replace: "not enough" },
      { find: "demonstrate", replace: "show" },
      { find: "demonstrates", replace: "shows" },
      { find: "demonstrated", replace: "showed" },
      { find: "demonstrating", replace: "showing" },
      { find: "numerous", replace: "many" },
      { find: "obtain", replace: "get" },
      { find: "obtains", replace: "gets" },
      { find: "obtained", replace: "got" },
      { find: "assist", replace: "help" },
      { find: "assists", replace: "helps" },
      { find: "assistance", replace: "help" },
      { find: "attempt", replace: "try" },
      { find: "attempts", replace: "tries" },
      { find: "attempted", replace: "tried" },
      { find: "individuals", replace: "people" },
      { find: "facilitate", replace: "help" },
      { find: "facilitates", replace: "helps" },
      { find: "facilitated", replace: "helped" },
      { find: "optimal", replace: "best" },
      { find: "optimum", replace: "best" },
      { find: "regarding", replace: "about" },
      { find: "concerning", replace: "about" },
      { find: "currently", replace: "now" },
      { find: "presently", replace: "now" },
      { find: "accelerate", replace: "speed up" },
      { find: "accelerates", replace: "speeds up" },
      { find: "mitigate", replace: "reduce" },
      { find: "mitigates", replace: "reduces" },
      { find: "mitigated", replace: "reduced" },
      { find: "methodology", replace: "method" },
      { find: "methodologies", replace: "methods" },
      { find: "necessitates", replace: "requires" },
      { find: "modification", replace: "change" },
      { find: "modifications", replace: "changes" },
      { find: "transmit", replace: "send" },
      { find: "transmits", replace: "sends" },
      { find: "endeavors", replace: "efforts" },
      { find: "whilst", replace: "while" },
      { find: "amongst", replace: "among" },
      { find: "thus", replace: "so" },
      { find: "hence", replace: "so" },
      { find: "nevertheless", replace: "still" },
      { find: "nonetheless", replace: "still" },
      { find: "moreover", replace: "also" },
      { find: "furthermore", replace: "also" },
      { find: "additionally", replace: "also" },
      { find: "notwithstanding", replace: "despite" }
    ],

    /* Marketing hype and AI sounding words with a safe plain swap. */
    hypeSwaps: [
      { find: "revolutionary", replace: "new" },
      { find: "groundbreaking", replace: "new" },
      { find: "cutting-edge", replace: "modern" },
      { find: "cutting edge", replace: "modern" },
      { find: "state-of-the-art", replace: "modern" },
      { find: "bleeding-edge", replace: "modern" },
      { find: "next-generation", replace: "new" },
      { find: "seamless", replace: "smooth" },
      { find: "seamlessly", replace: "smoothly" },
      { find: "frictionless", replace: "smooth" },
      { find: "empower", replace: "help" },
      { find: "empowers", replace: "helps" },
      { find: "empowering", replace: "helping" },
      { find: "empowered", replace: "helped" },
      { find: "harness", replace: "use", verbOnly: true },
      { find: "harnessing", replace: "using" },
      { find: "harnessed", replace: "used" },
      { find: "supercharge", replace: "improve" },
      { find: "supercharges", replace: "improves" },
      { find: "turbocharge", replace: "improve" },
      { find: "elevate", replace: "improve" },
      { find: "elevates", replace: "improves" },
      { find: "holistic", replace: "complete" },
      { find: "robust", replace: "strong" },
      { find: "streamline", replace: "simplify" },
      { find: "streamlines", replace: "simplifies" },
      { find: "streamlined", replace: "simplified" },
      { find: "streamlining", replace: "simplifying" },
      { find: "delve into", replace: "look at" },
      { find: "delves into", replace: "looks at" },
      { find: "delving into", replace: "looking at" },
      { find: "delve", replace: "dig" },
      { find: "deep dive into", replace: "close look at" },
      { find: "dive deep into", replace: "look closely at" }
    ],

    /* Wordy phrases replaced with short ones. */
    fillerPhrases: [
      { find: "in order to", replace: "to" },
      { find: "in order for", replace: "for" },
      { find: "due to the fact that", replace: "because" },
      { find: "owing to the fact that", replace: "because" },
      { find: "despite the fact that", replace: "although" },
      { find: "in spite of the fact that", replace: "although" },
      { find: "in the event that", replace: "if" },
      { find: "at this point in time", replace: "now" },
      { find: "at the present time", replace: "now" },
      { find: "for the purpose of", replace: "to" },
      { find: "with regard to", replace: "about" },
      { find: "with regards to", replace: "about" },
      { find: "in regards to", replace: "about" },
      { find: "the vast majority of", replace: "most" },
      { find: "a large number of", replace: "many" },
      { find: "a majority of", replace: "most" },
      { find: "a wide range of", replace: "many" },
      { find: "each and every", replace: "every" },
      { find: "first and foremost", replace: "first" },
      { find: "in the near future", replace: "soon" },
      { find: "on a daily basis", replace: "daily" },
      { find: "on a regular basis", replace: "regularly" },
      { find: "take into consideration", replace: "consider" },
      { find: "come to the conclusion", replace: "conclude" },
      { find: "prior to", replace: "before" },
      { find: "subsequent to", replace: "after" },
      { find: "in excess of", replace: "more than" },
      { find: "with the exception of", replace: "except for" },
      { find: "in conjunction with", replace: "with" },
      { find: "whether or not", replace: "whether" },
      { find: "in close proximity to", replace: "near" },
      { find: "has the ability to", replace: "can" },
      { find: "have the ability to", replace: "can" },
      { find: "is able to", replace: "can" },
      { find: "are able to", replace: "can" },
      { find: "in a timely manner", replace: "on time" },
      { find: "gain insights into", replace: "understand" },
      { find: "gain visibility into", replace: "see" }
    ],

    /* Throat clearing that gets deleted when it opens a sentence. */
    sentenceStartDeletes: [
      "It is worth noting that",
      "It's worth noting that",
      "It is important to note that",
      "It should be noted that",
      "Needless to say,",
      "As a matter of fact,",
      "At the end of the day,",
      "In today's fast-paced world,",
      "In today's fast-paced business environment,",
      "In today's digital age,",
      "In this day and age,",
      "Please be advised that",
      "Interestingly,",
      "Basically,"
    ],

    /* Filler that can be deleted anywhere in a sentence. */
    midSentenceDeletes: [
      "at the end of the day",
      "needless to say",
      "as a matter of fact",
      "it goes without saying that",
      "when all is said and done",
      "for all intents and purposes"
    ],

    /* Flagged for a human, never auto changed. word/phrase + why + what to do. */
    flagWords: [
      { find: "game-changing", reason: "Marketing hype", suggestion: "State the concrete benefit instead" },
      { find: "game changer", reason: "Marketing hype", suggestion: "State the concrete benefit instead" },
      { find: "ultimate", reason: "Marketing hype", suggestion: "Remove or replace with a specific claim you can defend" },
      { find: "unparalleled", reason: "Marketing hype", suggestion: "Replace with a measurable claim" },
      { find: "world-class", reason: "Marketing hype", suggestion: "Replace with a specific, verifiable strength" },
      { find: "best-in-class", reason: "Marketing hype", suggestion: "Replace with a specific, verifiable strength" },
      { find: "industry-leading", reason: "Marketing hype", suggestion: "Only keep if you can defend it with evidence" },
      { find: "synergy", reason: "Corporate jargon", suggestion: "Say what actually works better together" },
      { find: "synergies", reason: "Corporate jargon", suggestion: "Say what actually works better together" },
      { find: "paradigm shift", reason: "Corporate jargon", suggestion: "Describe the actual change" },
      { find: "transformative", reason: "Marketing hype", suggestion: "Describe what changes and by how much" },
      { find: "innovative", reason: "Overused claim", suggestion: "Show the innovation instead of labelling it" },
      { find: "unlock", reason: "AI sounding verb", suggestion: "Say what the reader can now do" },
      { find: "unlocks", reason: "AI sounding verb", suggestion: "Say what the reader can now do" },
      { find: "tapestry", reason: "AI sounding word", suggestion: "Rewrite in plain language" },
      { find: "testament to", reason: "AI sounding phrase", suggestion: "State the fact directly" },
      { find: "ever-evolving", reason: "AI sounding phrase", suggestion: "Rewrite the opening with a concrete point" },
      { find: "ever-changing", reason: "AI sounding phrase", suggestion: "Rewrite the opening with a concrete point" },
      { find: "navigate the complexities", reason: "AI sounding phrase", suggestion: "Name the specific problems" },
      { find: "in the realm of", reason: "AI sounding phrase", suggestion: "Just name the field" },
      { find: "landscape", reason: "Often AI filler (e.g. 'the AI landscape')", suggestion: "Name the market, industry or field directly" },
      { find: "embark", reason: "AI sounding word", suggestion: "Use start or begin" },
      { find: "journey", reason: "Often vague", suggestion: "Keep only if it is literally a journey; otherwise name the process" },
      { find: "thereby", reason: "Formal connective, hard for non native readers", suggestion: "Split into two sentences with 'so' or 'this'" },
      { find: "whereby", reason: "Formal connective, hard for non native readers", suggestion: "Rewrite with 'where' or split the sentence" },
      { find: "wherein", reason: "Formal connective, hard for non native readers", suggestion: "Rewrite with 'where'" },
      { find: "aforementioned", reason: "Legalese", suggestion: "Use 'this' or 'these', or repeat the noun" },
      { find: "in terms of", reason: "Vague connective", suggestion: "Usually removable; restructure the sentence" },
      { find: "solutions", reason: "Abstract when used alone", suggestion: "Name the product or capability if possible" },
      { find: "not only", reason: "Complex construction for non native readers", suggestion: "Consider splitting into two plain statements" },
      { find: "in conclusion", reason: "AI sounding closer", suggestion: "End with the action or outcome instead" }
    ],

    /* Contractions expanded in formal mode. */
    contractions: [
      { find: "don't", replace: "do not" },
      { find: "doesn't", replace: "does not" },
      { find: "didn't", replace: "did not" },
      { find: "can't", replace: "cannot" },
      { find: "won't", replace: "will not" },
      { find: "isn't", replace: "is not" },
      { find: "aren't", replace: "are not" },
      { find: "wasn't", replace: "was not" },
      { find: "weren't", replace: "were not" },
      { find: "hasn't", replace: "has not" },
      { find: "haven't", replace: "have not" },
      { find: "hadn't", replace: "had not" },
      { find: "shouldn't", replace: "should not" },
      { find: "wouldn't", replace: "would not" },
      { find: "couldn't", replace: "could not" },
      { find: "it's", replace: "it is" },
      { find: "that's", replace: "that is" },
      { find: "there's", replace: "there is" },
      { find: "here's", replace: "here is" },
      { find: "what's", replace: "what is" },
      { find: "we're", replace: "we are" },
      { find: "you're", replace: "you are" },
      { find: "they're", replace: "they are" },
      { find: "we've", replace: "we have" },
      { find: "you've", replace: "you have" },
      { find: "they've", replace: "they have" },
      { find: "we'll", replace: "we will" },
      { find: "you'll", replace: "you will" },
      { find: "they'll", replace: "they will" },
      { find: "I'm", replace: "I am" },
      { find: "I've", replace: "I have" },
      { find: "I'll", replace: "I will" },
      { find: "let's", replace: "let us" }
    ],

    settings: {
      expandContractions: true,
      removeEmojis: true,
      fixDashes: true,
      maxSentenceWords: 28,
      maxParagraphSentences: 6,
      flagPassiveVoice: true,
      flagSemicolons: true
    }
  };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /* Preserve the casing of the matched text on the replacement. */
  function matchCase(source, replacement) {
    if (source.toUpperCase() === source && source.length > 2) {
      return replacement.toUpperCase();
    }
    if (source.charAt(0) === source.charAt(0).toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  function contextSnippet(text, index, matchLen) {
    var start = Math.max(0, index - 32);
    var end = Math.min(text.length, index + matchLen + 32);
    var prefix = start > 0 ? "…" : "";
    var suffix = end < text.length ? "…" : "";
    return prefix + text.slice(start, end).replace(/\s+/g, " ") + suffix;
  }

  /* Estimate syllables for Flesch scoring. Heuristic, good enough. */
  function syllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return 0;
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");
    var m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }

  function splitSentences(text) {
    /* Rough sentence splitter that survives common abbreviations. */
    var guarded = text
      .replace(/\b(e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|Inc|Ltd|St|No|Fig)\./g, "$1\u0001")
      .replace(/(\d)\.(\d)/g, "$1\u0001$2");
    var parts = guarded.split(/(?<=[.!?])\s+/);
    return parts.map(function (s) {
      return s.replace(/\u0001/g, ".").trim();
    }).filter(function (s) { return s.length > 0; });
  }

  function words(text) {
    var m = text.match(/[A-Za-z0-9'’-]+/g);
    return m || [];
  }

  function fleschScore(text) {
    var sents = splitSentences(text.replace(/^#+\s.*$/gm, ""));
    var ws = words(text);
    if (!sents.length || !ws.length) return { score: 0, grade: 0, words: 0, sentences: 0, avgSentence: 0 };
    var syl = 0;
    for (var i = 0; i < ws.length; i++) syl += syllables(ws[i]);
    var wps = ws.length / sents.length;
    var spw = syl / ws.length;
    var score = 206.835 - 1.015 * wps - 84.6 * spw;
    var grade = 0.39 * wps + 11.8 * spw - 15.59;
    return {
      score: Math.round(score * 10) / 10,
      grade: Math.round(grade * 10) / 10,
      words: ws.length,
      sentences: sents.length,
      avgSentence: Math.round(wps * 10) / 10
    };
  }

  /* ------------------------------------------------------------------ */
  /* Protection of terms, URLs, emails and code spans                     */
  /* ------------------------------------------------------------------ */

  function protect(text, protectedTerms) {
    var vault = [];
    function stash(match) {
      vault.push(match);
      return "\u0000" + (vault.length - 1) + "\u0000";
    }
    /* code blocks and inline code */
    text = text.replace(/```[\s\S]*?```/g, stash);
    text = text.replace(/`[^`\n]+`/g, stash);
    /* URLs and emails */
    text = text.replace(/\bhttps?:\/\/[^\s)>\]]+/g, stash);
    text = text.replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, stash);
    /* protected terms, longest first so multi word terms win */
    var terms = (protectedTerms || []).slice().sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < terms.length; i++) {
      if (!terms[i]) continue;
      var re = new RegExp(escapeRegex(terms[i]), "g");
      text = text.replace(re, stash);
    }
    return { text: text, vault: vault };
  }

  function restore(text, vault) {
    return text.replace(/\u0000(\d+)\u0000/g, function (_, n) {
      return vault[parseInt(n, 10)];
    });
  }

  /* ------------------------------------------------------------------ */
  /* Replacement passes                                                   */
  /* ------------------------------------------------------------------ */

  /* ---- verb-only swap guard --------------------------------------------- *
     A few words are both a verb and a noun with different plain equivalents.
     "harness the power of X" is "use"; "an eval harness" is a thing and must be
     left alone. A rule engine cannot parse, so this decides from the words
     immediately around the match and refuses whenever the evidence points at a
     noun. Deliberately biased to refuse: a missed swap costs nothing, a wrong
     one ships "an eval use" in somebody's article.                          */

  var VERB_BEFORE = /\b(?:to|will|would|shall|should|can|could|may|might|must|cannot|let|lets|help|helps|allow|allows|enable|enables|and|or|then|not|never|always|also|we|they|you|i|he|she|it|one|who|that|which)\s+$/i;
  var AT_SENTENCE_START = /(?:^|[.!?;:]\s+|[\n\r]\s*|["'(\[]\s*)$/;
  var DETERMINER = /^(?:a|an|the|this|that|these|those|no|any|some|our|its|their|his|her|my|your|each|every|another|both|all|more|less|much|many|few)$/i;
  var ADJ_SUFFIX = /(?:al|ial|ic|ical|ive|ous|ful|less|able|ible|ary|ent|ant|ing|ed)$/i;
  var ADJ_WORDS = /^(?:good|bad|new|old|great|small|large|high|low|strong|weak|robust|solid|light|heavy|fast|slow|full|real|main|key|core|test|unit|eval|build|release|smoke|load|stress|prod|staging|financial|market|competitive)$/i;

  function isVerbPosition(text, index, matchLen) {
    var before = text.slice(Math.max(0, index - 60), index);
    var after = text.slice(index + matchLen, index + matchLen + 30);

    /* an explicit verb trigger settles it */
    if (VERB_BEFORE.test(before)) return true;

    /* at a sentence start it is a verb only if it takes an object:
       "Harness the wind" yes, "Leverage increased the risk" no */
    if (AT_SENTENCE_START.test(before)) {
      return /^\s+(?:a|an|the|this|that|these|those|its|our|their|his|her|my|your|all|both)\b/i.test(after);
    }

    var toks = before.replace(/[^\w\s'-]/g, " ").trim().split(/\s+/);
    var prev = toks[toks.length - 1] || "";

    /* a determiner or possessive close behind means a noun phrase */
    for (var i = toks.length - 1; i >= 0 && i >= toks.length - 3; i--) {
      if (DETERMINER.test(toks[i])) return false;
    }

    /* an adjective or noun modifier immediately behind means the same */
    if (ADJ_WORDS.test(prev)) return false;
    if (prev.length > 3 && ADJ_SUFFIX.test(prev)) return false;

    return true;
  }

  function applySwaps(text, rules, category, changes) {
    /* Longest finds first so phrases beat single words. */
    var sorted = rules.slice().sort(function (a, b) { return b.find.length - a.find.length; });
    for (var i = 0; i < sorted.length; i++) {
      var rule = sorted[i];
      if (!rule.find) continue;
      var re = new RegExp("\\b" + escapeRegex(rule.find).replace(/'/g, "['’]") + "\\b", "gi");
      text = text.replace(re, function (m) {
        var offsetIdx = arguments[arguments.length - 2];
        if (rule.verbOnly && !isVerbPosition(text, offsetIdx, m.length)) return m;
        var rep = matchCase(m, rule.replace);
        changes.push({
          category: category,
          before: m,
          after: rep,
          context: contextSnippet(text, offsetIdx, m.length)
        });
        return rep;
      });
    }
    return text;
  }

  function applySentenceStartDeletes(text, phrases, changes) {
    for (var i = 0; i < phrases.length; i++) {
      var p = phrases[i];
      if (!p) continue;
      var core = escapeRegex(p).replace(/'/g, "['’]");
      var re = new RegExp("(^|[.!?:]\\s+|\\n\\s*)" + core + "\\s+([a-zA-Z\u0000])", "gm");
      text = text.replace(re, function (m, lead, nextChar, offsetIdx) {
        changes.push({
          category: "Removed filler opener",
          before: p + " …",
          after: "(removed)",
          context: contextSnippet(text, offsetIdx, m.length)
        });
        return lead + nextChar.toUpperCase();
      });
    }
    return text;
  }

  function applyMidSentenceDeletes(text, phrases, changes) {
    for (var i = 0; i < phrases.length; i++) {
      var p = phrases[i];
      if (!p) continue;
      var core = escapeRegex(p).replace(/'/g, "['’]");
      var re = new RegExp("(,\\s*)?\\b" + core + "\\b(\\s*,)?", "gi");
      text = text.replace(re, function (m, lead, trail) {
        var offsetIdx = arguments[arguments.length - 2];
        changes.push({
          category: "Removed filler",
          before: m.trim(),
          after: "(removed)",
          context: contextSnippet(text, offsetIdx, m.length)
        });
        return lead && trail ? ", " : " ";
      });
    }
    /* tidy artefacts */
    text = text.replace(/ {2,}/g, " ").replace(/ ([.,;:!?])/g, "$1").replace(/,\s*,/g, ",");
    return text;
  }

  function fixDashes(text, changes) {
    /* Number ranges keep their meaning with 'to'. */
    text = text.replace(/(\d)\s*[–—]\s*(\d)/g, function (m, a, b, idx) {
      changes.push({ category: "Dash cleanup", before: m, after: a + " to " + b, context: contextSnippet(text, idx, m.length) });
      return a + " to " + b;
    });
    /* Em and en dashes between words become commas. */
    text = text.replace(/\s*[—–]\s*/g, function (m, idx) {
      changes.push({ category: "Dash cleanup", before: m.trim() || "—", after: ",", context: contextSnippet(text, idx, m.length) });
      return ", ";
    });
    /* Double hyphen used as a dash. */
    text = text.replace(/(\S)\s*--\s*(\S)/g, function (m, a, b, idx) {
      changes.push({ category: "Dash cleanup", before: "--", after: ",", context: contextSnippet(text, idx, m.length) });
      return a + ", " + b;
    });
    /* No comma directly before closing punctuation. */
    text = text.replace(/,\s*([.,;:!?])/g, "$1");
    return text;
  }

  /* A visible pictographic character: something a reader can see. Digits,
     "#" and "*" are keycap bases and are deliberately NOT here, because they
     are only emoji when a keycap follows them. */
  function isPictographic(cp) {
    return (cp >= 0x1f000 && cp <= 0x1faff) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      (cp >= 0x2b00 && cp <= 0x2bff);
  }

  /* Length in codepoints of the emoji sequence starting at index i, or 0.
     A sequence is a visible base plus everything bound to it: presentation
     selectors, skin-tone modifiers, keycaps, tag runs, and ZWJ links to
     further visible bases. */
  function emojiSequenceLength(cps, i) {
    var j;
    /* keycap: digit or # or *, an optional VS16, then the enclosing keycap */
    if ((cps[i] >= 0x30 && cps[i] <= 0x39) || cps[i] === 0x23 || cps[i] === 0x2a) {
      j = i + 1;
      if (cps[j] === 0xfe0f) j++;
      return cps[j] === 0x20e3 ? j + 1 - i : 0;
    }
    if (!isPictographic(cps[i])) return 0;
    j = i + 1;
    for (;;) {
      var c = cps[j];
      if (c === undefined) break;
      if (c === 0xfe0e || c === 0xfe0f || c === 0x20e3) { j++; continue; }
      if (c >= 0xe0020 && c <= 0xe007f) { j++; continue; }
      if (c === 0x200d && isPictographic(cps[j + 1])) { j += 2; continue; }
      break;
    }
    return j - i;
  }

  /* Remove whole emoji sequences, never individual codepoints (FR-U24).
     The old implementation matched U+200D and U+FE0F as bare characters,
     which deleted the orthographic joiner out of Devanagari clusters such as
     ka + virama + ZWJ + ssa and logged it as "Emoji removal" (defect D3).
     Matching sequences is a correctness dependency of the artifact pass, not
     tidy-up: once that pass preserves emoji glue, a removeEmojis that still
     deleted joiners one at a time would either strand them or go on
     destroying Devanagari. This function owns visible emoji; the artifact
     pass owns invisible carriers; neither claims a codepoint alone that the
     other would claim (FR-U24a). */
  function removeEmojis(text, changes) {
    var cps = [];
    var offs = [];
    for (var i = 0; i < text.length; ) {
      var cp = text.codePointAt(i);
      cps.push(cp);
      offs.push(i);
      i += cp > 0xffff ? 2 : 1;
    }
    var out = "";
    var count = 0;
    var n = 0;
    while (n < cps.length) {
      var len = emojiSequenceLength(cps, n);
      if (len > 0) {
        count++;
        n += len;
        continue;
      }
      out += String.fromCodePoint(cps[n]);
      n++;
    }
    if (count > 0) {
      changes.push({ category: "Emoji removal", before: count + " emoji(s)", after: "(removed)", context: "" });
    }
    /* tidy space left behind */
    return out.replace(/ {2,}/g, " ").replace(/ +([.,;:!?])/g, "$1");
  }

  /* ------------------------------------------------------------------ */
  /* Flagging (auto fix not safe, needs a human)                          */
  /* ------------------------------------------------------------------ */

  function collectFlags(text, config) {
    var flags = [];
    var s = config.settings || {};

    /* flag words */
    var fw = config.flagWords || [];
    for (var i = 0; i < fw.length; i++) {
      var re = new RegExp("\\b" + escapeRegex(fw[i].find).replace(/'/g, "['’]") + "\\b", "gi");
      var m;
      while ((m = re.exec(text)) !== null) {
        flags.push({
          type: "Word choice",
          excerpt: contextSnippet(text, m.index, m[0].length),
          found: m[0],
          reason: fw[i].reason,
          suggestion: fw[i].suggestion
        });
      }
    }

    var sentences = splitSentences(text);
    var maxWords = s.maxSentenceWords || 28;

    for (var j = 0; j < sentences.length; j++) {
      var sent = sentences[j];
      if (/^#{1,6}\s/.test(sent)) continue;
      var wc = words(sent).length;

      if (wc > maxWords) {
        flags.push({
          type: "Long sentence",
          excerpt: sent.length > 160 ? sent.slice(0, 160) + "…" : sent,
          found: wc + " words",
          reason: "Hard to follow for non native readers",
          suggestion: "Split into two or three short sentences, one idea each"
        });
      }

      if (s.flagPassiveVoice) {
        var pm = sent.match(/\b(am|is|are|was|were|been|being|be)\s+(\w+(?:ed|wn|en))\b(\s+by\b)?/i);
        if (pm && !/\b(is|are|was|were)\s+(based|located|named|called|designed|used|expected|required|needed|allowed|limited)\b/i.test(pm[0]) || (pm && pm[3])) {
          flags.push({
            type: "Passive voice",
            excerpt: sent.length > 160 ? sent.slice(0, 160) + "…" : sent,
            found: pm[0],
            reason: "Passive voice hides who does the action",
            suggestion: "Rewrite with the actor first: who does what"
          });
        }
      }

      if (s.flagSemicolons && sent.indexOf(";") !== -1) {
        flags.push({
          type: "Semicolon",
          excerpt: sent.length > 160 ? sent.slice(0, 160) + "…" : sent,
          found: ";",
          reason: "Semicolons make sentences feel complex",
          suggestion: "Split into two sentences, or use a comma with 'and' or 'but'"
        });
      }
    }

    /* long paragraphs */
    var maxParaSents = s.maxParagraphSentences || 6;
    var paras = text.split(/\n\s*\n/);
    for (var k = 0; k < paras.length; k++) {
      if (/^\s*#/.test(paras[k])) continue;
      var ps = splitSentences(paras[k]);
      if (ps.length > maxParaSents) {
        flags.push({
          type: "Long paragraph",
          excerpt: paras[k].slice(0, 120).replace(/\s+/g, " ") + "…",
          found: ps.length + " sentences",
          reason: "Dense blocks are hard to scan",
          suggestion: "Break into two paragraphs, or pull key items into a short list"
        });
      }
      /* repeated two word sentence openers inside one paragraph */
      var starters = {};
      for (var q = 0; q < ps.length; q++) {
        var ww = words(ps[q]);
        if (ww.length < 2) continue;
        var first = (ww[0] + " " + ww[1]).toLowerCase();
        starters[first] = (starters[first] || 0) + 1;
      }
      for (var key in starters) {
        if (starters[key] >= 3) {
          flags.push({
            type: "Repetitive rhythm",
            excerpt: paras[k].slice(0, 120).replace(/\s+/g, " ") + "…",
            found: starters[key] + " sentences start with \"" + key + "\"",
            reason: "Uniform sentence openings read as machine written",
            suggestion: "Vary the sentence openings in this paragraph"
          });
        }
      }
    }

    /* too many sentences starting with the same connective */
    var alsoCount = (text.match(/(^|[.!?]\s+)(Also|However|So),?\s/g) || []).length;
    if (alsoCount >= 3) {
      flags.push({
        type: "Repetitive rhythm",
        excerpt: alsoCount + " sentences start with a connective (Also / However / So)",
        found: alsoCount + " occurrences",
        reason: "Stacked connectives read as machine written",
        suggestion: "Remove most of them; short direct sentences rarely need a connective"
      });
    }

    /* repetitive markdown headings */
    var headings = text.match(/^#{1,6}\s+.*$/gm) || [];
    var headFirst = {};
    for (var h = 0; h < headings.length; h++) {
      var hw = (words(headings[h].replace(/^#+\s+/, ""))[0] || "").toLowerCase();
      if (hw) headFirst[hw] = (headFirst[hw] || 0) + 1;
    }
    for (var hk in headFirst) {
      if (headFirst[hk] >= 3) {
        flags.push({
          type: "Repetitive headings",
          excerpt: headFirst[hk] + " headings start with \"" + hk + "\"",
          found: hk,
          reason: "Repeated heading patterns look templated",
          suggestion: "Rewrite headings so each one states its section's point"
        });
      }
    }

    return flags;
  }

  /* ------------------------------------------------------------------ */
  /* Invisible Unicode artifacts                                          */
  /* ------------------------------------------------------------------ */

  /* Ported from guillaumemeyer/watermarks-remover (MIT licence),
     service/scripts/text_unicode.py at v0.5.0. This is a port, not a
     dependency: no code is loaded at runtime and nothing here calls out.
     Requirement: docs/req-unicode-artifacts.md (FR-U1 to FR-U54).

     Tables checked against Unicode 15.1, 2026-08-24. RE-CHECK ON VERSION
     BUMPS. Reserved default-ignorable ranges are enumerated explicitly and
     are never derived from a category test, because assignment turns a strip
     entry into a keep-in-context case: U+180F was unassigned until Unicode 14
     made it Mongolian free variation selector 4, and a category rule would
     have deleted it. There is no category fallback at all (FR-U26), so a
     format character assigned after this date is missed rather than guessed
     at. That is the correct trade: a missed strip is a line in a panel that a
     human reads, a wrong strip is a changed word nobody noticed.

     Invisible codepoints appear here only as escape sequences. A source file
     about invisible characters that contains them cannot be reviewed. */

  var ARTIFACT_TABLE_VERSION = "unicode-15.1/2026-08-24";

  var DEFAULT_ARTIFACT_SETTINGS = {
    artifactClean: true,
    artifactNormalizeSpaces: true,
    artifactStripBidiMarks: false,
    artifactFoldConfusables: false,
    artifactScanCode: false
  };

  /* ---- strip tables ------------------------------------------------- */

  /* Zero-width family: the common edit-based carriers. */
  var ART_ZW_FAMILY = { 0x200b: 1, 0x200c: 1, 0x200d: 1, 0x2060: 1, 0xfeff: 1, 0x180e: 1 };

  /* Directional format controls. */
  var ART_BIDI = {
    0x061c: 1, 0x200e: 1, 0x200f: 1,
    0x202a: 1, 0x202b: 1, 0x202c: 1, 0x202d: 1, 0x202e: 1,
    0x2066: 1, 0x2067: 1, 0x2068: 1, 0x2069: 1
  };
  /* Marks and isolates are legitimate in mixed-direction prose. Overrides
     (LRO, RLO) and unpaired embeddings are not, and are always stripped. */
  var ART_BIDI_PRESERVABLE = { 0x061c: 1, 0x200e: 1, 0x200f: 1, 0x2066: 1, 0x2067: 1, 0x2068: 1, 0x2069: 1 };

  var ART_MONGOLIAN_FVS = { 0x180b: 1, 0x180c: 1, 0x180d: 1, 0x180f: 1 };
  var ART_KHMER_VOWELS = { 0x17b4: 1, 0x17b5: 1 };
  var ART_HANGUL_FILLERS = { 0x115f: 1, 0x1160: 1, 0x3164: 1, 0xffa0: 1 };

  /* Cf and filler characters that are invisible but not directional and not
     zero-width joiners: soft hyphen, combining grapheme joiner, the invisible
     maths operators, the deprecated shaping controls, interlinear annotation,
     and the same-script fillers above. */
  var ART_FORMAT = {
    0x00ad: 1, 0x034f: 1,
    0x2061: 1, 0x2062: 1, 0x2063: 1, 0x2064: 1,
    0x206a: 1, 0x206b: 1, 0x206c: 1, 0x206d: 1, 0x206e: 1, 0x206f: 1,
    0xfff9: 1, 0xfffa: 1, 0xfffb: 1
  };

  /* Arabic and Syriac orthography, never carriers. */
  var ART_ORTHOGRAPHIC = {
    0x0600: 1, 0x0601: 1, 0x0602: 1, 0x0603: 1, 0x0604: 1, 0x0605: 1,
    0x06dd: 1, 0x070f: 1, 0x08e2: 1, 0x110bd: 1, 0x110cd: 1
  };

  /* Format controls that visibly govern how their own script renders:
     Egyptian hieroglyph quadrat controls, Duployan shorthand overlaps, and
     musical beams, ties and slurs. Body text next to their own script,
     contraband floating between unrelated characters. */
  var ART_LAYOUT_CF = [
    { from: 0x13430, to: 0x1343f, scriptFrom: 0x13000, scriptTo: 0x143ff },
    { from: 0x1bca0, to: 0x1bca3, scriptFrom: 0x1bc00, scriptTo: 0x1bca3 },
    { from: 0x1d173, to: 0x1d17a, scriptFrom: 0x1d100, scriptTo: 0x1d1ff }
  ];

  /* Spaces that look like, or stand in for, U+0020. */
  var ART_SPACES = {
    0x00a0: " ", 0x1680: " ",
    0x2000: " ", 0x2001: " ", 0x2002: " ", 0x2003: " ", 0x2004: " ",
    0x2005: " ", 0x2006: " ", 0x2007: " ", 0x2008: " ", 0x2009: " ", 0x200a: " ",
    0x202f: " ", 0x205f: " ", 0x3000: " "
  };

  /* Cyrillic and fullwidth Latin lookalikes. Off by default: folding these
     turns genuine Russian into mojibake. */
  var ART_CONFUSABLES = (function () {
    var map = {
      0x0410: "A", 0x0412: "B", 0x0415: "E", 0x041a: "K", 0x041c: "M", 0x041d: "H",
      0x041e: "O", 0x0420: "P", 0x0421: "C", 0x0422: "T", 0x0425: "X",
      0x0430: "a", 0x0435: "e", 0x043e: "o", 0x0440: "p", 0x0441: "c",
      0x0443: "y", 0x0445: "x", 0x0456: "i"
    };
    var upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var lower = "abcdefghijklmnopqrstuvwxyz";
    for (var i = 0; i < 26; i++) {
      map[0xff21 + i] = upper.charAt(i);
      map[0xff41 + i] = lower.charAt(i);
    }
    return map;
  })();

  /* The 66 noncharacters. Permanently prohibited in interchange and
     permanently unassignable, so stripping carries no future-Unicode risk. */
  function artIsNoncharacter(cp) {
    return (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe;
  }

  /* Unassigned codepoints with Other_Default_Ignorable_Code_Point=Yes.
     Explicit ranges, per FR-U13. */
  function artIsReservedIgnorable(cp) {
    return cp === 0x2065 || cp === 0xe0000 ||
      (cp >= 0xfff0 && cp <= 0xfff8) ||
      (cp >= 0xe0080 && cp <= 0xe00ff) ||
      (cp >= 0xe01f0 && cp <= 0xe0fff);
  }

  function artIsPrivateUse(cp) {
    return (cp >= 0xe000 && cp <= 0xf8ff) ||
      (cp >= 0xf0000 && cp <= 0xffffd) ||
      (cp >= 0x100000 && cp <= 0x10fffd);
  }

  /* C0 and C1 controls except tab, newline and carriage return (FR-U12). */
  function artIsControl(cp) {
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return false;
    return cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f);
  }

  function artIsTagChar(cp) { return cp >= 0xe0001 && cp <= 0xe007f; }
  function artIsVariationSelector(cp) {
    return (cp >= 0xfe00 && cp <= 0xfe0f) ||
      (cp >= 0xe0100 && cp <= 0xe01ef) ||
      ART_MONGOLIAN_FVS[cp] === 1;
  }

  /* Which of the eleven kinds this codepoint belongs to, or null when it is
     not a carrier at all. Order matters: the narrower classes come first. */
  function artifactKind(cp, settings) {
    if (artIsControl(cp)) return "control";
    if (artIsTagChar(cp)) return "tag_chars";
    if (artIsNoncharacter(cp)) return "noncharacter";
    if (artIsReservedIgnorable(cp)) return "reserved_ignorable";
    if (artIsVariationSelector(cp)) return "variation_selector";
    if (ART_BIDI[cp] === 1) return "bidi";
    if (ART_ZW_FAMILY[cp] === 1) return "zwj_family";
    if (artIsPrivateUse(cp)) return "private_use";
    if (ART_FORMAT[cp] === 1 || ART_KHMER_VOWELS[cp] === 1 || ART_HANGUL_FILLERS[cp] === 1) return "format";
    /* Orthographic Cf and the visible-layout controls are carriers only in
       the sense that they are invisible and must be accounted for. They enter
       the taxonomy here so their keep rules in artDecide are reachable and
       testable, and so the panel can show that the tool knows the difference.
       The source project reaches them through a category-Cf fallback, which
       FR-U26 forbids; without this line both keep rules would be dead code
       and the layout controls would never be stripped when they float free
       of their own script, which is the case the source calls contraband. */
    if (ART_ORTHOGRAPHIC[cp] === 1) return "format";
    for (var li = 0; li < ART_LAYOUT_CF.length; li++) {
      if (cp >= ART_LAYOUT_CF[li].from && cp <= ART_LAYOUT_CF[li].to) return "format";
    }
    if (ART_SPACES[cp] !== undefined) return "space";
    /* Confusables are a carrier class only when folding is on. Reporting
       every Cyrillic letter in a Russian document would bury the panel in
       thousands of rows that say nothing. */
    if (settings.artifactFoldConfusables && ART_CONFUSABLES[cp] !== undefined) return "confusable";
    return null;
  }

  /* ---- script tests for the keep rules ------------------------------ */

  /* Broad script groups where ZWJ and ZWNJ carry orthographic meaning. The
     source consults unicodedata for a letter-or-mark test. FR-U26 forbids a
     category lookup here, so the block range alone decides. That keeps more
     than the source does, which is the correct direction: an extra keep is a
     reported line, an extra strip is a silently altered word. */
  function artJoiningScript(cp) {
    if (cp >= 0x0600 && cp <= 0x08ff) return "arabic";
    if (cp >= 0x0900 && cp <= 0x0dff) return "indic";
    if (cp >= 0x0f00 && cp <= 0x109f) return "south-asian";
    if (cp >= 0x1780 && cp <= 0x17ff) return "khmer";
    if (cp >= 0x1800 && cp <= 0x18af) return "mongolian";
    return null;
  }

  function artIsCjkIdeograph(cp) {
    return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x323af);
  }
  function artIsMongolianBase(cp) { return cp >= 0x1800 && cp <= 0x18af; }
  function artIsKhmerBase(cp) { return cp >= 0x1780 && cp <= 0x17ff; }
  function artIsHangulJamo(cp) {
    return (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0xa960 && cp <= 0xa97c) ||
      (cp >= 0xd7b0 && cp <= 0xd7c6) || (cp >= 0x3131 && cp <= 0x318e) ||
      (cp >= 0xffa1 && cp <= 0xffdc);
  }

  /* Characters that can start or continue an emoji sequence. Shared with
     removeEmojis so the two functions cannot drift apart (FR-U24a). */
  function artIsEmojiBase(cp) {
    if (cp >= 0x1f000 && cp <= 0x1faff) return true;
    if (cp >= 0x2190 && cp <= 0x25ff) return true;
    if (cp >= 0x2600 && cp <= 0x27bf) return true;
    if (cp >= 0x2b00 && cp <= 0x2bff) return true;
    if (cp === 0x203c || cp === 0x2049 || cp === 0x2139 || cp === 0x2934 || cp === 0x2935) return true;
    if (cp === 0x00a9 || cp === 0x00ae || cp === 0x2122 ||
        cp === 0x3030 || cp === 0x303d || cp === 0x3297 || cp === 0x3299) return true;
    /* keycap bases */
    return cp === 0x0023 || cp === 0x002a || (cp >= 0x0030 && cp <= 0x0039);
  }

  function artIsEmojiGlue(cp) { return cp === 0x200d || cp === 0xfe0e || cp === 0xfe0f; }

  /* Glue never advances the previous-base pointer (FR-U19), so a ZWJ chain or
     a tag run stays anchored to the character that opened it. Without this a
     three-person family emoji fails on its second joiner. */
  function artIsGlue(cp) {
    return artIsEmojiGlue(cp) || artIsVariationSelector(cp) ||
      cp === 0x200c || cp === 0x200d ||
      (cp >= 0xe0020 && cp <= 0xe007f) ||
      ART_MONGOLIAN_FVS[cp] === 1 || ART_KHMER_VOWELS[cp] === 1 || ART_HANGUL_FILLERS[cp] === 1;
  }

  /* ---- whole-text passes that the per-codepoint decision needs ------- */

  /* UTF-16 offsets of tag characters inside a COMPLETE subdivision flag
     sequence: U+1F3F4, a run of tag characters, terminated by U+E007F.
     A lone tag character is never part of one. */
  function artFlagTagOffsets(text) {
    var valid = {};
    var cps = [];
    var offs = [];
    for (var i = 0; i < text.length; ) {
      var cp = text.codePointAt(i);
      cps.push(cp);
      offs.push(i);
      i += cp > 0xffff ? 2 : 1;
    }
    var k = 0;
    while (k < cps.length) {
      if (cps[k] !== 0x1f3f4) { k++; continue; }
      var j = k + 1;
      while (j < cps.length && cps[j] >= 0xe0020 && cps[j] <= 0xe007e) j++;
      if (j > k + 1 && j < cps.length && cps[j] === 0xe007f) {
        for (var m = k + 1; m <= j; m++) valid[offs[m]] = 1;
        k = j + 1;
      } else {
        k++;
      }
    }
    return valid;
  }

  /* UTF-16 offsets belonging to a balanced LRE/RLE ... PDF pair. Overrides
     (LRO, RLO) open a frame on the stack so they consume their PDF, but are
     never themselves valid. */
  function artBidiPairOffsets(text) {
    var valid = {};
    var stack = [];
    for (var i = 0; i < text.length; ) {
      var cp = text.codePointAt(i);
      if (cp === 0x202a || cp === 0x202b || cp === 0x202d || cp === 0x202e) {
        stack.push({ cp: cp, at: i });
      } else if (cp === 0x202c && stack.length) {
        var opener = stack.pop();
        if (opener.cp === 0x202a || opener.cp === 0x202b) {
          valid[opener.at] = 1;
          valid[i] = 1;
        }
      }
      i += cp > 0xffff ? 2 : 1;
    }
    return valid;
  }

  /* Fenced and inline code spans, as UTF-16 ranges. Computed from the
     backtick delimiters only. Those are ASCII and cannot themselves be
     defeated by a zero-width character, so running this before the
     classifier is safe (FR-U22). Deliberately NOT protectedRanges: terms,
     URLs and emails are matched after the pass so that they see clean text. */
  function artCodeRanges(text) {
    var ranges = [];
    var res = [/```[\s\S]*?```/g, /`[^`\n]+`/g];
    for (var r = 0; r < res.length; r++) {
      var re = res[r];
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        ranges.push([m.index, m.index + m[0].length]);
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    return ranges;
  }

  function artInRanges(ranges, at) {
    for (var i = 0; i < ranges.length; i++) {
      if (at >= ranges[i][0] && at < ranges[i][1]) return true;
    }
    return false;
  }

  /* ---- the single decision function --------------------------------- */

  /* Called by BOTH inspectArtifacts and cleanArtifacts (FR-U6). The source
     project has its inspect step running with strip_bidi on while its clean
     step defaults it off, so it reports findings its own default clean will
     not remove. One function decides here, and a panel that disagrees with
     the Changes tab is therefore impossible.

     Keep rules are evaluated BEFORE the strip test (FR-U18): a codepoint in a
     strip class survives when it is load-bearing, and when a keep rule and a
     strip class disagree the keep rule wins. */
  function artDecide(cp, ctx, settings) {
    var kind = artifactKind(cp, settings);

    /* Controls are removed before anything else, including inside code
       (FR-U16). protect() stashes spans as NUL + index + NUL and guardText
       marks abbreviations with U+0001, so a literal U+0000 in the input can
       corrupt a vault restore. Taking controls out in front of protect()
       makes that unreachable. This is the one keep rule that never applies. */
    if (kind === "control") {
      return { action: "strip", replacement: "", kind: kind, keptBecause: null };
    }
    if (kind === null) return null;

    /* Reported, never modified: an article ABOUT invisible characters must
       survive its own subject matter (FR-U21). */
    if (ctx.inCode && !settings.artifactScanCode) {
      return { action: "keep", replacement: null, kind: kind, keptBecause: "in-code" };
    }

    var prevIn = ctx.prevInput, nextIn = ctx.nextInput, prevKept = ctx.prevKept;

    if (!settings.artifactStripBidiMarks) {
      if (ctx.pairedBidi) return { action: "keep", replacement: null, kind: kind, keptBecause: "paired-bidi" };
      if (ART_BIDI_PRESERVABLE[cp] === 1) {
        return { action: "keep", replacement: null, kind: kind, keptBecause: "paired-bidi" };
      }
    }

    /* Variation selectors after a base from the matching script. */
    if (prevIn !== null) {
      if (cp >= 0xe0100 && cp <= 0xe01ef && artIsCjkIdeograph(prevIn)) {
        return { action: "keep", replacement: null, kind: kind, keptBecause: "same-script-base" };
      }
      if (ART_MONGOLIAN_FVS[cp] === 1 && artIsMongolianBase(prevIn)) {
        return { action: "keep", replacement: null, kind: kind, keptBecause: "same-script-base" };
      }
      if (cp >= 0xfe00 && cp <= 0xfe0d && artIsCjkIdeograph(prevIn)) {
        return { action: "keep", replacement: null, kind: kind, keptBecause: "same-script-base" };
      }
    }

    /* Emoji glue. VS15 and VS16 look back one input character; ZWJ needs an
       emoji base on both sides, and looks back at the last non-glue base so
       a multi-person sequence holds together. */
    if (artIsEmojiGlue(cp)) {
      if ((cp === 0xfe0e || cp === 0xfe0f) && prevIn !== null && artIsEmojiBase(prevIn)) {
        return { action: "keep", replacement: null, kind: kind, keptBecause: "emoji-glue" };
      }
      if (cp === 0x200d && prevKept !== null && nextIn !== null &&
          artIsEmojiBase(prevKept) && artIsEmojiBase(nextIn)) {
        return { action: "keep", replacement: null, kind: kind, keptBecause: "emoji-glue" };
      }
    }

    /* ZWNJ and ZWJ are orthography inside complex scripts: Persian mi-rawam,
       the Devanagari ka-virama-ZWJ-ssa cluster. This is the D3 fix. */
    if ((cp === 0x200c || cp === 0x200d) && prevIn !== null && nextIn !== null) {
      var ps = artJoiningScript(prevIn);
      var ns = artJoiningScript(nextIn);
      if (ps !== null && ps === ns) {
        return { action: "keep", replacement: null, kind: kind, keptBecause: "script-joiner" };
      }
    }

    if (cp >= 0xe0020 && cp <= 0xe007f && ctx.flagTag) {
      return { action: "keep", replacement: null, kind: kind, keptBecause: "flag-sequence" };
    }
    if (ART_MONGOLIAN_FVS[cp] === 1 && prevKept !== null && artIsMongolianBase(prevKept)) {
      return { action: "keep", replacement: null, kind: kind, keptBecause: "same-script-base" };
    }
    if (ART_KHMER_VOWELS[cp] === 1 && prevKept !== null && artIsKhmerBase(prevKept)) {
      return { action: "keep", replacement: null, kind: kind, keptBecause: "same-script-base" };
    }
    if (ART_HANGUL_FILLERS[cp] === 1 && prevKept !== null && artIsHangulJamo(prevKept)) {
      return { action: "keep", replacement: null, kind: kind, keptBecause: "same-script-base" };
    }
    if (ART_ORTHOGRAPHIC[cp] === 1) {
      return { action: "keep", replacement: null, kind: kind, keptBecause: "orthographic" };
    }
    for (var i = 0; i < ART_LAYOUT_CF.length; i++) {
      var lc = ART_LAYOUT_CF[i];
      if (cp < lc.from || cp > lc.to) continue;
      var near = (prevIn !== null && prevIn >= lc.scriptFrom && prevIn <= lc.scriptTo) ||
                 (nextIn !== null && nextIn >= lc.scriptFrom && nextIn <= lc.scriptTo);
      if (near) return { action: "keep", replacement: null, kind: kind, keptBecause: "layout-control" };
    }

    if (kind === "space") {
      return settings.artifactNormalizeSpaces
        ? { action: "replace", replacement: ART_SPACES[cp], kind: kind, keptBecause: null }
        : { action: "keep", replacement: null, kind: kind, keptBecause: null };
    }
    if (kind === "confusable") {
      /* artifactFoldConfusables is what made this a carrier class at all,
         so reaching here means folding is on. */
      return { action: "replace", replacement: ART_CONFUSABLES[cp], kind: kind, keptBecause: null };
    }
    return { action: "strip", replacement: "", kind: kind, keptBecause: null };
  }

  /* ---- confidence ---------------------------------------------------- */

  /* Broad script of a word character, for FR-U4. Unknown returns null, which
     downgrades to informational: the quieter answer when we cannot tell. */
  function artWordScript(cp) {
    if ((cp >= 0x0041 && cp <= 0x005a) || (cp >= 0x0061 && cp <= 0x007a) ||
        (cp >= 0x00c0 && cp <= 0x024f)) return "latin";
    if (cp >= 0x0030 && cp <= 0x0039) return "latin";
    if (cp >= 0x0370 && cp <= 0x03ff) return "greek";
    if (cp >= 0x0400 && cp <= 0x04ff) return "cyrillic";
    if (cp >= 0x0590 && cp <= 0x05ff) return "hebrew";
    var joining = artJoiningScript(cp);
    if (joining !== null) return joining;
    if (artIsCjkIdeograph(cp)) return "cjk";
    return null;
  }

  /* FR-U3 and FR-U4. Kinds with no legitimate use in running prose are
     confirmed; everything else, and every keep, is informational. */
  function artConfidence(cp, decision, ctx) {
    if (decision.action === "keep") return "informational";
    if (decision.kind === "tag_chars" || decision.kind === "noncharacter" ||
        decision.kind === "reserved_ignorable" || decision.kind === "private_use" ||
        decision.kind === "control") return "confirmed";
    if (decision.kind === "bidi") {
      /* An override, or an embedding that never found its PDF. */
      return "confirmed";
    }
    if (decision.kind === "zwj_family" || decision.kind === "format") {
      /* A carrier between two word characters of the same script is inside a
         word, and a zero-width character inside a word is not a paste
         artefact. At a boundary it usually is, so say so more quietly. */
      if (ctx.prevInput !== null && ctx.nextInput !== null) {
        var ps = artWordScript(ctx.prevInput);
        var ns = artWordScript(ctx.nextInput);
        if (ps !== null && ps === ns) return "confirmed";
      }
      return "informational";
    }
    return "informational";
  }

  /* ---- labels and context ------------------------------------------- */

  var ART_NAMES = {
    0x0000: "NULL", 0x0001: "START OF HEADING", 0x0007: "BELL", 0x0008: "BACKSPACE",
    0x000b: "LINE TABULATION", 0x000c: "FORM FEED", 0x001b: "ESCAPE", 0x007f: "DELETE",
    0x00a0: "NO-BREAK SPACE", 0x00ad: "SOFT HYPHEN", 0x034f: "COMBINING GRAPHEME JOINER",
    0x061c: "ARABIC LETTER MARK", 0x115f: "HANGUL CHOSEONG FILLER",
    0x1160: "HANGUL JUNGSEONG FILLER", 0x1680: "OGHAM SPACE MARK",
    0x17b4: "KHMER VOWEL INHERENT AQ", 0x17b5: "KHMER VOWEL INHERENT AA",
    0x180b: "MONGOLIAN FREE VARIATION SELECTOR ONE",
    0x180c: "MONGOLIAN FREE VARIATION SELECTOR TWO",
    0x180d: "MONGOLIAN FREE VARIATION SELECTOR THREE",
    0x180e: "MONGOLIAN VOWEL SEPARATOR",
    0x180f: "MONGOLIAN FREE VARIATION SELECTOR FOUR",
    0x200b: "ZERO WIDTH SPACE", 0x200c: "ZERO WIDTH NON-JOINER",
    0x200d: "ZERO WIDTH JOINER", 0x200e: "LEFT-TO-RIGHT MARK",
    0x200f: "RIGHT-TO-LEFT MARK",
    0x202a: "LEFT-TO-RIGHT EMBEDDING", 0x202b: "RIGHT-TO-LEFT EMBEDDING",
    0x202c: "POP DIRECTIONAL FORMATTING", 0x202d: "LEFT-TO-RIGHT OVERRIDE",
    0x202e: "RIGHT-TO-LEFT OVERRIDE", 0x202f: "NARROW NO-BREAK SPACE",
    0x2060: "WORD JOINER", 0x2061: "FUNCTION APPLICATION",
    0x2062: "INVISIBLE TIMES", 0x2063: "INVISIBLE SEPARATOR", 0x2064: "INVISIBLE PLUS",
    0x2065: "RESERVED DEFAULT-IGNORABLE",
    0x2066: "LEFT-TO-RIGHT ISOLATE", 0x2067: "RIGHT-TO-LEFT ISOLATE",
    0x2068: "FIRST STRONG ISOLATE", 0x2069: "POP DIRECTIONAL ISOLATE",
    0x205f: "MEDIUM MATHEMATICAL SPACE", 0x3000: "IDEOGRAPHIC SPACE",
    0x3164: "HANGUL FILLER", 0xfeff: "ZERO WIDTH NO-BREAK SPACE (BOM)",
    0xffa0: "HALFWIDTH HANGUL FILLER",
    0xfff9: "INTERLINEAR ANNOTATION ANCHOR", 0xfffa: "INTERLINEAR ANNOTATION SEPARATOR",
    0xfffb: "INTERLINEAR ANNOTATION TERMINATOR",
    0xe0001: "LANGUAGE TAG", 0xe007f: "CANCEL TAG"
  };

  /* No unicodedata in the browser, so names come from a table for the
     codepoints worth naming and are derived from the range otherwise. */
  function artLabel(cp, kind) {
    if (ART_NAMES[cp]) return ART_NAMES[cp];
    if (cp >= 0x2000 && cp <= 0x200a) return "EN/EM SPACE VARIANT";
    if (cp >= 0x206a && cp <= 0x206f) return "DEPRECATED FORMAT CHARACTER";
    if (cp >= 0xe0020 && cp <= 0xe007e) {
      return "TAG " + JSON.stringify(String.fromCharCode(cp - 0xe0000));
    }
    if (kind === "tag_chars") return "TAG CHARACTER";
    if (cp >= 0xfe00 && cp <= 0xfe0f) return "VARIATION SELECTOR-" + (cp - 0xfe00 + 1);
    if (cp >= 0xe0100 && cp <= 0xe01ef) return "VARIATION SELECTOR-" + (cp - 0xe0100 + 17);
    if (kind === "noncharacter") return "NONCHARACTER";
    if (kind === "reserved_ignorable") return "RESERVED DEFAULT-IGNORABLE";
    if (kind === "private_use") return "PRIVATE USE CHARACTER";
    if (kind === "confusable") return "LATIN LOOKALIKE";
    if (kind === "control") return "CONTROL CHARACTER";
    return "FORMAT CHARACTER";
  }

  /* A short excerpt with the position marked, for the panel. Any other
     carrier inside the window is dropped, so the excerpt is readable. */
  function artContext(text, at, len, settings) {
    var from = Math.max(0, at - 12);
    var to = Math.min(text.length, at + len + 12);
    function visible(s) {
      var out = "";
      for (var ch of s) {
        var cp = ch.codePointAt(0);
        if (artifactKind(cp, settings) === null || cp === 0x20) out += ch;
      }
      return out.replace(/\n/g, " ");
    }
    return visible(text.slice(from, at)) + "|" + visible(text.slice(at + len, to));
  }

  /* ---- settings ------------------------------------------------------ */

  /* Missing keys fall back to the defaults, never to undefined (FR-U28), so
     a config exported before this feature still loads. Accepts either a
     settings object or a whole config. */
  function artifactSettings(source) {
    var s = source || {};
    if (s.settings && typeof s.settings === "object") s = s.settings;
    var out = {};
    for (var k in DEFAULT_ARTIFACT_SETTINGS) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_ARTIFACT_SETTINGS, k)) continue;
      out[k] = (s[k] === undefined || s[k] === null) ? DEFAULT_ARTIFACT_SETTINGS[k] : !!s[k];
    }
    return out;
  }

  /* ---- the single walk ----------------------------------------------- */

  /* One pass over the codepoints, producing the artifact list and, when
     asked, the cleaned text. inspectArtifacts and cleanArtifacts both come
     out of here so they can never disagree (FR-U6).

     Iterates by codepoint and tracks the UTF-16 index alongside (FR-U7,
     FR-U8): every carrier above U+FFFF is a surrogate pair in a JS string,
     and a code-unit loop would split it. Offsets are UTF-16 indices into the
     ORIGINAL text so they stay usable by sentenceSpans, protectedRanges,
     replaceNth and the existing mark rendering. */
  function artScan(text, settings, buildText) {
    text = String(text === undefined || text === null ? "" : text);
    var flagTags = artFlagTagOffsets(text);
    var bidiPairs = artBidiPairOffsets(text);
    var codeRanges = settings.artifactScanCode ? [] : artCodeRanges(text);

    /* Codepoints and their UTF-16 offsets, once. */
    var cps = [];
    var offs = [];
    for (var i = 0; i < text.length; ) {
      var cp = text.codePointAt(i);
      cps.push(cp);
      offs.push(i);
      i += cp > 0xffff ? 2 : 1;
    }

    var artifacts = [];
    var out = buildText ? [] : null;
    var removed = 0;
    var replaced = 0;
    var prevKept = null;

    for (var n = 0; n < cps.length; n++) {
      var c = cps[n];
      var at = offs[n];
      var width = c > 0xffff ? 2 : 1;
      var ch = String.fromCodePoint(c);
      var ctx = {
        prevInput: n > 0 ? cps[n - 1] : null,
        nextInput: n + 1 < cps.length ? cps[n + 1] : null,
        prevKept: prevKept,
        flagTag: flagTags[at] === 1,
        pairedBidi: bidiPairs[at] === 1,
        inCode: codeRanges.length ? artInRanges(codeRanges, at) : false
      };
      var d = artDecide(c, ctx, settings);

      if (d === null) {
        /* Not a carrier at all. */
        if (out) out.push(ch);
        if (!artIsGlue(c)) prevKept = c;
        continue;
      }

      artifacts.push({
        paragraph: null,
        start: at,
        end: at + width,
        cp: c,
        label: artLabel(c, d.kind),
        kind: d.kind,
        action: d.action,
        replacement: d.action === "strip" ? "" : (d.action === "replace" ? d.replacement : ch),
        keptBecause: d.keptBecause,
        confidence: artConfidence(c, d, ctx),
        context: artContext(text, at, width, settings)
      });

      if (d.action === "strip") {
        removed++;
        /* prevKept unchanged: a removed character was never a base. */
      } else if (d.action === "replace") {
        replaced++;
        if (out) out.push(d.replacement);
        prevKept = d.replacement.codePointAt(0);
      } else {
        if (out) out.push(ch);
        if (!artIsGlue(c)) prevKept = c;
      }
    }

    return {
      text: out ? out.join("") : text,
      artifacts: artifacts,
      removed: removed,
      replaced: replaced
    };
  }

  /* Report only. Never modifies the text (FR-U5). Artifacts come back in
     ascending start order (FR-U10); unlike Findings they may be adjacent,
     and neither the non-overlap rule nor the highlight cap applies to them.
     A run of forty tag characters is forty artifacts, and the panel is
     expected to collapse the run for display rather than discard evidence. */
  function inspectArtifacts(text, settings) {
    return artScan(text, artifactSettings(settings), false).artifacts;
  }

  /* Counts for the report header and the panel. Never scored: FR-U1 forbids
     an artifact from moving score.weighted, any dimension, the band or the
     confidence, by a point or a fraction. An invisible character says
     something about a file's history, not about how the prose reads, and a
     rubric that responds to one pasted codepoint is measuring clipboards.
     Keeping the two adjacent and unweighted is what lets the report say
     "here is one thing we can prove, and separately, here is an estimate"
     instead of quietly becoming a detector. */
  function summarizeArtifacts(artifacts) {
    var kinds = {};
    var confirmed = 0, kept = 0, removed = 0, replaced = 0;
    for (var i = 0; i < artifacts.length; i++) {
      var a = artifacts[i];
      kinds[a.kind] = (kinds[a.kind] || 0) + 1;
      if (a.confidence === "confirmed") confirmed++;
      if (a.action === "keep") kept++;
      else if (a.action === "strip") removed++;
      else replaced++;
    }
    return {
      total: artifacts.length,
      confirmed: confirmed,
      kept: kept,
      removed: removed,
      replaced: replaced,
      kinds: kinds,
      tableVersion: ARTIFACT_TABLE_VERSION
    };
  }

  /* Report and apply. Strips and replaces only: never inserts, never
     reorders, never re-cases, never collapses whitespace (FR-U11). */
  function cleanArtifacts(text, settings) {
    var s = artifactSettings(settings);
    if (!s.artifactClean) {
      /* Removal off, reporting still on. A silent carrier is the failure
         mode this whole pass exists to fix, so there is no setting that
         turns the report off. */
      var report = artScan(text, s, false);
      return { text: String(text === undefined || text === null ? "" : text),
               artifacts: report.artifacts, removed: 0, replaced: 0 };
    }
    return artScan(text, s, true);
  }
  /* ------------------------------------------------------------------ */
  /* Main entry point                                                     */
  /* ------------------------------------------------------------------ */

  /* Apply all auto fixes to a piece of text. Paragraph boundaries survive. */
  function transform(input, config) {
    config = config || DEFAULT_CONFIG;
    var settings = config.settings || {};
    var changes = [];

    /* The invisible-Unicode pass runs at the very front, ahead of protect()
       and of every swap and delete list (FR-U23). The placement IS the fix:
       every dictionary in this engine is a word-boundary regex over the raw
       string, so a single U+200B inside "utilize" made the word unmatchable
       and the document came out looking processed while nothing had run
       (defect D1). Stripping controls here also closes a standing hazard,
       because protect() stashes spans as NUL + index + NUL and guardText
       marks abbreviations with U+0001, so a literal control in the input
       could corrupt a vault restore (FR-U16).

       This is the inverse of the ordering sentence splitting needs, and the
       two do not conflict: splitting runs late because it must see
       transformed text, this runs early because everything downstream must
       see clean text.

       Artifacts are reported against the ORIGINAL text offsets (FR-U25),
       because the point of an artifact is where it was before removal. */
    var art = cleanArtifacts(input, config);
    var artifacts = art.artifacts;
    if (art.removed > 0) {
      changes.push({
        category: "Invisible character",
        before: art.removed + " invisible character(s)",
        after: "(removed)",
        context: ""
      });
    }
    if (art.replaced > 0) {
      changes.push({
        category: "Invisible character",
        before: art.replaced + " non-standard space(s)",
        after: "(ordinary space)",
        context: ""
      });
    }

    var p = protect(art.text, config.protectedTerms);
    var text = p.text;

    if (settings.removeEmojis) text = removeEmojis(text, changes);
    if (settings.fixDashes) text = fixDashes(text, changes);

    text = applySentenceStartDeletes(text, config.sentenceStartDeletes || [], changes);
    text = applyMidSentenceDeletes(text, config.midSentenceDeletes || [], changes);
    text = applySwaps(text, config.fillerPhrases || [], "Filler phrase", changes);
    text = applySwaps(text, config.hypeSwaps || [], "Hype and AI wording", changes);
    text = applySwaps(text, config.simpleSwaps || [], "Simpler word", changes);
    if (settings.expandContractions) {
      text = applySwaps(text, config.contractions || [], "Contraction expanded", changes);
    }

    /* whitespace tidy inside the block, never across paragraph breaks */
    text = text.replace(/ {2,}/g, " ").replace(/ +\n/g, "\n");

    text = restore(text, p.vault);
    for (var c = 0; c < changes.length; c++) {
      changes[c].context = restore(changes[c].context || "", p.vault);
    }
    return { output: text, changes: changes, artifacts: artifacts };
  }

  /* Collect flags for human review on (usually already transformed) text. */
  function analyze(text, config) {
    config = config || DEFAULT_CONFIG;
    var p = protect(text, config.protectedTerms);
    var flags = collectFlags(p.text, config);
    for (var i = 0; i < flags.length; i++) {
      flags[i].excerpt = restore(flags[i].excerpt, p.vault);
      flags[i].found = restore(String(flags[i].found), p.vault);
    }
    return flags;
  }

  function process(input, config) {
    var before = fleschScore(input);
    var t = transform(input, config);
    var flags = analyze(t.output, config);
    var after = fleschScore(t.output);
    return {
      output: t.output,
      changes: t.changes,
      flags: flags,
      artifacts: t.artifacts,
      artifactSummary: summarizeArtifacts(t.artifacts),
      stats: {
        before: before,
        after: after,
        changeCount: t.changes.length,
        flagCount: flags.length,
        wordsSaved: before.words - after.words
      }
    };
  }

  /* Paragraph aware processing: returns 1:1 mapped original/output pairs
     so a UI can sync scroll positions at paragraph level. */
  function processDoc(input, config) {
    var normalized = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    var originals = normalized ? normalized.split(/\n\n/) : [];
    var pairs = [];
    var changes = [];
    var artifacts = [];
    for (var i = 0; i < originals.length; i++) {
      var t = transform(originals[i], config);
      for (var c = 0; c < t.changes.length; c++) {
        t.changes[c].paragraph = i;
        changes.push(t.changes[c]);
      }
      /* Offsets stay relative to this paragraph's ORIGINAL text, so the
         panel anchors to the left-hand pane (FR-U25). */
      for (var a = 0; a < t.artifacts.length; a++) {
        t.artifacts[a].paragraph = i;
        artifacts.push(t.artifacts[a]);
      }
      pairs.push({ original: originals[i], output: t.output });
    }
    var joined = pairs.map(function (x) { return x.output; }).join("\n\n");
    var flags = analyze(joined, config);
    var before = fleschScore(normalized);
    var after = fleschScore(joined);
    return {
      paragraphs: pairs,
      output: joined,
      changes: changes,
      flags: flags,
      artifacts: artifacts,
      artifactSummary: summarizeArtifacts(artifacts),
      stats: {
        before: before,
        after: after,
        changeCount: changes.length,
        flagCount: flags.length,
        wordsSaved: before.words - after.words
      }
    };
  }

  return {
    process: process,
    processDoc: processDoc,
    transform: transform,
    analyze: analyze,
    inspectArtifacts: inspectArtifacts,
    cleanArtifacts: cleanArtifacts,
    defaultArtifactSettings: DEFAULT_ARTIFACT_SETTINGS,
    artifactTableVersion: ARTIFACT_TABLE_VERSION,
    defaultConfig: DEFAULT_CONFIG,
    fleschScore: fleschScore
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MyridiusEngine;
}
