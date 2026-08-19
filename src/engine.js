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
      { find: "leverage", replace: "use" },
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
      { find: "harness", replace: "use" },
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

  function applySwaps(text, rules, category, changes) {
    /* Longest finds first so phrases beat single words. */
    var sorted = rules.slice().sort(function (a, b) { return b.find.length - a.find.length; });
    for (var i = 0; i < sorted.length; i++) {
      var rule = sorted[i];
      if (!rule.find) continue;
      var re = new RegExp("\\b" + escapeRegex(rule.find).replace(/'/g, "['’]") + "\\b", "gi");
      text = text.replace(re, function (m) {
        var offsetIdx = arguments[arguments.length - 2];
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

  function removeEmojis(text, changes) {
    var re = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{2764}]/gu;
    var count = 0;
    text = text.replace(re, function () { count++; return ""; });
    if (count > 0) {
      changes.push({ category: "Emoji removal", before: count + " emoji(s)", after: "(removed)", context: "" });
    }
    /* tidy space left behind */
    text = text.replace(/ {2,}/g, " ").replace(/ +([.,;:!?])/g, "$1");
    return text;
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
  /* Main entry point                                                     */
  /* ------------------------------------------------------------------ */

  /* Apply all auto fixes to a piece of text. Paragraph boundaries survive. */
  function transform(input, config) {
    config = config || DEFAULT_CONFIG;
    var settings = config.settings || {};
    var changes = [];

    var p = protect(input, config.protectedTerms);
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
    return { output: text, changes: changes };
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
    for (var i = 0; i < originals.length; i++) {
      var t = transform(originals[i], config);
      for (var c = 0; c < t.changes.length; c++) {
        t.changes[c].paragraph = i;
        changes.push(t.changes[c]);
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
    defaultConfig: DEFAULT_CONFIG,
    fleschScore: fleschScore
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MyridiusEngine;
}
